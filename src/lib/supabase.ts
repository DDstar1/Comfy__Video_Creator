import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const REFERENCE_BUCKET = "comfytr-reference-images";
export const REFERENCE_TABLE = "comfyTR_reference_images";
export const PROJECT_TABLE = "comfyTR_projects";
export const PROJECT_REFERENCE_TABLE = "comfyTR_project_references";
export const CLIP_TABLE = "comfyTR_clips";
export const PROMPT_VERSION_TABLE = "comfyTR_clip_prompt_versions";
export const CUSTOM_USER_TABLE = "comfyTR_custom_users";
export const GENERATED_VIDEO_BUCKET = "comfytr-generated-videos";
export const RENDER_JOB_TABLE = "comfyTR_render_jobs";
export const VIDEO_ASSET_TABLE = "comfyTR_clip_video_assets";

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Account connection is not configured on this deployment.");
  const redirectTo = `${window.location.origin}/studio`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}
