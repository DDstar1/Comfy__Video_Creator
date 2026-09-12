import { createHash } from "node:crypto";
import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { mergeSources } from "@/lib/merge-plan";
import { mergeVideoFiles } from "@/lib/server/merge-video";

export const runtime = "nodejs";
export const maxDuration = 300;
const bucket = "comfytr-generated-videos";
const requestSchema = z.object({ projectId: z.uuid() });

async function handle(request: Request, create: boolean) {
  try {
    if (create && request.headers.get("origin") !== new URL(request.url).origin)
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const { client, user } = await authenticatedClient(request);
    const { projectId } = requestSchema.parse(create ? await request.json() : { projectId: new URL(request.url).searchParams.get("projectId") });
    const { data: project, error } = await client.from("comfyTR_projects")
      .select("id,title").eq("id", projectId).eq("owner_id", user.id).single();
    if (error || !project) return Response.json({ error: "Project not found." }, { status: 404 });
    const { data: clips, error: clipError } = await client.from("comfyTR_clips")
      .select("id,status,video_url,continues_previous").eq("project_id", projectId).eq("owner_id", user.id).order("position");
    if (clipError) throw clipError;
    const sources = mergeSources(clips ?? []);
    if (sources.some((path) => !path.startsWith(`${user.id}/${projectId}/`)))
      throw new Error("A project video has an invalid storage path.");
    const hash = createHash("sha256").update(JSON.stringify(sources)).digest("hex");
    const folder = `${user.id}/${projectId}/exports`;
    const name = `${hash}.mp4`;
    const storage = client.storage.from(bucket);
    const { data: files, error: listError } = await storage.list(folder, { search: name });
    if (listError) throw listError;
    if (!files?.some((file) => file.name === name)) {
      if (!create) return Response.json({ videoUrl: null }, { headers: { "Cache-Control": "no-store" } });
      const bytes: Uint8Array[] = [];
      let total = 0;
      for (const source of sources) {
        const { data, error: downloadError } = await storage.download(source);
        if (downloadError || !data) throw new Error("A saved clip could not be downloaded. Try again.");
        total += data.size;
        if (total > 512 * 1024 * 1024) throw new Error("This project's videos exceed the 512 MB merge limit.");
        bytes.push(new Uint8Array(await data.arrayBuffer()));
      }
      const merged = await mergeVideoFiles(bytes);
      const uploaded = await storage.upload(`${folder}/${name}`, merged, { contentType: "video/mp4", upsert: false });
      if (uploaded.error && !["409", "400"].includes(String(uploaded.error.statusCode))) throw uploaded.error;
      if (uploaded.error) {
        const check = await storage.list(folder, { search: name });
        if (!check.data?.some((file) => file.name === name)) throw uploaded.error;
      }
    }
    const filename = `${project.title.replace(/[^a-z0-9-]/gi, "-").slice(0, 100)}.mp4`;
    const signed = await storage.createSignedUrl(`${folder}/${name}`, 3600);
    const download = await storage.createSignedUrl(`${folder}/${name}`, 3600, { download: filename });
    if (signed.error || download.error) throw new Error("The merged video could not be opened. Try again.");
    return Response.json({ videoUrl: signed.data.signedUrl, downloadUrl: download.data.signedUrl, filename }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = error instanceof Error && error.message === "AUTH_REQUIRED";
    console.error("Project merge failed", error instanceof Error ? error.message : "Storage error");
    return Response.json({ error: auth ? "Sign in to merge this project." : error instanceof Error ? error.message : "The videos could not be merged. Try again." }, { status: auth ? 401 : 400 });
  }
}

export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
