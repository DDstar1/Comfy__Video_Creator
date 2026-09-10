import test from "node:test";
import assert from "node:assert/strict";
import {
  createSampleProject,
  updateClip,
  validateClip,
  canChangeProjectSettings,
  newProject,
  newClip,
} from "../src/lib/studio-model.ts";

test("validated clips reject description, reference, duration and status changes", () => {
  const project = createSampleProject();
  const next = updateClip(project, "clip-1", {
    description: "Changed",
    referenceIds: [],
    duration: 15,
    status: "draft",
  });
  assert.equal(next, project);
  assert.equal(canChangeProjectSettings(project), false);
});

test("readable revisions preserve the description that generated the clip", () => {
  const project = createSampleProject();
  const next = updateClip(project, "clip-2", {
    pendingDescription: "Warmer morning light.",
    requestedChange: "Move the camera closer.",
  });
  assert.equal(next.clips[1].description, project.clips[1].description);
  assert.equal(next.clips[1].pendingDescription, "Warmer morning light.");
  assert.equal(next.clips[0], project.clips[0]);
});

test("draft edits cannot set validation status or change clip identity", () => {
  const project = createSampleProject();
  const next = updateClip(project, "clip-2", {
    status: "validated",
    id: "different-id",
  });
  assert.equal(next.clips[1].status, "draft");
  assert.equal(next.clips[1].id, "clip-2");
});

test("validation requires a rendered video and an approved prefix", () => {
  const project = createSampleProject();
  assert.equal(validateClip(project, "clip-2"), project);
  project.clips[2].status = "ready";
  project.clips[2].videoUrl = "/test-only-video.mp4";
  assert.equal(validateClip(project, "clip-3"), project);
  project.clips[1].status = "ready";
  assert.equal(validateClip(project, "clip-2"), project);
  project.clips[1].videoUrl = "/test-only-video.mp4";
  const approved = validateClip(project, "clip-2");
  assert.equal(approved.clips[1].status, "validated");
  assert.equal(validateClip(approved, "clip-3").clips[2].status, "validated");
});

test("pending descriptions and change requests prevent validation", () => {
  const project = createSampleProject();
  project.clips[1] = {
    ...project.clips[1],
    status: "ready",
    videoUrl: "/test-only-video.mp4",
    pendingDescription: "Change it",
  };
  assert.equal(validateClip(project, "clip-2"), project);
  project.clips[1].pendingDescription = undefined;
  project.clips[1].requestedChange = "Change it";
  assert.equal(validateClip(project, "clip-2"), project);
});

test("new projects and clips are empty drafts, never fabricated AI results", () => {
  const project = newProject("New story", "A traveler finds a doorway.");
  assert.equal(project.clips.length, 0);
  assert.equal(project.sample, undefined);
  assert.equal(canChangeProjectSettings(project), true);
  const clip = newClip(0);
  assert.equal(clip.description, "");
  assert.equal(clip.videoUrl, undefined);
  assert.equal(clip.status, "draft");
});
