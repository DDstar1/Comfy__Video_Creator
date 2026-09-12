export type MergeClip = {
  id: string;
  status: string;
  video_url: string | null;
  continues_previous: boolean | null;
};

export function mergeSources(clips: MergeClip[]): string[] {
  if (!clips.length || clips.some((clip) => clip.status !== "validated" || !clip.video_url))
    throw new Error("Validate every clip before merging the project.");
  // Each rendered continuation contains its entire chain. Only the final
  // export of each chain belongs in the finished film.
  return clips.filter((_, index) => index === clips.length - 1 || clips[index + 1].continues_previous === false)
    .map((clip) => clip.video_url!);
}
