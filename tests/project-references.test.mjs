import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { directorResponseSchema } from "../src/lib/director-contract.ts";
import { newProject, newClip, resolveSuggestedReference } from "../src/lib/studio-model.ts";
import { assembleH3Workflow, dimensions } from "../src/lib/render-workflow.ts";

const suggestion = { name: "Station", description: "An abandoned railway station." };
function fixture() {
  return { ...newProject("Journey", "Arrival", { ratio: "9:16", quality: "high" }),
    clips: [0, 1].map((i) => ({ ...newClip(i), technicalPrompt: "A station.", suggestedReferences: [suggestion] })) };
}
test("linking a suggestion updates all draft clips and requires recompilation", () => {
  const project = fixture();
  const image = { id: "station-image", name: "Station photo", url: "https://example.com/image.png" };
  const result = resolveSuggestedReference(project, "Station", image);
  assert.deepEqual(result.referenceIds, [image.id]);
  for (const clip of result.clips) {
    assert.deepEqual(clip.referenceIds, [image.id]);
    assert.deepEqual(clip.suggestedReferences, []);
    assert.equal(clip.continuityStale, true);
  }
  assert.equal(project.clips[0].suggestedReferences.length, 1);
});
test("removing an optional suggestion preserves the text prompt and locked clips", () => {
  const project = fixture();
  project.clips[1].status = "validated";
  const result = resolveSuggestedReference(project, "Station");
  assert.equal(result.clips[0].technicalPrompt, "A station.");
  assert.deepEqual(result.clips[0].suggestedReferences, []);
  assert.equal(result.clips[1], project.clips[1]);
});
test("missing references block rendering; chosen project quality and orientation reach the workflow", async () => {
  const project = fixture();
  await assert.rejects(assembleH3Workflow(project, project.clips[0], []), /suggested reference/);
  const resolved = resolveSuggestedReference(project, "Station");
  const { workflow } = await assembleH3Workflow(resolved, resolved.clips[0], []);
  assert.deepEqual([workflow["1"].inputs.width, workflow["1"].inputs.height], [736, 1280]);
  for (const quality of ["draft", "standard", "high"]) {
    const landscape = dimensions("16:9", quality);
    assert.deepEqual(dimensions("9:16", quality), [...landscape].reverse());
    const square = dimensions("1:1", quality);
    assert.equal(square[0], square[1]);
    assert.ok([...landscape, ...square].every((n) => n % 32 === 0));
  }
});
test("director response schema supports OpenAI strict structured output", () => {
  const format = zodTextFormat(directorResponseSchema, "clip_plan");
  assert.ok(format.schema.properties.clips.items.required.includes("suggestedReferences"));
});
