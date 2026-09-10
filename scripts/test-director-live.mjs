import nextEnv from "@next/env";
import { writeFile } from "node:fs/promises";
import { directorInputSchema } from "../src/lib/director-contract.ts";
import { runDirector } from "../src/lib/server/director.ts";
nextEnv.loadEnvConfig(process.cwd());
const input = directorInputSchema.parse({
  action: "plan",
  project: {
    id: "smoke",
    title: "Morning letter",
    story:
      "One five-second clip: a folded letter rests on a wooden table beside a window at dawn. The camera slowly pushes closer. No people or dialogue.",
    style: "Cinematic",
    ratio: "16:9",
    referenceIds: [],
    clips: [],
  },
  references: [],
});
try {
  const plan = await runDirector(input);
  console.log(
    JSON.stringify({
      stage: "plan",
      model: plan.model,
      clips: plan.clips.length,
      mode: plan.clips[0].mode,
      skillVersion: plan.skillVersion,
    }),
  );
  const clip = {
    ...plan.clips[0],
    id: "smoke-clip",
    status: "draft",
    requestedChange:
      "Make the camera completely stationary, with only the curtain moving gently.",
  };
  const revision = await runDirector(
    directorInputSchema.parse({
      ...input,
      action: "revise",
      clipId: clip.id,
      project: { ...input.project, clips: [clip] },
    }),
  );
  await writeFile(
    ".director-smoke.json",
    JSON.stringify({ plan, revision }, null, 2),
  );
  console.log(
    JSON.stringify({
      stage: "revision",
      clips: revision.clips.length,
      changed:
        revision.clips[0].technicalPrompt !== plan.clips[0].technicalPrompt,
      artifact: ".director-smoke.json",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      error: error.name,
      status: error.status,
      code: error.code,
      message: error.message?.replaceAll(
        process.env.CHATGPT_KEY ?? "NO_KEY",
        "[REDACTED]",
      ),
    }),
  );
  process.exitCode = 1;
}
