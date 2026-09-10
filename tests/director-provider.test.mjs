import { test } from "node:test";
import assert from "node:assert/strict";
import { runDirector } from "../src/lib/server/director.ts";

test("provider request uses the requested model, server key and pinned hosted skill; rejects unconsulted skill", async () => {
  const previousFetch = globalThis.fetch;
  const previous = {
    key: process.env.CHATGPT_KEY,
    id: process.env.OPENAI_DIRECTOR_SKILL_ID,
    version: process.env.OPENAI_DIRECTOR_SKILL_VERSION,
  };
  process.env.CHATGPT_KEY = "test-only";
  process.env.OPENAI_DIRECTOR_SKILL_ID = "skill_test";
  process.env.OPENAI_DIRECTOR_SKILL_VERSION = "1";
  const clip = {
    title: "Letter",
    description: "A letter.",
    duration: 5,
    referenceIds: [],
    mode: "T2VA",
    technicalPrompt:
      "integrated_multimodal_description: A letter.\noverall_soundscape: Wind.\nnon_diegetic_music: N/A",
    endState: "A letter on the table.",
  };
  const input = {
    action: "plan",
    project: {
      id: "p",
      title: "Letter",
      story: "A letter at dawn",
      style: "Cinematic",
      ratio: "16:9",
      referenceIds: [],
      clips: [],
    },
    references: [],
  };
  let includeShell = true;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-5.6-luna");
    assert.deepEqual(body.reasoning, {
      effort: "medium",
      mode: "standard",
      summary: "auto",
    });
    assert.equal(body.store, true);
    assert.equal(body.text.verbosity, "medium");
    assert.deepEqual(body.tools[0].environment.skills, [
      { type: "skill_reference", skill_id: "skill_test", version: "1" },
    ]);
    assert.equal(body.tools[0].environment.network_policy.type, "disabled");
    assert.equal(body.input[0].role, "developer");
    return new Response(
      JSON.stringify({
        id: "resp_test",
        object: "response",
        status: "completed",
        model: body.model,
        output: [
          ...(includeShell
            ? [
                {
                  id: "shell_test",
                  type: "shell_call",
                  status: "completed",
                  action: { commands: ["cat SKILL.md"] },
                },
              ]
            : []),
          {
            type: "message",
            id: "msg_test",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ clips: [clip] }),
                annotations: [],
              },
            ],
          },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const result = await runDirector(input);
    assert.equal(result.clips[0].technicalPrompt, clip.technicalPrompt);
    includeShell = false;
    await assert.rejects(() => runDirector(input), /did not consult/);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of [
      ["CHATGPT_KEY", previous.key],
      ["OPENAI_DIRECTOR_SKILL_ID", previous.id],
      ["OPENAI_DIRECTOR_SKILL_VERSION", previous.version],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
