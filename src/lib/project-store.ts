import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIP_TABLE,
  PROJECT_REFERENCE_TABLE,
  PROJECT_TABLE,
  PROMPT_VERSION_TABLE,
  GENERATED_VIDEO_BUCKET,
} from "./supabase";
import type { Clip, Project, ReferenceImage } from "./studio-model";

type Row = Record<string, unknown>;

export async function loadAccountProjects(
  client: SupabaseClient,
  ownerId: string,
): Promise<Project[]> {
  const [projectsResult, clipsResult, refsResult, versionsResult] =
    await Promise.all([
      client
        .from(PROJECT_TABLE)
        .select("*")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false }),
      client
        .from(CLIP_TABLE)
        .select("*")
        .eq("owner_id", ownerId)
        .order("position"),
      client
        .from(PROJECT_REFERENCE_TABLE)
        .select("project_id,reference_image_id")
        .eq("owner_id", ownerId),
      client
        .from(PROMPT_VERSION_TABLE)
        .select("*")
        .eq("owner_id", ownerId)
        .order("version"),
    ]);
  for (const result of [
    projectsResult,
    clipsResult,
    refsResult,
    versionsResult,
  ])
    if (result.error) throw result.error;

  const versionsByClip = new Map<string, Row[]>();
  for (const version of (versionsResult.data ?? []) as Row[]) {
    const id = String(version.clip_id);
    versionsByClip.set(id, [...(versionsByClip.get(id) ?? []), version]);
  }
  const clipsByProject = new Map<string, Clip[]>();
  for (const row of (clipsResult.data ?? []) as Row[]) {
    const videoStoragePath = row.video_url ? String(row.video_url) : "";
    const signedVideo = videoStoragePath
      ? await client.storage
          .from(GENERATED_VIDEO_BUCKET)
          .createSignedUrl(videoStoragePath, 3600)
      : null;
    const clip: Clip = {
      id: String(row.id),
      title: String(row.title),
      description: String(row.description ?? ""),
      duration: Number(row.duration),
      referenceIds: (row.reference_ids as string[]) ?? [],
      status: row.status as Clip["status"],
      image: String(row.image_url ?? ""),
      // Rows written before chains existed have no value; those clips continue
      // the previous one, which is how the project already behaved.
      continuesPrevious: row.continues_previous !== false,
      ...(videoStoragePath ? { videoStoragePath } : {}),
      ...(signedVideo?.data?.signedUrl
        ? { videoUrl: signedVideo.data.signedUrl }
        : {}),
      ...(row.requested_change
        ? { requestedChange: String(row.requested_change) }
        : {}),
      ...(row.pending_description
        ? { pendingDescription: String(row.pending_description) }
        : {}),
      ...(row.technical_prompt
        ? { technicalPrompt: String(row.technical_prompt) }
        : {}),
      ...(row.mode ? { mode: row.mode as Clip["mode"] } : {}),
      ...(row.end_state ? { endState: String(row.end_state) } : {}),
      continuityStale: Boolean(row.continuity_stale),
      revision: Number(row.revision ?? 0),
      ...(row.response_id ? { responseId: String(row.response_id) } : {}),
      promptHistory: (versionsByClip.get(String(row.id)) ?? []).map((v) => ({
        description: String(v.description),
        technicalPrompt: String(v.technical_prompt),
        referenceIds: (v.reference_ids as string[]) ?? [],
        duration: Number(v.duration),
        ...(v.end_state ? { endState: String(v.end_state) } : {}),
        savedAt: String(v.created_at),
      })),
    };
    const projectId = String(row.project_id);
    clipsByProject.set(projectId, [
      ...(clipsByProject.get(projectId) ?? []),
      clip,
    ]);
  }
  const refsByProject = new Map<string, string[]>();
  for (const row of (refsResult.data ?? []) as Row[]) {
    const projectId = String(row.project_id);
    refsByProject.set(projectId, [
      ...(refsByProject.get(projectId) ?? []),
      String(row.reference_image_id),
    ]);
  }
  return ((projectsResult.data ?? []) as Row[]).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    story: String(row.story ?? ""),
    ratio: row.ratio as Project["ratio"],
    style: String(row.style ?? "Cinematic"),
    image: String(row.image_url ?? ""),
    referenceIds: refsByProject.get(String(row.id)) ?? [],
    clips: clipsByProject.get(String(row.id)) ?? [],
    updatedAt: String(row.updated_at ?? row.created_at),
  }));
}

export async function saveAccountProject(
  client: SupabaseClient,
  ownerId: string,
  project: Project,
  references: ReferenceImage[],
) {
  if (project.sample) return;
  const existingProject = await client
    .from(PROJECT_TABLE)
    .select("id")
    .eq("id", project.id)
    .maybeSingle();
  if (existingProject.error) throw existingProject.error;
  const projectValues = {
    title: project.title,
    story: project.story,
    ratio: project.ratio,
    style: project.style,
    image_url: project.image,
    updated_at: project.updatedAt,
  };
  const projectResult = existingProject.data
    ? await client.from(PROJECT_TABLE).update(projectValues).eq("id", project.id)
    : await client.from(PROJECT_TABLE).insert({
        id: project.id,
        owner_id: ownerId,
        ...projectValues,
      });
  if (projectResult.error) throw projectResult.error;

  const existingClips = await client
    .from(CLIP_TABLE)
    .select("id")
    .eq("project_id", project.id);
  if (existingClips.error) throw existingClips.error;
  const existingClipIds = new Set(
    (existingClips.data ?? []).map((row) => String(row.id)),
  );

  if (project.clips.length) {
    const clipValues = project.clips.map((clip, position) => ({
      clip,
      values: {
        position,
        title: clip.title,
        description: clip.description,
        duration: clip.duration,
        reference_ids: clip.referenceIds,
        status: clip.status,
        image_url: clip.image,
        video_url: clip.videoStoragePath ?? null,
        requested_change: clip.requestedChange ?? null,
        pending_description: clip.pendingDescription ?? null,
        technical_prompt: clip.technicalPrompt ?? null,
        mode: clip.mode ?? null,
        end_state: clip.endState ?? null,
        continues_previous: clip.continuesPrevious !== false,
        continuity_stale: clip.continuityStale ?? false,
        revision: clip.revision ?? 0,
        response_id: clip.responseId ?? null,
      },
    }));
    const newClips = clipValues
      .filter(({ clip }) => !existingClipIds.has(clip.id))
      .map(({ clip, values }) => ({
        id: clip.id,
        project_id: project.id,
        owner_id: ownerId,
        ...values,
      }));
    if (newClips.length) {
      const inserted = await client.from(CLIP_TABLE).insert(newClips);
      if (inserted.error) throw inserted.error;
    }
    for (const { clip, values } of clipValues) {
      if (!existingClipIds.has(clip.id)) continue;
      const updated = await client
        .from(CLIP_TABLE)
        .update(values)
        .eq("id", clip.id)
        .eq("project_id", project.id);
      if (updated.error) throw updated.error;
    }
  }

  const retained = new Set(project.clips.map((clip) => clip.id));
  const removed = (existingClips.data ?? [])
    .map((row) => row.id)
    .filter((id) => !retained.has(id));
  if (removed.length) {
    const deleted = await client.from(CLIP_TABLE).delete().in("id", removed);
    if (deleted.error) throw deleted.error;
  }

  // Sync by difference. Deleting every link and re-inserting meant a save that
  // carried an empty selection wiped the rows and put nothing back, so an
  // unrelated save could destroy a project's references.
  const existingRefs = await client
    .from(PROJECT_REFERENCE_TABLE)
    .select("reference_image_id")
    .eq("project_id", project.id);
  if (existingRefs.error) throw existingRefs.error;
  const linkedIds = new Set(
    (existingRefs.data ?? []).map((row) => String(row.reference_image_id)),
  );
  const wanted = new Set(project.referenceIds);
  const droppedIds = [...linkedIds].filter((id) => !wanted.has(id));
  const addedIds = project.referenceIds.filter((id) => !linkedIds.has(id));
  if (droppedIds.length) {
    const dropped = await client
      .from(PROJECT_REFERENCE_TABLE)
      .delete()
      .eq("project_id", project.id)
      .in("reference_image_id", droppedIds);
    if (dropped.error) throw dropped.error;
  }
  if (addedIds.length) {
    const names = new Map(
      references.map((reference) => [reference.id, reference.name]),
    );
    const linked = await client.from(PROJECT_REFERENCE_TABLE).insert(
      addedIds.map((referenceId) => ({
        project_id: project.id,
        reference_image_id: referenceId,
        owner_id: ownerId,
        mention_name: names.get(referenceId) ?? referenceId,
      })),
    );
    if (linked.error) throw linked.error;
  }

  const promptRows = project.clips.flatMap((clip) =>
    (clip.promptHistory ?? []).map((version, index) => ({
      clip_id: clip.id,
      owner_id: ownerId,
      version: index + 1,
      description: version.description,
      technical_prompt: version.technicalPrompt,
      reference_ids: version.referenceIds,
      duration: version.duration,
      end_state: version.endState ?? null,
      response_id: clip.responseId ?? null,
      created_at: version.savedAt,
    })),
  );
  if (promptRows.length) {
    const versions = await client
      .from(PROMPT_VERSION_TABLE)
      .upsert(promptRows, {
        onConflict: "clip_id,version",
        ignoreDuplicates: true,
      });
    if (versions.error) throw versions.error;
  }
}
