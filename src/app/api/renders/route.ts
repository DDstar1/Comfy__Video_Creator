import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticatedClient } from "@/lib/server/render-auth";
import { hasUnlimitedGeneration } from "@/lib/server/billing-access";
import { getVolumeObject, listChainSegments } from "@/lib/server/runpod-volume";

export const runtime = "nodejs";
export const maxDuration = 300;

const BUCKET = "comfytr-generated-videos";
const JOBS = "comfyTR_render_jobs";
const CLIPS = "comfyTR_clips";
const RENDER_RESERVE_CENTS = 59;

function finalCharge(runtimeMs: number) {
  const hourlyCents = Number(process.env.RUNPOD_GPU_RATE_CENTS_PER_HOUR ?? 58);
  const marginCents = Number(process.env.CLIPWEAVE_MARGIN_CENTS ?? 30);
  return Math.max(1, Math.ceil((runtimeMs / 3_600_000) * hourlyCents)) + marginCents;
}
const submitSchema = z.object({
  projectId: z.uuid(),
  clipId: z.uuid(),
  workflow: z.record(z.string(), z.unknown()),
  images: z
    .array(
      z.object({ name: z.string().min(1).max(255), image: z.string().min(1) }),
    )
    .max(9)
    .optional(),
});
const ALLOWED_NODES = new Set([
  "UNETLoader",
  "CLIPLoader",
  "VAELoader",
  "LoraLoaderModelOnly",
  "PrimitiveStringMultiline",
  "LoadImage",
  "MiniMaxH3PromptPackBridge",
  "MiniMaxH3ReferencePackBridge",
  "MiniMaxH3Extender",
  "MiniMaxH3MotionContextDiskFinalDecode",
]);

function assertClipWeaveWorkflow(
  workflow: Record<string, unknown>,
  clipId: string,
  images: { name: string; image: string }[],
) {
  const nodes = Object.values(workflow) as {
    class_type?: unknown;
    inputs?: Record<string, unknown>;
  }[];
  if (!nodes.length || nodes.length > 40)
    throw new Error("The assembled workflow has an invalid node count.");
  if (nodes.some((node) => !ALLOWED_NODES.has(String(node.class_type))))
    throw new Error("The assembled workflow contains an unsupported node.");
  const extender = nodes.find(
    (node) => node.class_type === "MiniMaxH3Extender",
  );
  const output = nodes.find(
    (node) => node.class_type === "MiniMaxH3MotionContextDiskFinalDecode",
  );
  if (
    !extender?.inputs ||
    extender.inputs.run_mode !== "clip_by_clip" ||
    extender.inputs.steps !== 4 ||
    extender.inputs.resolution_mode !== "manual" ||
    !output?.inputs ||
    output.inputs.output_directory !== "" ||
    output.inputs.codec !== "H.264" ||
    output.inputs.filename_prefix !== `clipweave-${clipId}`
  )
    throw new Error("The assembled workflow has unsafe generation settings.");
  const names = new Set(images.map((image) => image.name));
  for (const image of images) {
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(image.image))
      throw new Error("Reference images must be encoded image data.");
  }
  for (const node of nodes.filter((item) => item.class_type === "LoadImage"))
    if (!names.has(String(node.inputs?.image ?? "")))
      throw new Error("A workflow image is missing from the request.");
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

function runpod() {
  const key = process.env.RUNPOD_ENDPOINT_API_KEY;
  const endpoint = process.env.RUNPOD_ENDPOINT_ID;
  if (!key || !endpoint)
    throw new Error("RunPod is not configured on this deployment.");
  return { key, endpoint };
}

class RunpodRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function runpodRequest(url: string, key: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new RunpodRequestError(
      response.status,
      typeof result.error === "string"
        ? result.error
        : `RunPod request failed (${response.status}).`,
    );
  return result as Record<string, unknown>;
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Same-origin requests required." },
      { status: 403 },
    );
  try {
    const { client, user } = await authenticatedClient(request);
    const input = submitSchema.parse(await request.json());
    assertClipWeaveWorkflow(input.workflow, input.clipId, input.images ?? []);
    const { data: clip, error: clipError } = await client
      .from(CLIPS)
      .select("id,project_id,status,technical_prompt,continuity_stale")
      .eq("id", input.clipId)
      .eq("project_id", input.projectId)
      .eq("owner_id", user.id)
      .single();
    if (clipError || !clip)
      return Response.json({ error: "Clip not found." }, { status: 404 });
    if (clip.status === "validated")
      return Response.json(
        { error: "Validated clips cannot be rendered again." },
        { status: 409 },
      );
    if (!clip.technical_prompt || clip.continuity_stale)
      return Response.json(
        { error: "Compile this clip and resolve continuity before rendering." },
        { status: 409 },
      );

    // Which chain this clip belongs to decides its cache directory, so it is
    // derived here from stored order rather than trusted from the browser. A
    // clip that does not continue the previous one starts a new chain, and the
    // first clip always starts one.
    const { data: ordered, error: orderError } = await client
      .from(CLIPS)
      .select("id,continues_previous")
      .eq("project_id", input.projectId)
      .eq("owner_id", user.id)
      .order("position");
    if (orderError || !ordered?.length)
      return Response.json(
        { error: "This project's clips could not be read." },
        { status: 409 },
      );
    let chainIndex = -1;
    for (const [position, row] of ordered.entries()) {
      if (position === 0 || row.continues_previous === false) chainIndex += 1;
      if (row.id === input.clipId) break;
    }

    const cacheNamespace = `${user.id}:${input.projectId}:${chainIndex}`;
    const { data: job, error: jobError } = await client
      .from(JOBS)
      .insert({
        project_id: input.projectId,
        clip_id: input.clipId,
        owner_id: user.id,
        cache_namespace: cacheNamespace,
      })
      .select("id")
      .single();
    if (jobError)
      return Response.json(
        {
          error:
            jobError.code === "23505"
              ? "This project already has an active render."
              : jobError.message,
        },
        { status: 409 },
      );

    const reservation = hasUnlimitedGeneration(user) ? { error: null } : await client.rpc("comfyTR_reserve_render", {
      job_uuid: job.id,
      reserve_amount: RENDER_RESERVE_CENTS,
    });
    if (reservation.error) {
      await client.from(JOBS).update({ status: "cancelled", error_message: reservation.error.message }).eq("id", job.id);
      return Response.json(
        { error: reservation.error.message.includes("INSUFFICIENT_FUNDS") ? "You need at least $0.59 of available credit to start this render." : reservation.error.message },
        { status: reservation.error.message.includes("INSUFFICIENT_FUNDS") ? 402 : 409 },
      );
    }

    try {
      const { key, endpoint } = runpod();
      const result = await runpodRequest(
        `https://api.runpod.ai/v2/${endpoint}/run`,
        key,
        {
          method: "POST",
          body: JSON.stringify({
            input: {
              workflow: input.workflow,
              images: input.images ?? [],
              cache_namespace: cacheNamespace,
            },
          }),
        },
      );
      const runpodJobId = typeof result.id === "string" ? result.id : "";
      if (!runpodJobId) throw new Error("RunPod did not return a job ID.");
      const { error } = await client
        .from(JOBS)
        .update({
          runpod_job_id: runpodJobId,
          status: "queued",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (error) throw error;
      return Response.json(
        { jobId: job.id, runpodJobId, status: "queued" },
        { status: 202 },
      );
    } catch (error) {
      await client
        .from(JOBS)
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Submission failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await client.rpc("comfyTR_release_render", { job_uuid: job.id });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED")
      return Response.json(
        { error: "Sign in to render clips." },
        { status: 401 },
      );
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid render request.",
      },
      { status: error instanceof z.ZodError ? 400 : 502 },
    );
  }
}

type Artifact = {
  filename?: unknown;
  type?: unknown;
  data?: unknown;
  url?: unknown;
};

async function artifactBytes(artifact: Artifact) {
  const source =
    typeof artifact.data === "string"
      ? artifact.data
      : typeof artifact.url === "string"
        ? artifact.url
        : "";
  if (!source)
    throw new Error("RunPod completed without downloadable video data.");
  if (artifact.type === "base64")
    return Uint8Array.from(
      Buffer.from(source.replace(/^data:[^;]+;base64,/, ""), "base64"),
    );
  if (!/^https:\/\//i.test(source))
    throw new Error("RunPod returned an unsupported video artifact.");
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok)
    throw new Error("The temporary RunPod video could not be downloaded.");
  return new Uint8Array(await response.arrayBuffer());
}

type RenderJobRow = {
  id: string;
  project_id: string;
  clip_id: string;
  [key: string]: unknown;
};

function extensionAndMime(filename: string) {
  const lower = filename.toLowerCase();
  const extension = lower.endsWith(".mkv")
    ? "mkv"
    : lower.endsWith(".webm")
      ? "webm"
      : lower.endsWith(".mov")
        ? "mov"
        : "mp4";
  const mime =
    extension === "mkv"
      ? "video/x-matroska"
      : extension === "webm"
        ? "video/webm"
        : extension === "mov"
          ? "video/quicktime"
          : "video/mp4";
  return { extension, mime };
}

// Shared by a normal completed job and by direct-volume recovery, so both end
// at the same place: uploaded into the account's own storage, published, and
// settled. `runtimeMs` is 0 for a volume read, since no new GPU time was spent
// retrieving bytes that already existed -- it settles at the configured floor
// rather than the original render's true cost, which was never captured.
async function ingestVideoBytes(
  client: SupabaseClient,
  job: RenderJobRow,
  bytes: Uint8Array,
  filename: string,
  runtimeMs: number,
) {
  if (!bytes.byteLength) throw new Error("The video data was empty.");
  const { extension, mime } = extensionAndMime(filename);
  const path = `${job.owner_id}/${job.project_id}/${job.clip_id}/${crypto.randomUUID()}.${extension}`;
  const upload = await client.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (upload.error) throw upload.error;
  const published = await client.rpc("comfyTR_publish_render_result", {
    job_uuid: job.id,
    object_path: path,
    original_filename: filename,
    content_type: mime,
    content_bytes: bytes.byteLength,
  });
  if (published.error) {
    await client.storage.from(BUCKET).remove([path]);
    throw published.error;
  }
  const settlement = await client.rpc("comfyTR_settle_render", {
    job_uuid: job.id,
    charge_amount: finalCharge(runtimeMs),
    execution_ms: runtimeMs,
  });
  if (settlement.error) throw settlement.error;
  const signed = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (signed.error) throw signed.error;
  return Response.json({
    ...job,
    status: "completed",
    videoUrl: signed.data.signedUrl,
    videoStoragePath: path,
    asset: published.data,
  });
}

/**
 * Try to recover a render straight from the Network Volume, bypassing RunPod
 * entirely, when the chain is exactly one clip -- the common case, since a
 * multi-clip chain's segments need ffmpeg to join and only the worker has
 * that. Returns null when this path cannot handle it (no segments, more than
 * one, or the volume read itself failed), leaving the caller to fall back to
 * the worker's "fetch" job.
 */
async function recoverFromVolume(
  client: SupabaseClient,
  job: RenderJobRow,
  cacheNamespace: string,
) {
  try {
    const segments = await listChainSegments(cacheNamespace);
    if (segments.length !== 1) return null;
    const bytes = await getVolumeObject(segments[0]);
    return await ingestVideoBytes(client, job, bytes, segments[0].split("/").pop()!, 0);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { client, user } = await authenticatedClient(request);
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId || !z.uuid().safeParse(jobId).success)
      return Response.json(
        { error: "A valid jobId is required." },
        { status: 400 },
      );
    const { data: job, error } = await client
      .from(JOBS)
      .select("*")
      .eq("id", jobId)
      .eq("owner_id", user.id)
      .single();
    if (error || !job)
      return Response.json({ error: "Render job not found." }, { status: 404 });
    if (["completed", "failed", "cancelled"].includes(job.status))
      return Response.json(job);
    if (!job.runpod_job_id) return Response.json(job);

    const { key, endpoint } = runpod();
    let result: Record<string, unknown>;
    try {
      result = await runpodRequest(
        `https://api.runpod.ai/v2/${endpoint}/status/${encodeURIComponent(job.runpod_job_id)}`,
        key,
      );
    } catch (statusError) {
      // A finished job's own /status result is only kept for a limited window
      // (observed ~30 minutes) -- past that this 404s even though the job
      // genuinely completed. The video survives on the Network Volume as an
      // ordinary side effect of the Extender's disk cache, independent of that
      // window, so recover it there instead of treating this render as lost.
      if (statusError instanceof RunpodRequestError && statusError.status === 404 && job.cache_namespace) {
        // Try a direct read from the volume first: no RunPod job, no GPU
        // billing, no cold start. It only handles a single-clip chain, since
        // joining multiple segments needs ffmpeg, which this server does not
        // have.
        const direct = await recoverFromVolume(
          client,
          job as RenderJobRow,
          String(job.cache_namespace),
        );
        if (direct) return direct;
        // Otherwise ask the worker to do it, which can join multiple segments.
        // Swap in a fresh runpod_job_id and let the normal poll loop pick it
        // up; if the volume copy is also gone, that job fails fast on its own
        // and falls through to the ordinary failure path below.
        try {
          const fetchJob = await runpodRequest(
            `https://api.runpod.ai/v2/${endpoint}/run`,
            key,
            {
              method: "POST",
              body: JSON.stringify({
                input: { fetch: { cache_namespace: job.cache_namespace } },
              }),
            },
          );
          const recoveryId = typeof fetchJob.id === "string" ? fetchJob.id : "";
          if (recoveryId) {
            await client
              .from(JOBS)
              .update({ runpod_job_id: recoveryId, updated_at: new Date().toISOString() })
              .eq("id", job.id);
            return Response.json({ ...job, runpod_job_id: recoveryId, status: "queued" });
          }
        } catch {
          // Recovery submission itself failed; fall through to the ordinary
          // failure path with the original expiry error below.
        }
      }
      throw statusError;
    }
    const remote = String(result.status ?? "").toUpperCase();
    if (remote === "IN_QUEUE" || remote === "IN_PROGRESS") {
      const status = remote === "IN_QUEUE" ? "queued" : "running";
      await client
        .from(JOBS)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      return Response.json({ ...job, status });
    }
    if (remote !== "COMPLETED") {
      const message =
        typeof result.error === "string"
          ? result.error
          : `RunPod job ended with status ${remote || "unknown"}.`;
      await client
        .from(JOBS)
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await client.rpc("comfyTR_release_render", { job_uuid: job.id });
      return Response.json({
        ...job,
        status: "failed",
        error_message: message,
      });
    }

    try {
      const output = result.output as { videos?: Artifact[] } | undefined;
      const artifact = output?.videos?.[0];
      if (!artifact)
        throw new Error("RunPod completed without an MP4/MKV video.");
      const filename =
        typeof artifact.filename === "string" ? artifact.filename : "clip.mp4";
      const bytes = await artifactBytes(artifact);
      const runtimeMs = Math.max(0, Number(result.executionTime ?? result.execution_time ?? 0));
      return await ingestVideoBytes(client, job as RenderJobRow, bytes, filename, runtimeMs);
    } catch (ingestionError) {
      const message =
        ingestionError instanceof Error
          ? ingestionError.message
          : "The completed video could not be stored.";
      await client
        .from(JOBS)
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await client.rpc("comfyTR_release_render", { job_uuid: job.id });
      throw ingestionError;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED")
      return Response.json(
        { error: "Sign in to view renders." },
        { status: 401 },
      );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Render status could not be read.",
      },
      { status: 502 },
    );
  }
}
