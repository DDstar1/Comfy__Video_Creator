import { z } from "zod";

const text = z.string().trim().min(1).max(30000);
const id = z.string().min(1).max(120);
export const generatedClipSchema = z
  .object({
    title: text.max(160),
    description: text.max(6000),
    duration: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    referenceIds: z.array(id).max(9),
    mode: z.enum(["T2VA", "Ref2VA"]),
    technicalPrompt: text,
    endState: text.max(4000),
  })
  .strict();
export type GeneratedClip = z.infer<typeof generatedClipSchema>;
export const directorOutputSchema = z
  .object({ clips: z.array(generatedClipSchema).min(1).max(12) })
  .strict();
const inputClip = z.object({
  id,
  title: z.string().max(160),
  description: z.string().max(6000),
  duration: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  referenceIds: z.array(id).max(9),
  status: z.enum(["draft", "ready", "validated"]),
  technicalPrompt: z.string().max(30000).optional(),
  endState: z.string().max(4000).optional(),
  pendingDescription: z.string().max(6000).optional(),
  requestedChange: z.string().max(4000).optional(),
});
export const directorInputSchema = z.object({
  action: z.enum(["plan", "revise"]),
  clipId: id.optional(),
  project: z.object({
    id,
    title: text.max(160),
    story: text.max(50000),
    style: text.max(200),
    ratio: z.enum(["16:9", "9:16", "1:1"]),
    referenceIds: z.array(id).max(9),
    clips: z.array(inputClip).max(12),
  }),
  references: z
    .array(
      z.object({
        id,
        name: text.max(160),
        description: z.string().max(4000),
        url: z.url().max(2000),
      }),
    )
    .max(9),
});
export type DirectorInput = z.infer<typeof directorInputSchema>;

export function checkDirectorInput(input: DirectorInput) {
  const ids = input.references.map((r) => r.id);
  if (
    new Set(ids).size !== ids.length ||
    new Set(input.project.referenceIds).size !==
      input.project.referenceIds.length
  )
    throw new Error("Reference IDs must be unique.");
  if (
    input.project.referenceIds.some((id) => !ids.includes(id)) ||
    ids.some((id) => !input.project.referenceIds.includes(id))
  )
    throw new Error(
      "Some project references are unavailable. Reload your library.",
    );
  if (
    input.project.clips.some((c) =>
      c.referenceIds.some((id) => !ids.includes(id)),
    )
  )
    throw new Error("A clip contains an unavailable reference.");
  if (input.action === "plan" && input.project.clips.length)
    throw new Error(
      "This project already has clips. Revise them individually or start a new project.",
    );
  if (input.action === "revise") {
    const clip = input.project.clips.find((c) => c.id === input.clipId);
    if (!clip) throw new Error("Clip not found.");
    if (clip.status === "validated")
      throw new Error("Validated clips cannot be revised.");
    if (!clip.pendingDescription?.trim() && !clip.description.trim())
      throw new Error("Describe this clip first.");
  }
}

export function parseDirectorOutput(raw: string, input: DirectorInput) {
  const result = directorOutputSchema.parse(JSON.parse(raw));
  if (input.action === "revise" && result.clips.length !== 1)
    throw new Error("Expected one revised clip.");
  for (const clip of result.clips) {
    if (
      new Set(clip.referenceIds).size !== clip.referenceIds.length ||
      clip.referenceIds.some((id) => !input.project.referenceIds.includes(id))
    )
      throw new Error("The model returned an unknown or duplicate reference.");
    if (clip.referenceIds.length > 0 !== (clip.mode === "Ref2VA"))
      throw new Error("Prompt mode does not match references.");
    const sections =
      clip.mode === "Ref2VA"
        ? [
            "subject_definitions",
            "summary",
            "retention_analysis",
            "detailed_description",
            "overall_soundscape",
            "non_diegetic_music",
          ]
        : [
            "integrated_multimodal_description",
            "overall_soundscape",
            "non_diegetic_music",
          ];
    let previous = -1;
    for (const section of sections) {
      const match = new RegExp(`^${section}:`, "m").exec(clip.technicalPrompt);
      if (!match || match.index <= previous)
        throw new Error("The model returned an invalid H3 section order.");
      previous = match.index;
    }
    for (const match of clip.technicalPrompt.matchAll(/<Picture (\d+)>/g)) {
      if (+match[1] < 1 || +match[1] > clip.referenceIds.length)
        throw new Error("The prompt points to an unassigned picture.");
    }
    if (/<(?:Video|Audio) \d+>/.test(clip.technicalPrompt))
      throw new Error("Only image references are supported.");
    // A clip may carry project references its scene does not feature, and
    // revise is told to preserve the existing selection, so requiring every
    // assigned image to appear made such clips impossible to revise. The
    // bounds check above still rejects a <Picture N> with no reference behind it.
  }
  return result;
}
