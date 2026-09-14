import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { deleteChainCache } from "@/lib/server/runpod-volume";

export const runtime = "nodejs";

const projects = "comfyTR_projects";
const clips = "comfyTR_clips";
const jobs = "comfyTR_render_jobs";
const generatedVideos = "comfytr-generated-videos";
const requestSchema = z.object({ projectId: z.uuid() });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

async function listAll(storage: ReturnType<typeof Object>, prefix: string): Promise<string[]> {
  const bucket = storage as { list: (path: string, options?: Record<string, unknown>) => Promise<{ data: { name: string; id?: string | null }[] | null; error: unknown }> };
  const result: string[] = [];
  const visit = async (path: string) => {
    const { data, error } = await bucket.list(path, { limit: 1000 });
    if (error) throw error;
    for (const entry of data ?? []) {
      const next = `${path}/${entry.name}`;
      if (entry.id) result.push(next);
      else await visit(next);
    }
  };
  await visit(prefix);
  return result;
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Same-origin requests required." }, { status: 403 });
  try {
    const { client, user } = await authenticatedClient(request);
    const { projectId } = requestSchema.parse(await request.json());
    const { data: project, error: projectError } = await client
      .from(projects)
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

    const { data: active, error: activeError } = await client
      .from(jobs)
      .select("id")
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .in("status", ["submitting", "queued", "running"])
      .limit(1);
    if (activeError) throw activeError;
    if (active?.length)
      return Response.json({ error: "Wait for the active render to finish before deleting this project." }, { status: 409 });

    const { data: orderedClips, error: clipsError } = await client
      .from(clips)
      .select("continues_previous")
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .order("position");
    if (clipsError) throw clipsError;
    let chainIndex = -1;
    const namespaces = (orderedClips ?? []).flatMap((clip, position) => {
      if (position === 0 || clip.continues_previous === false) chainIndex += 1;
      return position === 0 || clip.continues_previous === false
        ? [`${user.id}:${projectId}:${chainIndex}`]
        : [];
    });

    // The volume is the only place where the motion context exists. Clean it
    // before deleting the database rows that provide the trusted namespace.
    await Promise.all(namespaces.map((namespace) => deleteChainCache(namespace)));

    const storage = client.storage.from(generatedVideos);
    const paths = await listAll(storage, `${user.id}/${projectId}`);
    if (paths.length) {
      const { error } = await storage.remove(paths);
      if (error) throw error;
    }

    const { error: deleted } = await client
      .from(projects)
      .delete()
      .eq("id", projectId)
      .eq("owner_id", user.id);
    if (deleted) throw deleted;
    return Response.json({ deleted: true, removedFiles: paths.length, removedCaches: namespaces.length });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED")
      return Response.json({ error: "Sign in to delete a project." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Project deletion failed." }, { status: 400 });
  }
}