import nextEnv from "@next/env";
import { readFile, readdir, appendFile } from "node:fs/promises";
import path from "node:path";

nextEnv.loadEnvConfig(process.cwd());
const name = "minimax-h3-extender-sequential-director";
if (!process.env.CHATGPT_KEY)
  throw new Error("CHATGPT_KEY is missing from frontend/.env");
if (process.env.OPENAI_DIRECTOR_SKILL_ID) {
  console.log(
    "Director skill already configured. Remove its env entry to upload a replacement.",
  );
  process.exit(0);
}
const form = new FormData();
async function add(directory, relative = name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const target = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await add(file, target);
    else form.append("files[]", new Blob([await readFile(file)]), target);
  }
}
await add(path.join(process.cwd(), "skills", name));
const response = await fetch("https://api.openai.com/v1/skills", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.CHATGPT_KEY}` },
  body: form,
});
if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  console.error(
    "Skill upload failed",
    response.status,
    body.error?.code ?? "unknown_error",
  );
  process.exit(1);
}
const skill = await response.json();
if (!skill.id || !Number.isInteger(Number(skill.default_version)))
  throw new Error("Unexpected skill response");
await appendFile(
  ".env.local",
  `\nOPENAI_DIRECTOR_SKILL_ID=${skill.id}\nOPENAI_DIRECTOR_SKILL_VERSION=${Number(skill.default_version)}\n`,
);
console.log(
  "Director skill uploaded; pinned ID and version saved to ignored .env.local.",
);
