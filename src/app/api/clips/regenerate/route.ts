import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { truncateChainVideos } from "@/lib/server/runpod-volume";

export const runtime = "nodejs";
const schema = z.object({ projectId: z.uuid(), clipId: z.uuid() });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Same-origin requests required." }, { status: 403 });
  try {
    const { client, user } = await authenticatedClient(request);
    const input = schema.parse(await request.json());
    const { data: active, error: activeError } = await client
      .from("comfyTR_render_jobs").select("id").eq("project_id", input.projectId)
      .eq("owner_id", user.id).in("status", ["submitting", "queued", "running"]).limit(1);
    if (activeError) throw activeError;
    if (active?.length)
      return Response.json({ error: "Wait for the active render to finish before regenerating this chain." }, { status: 409 });
    const { data: result, error } = await client.rpc("comfyTR_prepare_chain_regeneration", {
      project_uuid: input.projectId, clip_uuid: input.clipId,
    });
    if (error) throw error;
    const detail = Array.isArray(result) ? result[0] : result;
    if (!detail) return Response.json({ error: "Clip not found." }, { status: 404 });
    const paths: string[] = Array.isArray(detail.storage_paths)
      ? (detail.storage_paths as unknown[]).filter((value): value is string => typeof value === "string" && !value.startsWith("comfytr-cache/"))
      : [];
    if (paths.length) {
      const { error: storageError } = await client.storage.from("comfytr-generated-videos").remove(paths);
      if (storageError) throw storageError;
    }
    const cacheNamespace = String(detail.cache_namespace ?? "");
    const removedCacheSegments = cacheNamespace
      ? await truncateChainVideos(cacheNamespace, Number(detail.retain_segments ?? 0))
      : 0;
    return Response.json({
      resetClipIds: detail.reset_clip_ids ?? [], removedVideos: paths.length,
      removedCacheSegments, retainedMotionPrefix: Number(detail.retain_segments ?? 0),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED")
      return Response.json({ error: "Sign in to regenerate clips." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Clip regeneration could not be prepared." }, { status: 400 });
  }
}
