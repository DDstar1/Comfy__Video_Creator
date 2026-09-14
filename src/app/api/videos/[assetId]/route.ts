import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { getVolumeObject } from "@/lib/server/runpod-volume";

export const runtime = "nodejs";
export const maxDuration = 300;

const assets = "comfyTR_clip_video_assets";
const keyPattern = /^comfytr-cache\/[a-f0-9]{2}\/[a-f0-9]{64}\/chain_extender_1\.final\.video\/ref2va_\d+\.(mp4|mkv|webm|mov)$/i;

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await context.params;
    if (!z.uuid().safeParse(assetId).success) return Response.json({ error: "Invalid video asset." }, { status: 400 });
    const { client, user } = await authenticatedClient(request);
    const { data: asset, error } = await client.from(assets)
      .select("storage_path,filename,mime_type,byte_size")
      .eq("id", assetId).eq("owner_id", user.id).eq("state", "active").single();
    if (error || !asset) return Response.json({ error: "Video not found." }, { status: 404 });
    const key = String(asset.storage_path);
    if (!keyPattern.test(key)) return Response.json({ error: "This video is not volume-backed." }, { status: 409 });
    const bytes = await getVolumeObject(key);
    return new Response(Buffer.from(bytes), { headers: {
      "Content-Type": String(asset.mime_type),
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${String(asset.filename).replace(/[\"\\]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "none",
    }});
  } catch (error) {
    const auth = error instanceof Error && error.message === "AUTH_REQUIRED";
    return Response.json({ error: auth ? "Sign in to view this video." : "Video playback is temporarily unavailable." }, { status: auth ? 401 : 502 });
  }
}