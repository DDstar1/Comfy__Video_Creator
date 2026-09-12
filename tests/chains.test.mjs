import assert from "node:assert/strict";
import test from "node:test";
import { assembleH3Workflow } from "../src/lib/render-workflow.ts";
import { chainIndexes, chainMembers, validateClip } from "../src/lib/studio-model.ts";

function clip(id, extra = {}) {
  return {
    id,
    title: id,
    description: id,
    duration: 5,
    referenceIds: [],
    status: "draft",
    image: "",
    technicalPrompt: `${id} technical prompt`,
    ...extra,
  };
}

function project(clips) {
  return {
    id: "project",
    title: "Project",
    story: "",
    ratio: "16:9",
    style: "Cinematic",
    image: "",
    referenceIds: [],
    clips,
    updatedAt: new Date().toISOString(),
  };
}

test("a clip that does not continue the previous one starts a new chain", () => {
  const clips = [
    clip("a"),
    clip("b", { continuesPrevious: false }),
    clip("c", { continuesPrevious: true }),
    clip("d", { continuesPrevious: false }),
  ];
  // The first clip always starts a chain even though it says nothing about it.
  assert.deepEqual(chainIndexes(clips), [0, 1, 1, 2]);
  assert.deepEqual(chainMembers(clips, 2), {
    chain: 1,
    start: 1,
    members: [clips[1], clips[2]],
  });
});

test("clips without the flag stay in one chain, as projects behaved before cuts", () => {
  const clips = [clip("a"), clip("b"), clip("c")];
  assert.deepEqual(chainIndexes(clips), [0, 0, 0]);
});

test("a render sends only its own chain, so an earlier scene cannot leak in", async () => {
  const clips = [
    clip("a", { status: "validated" }),
    clip("b", { continuesPrevious: false, status: "validated" }),
    clip("c", { continuesPrevious: true }),
  ];
  const result = await assembleH3Workflow(project(clips), clips[2], []);
  const state = JSON.parse(result.workflow["1"].inputs.clips_json);
  // Clip "a" belongs to the previous chain. Including it would hand the model
  // the previous scene's final frames and produce a morph instead of a cut.
  assert.equal(state.clips.length, 2);
  assert.deepEqual(
    state.clips.map((entry) => entry.validated),
    [true, false],
  );
});

test("a clip that starts a chain renders alone, with no motion context", async () => {
  const clips = [
    clip("a", { status: "validated" }),
    clip("b", { continuesPrevious: false }),
  ];
  const result = await assembleH3Workflow(project(clips), clips[1], []);
  const state = JSON.parse(result.workflow["1"].inputs.clips_json);
  assert.equal(state.clips.length, 1);
  assert.equal(state.clips[0].validated, false);
});

test("validation only waits on earlier clips in the same chain", () => {
  const clips = [
    // An unapproved clip in an earlier chain must not block a later scene.
    clip("a", { status: "ready", videoUrl: "https://example.test/a.mp4" }),
    clip("b", {
      continuesPrevious: false,
      status: "ready",
      videoUrl: "https://example.test/b.mp4",
    }),
  ];
  const after = validateClip(project(clips), "b");
  assert.equal(after.clips[1].status, "validated");
});

test("validation still waits on an earlier clip inside the same chain", () => {
  const clips = [
    clip("a", { status: "ready", videoUrl: "https://example.test/a.mp4" }),
    clip("b", {
      continuesPrevious: true,
      status: "ready",
      videoUrl: "https://example.test/b.mp4",
    }),
  ];
  const after = validateClip(project(clips), "b");
  assert.equal(after.clips[1].status, "ready");
});
