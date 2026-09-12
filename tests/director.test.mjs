import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkDirectorInput,
  directorInputSchema,
  parseDirectorOutput,
} from "../src/lib/director-contract.ts";
import {
  applyCompiledClip,
  newProject,
  newClip,
} from "../src/lib/studio-model.ts";
const generated = {
  title: "Dawn",
  description: "A letter at dawn.",
  duration: 5,
  referenceIds: [],
  mode: "T2VA",
  technicalPrompt:
    "integrated_multimodal_description: [Shot 1] A letter.\noverall_soundscape: Wind.\nnon_diegetic_music: N/A",
  endState: "The letter is still on the table.",
  continuesPrevious: false,
};
const project = newProject("Letter", "A letter at dawn");
const input = directorInputSchema.parse({
  action: "plan",
  project,
  references: [],
});
test("validates H3 output and rejects malformed sections and invented pictures", () => {
  assert.equal(
    parseDirectorOutput(JSON.stringify({ clips: [generated] }), input).clips
      .length,
    1,
  );
  assert.throws(() =>
    parseDirectorOutput(
      JSON.stringify({
        clips: [{ ...generated, technicalPrompt: "Nice scene" }],
      }),
      input,
    ),
  );
  assert.throws(() =>
    parseDirectorOutput(
      JSON.stringify({
        clips: [
          {
            ...generated,
            technicalPrompt: generated.technicalPrompt + " <Picture 1>",
          },
        ],
      }),
      input,
    ),
  );
  assert.throws(() =>
    parseDirectorOutput(
      JSON.stringify({ clips: [{ ...generated, referenceIds: ["invented"] }] }),
      input,
    ),
  );
});
test("server contract rejects missing references, re-planning existing clips and locked revisions", () => {
  assert.throws(() =>
    checkDirectorInput({
      ...input,
      project: { ...project, referenceIds: ["missing"] },
    }),
  );
  const clip = { ...newClip(0), description: "A letter", status: "validated" };
  assert.throws(() =>
    checkDirectorInput({ ...input, project: { ...project, clips: [clip] } }),
  );
  assert.throws(() =>
    checkDirectorInput({
      ...input,
      action: "revise",
      clipId: clip.id,
      project: { ...project, clips: [clip] },
    }),
  );
});
test("revision atomically updates both prompts, preserves history and marks later drafts stale", () => {
  const first = {
    ...newClip(0),
    ...generated,
    technicalPrompt: "old",
    pendingDescription: "new",
    requestedChange: "slower",
  };
  const second = newClip(1);
  const p = { ...project, clips: [first, second] };
  const next = applyCompiledClip(p, first.id, generated, "response-test");
  assert.equal(next.clips[0].technicalPrompt, generated.technicalPrompt);
  assert.equal(next.clips[0].description, generated.description);
  assert.equal(next.clips[0].pendingDescription, undefined);
  assert.equal(next.clips[0].promptHistory[0].technicalPrompt, "old");
  assert.equal(next.clips[1].continuityStale, true);
  assert.equal(p.clips[0].technicalPrompt, "old");
  const locked = { ...p, clips: [{ ...first, status: "validated" }] };
  assert.equal(
    applyCompiledClip(locked, first.id, generated, "response-test"),
    locked,
  );
});
