import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";

const exec = promisify(execFile);

export async function mergeVideoFiles(sources: Uint8Array[]): Promise<Buffer> {
  if (!ffmpeg) throw new Error("Video merging is unavailable on this server.");
  if (!sources.length) throw new Error("No videos to merge.");
  const directory = await mkdtemp(join(tmpdir(), "clipweave-merge-"));
  try {
    for (const [index, bytes] of sources.entries())
      await writeFile(join(directory, `part-${index}.mp4`), bytes);
    await writeFile(join(directory, "inputs.txt"), sources.map((_, i) => `file 'part-${i}.mp4'`).join("\n"));
    await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1",
      "-i", "inputs.txt", "-map", "0:v:0", "-map", "0:a?", "-c", "copy",
      "-movflags", "+faststart", "-avoid_negative_ts", "make_zero", "merged.mp4"],
      { cwd: directory, timeout: 180000, maxBuffer: 1024 * 1024, windowsHide: true });
    return await readFile(join(directory, "merged.mp4"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
