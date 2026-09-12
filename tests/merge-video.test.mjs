import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ffmpeg from "ffmpeg-static";
import { mergeVideoFiles } from "../src/lib/server/merge-video.ts";
const exec = promisify(execFile);

test("merged MP4 contains both input scenes and playable audio", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clipweave-merge-test-"));
  try {
    const inputs = [];
    for (const [index, color] of ["red", "blue"].entries()) {
      const file = join(dir, `${index}.mp4`);
      await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=${color}:s=64x64:r=24`,
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file], { windowsHide: true });
      inputs.push(await readFile(file));
    }
    const output = join(dir, "merged.mp4");
    await writeFile(output, await mergeVideoFiles(inputs));
    const decoded = await exec(ffmpeg, ["-hide_banner", "-i", output, "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"], { windowsHide: true });
    assert.match(decoded.stderr, /Duration: 00:00:02\./);
    assert.match(decoded.stderr, /Audio: aac/);
    assert.match(decoded.stderr, /frame=\s*48/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
