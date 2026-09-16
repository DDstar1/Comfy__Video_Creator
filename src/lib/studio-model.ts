import type { GeneratedClip } from "./director-contract.ts";

export type ReferenceImage = {
  id: string;
  name: string;
  description: string;
  url: string;
  category: "Character" | "Location" | "Object" | "Image";
  sample?: boolean;
};

/**
 * A clip's visual references are declared in its readable description. Keep
 * the returned order identical to the mentions, since it also defines the
 * <Picture N> order used by the compiled H3 prompt.
 */
export function referenceIdsFromDescription(
  description: string,
  references: ReferenceImage[],
  projectReferenceIds: string[],
) {
  const allowed = new Map(
    references
      .filter((reference) => projectReferenceIds.includes(reference.id))
      .map((reference) => [reference.name, reference.id]),
  );
  const ids: string[] = [];

  for (const match of description.matchAll(/@([\p{L}\p{N}_]+)/gu)) {
    const id = allowed.get(match[1]);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export type Clip = {
  suggestedReferences?: { name: string; description: string }[];
  id: string;
  title: string;
  description: string;
  duration: number;
  renderPreset?: "quick" | "cinematic";
  referenceIds: string[];
  status: "draft" | "ready" | "validated";
  image: string;
  videoUrl?: string;
  videoStoragePath?: string;
  videoAssetId?: string;
  requestedChange?: string;
  pendingDescription?: string;
  technicalPrompt?: string;
  mode?: "T2VA" | "Ref2VA";
  endState?: string;
  // False starts a new chain: the clip is generated with no motion context, so
  // the sequence cuts to it instead of morphing into it. The first clip always
  // starts one. Absent means "continues", which is how every project behaved
  // before chains existed.
  continuesPrevious?: boolean;
  continuityStale?: boolean;
  revision?: number;
  responseId?: string;
  promptHistory?: {
    description: string;
    technicalPrompt: string;
    referenceIds: string[];
    duration: number;
    endState?: string;
    savedAt: string;
  }[];
};export type Project = {
  id: string;
  title: string;
  story: string;
  ratio: "16:9" | "9:16" | "1:1";
  quality?: "draft" | "standard" | "high";
  style: string;
  image: string;
  referenceIds: string[];
  clips: Clip[];
  updatedAt: string;
  sample?: boolean;
};
export const FOREST =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85";
export const PATH =
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1100&q=85";
export const MOUNTAIN =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85";
export const sampleReferences: ReferenceImage[] = [
  {
    id: "ref-elena",
    name: "Elena",
    category: "Character",
    description:
      "Our protagonist. Curious, quietly determined, and drawn to the unknown.",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=85",
    sample: true,
  },
  {
    id: "ref-forest",
    name: "WhisperingForest",
    category: "Location",
    description:
      "An ancient evergreen forest. Tall trees, soft mist, and scattered morning light.",
    url: FOREST,
    sample: true,
  },
  {
    id: "ref-book",
    name: "OldJournal",
    category: "Object",
    description: "A worn journal that holds the clues to a forgotten story.",
    url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=85",
    sample: true,
  },
  {
    id: "ref-mountain",
    name: "NorthernPeaks",
    category: "Location",
    description: "A distant mountain range beyond the edge of the forest.",
    url: MOUNTAIN,
    sample: true,
  },
];
export function createSampleProject(): Project {
  return {
    id: "sample-forest",
    title: "Where the forest remembers",
    story:
      "At the edge of the @WhisperingForest, @Elena pauses. The trees are older than the stories her grandmother used to tell. She opens the @OldJournal, its pages catching the first light of morning. A narrow path disappears into the mist. Somewhere beyond the trees, something is waiting to be found.",
    ratio: "16:9",
    style: "Cinematic",
    image: FOREST,
    referenceIds: ["ref-elena", "ref-forest", "ref-book"],
    sample: true,
    updatedAt: "2026-09-09T09:00:00.000Z",
    clips: [
      {
        id: "clip-1",
        title: "The forest wakes",
        description:
          "Morning mist drifts between ancient trees in @WhisperingForest. The camera slowly moves forward through the stillness, as soft sunlight finds its way through the canopy. A distant birdsong breaks the silence.",
        duration: 5,
        referenceIds: ["ref-forest"],
        status: "validated",
        image: FOREST,
      },
      {
        id: "clip-2",
        title: "A step into the unknown",
        description:
          "@Elena stands at the edge of @WhisperingForest, the @OldJournal held close to her chest. She takes a slow breath and steps onto the narrow path. The camera follows gently behind her, revealing the towering trees ahead. The mood is quiet, curious, and full of possibility.",
        duration: 5,
        referenceIds: ["ref-elena", "ref-forest", "ref-book"],
        status: "draft",
        image: PATH,
      },
      {
        id: "clip-3",
        title: "Between the pages",
        description:
          "A close view of @Elena opening the @OldJournal. Her fingers trace a faded drawing as dappled light moves across the paper. The forest falls softly out of focus behind her.",
        duration: 5,
        referenceIds: ["ref-elena", "ref-book"],
        status: "draft",
        image: sampleReferences[2].url,
      },
      {
        id: "clip-4",
        title: "The path remembers",
        description:
          "The camera moves past @Elena to reveal a winding path through @WhisperingForest. Mist begins to lift. She closes the journal and walks toward the light, her footsteps soft against the earth.",
        duration: 5,
        referenceIds: ["ref-elena", "ref-forest"],
        status: "draft",
        image: FOREST,
      },
    ],
  };
}
export function updateClip(
  project: Project,
  id: string,
  patch: Partial<Clip>,
): Project {
  const clip = project.clips.find((c) => c.id === id);
  if (!clip || clip.status === "validated") return project;
  const { status: _status, id: _id, ...editable } = patch;
  void _status;
  void _id;
  const index = project.clips.findIndex((candidate) => candidate.id === id);
  const { start, chain } = chainMembers(project.clips, index);
  // A continuation inherits its render profile from the first clip in its chain.
  if (editable.renderPreset && index !== start) delete editable.renderPreset;
  const chainIds = chainIndexes(project.clips);
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    clips: project.clips.map((c, position) => {
      if (c.id === id) {
        return {
          ...c,
          ...editable,
          ...(patch.duration !== undefined || patch.referenceIds !== undefined
            ? { continuityStale: true }
            : {}),
        };
      }
      if (editable.renderPreset && chainIds[position] === chain) {
        return { ...c, renderPreset: editable.renderPreset };
      }
      return c;
    }),
  };
}

/** Change whether a draft clip continues the previous one and give every
 * resulting chain the render profile selected by its first clip. */
export function setClipContinuity(
  project: Project,
  id: string,
  continuesPrevious: boolean,
): Project {
  const index = project.clips.findIndex((clip) => clip.id === id);
  if (index <= 0 || project.clips[index]?.status === "validated") return project;
  const updated = project.clips.map((clip) =>
    clip.id === id ? { ...clip, continuesPrevious } : clip,
  );
  const chains = chainIndexes(updated);
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    clips: updated.map((clip, position) => {
      const chainStart = chains.indexOf(chains[position]);
      const renderPreset = updated[chainStart].renderPreset ?? "quick";
      return clip.renderPreset === renderPreset ? clip : { ...clip, renderPreset };
    }),
  };
}
/** Chain number for each clip. A clip that does not continue the previous one
 *  starts a new chain, and each chain renders with its own motion-context cache. */
export function chainIndexes(clips: Clip[]): number[] {
  let chain = -1;
  return clips.map((clip, index) => {
    if (index === 0 || clip.continuesPrevious === false) chain += 1;
    return chain;
  });
}

/** The clips sharing a chain with `index`, and where that chain starts. */
export function chainMembers(clips: Clip[], index: number) {
  const chains = chainIndexes(clips);
  const chain = chains[index];
  const start = chains.indexOf(chain);
  return {
    chain,
    start,
    members: clips.filter((_, position) => chains[position] === chain),
  };
}

export function validateClip(project: Project, id: string): Project {
  const index = project.clips.findIndex((c) => c.id === id);
  const clip = project.clips[index];
  // Only the clips before this one *in the same chain* have to be approved.
  // Earlier chains are separate takes joined by a cut, so they neither feed
  // this clip's motion context nor block it.
  const { start } = chainMembers(project.clips, index);
  if (
    !clip ||
    clip.status !== "ready" ||
    !clip.videoUrl ||
    clip.pendingDescription ||
    clip.requestedChange ||
    clip.continuityStale ||
    project.clips.slice(start, index).some((c) => c.status !== "validated")
  )
    return project;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    clips: project.clips.map((c) =>
      c.id === id ? { ...c, status: "validated" } : c,
    ),
  };
}
export function canChangeProjectSettings(project: Project) {
  return !project.clips.some((c) => c.status === "validated");
}
export function newProject(title: string, story: string, settings: Pick<Project, "ratio" | "quality"> = { ratio: "16:9", quality: "draft" }): Project {
  return {
    id: crypto.randomUUID(),
    title,
    story,
    ...settings,
    style: "Cinematic",
    image: "",
    referenceIds: [],
    clips: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Starts a clean production pass from an existing plan. The original project
 * remains untouched: approved clips and their rendered media stay available
 * there for reference, while the copy has fresh clip ids and no render state.
 */
export function duplicateProjectAsDraft(project: Project): Project {
  const now = new Date().toISOString();
  return {
    ...project,
    id: crypto.randomUUID(),
    title: `${project.title} — new version`,
    sample: undefined,
    updatedAt: now,
    clips: project.clips.map((clip) => ({
      id: crypto.randomUUID(),
      title: clip.title,
      description: clip.description,
      duration: clip.duration,
      referenceIds: [...clip.referenceIds],
      suggestedReferences: clip.suggestedReferences
        ? clip.suggestedReferences.map((reference) => ({ ...reference }))
        : undefined,
      status: "draft",
      image: clip.image,
      technicalPrompt: clip.technicalPrompt,
      mode: clip.mode,
      endState: clip.endState,
      continuesPrevious: clip.continuesPrevious,
      continuityStale: false,
      revision: undefined,
      videoUrl: undefined,
      videoStoragePath: undefined,
      requestedChange: undefined,
      pendingDescription: undefined,
      responseId: undefined,
      promptHistory: undefined,
    })),
  };
}
export function resolveSuggestedReference(project: Project, name: string, image?: ReferenceImage): Project {
  const matches = (clip: Clip) => clip.status !== "validated" &&
    clip.suggestedReferences?.some((ref) => ref.name === name);
  if (image && !project.referenceIds.includes(image.id) && project.referenceIds.length >= 9)
    throw new Error("A project can use up to nine reference images.");
  if (image && project.clips.some((clip) => matches(clip) && !clip.referenceIds.includes(image.id) && clip.referenceIds.length >= 9))
    throw new Error("One of these clips already has nine reference images.");
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    referenceIds: image ? [...new Set([...project.referenceIds, image.id])] : project.referenceIds,
    clips: project.clips.map((clip) => matches(clip) ? {
      ...clip,
      suggestedReferences: clip.suggestedReferences?.filter((ref) => ref.name !== name),
      ...(image ? {
        // Linking an uploaded image writes its @mention into the readable
        // description; compilation then derives referenceIds from that text.
        pendingDescription: `${clip.pendingDescription ?? clip.description}${(clip.pendingDescription ?? clip.description).includes(`@${image.name}`) ? "" : ` @${image.name}`}`.trim(),
        requestedChange: [clip.requestedChange, `Use the linked image @${image.name} (ID ${image.id}) as the visual reference for ${name}.`].filter(Boolean).join("\n").slice(0, 4000),
        continuityStale: true,
        status: "draft" as const,
        videoUrl: undefined,
        videoStoragePath: undefined,
      } : {}),
    } : clip),
  };
}
export function newClip(index: number): Clip {
  return {
    id: crypto.randomUUID(),
    title: `Clip ${String(index + 1).padStart(2, "0")}`,
    description: "",
    duration: 5,
    referenceIds: [],
    status: "draft",
    image: "",
  };
}

export function applyCompiledClip(
  project: Project,
  id: string,
  result: GeneratedClip,
  responseId: string,
): Project {
  const index = project.clips.findIndex((c) => c.id === id);
  const current = project.clips[index];
  if (!current || current.status === "validated") return project;
  const history = [...(current.promptHistory ?? [])];
  if (current.technicalPrompt)
    history.push({
      description: current.description,
      technicalPrompt: current.technicalPrompt,
      referenceIds: current.referenceIds,
      duration: current.duration,
      endState: current.endState,
      savedAt: new Date().toISOString(),
    });
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    clips: project.clips.map((clip, i) => {
      if (i === index)
        return {
          ...clip,
          ...result,
          status: "draft",
          videoUrl: undefined,
          pendingDescription: undefined,
          requestedChange: undefined,
          continuityStale: false,
          revision: (clip.revision ?? 0) + 1,
          responseId,
          promptHistory: history,
        };
      if (i > index && clip.status !== "validated")
        return { ...clip, continuityStale: true };
      return clip;
    }),
  };
}
