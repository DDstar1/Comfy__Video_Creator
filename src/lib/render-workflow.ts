import type { Clip, Project, ReferenceImage } from "./studio-model.ts";
import { chainMembers } from "./studio-model.ts";

type ApiNode = { class_type: string; inputs: Record<string, unknown> };
export type RenderPayload = {
  workflow: Record<string, ApiNode>;
  images: { name: string; image: string }[];
};
const MODEL = "minimax_h3_ref2va_pruned_int8_convrot.safetensors";
const TEXT_ENCODER = "qwen3vl_32b_minimax_h3_int8_convrot.safetensors";
const VIDEO_VAE = "minimax_h3_video_vae_fp16.safetensors";
const AUDIO_VAE = "minimax_h3_audio_vae_fp32.safetensors";
const TURBO_LORA =
  "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors";

function dimensions(ratio: Project["ratio"]): [number, number] {
  if (ratio === "9:16") return [352, 608];
  if (ratio === "1:1") return [448, 448];
  return [608, 352];
}
function seed(id: string) {
  let value = 2166136261;
  for (const char of id)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return Math.abs(value) % 9_007_199_254_740_991;
}
function extension(reference: ReferenceImage) {
  try {
    const ext = new URL(reference.url).pathname.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  } catch {}
  return "png";
}
async function asDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error("A reference image could not be downloaded.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("A reference image could not be prepared."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function assembleH3Workflow(
  project: Project,
  target: Clip,
  library: ReferenceImage[],
): Promise<RenderPayload> {
  const targetIndex = project.clips.findIndex((clip) => clip.id === target.id);
  if (targetIndex < 0)
    throw new Error("The selected clip is not in this project.");
  // Only this clip's own chain is sent. Including an earlier chain would hand
  // the model the previous scene's final frames as motion context, which is
  // what makes one scene morph into the next instead of cutting to it.
  const { start: chainStart } = chainMembers(project.clips, targetIndex);
  const sequence = project.clips.slice(chainStart, targetIndex + 1);
  if (sequence.some((clip) => !clip.technicalPrompt?.trim()))
    throw new Error(
      "Compile every clip through the current clip before rendering.",
    );
  if (sequence.slice(0, -1).some((clip) => clip.status !== "validated"))
    throw new Error("Validate every earlier clip before rendering this one.");
  const references = target.referenceIds.map((id) => {
    const reference = library.find((item) => item.id === id);
    if (!reference)
      throw new Error("One of this clip’s references is unavailable.");
    return reference;
  });
  const images = await Promise.all(
    references.map(async (reference, index) => ({
      name: `clipweave-ref-${index + 1}.${extension(reference)}`,
      image: await asDataUrl(reference.url),
    })),
  );
  const [width, height] = dimensions(project.ratio);
  const workflow: Record<string, ApiNode> = {
    "3": {
      class_type: "UNETLoader",
      inputs: { unet_name: MODEL, weight_dtype: "default" },
    },
    "4": {
      class_type: "CLIPLoader",
      inputs: { clip_name: TEXT_ENCODER, type: "minimax", device: "default" },
    },
    "5": { class_type: "VAELoader", inputs: { vae_name: VIDEO_VAE } },
    "6": { class_type: "VAELoader", inputs: { vae_name: AUDIO_VAE } },
    "13": {
      class_type: "LoraLoaderModelOnly",
      inputs: { model: ["3", 0], lora_name: TURBO_LORA, strength_model: 1 },
    },
  };
  const promptInputs: Record<string, unknown> = {};
  sequence.forEach((clip, index) => {
    const id = String(100 + index);
    workflow[id] = {
      class_type: "PrimitiveStringMultiline",
      inputs: { value: clip.technicalPrompt!.trim() },
    };
    promptInputs[`prompt_${index + 1}`] = [id, 0];
  });
  workflow["17"] = {
    class_type: "MiniMaxH3PromptPackBridge",
    inputs: promptInputs,
  };
  const refInputs: Record<string, unknown> = {};
  images.forEach((image, index) => {
    const id = String(300 + index);
    workflow[id] = { class_type: "LoadImage", inputs: { image: image.name } };
    refInputs[`ref_${index + 1}`] = [id, 0];
  });
  if (images.length)
    workflow["21"] = {
      class_type: "MiniMaxH3ReferencePackBridge",
      inputs: refInputs,
    };
  workflow["1"] = {
    class_type: "MiniMaxH3Extender",
    inputs: {
      model: ["13", 0],
      clip: ["4", 0],
      vae: ["5", 0],
      audio_vae: ["6", 0],
      prompt_pack: ["17", 0],
      ...(images.length ? { ref_pack: ["21", 0] } : {}),
      run_mode: "clip_by_clip",
      width,
      height,
      ref_image_size: "match",
      steps: 4,
      sampler_name: "euler",
      scheduler: "simple",
      denoise: 1,
      context_length: "22",
      audio_context_length: 0,
      resolution_mode: "manual",
      megapixels: 0.2,
      clips_json: JSON.stringify({
        version: 1,
        clips: sequence.map((clip, index) => ({
          id: clip.id,
          name: clip.title,
          prompt: clip.technicalPrompt,
          seed: seed(clip.id),
          seed_mode: "fixed",
          duration: clip.duration,
          // The target is the last entry of the chain-scoped sequence, so this
          // must compare against the sequence, not the project-wide index.
          validated: index < sequence.length - 1,
          color_adjustment: { saturation: 100, contrast: 100, brightness: 100 },
        })),
      }),
      refs_json: JSON.stringify({ version: 2, refs: Array(9).fill(null) }),
      generation_mode: "ref2va",
    },
  };
  workflow["2"] = {
    class_type: "MiniMaxH3MotionContextDiskFinalDecode",
    inputs: {
      cache: ["1", 0],
      vae: ["5", 0],
      audio_vae: ["6", 0],
      fps: 24,
      filename_prefix: `clipweave-${target.id}`,
      output_directory: "",
      codec: "H.264",
      crf: 17,
      preset: "fast",
      audio_bitrate: "192k",
      // Required BOOLEAN on the node; API format does not apply widget defaults.
      autoplay: true,
    },
  };
  return { workflow, images };
}
