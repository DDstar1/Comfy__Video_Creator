import assert from "node:assert/strict";
import test from "node:test";
import { assembleH3Workflow } from "../src/lib/render-workflow.ts";

test("assembles the validated prefix and current clip into an API workflow", async () => {
  const first = {
    id: "first",
    title: "First",
    description: "First",
    duration: 6,
    referenceIds: [],
    status: "validated",
    image: "",
    technicalPrompt: "first technical prompt",
  };
  const second = {
    ...first,
    id: "second",
    title: "Second",
    status: "draft",
    technicalPrompt: "second technical prompt",
  };
  const project = {
    id: "project",
    title: "Project",
    story: "",
    ratio: "16:9",
    style: "Cinematic",
    image: "",
    referenceIds: [],
    clips: [first, second],
    updatedAt: new Date().toISOString(),
  };
  const result = await assembleH3Workflow(project, second, []);
  const state = JSON.parse(result.workflow["1"].inputs.clips_json);
  assert.deepEqual(
    state.clips.map((clip) => clip.validated),
    [true, false],
  );
  assert.deepEqual(
    [result.workflow["1"].inputs.width, result.workflow["1"].inputs.height],
    [608, 352],
  );
  assert.equal(
    result.workflow["2"].class_type,
    "MiniMaxH3MotionContextDiskFinalDecode",
  );
  assert.equal(result.images.length, 0);
});

test("rejects a target whose earlier clip is still editable", async () => {
  const clip = {
    id: "first",
    title: "First",
    description: "First",
    duration: 6,
    referenceIds: [],
    status: "draft",
    image: "",
    technicalPrompt: "prompt",
  };
  const target = { ...clip, id: "second" };
  const project = {
    id: "project",
    title: "Project",
    story: "",
    ratio: "16:9",
    style: "Cinematic",
    image: "",
    referenceIds: [],
    clips: [clip, target],
    updatedAt: new Date().toISOString(),
  };
  await assert.rejects(
    () => assembleH3Workflow(project, target, []),
    /Validate every earlier clip/,
  );
});
