import test from "node:test";
import assert from "node:assert/strict";
import { readStudioRoute, studioUrl } from "../src/lib/studio-route.ts";
import { loadProjectSummaries, loadAccountProject } from "../src/lib/project-store.ts";

test("project URLs and tabs round-trip and old bookmarks still resolve", () => {
  for (const tab of ["story", "references", "clips"]) {
    const route = { view: "studio", projectId: "project-id", tab };
    assert.deepEqual(readStudioRoute(new URL(studioUrl(route), "https://example.com")), route);
    assert.deepEqual(readStudioRoute(new URL(`https://example.com/studio#/project/project-id/${tab}`)), route);
  }
  assert.deepEqual(readStudioRoute(new URL("https://example.com/studio")), { view: "projects" });
  assert.deepEqual(readStudioRoute(new URL("https://example.com/studio/library")), { view: "library" });
});

function clientFixture() {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    const query = {
      select(value) { call.select = value; return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      in(key, value) { call.filters.push([key, value]); return query; },
      order() { return query; },
      then(resolve) { return Promise.resolve({ data: table === "comfyTR_projects" ? [{ id: "selected", title: "Saved project", ratio: "9:16", quality: "high", updated_at: "2026-09-12" }] : table === "comfyTR_clips" ? [{ id: "clip-selected", project_id: "selected", title: "Clip", duration: 5, status: "draft" }] : [], error: null }).then(resolve); },
    };
    return query;
  }};
  return { calls, client };
}
test("sidebar summaries never fetch clips, story or prompt history", async () => {
  const { client, calls } = clientFixture();
  const result = await loadProjectSummaries(client, "owner");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "comfyTR_projects");
  assert.ok(!calls[0].select.includes("story"));
  assert.ok(!("clips" in result[0]));
  assert.deepEqual(calls[0].filters, [["owner_id", "owner"]]);
});
test("project detail and prompt history queries are restricted to the selected account and project", async () => {
  const { client, calls } = clientFixture();
  const [project] = await loadAccountProject(client, "owner", "selected");
  assert.equal(project.quality, "high");
  assert.equal(project.clips[0].id, "clip-selected");
  for (const call of calls) {
    assert.ok(call.filters.some(([key, value]) => key === "owner_id" && value === "owner"));
    if (call.table === "comfyTR_clip_prompt_versions")
      assert.deepEqual(call.filters.find(([key]) => key === "clip_id"), ["clip_id", ["clip-selected"]]);
    else assert.ok(call.filters.some(([key, value]) => ["id", "project_id"].includes(key) && value === "selected"));
  }
});
