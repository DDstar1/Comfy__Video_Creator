import test from "node:test";
import assert from "node:assert/strict";
import { mergeSources } from "../src/lib/merge-plan.ts";

const clip = (id, continues = false) => ({ id, status: "validated", video_url: `${id}.mp4`, continues_previous: continues });
test("merge uses the final full export per chain without duplicating earlier footage", () => {
  assert.deepEqual(mergeSources([clip("a"), clip("b"), clip("c"), clip("d", true)]), ["a.mp4", "b.mp4", "d.mp4"]);
  assert.deepEqual(mergeSources([clip("a"), clip("b", true), clip("c", true)]), ["c.mp4"]);
});
test("merge rejects empty projects, unvalidated clips and missing video files", () => {
  assert.throws(() => mergeSources([]), /Validate/);
  assert.throws(() => mergeSources([{ ...clip("a"), status: "ready" }]), /Validate/);
  assert.throws(() => mergeSources([{ ...clip("a"), video_url: null }]), /Validate/);
});
