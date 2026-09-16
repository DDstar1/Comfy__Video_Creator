"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Copy,
  Clock3,
  CreditCard,
  ExternalLink,
  Film,
  FolderOpen,
  Grid2X2,
  ImageIcon,
  ImagePlus,
  Leaf,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Link2,
  Plus,
  Play,
  Scissors,
  Trash2,
  Search,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  supabase,
  REFERENCE_BUCKET,
  REFERENCE_TABLE,
  RENDER_JOB_TABLE,
} from "@/lib/supabase";
import { loadAccountProject, loadProjectSummaries, saveAccountProject, type ProjectSummary } from "@/lib/project-store";
import { readStudioRoute, studioUrl, type StudioRoute } from "@/lib/studio-route";
import {
  applyCompiledClip,
  canChangeProjectSettings,
  chainIndexes,
  chainMembers,
  createSampleProject,
  setClipContinuity,
  duplicateProjectAsDraft,
  newClip,
  sampleReferences,
  referenceIdsFromDescription,
  resolveSuggestedReference,
  updateClip,
  validateClip,
  type Clip,
  type Project,
  type ReferenceImage,
} from "@/lib/studio-model";
import { AuthForm, NewProjectForm, UploadForm } from "./studio-forms";
import { directorOutputSchema } from "@/lib/director-contract";
import { assembleH3Workflow } from "@/lib/render-workflow";
import { readRenderStatus } from "@/lib/render-status";
import { Mentions, MentionEditor, Modal, Photo } from "./ui";
import { ProjectMerge } from "./project-merge";

type Tab = "story" | "references" | "clips";
type Dialog =
  "new" | "auth" | "upload" | "help" | "settings" | "account" | "validate" | "regenerate" | "wallet" | "delete" | null;
type Route = StudioRoute;

type ClipTransition = { direction: 1 | -1; distance: string };
const clipDetailVariants = {
  initial: (transition: ClipTransition = { direction: 1, distance: "0%" }) => ({
    x: transition.direction === 1 ? transition.distance : `-${transition.distance}`,
  }),
  visible: { x: 0, y: 0 },
  exit: (transition: ClipTransition = { direction: 1, distance: "0%" }) => ({
    x: transition.direction === 1 ? `-${transition.distance}` : transition.distance,
  }),
};

export default function Studio({ initialRoute = { view: "projects" } }: { initialRoute?: Route }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Workspace key={user?.id ?? "guest"} user={user} authReady={authReady} initialRoute={initialRoute} />
  );
}

function Workspace({
  user,
  authReady,
  initialRoute,
}: {
  user: User | null;
  authReady: boolean;
  initialRoute: Route;
}) {
  // Supabase hands back a new user object on every auth event, including token
  // refreshes and tab focus. Effects keyed on the object itself therefore
  // re-ran and replaced local state with the database, discarding edits that
  // had not finished saving. Key them on the stable id instead.
  const userId = user?.id ?? null;
  const reduceMotion = useReducedMotion();
  const [projects, setProjects] = useState<Project[]>([createSampleProject()]);
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [route, setRoute] = useState<Route>(initialRoute);
  const [loadedProjectId, setLoadedProjectId] = useState<string>();
  const [projectError, setProjectError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [clipId, setClipId] = useState("clip-2");
  const [clipTransitionDirection, setClipTransitionDirection] = useState<1 | -1>(1);
  const [references, setReferences] =
    useState<ReferenceImage[]>(sampleReferences);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [quickSettingsProject, setQuickSettingsProject] = useState<Project | null>(null);
  const [renders, setRenders] = useState<
    Record<string, { jobId?: string; status: string; error?: string }>
  >({});
  const [wallet, setWallet] = useState({ balance_cents: 0, reserved_cents: 0, unlimited: false });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiController = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<ReferenceImage | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All projects");
  const [refFilter, setRefFilter] = useState("All references");
  const [referenceSuggestion, setReferenceSuggestion] = useState<{ name: string; description: string }>();
  const [listView, setListView] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [validationBusy, setValidationBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  // Last state known to match the database, keyed by project id. Project
  // objects are replaced immutably on edit, so identity is the change signal.
  // Without this the autosave rewrote every project whenever the reference
  // library finished loading, letting one project's incomplete in-memory state
  // reach the database with no user action.
  const persisted = useRef(new Map<string, Project>());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = useCallback(
    (message: string) => {
      setNotice(message);
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(""), 6500);
    },
    [setNotice],
  );
  const refreshWallet = useCallback(async () => {
    if (!user || !supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const response = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
    if (response.ok) setWallet(await response.json());
  }, [user]);
  useEffect(() => { queueMicrotask(() => void refreshWallet()); }, [refreshWallet]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(media.matches);
    queueMicrotask(update);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileNav || !isMobile) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    navRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = navRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href]",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileNav, isMobile]);

  useEffect(() => {
    const syncRoute = () => {
      const next = readStudioRoute(new URL(window.location.href));
      if (/^#\/?(project|projects|library)(\/|$)/.test(window.location.hash))
        window.history.replaceState(null, "", studioUrl(next));
      setRoute(next);
    };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    if (!userId || !supabase) {
      queueMicrotask(() => {
        if (active) setReady(true);
      });
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (active) {
        setReady(false);
        setSaveError("");
      }
    });
    void loadProjectSummaries(supabase, userId)
      .then((saved) => {
        if (!active) return;
        setSummaries(saved);
      })
      .catch((error: unknown) => {
        if (active)
          setSaveError(
            error instanceof Error
              ? error.message
              : "Your projects could not be loaded from Supabase.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authReady, userId]);

  // Keep the request effect independent of local edits and token refreshes.
  const latest = useRef({ projects, references });
  useEffect(() => { latest.current = { projects, references }; }, [projects, references]);
  const selectedProjectId = route.view === "studio" ? route.projectId : undefined;
  useEffect(() => {
    if (!authReady || !userId || !supabase || !selectedProjectId || selectedProjectId === "sample-forest") return;
    let active = true;
    const client = supabase;
    queueMicrotask(() => { if (active) { setProjectError(""); setLoadedProjectId(undefined); } });
    const request = saveQueue.current.then(async () => {
      for (const item of latest.current.projects) {
        if (!item.sample && persisted.current.get(item.id) !== item) {
          await saveAccountProject(client, userId, item, latest.current.references);
          persisted.current.set(item.id, item);
        }
      }
    });
    saveQueue.current = request.catch(() => {});
    void request.then(() => loadAccountProject(client, userId, selectedProjectId))
      .then((saved) => {
        if (!active) return;
        const loaded = saved[0];
        if (!loaded) throw new Error("This project is unavailable or belongs to another account.");
        persisted.current.set(loaded.id, loaded);
        setProjects((current) => [...current.filter((p) => p.id !== loaded.id), loaded]);
        setClipId(loaded.clips.find((c) => c.status !== "validated")?.id ?? loaded.clips[0]?.id ?? "");
        setLoadedProjectId(loaded.id);
      }).catch((error: unknown) => {
        if (active) setProjectError(error instanceof Error ? error.message : "This project could not be loaded. Try again.");
      });
    return () => { active = false; };
  }, [authReady, userId, selectedProjectId, loadAttempt]);

  useEffect(() => {
    if (!ready || !userId || !supabase) return;
    const client = supabase;
    const changed = projects.filter(
      (item) => !item.sample && persisted.current.get(item.id) !== item,
    );
    if (!changed.length) return;
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .then(async () => {
          for (const item of changed) {
            if (persisted.current.get(item.id) === item) continue;
            await saveAccountProject(client, userId, item, references);
            persisted.current.set(item.id, item);
          }
        })
        .then(() => setSaveError(""))
        .catch((error: unknown) =>
          setSaveError(
            error instanceof Error
              ? error.message
              : "Your project could not be saved to Supabase.",
          ),
        );
    }, 800);
    return () => clearTimeout(timer);
  }, [projects, ready, references, userId]);

  const loadLibrary = useCallback(async () => {
    if (!userId || !supabase) return;
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const { data, error } = await supabase
        .from(REFERENCE_TABLE)
        .select("id,name,description,storage_path")
        .eq("owner_id", userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const client = supabase;
      setReferences([
        ...data.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: "Image" as const,
          url: client.storage
            .from(REFERENCE_BUCKET)
            .getPublicUrl(row.storage_path).data.publicUrl,
        })),
        ...sampleReferences,
      ]);
    } catch (err) {
      setLibraryError(
        err instanceof Error
          ? err.message
          : "Your reference library could not be loaded.",
      );
    } finally {
      setLibraryLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (userId) queueMicrotask(() => void loadLibrary());
  }, [userId, loadLibrary, selectedProjectId]);

  const project = projects.find((p) => p.id === route.projectId &&
    (p.sample || loadedProjectId === route.projectId));
  const settingsProject = project ?? quickSettingsProject;
  const clip =
    project?.clips.find((c) => c.id === clipId) ??
    project?.clips.find((c) => c.status !== "validated") ??
    project?.clips[0];
  const tab = route.tab ?? "clips";
  function selectClip(nextId: string) {
    if (!project || !clip || nextId === clip.id) {
      setClipId(nextId);
      return;
    }
    const currentIndex = project.clips.findIndex((item) => item.id === clip.id);
    const nextIndex = project.clips.findIndex((item) => item.id === nextId);
    if (nextIndex >= 0 && currentIndex >= 0) {
      setClipTransitionDirection(nextIndex > currentIndex ? 1 : -1);
    }
    setClipId(nextId);
  }
  function navigate(next: Route) {
    window.history.pushState(null, "", studioUrl(next));
    setRoute(next);
    setQuery("");
    setMobileNav(false);
  }
  function saveProject(next: Project) {
    setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }
  const isRendering = (clipId: string) =>
    ["preparing", "queued", "running"].includes(renders[clipId]?.status ?? "");
  function modifyProject(patch: Partial<Project>) {
    if (project && (patch.ratio || patch.quality) &&
        project.clips.length > 0) {
      notify("Output settings are fixed for this project's clips.");
      return;
    }
    if (project)
      saveProject({
        ...project,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
  }
  function resolveReference(name: string, image?: ReferenceImage) {
    if (!project) return;
    if (project.clips.some((c) => isRendering(c.id))) {
      notify("Wait for the current render before changing references.");
      return;
    }
    try {
      saveProject(resolveSuggestedReference(project, name, image));
      notify(image ? "Image linked across clips. Recompile affected prompts before generating." : "Suggestion removed across draft clips.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update references.");
    }
  }
  // Polling is what ingests a finished render: the status route copies the video
  // out of RunPod into permanent storage. Keeping it in a named function means a
  // render can be picked back up after a reload instead of being stranded, and
  // the session is re-read each pass so a token refresh mid-render cannot 401.
  const followRender = useCallback(
    async (jobId: string, clipId: string, projectId: string) => {
      const client = supabase;
      if (!client) return;
      try {
        for (;;) {
          const { data } = await client.auth.getSession();
          if (!data.session) throw new Error("Sign in to generate clips.");
          const statusResponse = await readRenderStatus(() => fetch(
            `/api/renders?jobId=${encodeURIComponent(jobId)}`,
            {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
              cache: "no-store",
            },
          ));
          const result = await statusResponse.json();
          if (!statusResponse.ok)
            throw new Error(result.error ?? "Render status could not be read.");
          if (result.status === "failed" || result.status === "cancelled")
            throw new Error(result.error_message ?? "The render failed.");
          if (result.status === "completed") {
            setProjects((current) =>
              current.map((item) =>
                item.id !== projectId
                  ? item
                  : {
                      ...item,
                      updatedAt: new Date().toISOString(),
                      clips: item.clips.map((candidate) =>
                        candidate.id === clipId
                          ? {
                              ...candidate,
                              status: "ready" as const,
                              videoUrl: result.videoUrl,
                              videoStoragePath: result.videoStoragePath,
                              videoAssetId: result.videoAssetId,
                            }
                          : candidate,
                      ),
                    },
              ),
            );
            setRenders((current) => ({
              ...current,
              [clipId]: { jobId, status: "completed" },
            }));
            notify("Your clip is ready to preview and validate.");
            void refreshWallet();
            return;
          }
          setRenders((current) => ({
            ...current,
            [clipId]: { jobId, status: result.status },
          }));
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The render failed.";
        setRenders((current) => ({
          ...current,
          [clipId]: { ...current[clipId], jobId, status: "failed", error: message },
        }));
        notify(message);
      }
    },
    [refreshWallet, notify],
  );

  // A render survives the page that started it. RunPod keeps a finished result
  // for roughly half an hour, so re-attaching on load recovers a clip whose tab
  // was reloaded or closed; without this the GPU time is paid for and the video
  // is never ingested.
  useEffect(() => {
    if (!ready || !userId || !supabase || !selectedProjectId || selectedProjectId === "sample-forest") return;
    const client = supabase;
    let active = true;
    void (async () => {
      const { data, error } = await client
        .from(RENDER_JOB_TABLE)
        .select("id,clip_id,project_id,status")
        .eq("owner_id", userId)
        .eq("project_id", selectedProjectId)
        .in("status", ["submitting", "queued", "running"]);
      if (error || !active || !data?.length) return;
      for (const job of data) {
        const clipId = String(job.clip_id);
        let alreadyFollowed = false;
        setRenders((current) => {
          alreadyFollowed = Boolean(current[clipId]);
          return alreadyFollowed
            ? current
            : { ...current, [clipId]: { jobId: String(job.id), status: String(job.status) } };
        });
        if (alreadyFollowed) continue;
        void followRender(String(job.id), clipId, String(job.project_id));
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, userId, followRender, selectedProjectId]);

  async function generateClip(target: Clip) {
    if (!project || !user || !supabase) {
      if (!user) setDialog("auth");
      return;
    }
    if (["preparing", "queued", "running"].includes(renders[target.id]?.status))
      return;
    setRenders((current) => ({
      ...current,
      [target.id]: { status: "preparing" },
    }));
    try {
      await saveAccountProject(supabase, user.id, project, references);
      const payload = await assembleH3Workflow(project, target, references);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to generate clips.");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      };
      const response = await fetch("/api/renders", {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: project.id,
          clipId: target.id,
          ...payload,
        }),
      });
      const submitted = await response.json();
      if (!response.ok)
        throw new Error(submitted.error ?? "The render could not be started.");
      setRenders((current) => ({
        ...current,
        [target.id]: { jobId: submitted.jobId, status: "queued" },
      }));
      await followRender(submitted.jobId, target.id, project.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The render failed.";
      setRenders((current) => ({
        ...current,
        [target.id]: {
          ...current[target.id],
          status: "failed",
          error: message,
        },
      }));
      notify(message);
    }
  }
  async function askDirector(
    action: "plan" | "revise",
    target?: Clip,
    patch?: Partial<Clip>,
  ) {
    if (!project || aiBusy) return;
    const effectiveDescription = target
      ? patch?.pendingDescription ?? target.pendingDescription ?? target.description
      : "";
    const referenceIds = target
      ? referenceIdsFromDescription(
          effectiveDescription,
          references,
          project.referenceIds,
        )
      : [];
    const snapshot = target
      ? updateClip(project, target.id, { ...patch, referenceIds })
      : project;
    if (target) saveProject(snapshot);
    setAiError("");
    setAiBusy(true);
    const controller = new AbortController();
    aiController.current = controller;
    try {
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const response = await fetch("/api/director", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          action,
          clipId: target?.id,
          project: snapshot,
          references: references.filter((r) =>
            snapshot.referenceIds.includes(r.id),
          ),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            "The writing assistant could not complete this request.",
        );
      const parsed = directorOutputSchema.parse({ clips: result.clips });
      const clips = parsed.clips.map((clip) => ({
        ...clip,
        referenceIds: referenceIdsFromDescription(
          clip.description,
          references,
          snapshot.referenceIds,
        ),
      }));
      if (controller.signal.aborted) {
        if (process.env.NODE_ENV === "development")
          console.warn("Director result discarded: aborted after response", {
            action,
            clipId: target?.id,
            responseId: result.responseId,
          });
        return;
      }
      if (action === "plan") {
        const plannedClips = clips.map((c) => ({
          ...newClip(0),
          ...c,
          image: references.find((r) => r.id === c.referenceIds[0])?.url ?? "",
          revision: 1,
          responseId: result.responseId,
        }));
        saveProject({
          ...snapshot,
          clips: plannedClips,
          updatedAt: new Date().toISOString(),
        });
        setClipId(plannedClips[0].id);
        navigate({ view: "studio", projectId: snapshot.id, tab: "clips" });
      } else if (target) {
        const applied = applyCompiledClip(
          snapshot,
          target.id,
          clips[0],
          result.responseId,
        );
        if (process.env.NODE_ENV === "development") {
          const before = snapshot.clips.find((c) => c.id === target.id);
          const after = applied.clips.find((c) => c.id === target.id);
          console.warn("Director revise outcome", {
            clipId: target.id,
            returnedSnapshotUnchanged: applied === snapshot,
            clipPresentInSnapshot: Boolean(before),
            statusInSnapshot: before?.status,
            promptChanged: before?.technicalPrompt !== after?.technicalPrompt,
            descriptionChanged: before?.description !== after?.description,
            revisionBefore: before?.revision,
            revisionAfter: after?.revision,
          });
        }
        saveProject(applied);
      }
      notify(
        action === "plan"
          ? "Clip plan and H3 prompts saved."
          : "Description and H3 prompt updated together. Later draft clips are marked for continuity review.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setAiError(
          error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "The model returned an invalid result. Your previous prompt is unchanged.",
        );
    } finally {
      if (aiController.current === controller) {
        setAiBusy(false);
        aiController.current = null;
      }
    }
  }
  function openProject(p: ProjectSummary) {
    navigate({ view: "studio", projectId: p.id, tab: "clips" });
  }
  async function regenerateClip(target: Clip) {
    if (!project || !user || !supabase || regenerating) return;
    setRegenerating(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again before regenerating.");
      const response = await fetch("/api/clips/regenerate", {
        method: "POST",
        headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, clipId: target.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Clip regeneration could not be prepared.");
      const loaded = await loadAccountProject(supabase, user.id, project.id);
      const refreshed = loaded.find((item) => item.id === project.id);
      if (!refreshed) throw new Error("The regenerated project could not be reloaded.");
      persisted.current.set(refreshed.id, refreshed);
      saveProject(refreshed);
      setRenders((current) => {
        const next = { ...current };
        for (const id of result.resetClipIds ?? []) delete next[id];
        return next;
      });
      setClipId(target.id);
      setDialog(null);
      notify(result.retainedMotionPrefix
        ? "Later clips were reset. This clip keeps the approved motion context before it."
        : "This chain was reset from its first clip.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Clip regeneration could not be prepared.");
    } finally {
      setRegenerating(false);
    }
  }
  async function openQuickSettings(p: ProjectSummary) {
    if (!user || !supabase) return;
    try {
      const loaded = await loadAccountProject(supabase, user.id, p.id);
      const target = loaded.find((item) => item.id === p.id);
      if (!target) throw new Error("Project details could not be loaded.");
      setProjects((current) => [target, ...current.filter((item) => item.id !== target.id)]);
      setQuickSettingsProject(target);
      setDialog("settings");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Project settings could not be opened.");
    }
  }
  function createProject(p: Project) {
    setProjects((prev) => [p, ...prev]);
    setDialog(null);
    navigate({ view: "studio", projectId: p.id, tab: "story" });
    notify("Project created. Your project is saved to your account.");
  }
  function duplicateProject(source = settingsProject, openAfter = true) {
    if (!source) return;
    const duplicate = duplicateProjectAsDraft(source);
    setProjects((prev) => [duplicate, ...prev]);
    setClipId(duplicate.clips[0]?.id ?? "");
    if (openAfter) navigate({ view: "studio", projectId: duplicate.id, tab: "clips" });
    else setQuickSettingsProject(duplicate);
    notify("New project version created. All clips are fresh drafts with no generated video.");
  }
  async function deleteProject() {
    const target = settingsProject;
    if (!target || !user || !supabase) return;
    setDeleteBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again before deleting this project.");
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: target.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Project deletion failed.");
      persisted.current.delete(target.id);
      setProjects((current) => current.filter((item) => item.id !== target.id));
      setSummaries((current) => current.filter((item) => item.id !== target.id));
      setQuickSettingsProject(null);
      setDialog(null);
      if (route.view === "studio" && project?.id === target.id) navigate({ view: "projects" });
      notify("Project, generated videos, and RunPod cache deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Project deletion failed.");
    } finally {
      setDeleteBusy(false);
    }
  }  function addClip() {
    if (!project) return;
    const next = newClip(project.clips.length);
    modifyProject({ clips: [...project.clips, next] });
    setClipId(next.id);
    notify("A new clip draft is ready for your ideas.");
  }
  function removeClip(id: string) {
    if (!project) return;
    const index = project.clips.findIndex((c) => c.id === id);
    const target = project.clips[index];
    // Validated clips are the motion context later clips were generated from,
    // so removing one would invalidate work that is already approved.
    if (!target || target.status === "validated") return;
    const remaining = project.clips.filter((c) => c.id !== id);
    modifyProject({ clips: remaining });
    setClipId(remaining[Math.max(0, index - 1)]?.id ?? "");
    notify("Clip removed.");
  }
  function toggleReference(id: string) {
    if (!project) return;
    if (project.referenceIds.includes(id)) {
      if (project.clips.some((c) => c.referenceIds.includes(id))) {
        notify(
          "This image is used by a clip. Keep it in the project to preserve that reference.",
        );
        return;
      }
      modifyProject({
        referenceIds: project.referenceIds.filter((r) => r !== id),
      });
    } else modifyProject({ referenceIds: [...project.referenceIds, id] });
  }
  function showMention(name: string) {
    const ref = references.find((r) => r.name === name);
    if (ref) setPreview(ref);
    else notify(`@${name} has no matching image yet. Add it in References.`);
  }
  function exportDraft(source = project) {
    if (!source) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "comfyTR-draft-v1",
            project: source,
            references: references
              .filter((r) => source.referenceIds.includes(r.id))
              .map(({ id, name, url, description }) => ({
                id,
                name,
                url,
                description,
              })),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = source.title.replace(/[^a-z0-9-]/gi, "-").toLowerCase() + "-draft.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(
      "Draft backup downloaded. This is a story plan, not an executable ComfyUI workflow.",
    );
  }
  const referenceList = references.filter(
    (r) =>
      (refFilter === "All references" ||
        (refFilter === "My uploads" ? !r.sample : r.category === refFilter)) &&
      `${r.name} ${r.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const projectSummaries: ProjectSummary[] = [...new Map([
    ...summaries.map((p) => [p.id, p] as const),
    ...projects.map((p) => [p.id, p] as const),
  ]).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projectList = projectSummaries.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All projects" ||
        (filter === "Examples" ? p.sample : !p.sample)),
  );
  const selectedReferences = references.filter((r) =>
    project?.referenceIds.includes(r.id),
  );
  const validatedCount =
    project?.clips.filter((c) => c.status === "validated").length ?? 0;
  const userLabel = user?.email?.split("@")[0] ?? "Your workspace";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        ref={navRef}
        className={`sidebar ${mobileNav ? "open" : ""}`}
        inert={isMobile && !mobileNav}
        role={isMobile && mobileNav ? "dialog" : undefined}
        aria-modal={isMobile && mobileNav ? true : undefined}
        aria-label="Workspace navigation"
      >
          <Link className="brand" href="/" aria-label="Return to the ClipWeave landing page">
            <Image className="brand-mark" src="/brand/clipweave-mark.png" alt="" width={32} height={35} priority />
            <span>
              Clip<span className="brand-tr">Weave</span>
            </span>
          </Link>

        <div className="workspace-switch">
          <span className="workspace-avatar">{userLabel[0].toUpperCase()}</span>
          <div>
            <strong>{userLabel}</strong>
            <span>Personal studio</span>
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <button
          className="button primary new-project-button"
          onClick={() => setDialog("new")}
        >
          <Plus size={18} /> New project
        </button>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${route.view !== "library" ? "active" : ""}`}
            onClick={() => navigate({ view: "projects" })}
          >
            <FolderOpen size={19} />
            <span>Projects</span>
            <span className="nav-count">{projectSummaries.length}</span>
          </button>
          <button
            className={`nav-item ${route.view === "library" ? "active" : ""}`}
            onClick={() => navigate({ view: "library" })}
          >
            <ImageIcon size={19} />
            <span>Reference library</span>
          </button>
        </nav>
        <div className="recent-nav">
          <span className="nav-caption">RECENT PROJECTS</span>
          {projectSummaries.slice(0, 4).map((p) => (
            <a
              key={p.id}
              href={studioUrl({ view: "studio", projectId: p.id })}
              title={p.title}
              className={`recent-item ${project?.id === p.id && route.view === "studio" ? "selected" : ""}`}
              onClick={(e) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); openProject(p); } }}
            >
              <span className="project-dot" />
              <span>{p.title}</span>
            </a>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="inspiration-note">
            <Leaf size={21} strokeWidth={1.5} />
            <strong>Big stories start small.</strong>
            <p>
              A scene, a sentence, a spark.
              <br />
              Let’s see where yours goes.
            </p>
            <button onClick={() => setDialog("new")}>
              Start something new <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setDialog("help")}>
            <CircleHelp size={18} />
            <span>A little guidance</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            className="account-row"
            onClick={() => setDialog(user ? "account" : "auth")}
          >
            <span className="account-avatar">
              {user ? userLabel.slice(0, 2).toUpperCase() : "Y"}
            </span>
            <div>
              <strong>{user ? userLabel : "Make yourself at home"}</strong>
              <span>
                {user ? "Account settings" : "Sign in to your account"}
              </span>
            </div>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <button
              onClick={() =>
                navigate({
                  view: route.view === "library" ? "library" : "projects",
                })
              }
            >
              {route.view === "library" ? "Reference library" : "Projects"}
            </button>
            {project && (
              <>
                <ChevronRight size={14} />
                <strong>{project.title}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {wallet.unlimited && <a href="/admin" className="wallet-pill">Admin</a>}
            <span className="save-indicator">
              <span />
              {saveError
                ? "Save needs attention"
                : "Projects saved to Supabase"}
            </span>
            {user && (
              <button className="wallet-pill" onClick={() => setDialog("wallet")} aria-label="Open wallet">
                <CreditCard size={15} /> {wallet.unlimited ? "Unlimited" : `$${(wallet.balance_cents / 100).toFixed(2)}`}
              </button>
            )}
            <button
              className="top-avatar"
              onClick={() => setDialog(user ? "account" : "auth")}
              aria-label={user ? "Account settings" : "Sign in"}
            >
              {userLabel[0].toUpperCase()}
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {saveError && (
            <div className="error-banner" role="alert">
              {saveError}
              {project && (
                <button onClick={() => exportDraft()}>Download backup</button>
              )}
            </div>
          )}
          {route.view === "studio" && project ? (
            <>
              <div className="project-heading">
                <div>
                  <button
                    className="back-link"
                    onClick={() => navigate({ view: "projects" })}
                  >
                    <ArrowLeft size={14} /> All projects
                  </button>
                  <div className="title-row">
                    <h1>{project.title}</h1>
                    <span className="badge neutral">
                      {project.sample ? "Example project" : "Draft project"}
                    </span>
                  </div>
                  <p>A story taking shape, one scene at a time.</p>
                </div>
                <div className="heading-actions">

                  <button
                    className="button secondary"
                    aria-label="Project settings"
                    onClick={() => setDialog("settings")}
                  >
                    <Settings2 size={16} />
                    <span>Project settings</span>
                  </button>
                  <button
                    className="button secondary icon-only"
                    aria-label="Download project draft"
                    title="Download project draft"
                    onClick={() => exportDraft()}
                  >
                    <ArrowDownToLine size={17} />
                  </button>
                </div>
              </div>
              <div className="project-hero">
                <Photo
                  key={project.image}
                  src={project.image}
                  alt={
                    project.sample
                      ? "Forest atmosphere for the example story"
                      : "Visual direction for your project"
                  }
                />
                <div className="hero-shade" />
                <div className="hero-content">
                  <span className="hero-eyebrow">
                    <Film size={14} /> YOUR STORY, IN MOTION
                  </span>
                  <h2>
                    {project.sample ? (
                      <>
                        A little mystery.
                        <br />A world of possibility.
                      </>
                    ) : (
                      <>
                        Your next story.
                        <br />
                        Waiting to unfold.
                      </>
                    )}
                  </h2>
                  <div className="hero-meta">
                    <span>
                      <Clapperboard size={14} />
                      {project.clips.length} clips
                    </span>
                    <span>
                      <Clock3 size={14} />
                      {project.clips.reduce((n, c) => n + c.duration, 0)}{" "}
                      seconds planned
                    </span>
                    <span>{project.ratio}</span>
                    <span>{project.quality ?? "draft"} quality</span>
                    <span>{project.style}</span>
                  </div>
                </div>
                <span className="hero-label">
                  {project.sample
                    ? "Reference imagery · example story"
                    : "Your creative canvas"}
                </span>
              </div>
              <div className="studio-tabbar">
                <div
                  className="tabs"
                  role="tablist"
                  aria-label="Project sections"
                >
                  {(
                    [
                      { id: "story", title: "Story", icon: BookOpen },
                      {
                        id: "references",
                        title: "References",
                        icon: ImageIcon,
                      },
                      { id: "clips", title: "Clips", icon: Clapperboard },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      id={`project-tab-${t.id}`}
                      aria-controls="project-panel"
                      tabIndex={tab === t.id ? 0 : -1}
                      onKeyDown={(event) => {
                        const ids: Tab[] = ["story", "references", "clips"];
                        let target: Tab | undefined;
                        if (event.key === "ArrowRight")
                          target = ids[(ids.indexOf(tab) + 1) % 3];
                        if (event.key === "ArrowLeft")
                          target = ids[(ids.indexOf(tab) + 2) % 3];
                        if (event.key === "Home") target = "story";
                        if (event.key === "End") target = "clips";
                        if (target) {
                          event.preventDefault();
                          navigate({
                            view: "studio",
                            projectId: project.id,
                            tab: target,
                          });
                          document
                            .getElementById(`project-tab-${target}`)
                            ?.focus();
                        }
                      }}
                      aria-selected={tab === t.id}
                      className={tab === t.id ? "active" : ""}
                      onClick={() =>
                        navigate({
                          view: "studio",
                          projectId: project.id,
                          tab: t.id,
                        })
                      }
                    >
                      <t.icon size={17} />
                      {t.title}
                      {t.id === "references" && (
                        <span>{selectedReferences.length}</span>
                      )}
                      {t.id === "clips" && <span>{project.clips.length}</span>}
                    </button>
                  ))}
                </div>
                <span className="tab-helper">
                  <span className="tiny-dot" />
                  {validatedCount} of {project.clips.length} clips{" "}
                  {project.sample ? "approved in example" : "validated"}
                </span>
              </div>

              <div
                id="project-panel"
                role="tabpanel"
                aria-labelledby={`project-tab-${tab}`}
              >
                {tab === "story" && (
                  <section className="story-layout" aria-label="Story editor">
                    <div className="panel story-panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">
                            THE BEGINNING OF EVERYTHING
                          </span>
                          <h2>Your story</h2>
                          <p>Set the scene. We’ll help you find the frames.</p>
                        </div>
                        <BookOpen size={23} />
                      </div>
                      <label className="field story-field">
                        Scene or video idea
                        <textarea
                          value={project.story}
                          rows={11}
                          onChange={(e) =>
                            modifyProject({ story: e.target.value })
                          }
                          placeholder="Tell us the story you want to bring to life…"
                        />
                      </label>
                      <div className="story-mention-row">
                        <span>Mention a reference</span>
                        {selectedReferences.map((r) => (
                          <button
                            className="reference-chip"
                            key={r.id}
                            onClick={() =>
                              modifyProject({
                                story: `${project.story}${project.story.endsWith(" ") ? "" : " "}@${r.name}`,
                              })
                            }
                          >
                            <Photo src={r.url} alt="" />@{r.name}
                          </button>
                        ))}
                        <button
                          className="small-add"
                          onClick={() =>
                            navigate({
                              view: "studio",
                              projectId: project.id,
                              tab: "references",
                            })
                          }
                        >
                          <Plus size={14} /> Add references
                        </button>
                      </div>
                      <div className="panel-footer">
                        <span className="small muted">
                          {
                            project.story.trim().split(/\s+/).filter(Boolean)
                              .length
                          }{" "}
                          words · Saved to your account
                        </span>
                        <button
                          className="button primary"
                          disabled={
                            !project.story.trim() ||
                            project.clips.length > 0 ||
                            aiBusy
                          }
                          onClick={() => void askDirector("plan")}
                        >
                          <Sparkles size={16} /> Create clip plan
                        </button>
                      </div>
                    </div>
                    <aside className="story-aside">
                      <div className="panel">
                        <span className="eyebrow">SET THE MOOD</span>
                        <h3>A world that feels like yours.</h3>
                        <label className="field">
                          Visual direction
                          <select
                            value={project.style}
                            disabled={!canChangeProjectSettings(project)}
                            onChange={(e) =>
                              modifyProject({ style: e.target.value })
                            }
                          >
                            <option>Cinematic</option>
                            <option>Natural & documentary</option>
                            <option>Dreamlike</option>
                            <option>Animated</option>
                          </select>
                        </label>
                        <label className="field">
                          Frame shape
                          <select
                            value={project.ratio}
                            disabled={project.clips.length > 0}
                            onChange={(e) =>
                              modifyProject({
                                ratio: e.target.value as Project["ratio"],
                              })
                            }
                          >
                            <option value="16:9">Landscape · 16:9</option>
                            <option value="9:16">Portrait · 9:16</option>
                            <option value="1:1">Square · 1:1</option>
                          </select>
                        </label>
                        <label className="field">
                          Quality
                          <select value={project.quality ?? "draft"}
                            disabled={project.clips.length > 0}
                            onChange={(e) => modifyProject({ quality: e.target.value as Project["quality"] })}>
                            <option value="draft">Draft</option>
                            <option value="standard">Standard</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                        {project.clips.length > 0 && <p className="small muted"><LockKeyhole size={13} /> Quality and frame size apply to every clip.</p>}
                        {!canChangeProjectSettings(project) && (
                          <p className="small muted">
                            <LockKeyhole size={13} /> Settings are locked after
                            a clip is validated.
                          </p>
                        )}
                      </div>
                      <div className="writing-tip">
                        <Sparkles size={21} />
                        <h3>Think in moments.</h3>
                        <p>
                          A glance over the shoulder. The light through a
                          window. Small, specific details make a scene feel
                          real.
                        </p>
                        <span>YOUR STORYTELLING COMPANION</span>
                      </div>
                    </aside>
                  </section>
                )}

                {tab === "references" && (
                  <section className="project-reference-section">
                    <div className="section-heading">
                      <div>
                        <h2>The faces, places, and little details.</h2>
                        <p>
                          Choose images from your library to give this story its
                          own world.
                        </p>
                      </div>
                      <button
                        className="button primary"
                        onClick={() => setDialog(user ? "upload" : "auth")}
                      >
                        <Upload size={16} /> Upload image
                      </button>
                    </div>
                    <div className="reference-selection-note">
                      <ImageIcon size={17} />
                      {selectedReferences.length} selected for this project{" "}
                      <span>Up to 9 images can be used in each clip.</span>
                    </div>
                    {renderLibraryControls()}
                    {renderReferenceGrid(true)}
                  </section>
                )}

                {tab === "clips" && (
                  <section className="clips-section">
                    <ProjectMerge key={project.id} project={project} />
                    <div className="section-heading">
                      <div>
                        <h2>Your story, frame by frame.</h2>
                        <p>
                          Shape each moment. When it feels right, make it part
                          of the story.
                        </p>
                      </div>
                      <button className="button secondary" onClick={addClip}>
                        <Plus size={16} /> Add clip
                      </button>
                    </div>
                    {project.clips.length ? (
                      <div className="clip-workspace">
                        <div className="clip-sequence">
                          <div className="sequence-header">
                            <span>CLIP SEQUENCE</span>
                            <span>
                              {String(project.clips.length).padStart(2, "0")}
                            </span>
                          </div>
                          <div className="clip-track">
                            {(() => {
                              // Clips sharing a chain (one continuing the next)
                              // render inside one shared, darker group so the
                              // story's cuts are visible in the sequence itself,
                              // not just inside an opened clip.
                              const chains = chainIndexes(project.clips);
                              const groups: { chain: number; clips: Clip[] }[] = [];
                              project.clips.forEach((c, i) => {
                                const last = groups[groups.length - 1];
                                if (last && last.chain === chains[i]) last.clips.push(c);
                                else groups.push({ chain: chains[i], clips: [c] });
                              });
                              let position = 0;
                              return groups.map((group) => {
                                const startIndex = position;
                                position += group.clips.length;
                                return (
                                  <div key={group.chain} className={`chain-group${group.clips.length > 1 ? " chain-group-connected" : ""}`}>
                                    {group.clips.map((c, offset) => {
                                      const index = startIndex + offset;
                                      return (
                                        <button
                                          key={c.id}
                                          className={`clip-card ${clip?.id === c.id ? "selected" : ""} ${isRendering(c.id) ? "generating" : ""}`}
                                          aria-busy={isRendering(c.id)}
                                          onClick={() => selectClip(c.id)}
                                          aria-pressed={clip?.id === c.id}
                                        >
                                          <div className="clip-thumb">
                                            <Photo
                                              src={c.image}
                                              alt={`${c.title} reference still`}
                                            />
                                            <span className="clip-number">
                                              {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="duration">{c.duration}s</span>
                                          </div>
                                          <div className="clip-card-content">
                                            <div className="clip-card-title">
                                              <strong>{c.title}</strong>
                                              <ChevronRight size={15} />
                                            </div>
                                            <p>
                                              {(
                                                c.pendingDescription ?? c.description
                                              ).replace(/@/g, "") ||
                                                "A new moment, waiting to be written."}
                                            </p>
                                            <div className="clip-card-bottom">
                                              <span
                                                className={`status ${c.status === "validated" ? "approved" : ""}`}
                                                aria-live="polite"
                                              >
                                                {isRendering(c.id) ? (
                                                  <LoaderCircle size={12} className="spin" aria-hidden="true" />
                                                ) : c.status === "validated" ? (
                                                  <Check size={12} />
                                                ) : (
                                                  <span className="tiny-dot" />
                                                )}
                                                {isRendering(c.id)
                                                  ? "Generating"
                                                  : c.status === "validated"
                                                  ? "Validated"
                                                  : c.pendingDescription ||
                                                      c.requestedChange
                                                    ? "Revision pending"
                                                    : "Draft"}
                                              </span>
                                              <span>
                                                {c.referenceIds.length} references
                                              </span>
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          <div className="continuity-note">
                            <AudioLines size={18} />
                            <p>
                              Every clip carries the story forward.
                              <br />
                              <strong>Continuity is part of the plan.</strong>
                            </p>
                          </div>
                        </div>
                        <div className="clip-detail-slider">
                          <AnimatePresence
                            mode="popLayout"
                            initial={false}
                            custom={{
                              direction: clipTransitionDirection,
                              distance: reduceMotion ? "0%" : "108%",
                            }}
                          >
                            {clip && (
                              <motion.div
                                key={clip.id}
                                custom={{
                                  direction: clipTransitionDirection,
                                  distance: reduceMotion ? "0%" : "108%",
                                }}
                                variants={clipDetailVariants}
                                initial="initial"
                                animate="visible"
                                exit="exit"
                                transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
                              >
                              <ClipEditor
                                key={`${clip.id}:${clip.revision ?? 0}`}
                                project={project}
                                clip={clip}
                                references={references}
                                onResolveReference={resolveReference}
                                onUploadReference={(suggestion) => {
                                  setReferenceSuggestion(suggestion);
                                  setDialog(user ? "upload" : "auth");
                                }}
                                onChange={(patch) =>
                                  saveProject(updateClip(project, clip.id, patch))
                                }
                                onChangeContinuity={() =>
                                  saveProject(
                                    setClipContinuity(project, clip.id, clip.continuesPrevious === false),
                                  )
                                }
                                onMention={showMention}
                                onCompile={(patch) =>
                                  void askDirector("revise", clip, patch)
                                }
                                renderState={renders[clip.id]}
                                onGenerate={() => void generateClip(clip)}
                                onRegenerate={() => setDialog("regenerate")}
                                onRemove={() => removeClip(clip.id)}
                                onValidate={() => setDialog("validate")}
                                onNotice={notify}
                                onNext={() => {
                                  const next =
                                    project.clips[
                                      project.clips.findIndex(
                                        (c) => c.id === clip.id,
                                      ) + 1
                                  ];
                                  if (next) selectClip(next.id);
                                }}
                              />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state panel">
                        <span className="empty-icon">
                          <Clapperboard size={30} />
                        </span>
                        <h3>Your next scene starts here.</h3>
                        <p>
                          Add a clip draft yourself, or connect the writing
                          assistant to turn your story into a clip plan.
                        </p>
                        <div>
                          <button
                            className="button secondary"
                            onClick={addClip}
                          >
                            <Plus size={16} /> Add a clip draft
                          </button>
                          <button
                            className="button primary"
                            onClick={() => void askDirector("plan")}
                          >
                            <Sparkles size={16} /> Create clip plan
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
              <footer className="page-footer">
                <span>
                  <Leaf size={14} /> Made for the stories only you can tell.
                </span>
                <span>
                  ClipWeave is operated by DTECH SOFTWARE LAB ENTERPRISE, a
                  business registered in Nigeria.
                </span>
              </footer>
            </>
          ) : route.view === "studio" ? (
            <div className="empty-state panel">
              <FolderOpen size={32} />
              <h2>{!authReady ? "Loading your account..." : !userId ? "Sign in to open this project" : projectError ? "Project unavailable" : "Loading project..."}</h2>
              <p role="status">{projectError || (!userId && authReady ? "Use the account where this project was created." : "Fetching the saved project and clips.")}</p>
              {!userId && authReady && <button className="button primary" onClick={() => setDialog("auth")}>Sign in</button>}
              {projectError && <button className="button secondary" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</button>}
              <button
                className="button primary"
                onClick={() => navigate({ view: "projects" })}
              >
                Go to projects
              </button>
            </div>
          ) : route.view === "projects" ? (
            <>
              <div className="overview-heading">
                <span className="eyebrow">A SPACE FOR YOUR IMAGINATION</span>
                <div className="title-row">
                  <h1>Good stories deserve to be seen.</h1>
                </div>
                <p>
                  From a few words to a world of your own. What will you create
                  today?
                </p>
              </div>
              <div className="create-banner">
                <div>
                  <span className="eyebrow">YOUR NEXT CHAPTER</span>
                  <h2>It starts with a spark.</h2>
                  <p>
                    Bring a passage from your book, or an idea that’s entirely
                    yours.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setDialog("new")}
                  >
                    Create a new project <ArrowRight size={16} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-frame back">
                    <Photo src={sampleReferences[3].url} alt="" />
                  </div>
                  <div className="art-frame front">
                    <Photo src={sampleReferences[1].url} alt="" />
                    <span>
                      <Clapperboard size={14} /> A story waiting to happen
                    </span>
                  </div>
                  <Sparkles className="art-sparkle" size={29} />
                </div>
              </div>
              <div className="section-heading projects-list-heading">
                <div>
                  <h2>
                    Your projects{" "}
                    <span className="count-inline">{projectSummaries.length}</span>
                  </h2>
                  <p>Pick up where your imagination left off.</p>
                </div>
                <div className="view-switch">
                  <button
                    className={!listView ? "active" : ""}
                    aria-label="Grid view"
                    aria-pressed={!listView}
                    onClick={() => setListView(false)}
                  >
                    <Grid2X2 size={17} />
                  </button>
                  <button
                    className={listView ? "active" : ""}
                    aria-label="List view"
                    aria-pressed={listView}
                    onClick={() => setListView(true)}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
              <div className="filter-toolbar">
                <div className="filter-chips">
                  {["All projects", "My drafts", "Examples"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search projects"
                    placeholder="Search your projects…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              <div className={`project-grid ${listView ? "list-view" : ""}`}>
                {projectList.map((p) => (
                  <div className="project-card-wrap" key={p.id}>
                    <a
                      className="project-card"
                      href={studioUrl({ view: "studio", projectId: p.id })}
                      onClick={(e) => {
                        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                          e.preventDefault();
                          openProject(p);
                        }
                      }}
                    >
                      <div className="project-card-image">
                        <Photo src={p.image} alt={`${p.title} cover`} />
                        <span className="image-badge">
                          {p.sample ? "Example project" : "Draft"}
                        </span>
                      </div>
                      <div className="project-card-info">
                        <h3>{p.title}</h3>
                        <div>
                          <span><Clapperboard size={13} /> Open project</span>
                          <span>{p.ratio}</span>
                          <span>{p.sample ? "Explore the studio" : "Saved to account"}</span>
                        </div>
                      </div>
                    </a>
                    <button
                      className="project-card-settings"
                      aria-label={`Project settings for ${p.title}`}
                      title="Project settings"
                      onClick={() => void openQuickSettings(p)}
                    >
                      <Settings2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="new-project-card"
                  onClick={() => setDialog("new")}
                >
                  <span>
                    <Plus size={26} />
                  </span>
                  <strong>A blank canvas.</strong>
                  <p>Make room for your next story.</p>
                </button>
              </div>
              {!projectList.length && (
                <p className="search-empty">
                  No projects match this search. Try another name or filter.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="library-heading">
                <div>
                  <span className="eyebrow">
                    THE BUILDING BLOCKS OF YOUR WORLD
                  </span>
                  <h1>Your reference library.</h1>
                  <p>
                    Familiar faces. Faraway places. A collection of things that
                    make your stories yours.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setDialog(user ? "upload" : "auth")}
                >
                  <Plus size={17} /> Upload image
                </button>
              </div>
              <div className="library-info">
                <span className="library-info-icon">
                  <ImageIcon size={22} />
                </span>
                <div>
                  <strong>Collect once. Create again and again.</strong>
                  <p>
                    Your uploaded references live in your account and can be
                    used across projects. Images are public by link.
                  </p>
                </div>
                <span className="badge neutral">
                  {references.filter((r) => !r.sample).length} account images
                </span>
              </div>
              {renderLibraryControls()}
              {renderReferenceGrid(false)}
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === "delete" && settingsProject && (
        <Modal title="Delete this project?" eyebrow="PERMANENT ACTION" onClose={() => !deleteBusy && setDialog(null)}>
          <p className="modal-intro">
            This permanently removes <strong>{settingsProject.title}</strong>, its clips, generated videos, and matching RunPod motion cache. Your account reference images stay in your library.
          </p>
          <div className="modal-footer">
            <button className="button secondary" disabled={deleteBusy} onClick={() => setDialog(null)}>Keep project</button>
            <button className="button danger" disabled={deleteBusy} onClick={() => void deleteProject()}>
              <Trash2 size={16} /> {deleteBusy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      )}      {dialog === "new" && (
        <NewProjectForm
          onClose={() => setDialog(null)}
          onCreate={createProject}
        />
      )}
      {dialog === "auth" && (
        <AuthForm
          onClose={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            notify("You’re signed in. Your account library is ready.");
          }}
        />
      )}
      {dialog === "upload" && user && (
        <UploadForm
          userId={user.id}
          suggestion={referenceSuggestion}
          onClose={() => { setDialog(null); setReferenceSuggestion(undefined); }}
          onUploaded={(image) => {
            setReferences((prev) => [image, ...prev]);
            if (project && referenceSuggestion) {
              resolveReference(referenceSuggestion.name, image);
            } else if (project && route.view === "studio")
              modifyProject({
                referenceIds: [...project.referenceIds, image.id],
                ...(!project.image ? { image: image.url } : {}),
              });
            setDialog(null);
            setReferenceSuggestion(undefined);
            notify("Image uploaded to your public account library.");
          }}
        />
      )}
      {aiBusy && (
        <Modal
          title="Shaping your story…"
          eyebrow="WRITING ASSISTANT"
          onClose={() => {
            aiController.current?.abort();
            setAiBusy(false);
          }}
        >
          <p className="modal-intro" role="status">
            <LoaderCircle size={20} className="spin" /> Reading the H3 Director
            guides and compiling your scene. This can take a few minutes.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              aiController.current?.abort();
              setAiBusy(false);
            }}
          >
            Cancel request
          </button>
        </Modal>
      )}
      {aiError && (
        <Modal
          title="Your prompt is unchanged"
          eyebrow="WRITING ASSISTANT"
          onClose={() => setAiError("")}
        >
          <p className="modal-intro" role="alert">
            {aiError}
          </p>
          <button className="button primary" onClick={() => setAiError("")}>
            Back to my story
          </button>
        </Modal>
      )}
      {preview && (
        <Modal
          title={preview.name}
          eyebrow={`${preview.category.toUpperCase()} REFERENCE${preview.sample ? " · EXAMPLE" : ""}`}
          onClose={() => setPreview(null)}
        >
          <Photo
            className="reference-preview"
            src={preview.url}
            alt={preview.name}
          />
          <p className="modal-intro">
            {preview.description || "A picture for your next story."}
          </p>
          <div className="reference-detail-footer">
            <code>@{preview.name}</code>
            <a
              className="button secondary"
              href={preview.url}
              target="_blank"
              rel="noreferrer"
            >
              Open image <ExternalLink size={14} />
            </a>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="From your words to a whole new world."
          eyebrow="A LITTLE GUIDANCE"
          onClose={() => setDialog(null)}
        >
          <div className="help-steps">
            {[
              [
                "Start with your story",
                "Paste a scene or upload a TXT/Markdown file. You can also describe an original idea.",
              ],
              [
                "Give it a familiar face",
                "Upload images to your account, add them to a project, and mention them using @Name.",
              ],
              [
                "Shape each moment",
                "Review readable clip descriptions. Edit the description or leave a short revision request for the writing assistant.",
              ],
              [
                "Make it part of the story",
                "Generate and watch each clip, then validate it. Validated clips are permanently locked.",
              ],
            ].map(([title, text], i) => (
              <div key={title}>
                <span className="step-dot">{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">
            This version supports Supabase projects, image uploads, AI prompt
            planning, prepaid credit and RunPod video rendering.
          </p>
          <button
            className="button primary full-width"
            onClick={() => setDialog(null)}
          >
            Let’s make something <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {dialog === "settings" && settingsProject && (
        <Modal title="Project quick settings" eyebrow="SETTINGS" onClose={() => setDialog(null)}>
          <label className="field">
            Project name
            <input
              value={settingsProject.title}
              maxLength={200}
              onChange={(e) => {
                const title = e.target.value.trim();
                if (!title) return;
                if (project?.id === settingsProject.id) {
                  modifyProject({ title: e.target.value });
                  return;
                }
                const next = { ...settingsProject, title: e.target.value, updatedAt: new Date().toISOString() };
                setQuickSettingsProject(next);
                setProjects((current) => current.map((item) => item.id === next.id ? next : item));
              }}
            />
          </label>
          <p className="small muted">Quick settings do not open the project editor.</p>
          <div className="project-settings-actions">
            <span className="eyebrow">PROJECT ACTIONS</span>
            <button
              className="button secondary full-width"
              onClick={() => {
                setDialog(null);
                duplicateProject(settingsProject, false);
              }}
            >
              <Copy size={16} /> Create a new project version
            </button>
            <button className="button danger full-width" onClick={() => setDialog("delete")}>
              <Trash2 size={16} /> Delete this project
            </button>
          </div>
        </Modal>
      )}      {dialog === "account" && (
        <Modal title="Your creative workspace." eyebrow="ACCOUNT" onClose={() => setDialog(null)}>
          <div className="account-settings">
            <span className="account-avatar large">{userLabel[0].toUpperCase()}</span>
            <div>
              <strong>{user?.email ?? "You’re exploring as a guest"}</strong>
              <p>Account reference library connected</p>
            </div>
          </div>
          <button
            className="button secondary full-width"
            onClick={async () => {
              const result = await supabase?.auth.signOut();
              if (result?.error) notify(result.error.message);
              else setDialog(null);
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </Modal>
      )}      {dialog === "wallet" && user && (
        <WalletDialog
          unlimited={wallet.unlimited} balanceCents={wallet.balance_cents}
          reservedCents={wallet.reserved_cents}
          onClose={() => setDialog(null)}
          onRefresh={refreshWallet}
        />
      )}
      {dialog === "validate" && project && clip && (
        <Modal
          title="Make this moment final?"
          eyebrow="VALIDATE CLIP"
          onClose={() => setDialog(null)}
        >
          <p className="modal-intro">
            Validating “{clip.title}” locks its description, reference images,
            and generation settings. You cannot edit this clip afterward.
          </p>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Keep reviewing
            </button>
            <button
              className="button primary"
              disabled={validationBusy}
              onClick={async () => {
                const next = validateClip(project, clip.id);
                if (next === project) {
                  notify(
                    "Validation needs a generated video, no pending edits, and earlier clips in this scene validated.",
                  );
                  return;
                }
                if (!supabase || !user) return;
                setValidationBusy(true);
                try {
                  const client = supabase;
                  saveQueue.current = saveQueue.current.then(() =>
                    saveAccountProject(client, user.id, next, references),
                  );
                  await saveQueue.current;
                  persisted.current.set(next.id, next);
                  saveProject(next);
                  setSaveError("");
                  notify("Clip validated and locked.");
                  setDialog(null);
                } catch (error) {
                  saveQueue.current = Promise.resolve();
                  const message = error && typeof error === "object" && "message" in error
                    ? String(error.message) : "Validation could not be saved. Please try again.";
                  setSaveError(message);
                  notify(message);
                } finally {
                  setValidationBusy(false);
                }
              }}
            >
              <CheckCheck size={16} /> {validationBusy ? "Saving validation…" : "Validate and lock"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "regenerate" && project && clip && (
        <Modal
          title="Make a new version of this clip?"
          onClose={() => !regenerating && setDialog(null)}
        >
          <p className="modal-intro">
            This will replace this clip’s video. Any clips after it will need to be made again, because they continue from this moment.
          </p>
          <p className="small muted">The clips before this one will stay unchanged.</p>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={regenerating}
              onClick={() => setDialog(null)}
            >
              Go back
            </button>
            <button
              className="button danger"
              disabled={regenerating}
              onClick={() => void regenerateClip(clip)}
            >
              {regenerating ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {regenerating ? "Making new version…" : "Make new version"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  function renderLibraryControls() {
    return (
      <>
        <div className="filter-toolbar">
          <div className="filter-chips">
            {[
              "All references",
              "My uploads",
              "Character",
              "Location",
              "Object",
            ].map((f) => (
              <button
                key={f}
                className={refFilter === f ? "active" : ""}
                onClick={() => setRefFilter(f)}
              >
                {f === "Character"
                  ? "Characters"
                  : f === "Location"
                    ? "Locations"
                    : f === "Object"
                      ? "Objects"
                      : f}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search references"
              placeholder="Find a face, a place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {libraryError && (
          <div className="error-banner" role="alert">
            {libraryError}
            <button onClick={() => void loadLibrary()}>Try again</button>
          </div>
        )}
        {libraryLoading && (
          <p className="loading-line" role="status">
            <LoaderCircle className="spin" size={16} /> Loading your library…
          </p>
        )}
      </>
    );
  }
  function renderReferenceGrid(selection: boolean) {
    return (
      <>
        <div className="reference-grid">
          {referenceList.map((r) => (
            <article
              key={r.id}
              className={`reference-card ${selection && project?.referenceIds.includes(r.id) ? "chosen" : ""}`}
            >
              <button
                className="reference-image-button"
                onClick={() => setPreview(r)}
                aria-label={`Preview ${r.name}`}
              >
                <Photo src={r.url} alt={r.name} />
                <span className="reference-category">
                  {r.sample ? `Example · ${r.category}` : "Account image"}
                </span>
              </button>
              <div className="reference-card-info">
                <div>
                  <strong>{r.name}</strong>
                  {selection && (
                    <button
                      className={`reference-select ${project?.referenceIds.includes(r.id) ? "checked" : ""}`}
                      aria-label={`${project?.referenceIds.includes(r.id) ? "Remove" : "Add"} ${r.name} ${project?.referenceIds.includes(r.id) ? "from" : "to"} project`}
                      aria-pressed={project?.referenceIds.includes(r.id)}
                      onClick={() => toggleReference(r.id)}
                    >
                      {project?.referenceIds.includes(r.id) ? (
                        <Check size={15} />
                      ) : (
                        <Plus size={15} />
                      )}
                    </button>
                  )}
                </div>
                <p>{r.description || "Ready for a story of its own."}</p>
                <span className="reference-handle">@{r.name}</span>
              </div>
            </article>
          ))}
          <button
            className="upload-reference-card"
            onClick={() => setDialog(user ? "upload" : "auth")}
          >
            <span>
              <ImagePlus size={25} />
            </span>
            <strong>Add a little inspiration</strong>
            <p>Upload a reference image</p>
            <span className="small">JPEG, PNG, WebP</span>
          </button>
        </div>
        {!referenceList.length && (
          <p className="search-empty">
            {refFilter === "My uploads"
              ? user
                ? "Your account library is ready for its first image."
                : "Sign in to start your own reference library."
              : "No references match. Try another name or filter."}
          </p>
        )}
        <p className="reference-footnote">
          {!user
            ? "Example images are here to help you explore. Sign in to start your own library."
            : "Example images are inspiration only. Your uploads are stored in your account."}
        </p>
      </>
    );
  }
}

function WalletDialog({ unlimited, balanceCents, reservedCents, onClose, onRefresh }: {
  unlimited: boolean; balanceCents: number; reservedCents: number; onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setBusy(true); setError("");
    try {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) throw new Error("Sign in to add funds.");
      const response = await fetch("/api/payments/creem", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ amountUsd: Number(amount) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Checkout could not be opened.");
      window.location.assign(result.checkoutUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout could not be opened."); setBusy(false); }
  }
  if (unlimited) return <Modal title="Your generation wallet" eyebrow="OWNER ACCESS" onClose={onClose}><p>Your account has unlimited generation credit. No wallet top-up is required.</p></Modal>;
  return <Modal title="Your generation wallet" eyebrow="WALLET" onClose={onClose}>
    <div className="wallet-balance"><span>Available credit</span><strong>${(balanceCents / 100).toFixed(2)}</strong>
      {reservedCents > 0 && <small>${(reservedCents / 100).toFixed(2)} reserved for active renders</small>}
    </div>
    <label className="field">Amount to add (USD)<input type="number" min="5" max="1000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <p className="small muted">The minimum top-up is $5. Each completed render costs its RunPod compute time plus a $0.30 ClipWeave fee. Failed jobs return their full reservation.</p>
    <p className="small muted">Payments for ClipWeave services are collected by DTECH SOFTWARE LAB ENTERPRISE, the registered Nigerian business that operates ClipWeave. Wallet credit is non-transferable, cannot be withdrawn as cash, and may only be used for ClipWeave services.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button className="button secondary" onClick={() => void onRefresh()}>Refresh balance</button><button className="button primary" disabled={busy || Number(amount) < 5} onClick={checkout}><CreditCard size={16} /> {busy ? "Opening…" : "Add funds"}</button></div>
  </Modal>;
}

function VolumeBackedVideo({ assetId }: { assetId: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void (async () => {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in to play this video.");
      const response = await fetch(`/api/videos/${assetId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("The video could not be loaded from the render volume.");
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setSrc(objectUrl);
    })().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "The video could not be loaded."); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId]);
  if (error) return <p className="modal-intro">{error}</p>;
  if (!src) return <p className="modal-intro"><LoaderCircle size={16} className="spin" /> Loading video from render storage…</p>;
  return <video className="video-preview" controls src={src} />;
}
function ClipEditor({
  project,
  clip,
  references,
  onChange,
  onChangeContinuity,
  onMention,
  renderState,
  onGenerate,
  onRegenerate,
  onCompile,
  onValidate,
  onRemove,
  onNotice,
  onNext,
  onResolveReference,
  onUploadReference,
}: {
  project: Project;
  clip: Clip;
  references: ReferenceImage[];
  onChange: (patch: Partial<Clip>) => void;
  onChangeContinuity: () => void;
  onMention: (name: string) => void;
  renderState?: { jobId?: string; status: string; error?: string };
  onGenerate: () => void;
  onRegenerate: () => void;
  onCompile: (patch?: Partial<Clip>) => void;
  onValidate: () => void;
  onRemove: () => void;
  onNotice: (message: string) => void;
  onNext: () => void;
  onResolveReference: (name: string, image?: ReferenceImage) => void;
  onUploadReference: (suggestion: { name: string; description: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(
    clip.pendingDescription ?? clip.description,
  );
  const [request, setRequest] = useState(clip.requestedChange ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openLockHelp, setOpenLockHelp] = useState<"duration" | "render" | null>(null);
  const [shakeGenerate, setShakeGenerate] = useState(false);
  const locked = clip.status === "validated";
  const rendering =
    !!renderState &&
    ["preparing", "queued", "running"].includes(renderState.status);
  const index = project.clips.findIndex((c) => c.id === clip.id);
  // The first clip always starts a chain; there is nothing before it to continue.
  const continues = index > 0 && clip.continuesPrevious !== false;
  const { start: chainStart } = chainMembers(project.clips, index);
  const isChainFollower = index > chainStart;
  const canEditStory = !locked;
  const chainRenderPreset = project.clips[chainStart]?.renderPreset ?? "quick";
  const referenceDescription = editing
    ? description
    : clip.pendingDescription ?? clip.description;
  const usedRefIds = referenceIdsFromDescription(
    referenceDescription,
    references,
    project.referenceIds,
  );
  const usedRefs = usedRefIds.flatMap((id) =>
    references.filter((reference) => reference.id === id),
  );
  const priorReady = project.clips
    .slice(chainMembers(project.clips, index).start, index)
    .every((c) => c.status === "validated");
  const nextExists = index < project.clips.length - 1;
  // Shared with both the note text above the action button and the button's own
  // click guard, so the two can never disagree about why generating is blocked.
  const generateBlockReason = !priorReady
    ? "Validate earlier clips in this scene before generating this one."
    : project.sample
      ? "This is an example project. Start your own to generate real clips."
      : clip.suggestedReferences?.length
        ? "Resolve the suggested references above before generating this clip."
        : !clip.technicalPrompt
          ? "Compile a prompt before generating this clip."
          : clip.pendingDescription
            ? "Recompile the prompt to include your latest edit before generating."
            : clip.requestedChange
              ? "Submit or discard your pending change request before generating."
              : clip.continuityStale
                ? "This clip's continuity needs review — recompile before generating."
                : null;
  // Kept separate from generateBlockReason: validating an already-rendered,
  // ready clip never depended on suggestedReferences/technicalPrompt/sample,
  // and reusing the broader reason would have quietly started blocking it too.
  const validateBlockReason = !priorReady
    ? "Validate earlier clips in this scene before generating this one."
    : clip.pendingDescription
      ? "Recompile the prompt to include your latest edit before validating."
      : clip.requestedChange
        ? "Submit or discard your pending change request before validating."
        : clip.continuityStale
          ? "This clip's continuity needs review — recompile before validating."
          : null;
  const editorRef = useRef<HTMLDivElement>(null);
  function saveEdit() {
    if (!description.trim()) return;
    setEditing(false);
    onCompile({ pendingDescription: description.trim(), referenceIds: usedRefIds });
  }
  return (
    <article className="clip-editor panel">
      <div className="editor-heading">
        <div>
          <span className="eyebrow clip-position">
            CLIP {index + 1}/{project.clips.length}
          </span>
          <h3>{clip.title}</h3>
        </div>
        <div className="editor-heading-actions">
          {index > 0 && (
            <button
              className={`clip-continuity ${continues ? "joined" : "cut"}`}
              onClick={() =>
                locked
                  ? onNotice("Validated clips keep the timing they were approved with.")
                  : onChangeContinuity()
              }
              aria-pressed={continues}
              title={
                continues
                  ? "Continues the previous clip as one take. Click to cut instead."
                  : "Cuts to this clip. Click to continue the previous one instead."
              }
            >
              {continues ? <Link2 size={13} /> : <Scissors size={13} />}
              {continues ? "Continues" : "Cuts here"}
            </button>
          )}
          <span className={`badge ${locked ? "green" : "ochre"}`}>
            {locked ? <Check size={12} /> : <span className="tiny-dot" />}
            {locked
              ? "Validated"
              : clip.pendingDescription || clip.requestedChange
                ? "Revision pending"
                : "Ready to shape"}
          </span>
          {canEditStory && (
            <button
              className="clip-remove"
              onClick={onRemove}
              title="Remove this clip"
              aria-label={`Remove clip ${index + 1}, ${clip.title}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <button
        className="scene-preview"
        onClick={() => setPreviewOpen(true)}
        aria-label={
          (clip.videoUrl || clip.videoAssetId) ? "Open generated clip preview" : "Open reference still"
        }
      >
        <Photo
          src={clip.image || usedRefs[0]?.url}
          alt={`${clip.title} scene reference`}
        />
        <span className="preview-gradient" />
        <span className="preview-caption">
          <span>
            <ImageIcon size={14} />
            {(clip.videoUrl || clip.videoAssetId)
              ? "View clip preview"
              : "Scene reference · not a generated video"}
          </span>
          <span>{clip.duration}s planned</span>
        </span>
        {(clip.videoUrl || clip.videoAssetId) && <span className="preview-play" aria-hidden="true"><Play size={22} fill="currentColor" /></span>}
      </button>
      <div className="editor-body">
        <div className="description-heading">
          <label htmlFor="clip-description">The scene, in your words</label>
          {canEditStory && (
            <button
              className="text-button"
              onClick={() => {
                setDescription(clip.pendingDescription ?? clip.description);
                setEditing(!editing);
                if (!editing) setTimeout(() => editorRef.current?.focus(), 0);
              }}
            >
              {editing ? "Cancel edit" : "Edit description"}
              {!editing && <WandSparkles size={13} />}
            </button>
          )}
        </div>
        {editing ? (
          <div className="description-edit">
            <div className="description-textarea-wrap">
              <MentionEditor
                editorRef={editorRef}
                text={description}
                references={references.filter((reference) =>
                  project.referenceIds.includes(reference.id),
                )}
                onChange={setDescription}
              />
            </div>
            <div>
              <span className="small muted">
                Saving updates the H3 prompt through the writing assistant.
              </span>
              <button
                className="button primary small-button"
                disabled={!description.trim()}
                onClick={saveEdit}
              >
                Update prompt <Check size={14} />
              </button>
            </div>
          </div>
        ) : (
          <p className="scene-description">
            <Mentions
              text={
                (clip.pendingDescription ?? clip.description) ||
                "Describe this moment. What do we see, how does it feel, and where does the camera go?"
              }
              onMention={onMention}
            />
          </p>
        )}
        {canEditStory && !editing && (
          <div className="pending-note">
            <span>
              {clip.continuityStale
                ? "Continuity review needed"
                : clip.technicalPrompt
                  ? `H3 prompt compiled · revision ${clip.revision ?? 1}`
                  : "H3 prompt not compiled yet"}
            </span>
            <button
              className="text-button"
              onClick={() => onCompile()}
              disabled={
                !clip.description.trim() && !clip.pendingDescription?.trim()
              }
            >
              {clip.technicalPrompt ? "Recompile prompt" : "Compile prompt"}
            </button>
          </div>
        )}
        {clip.pendingDescription && !editing && (
          <div className="pending-note">
            <Clock3 size={13} />
            <span>Readable revision saved · awaiting prompt compilation</span>
            <button
              className="text-button"
              onClick={() => {
                onChange({ pendingDescription: undefined });
                setDescription(clip.description);
                onNotice(
                  "Pending readable edit discarded. The original description is restored.",
                );
              }}
            >
              Discard edit
            </button>
          </div>
        )}
        <div className="clip-references-heading">
          <span>
            IN THIS CLIP <span>{usedRefs.length}/9</span>
          </span>
        </div>
        <div className="reference-chips">
          {usedRefs.map((r) => (
            <button
              key={r.id}
              className="reference-chip reference-linked"
              onClick={() => onMention(r.name)}
            >
              <Photo src={r.url} alt="" />
              {r.name}
              <Check size={13} /> <span>Linked</span>
            </button>
          ))}
          {!usedRefs.length && !clip.suggestedReferences?.length && (
            <span className="small muted">Mention project images in the description to add them here.</span>
          )}
        </div>
        {!!clip.suggestedReferences?.length && (
          <div className="suggested-references">
            {clip.suggestedReferences.map((suggestion) => (
              <div className="reference-missing" key={suggestion.name}>
                <div><ImagePlus size={16} /><strong>{suggestion.name}</strong><span>Image needed</span></div>
                <p>{suggestion.description}</p>
                {canEditStory && <div className="suggestion-actions">
                  <button className="text-button" disabled={rendering} onClick={() => onUploadReference(suggestion)}><Upload size={15} /> Upload image</button>
                  <select aria-label={`Choose image for ${suggestion.name}`} value="" disabled={rendering}
                    onChange={(e) => {
                      const image = references.find((r) => r.id === e.target.value);
                      if (image) onResolveReference(suggestion.name, image);
                    }}>
                    <option value="">Choose from library</option>
                    {references.filter((r) => project.sample || !r.sample).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="text-button" disabled={rendering} title={`Remove ${suggestion.name} suggestion`} aria-label={`Remove ${suggestion.name} suggestion`} onClick={() => onResolveReference(suggestion.name)}><Trash2 size={16} /></button>
                </div>}
              </div>
            ))}
          </div>
        )}
        {!canEditStory ? (
          <div className="locked-note">
            <span>
              <LockKeyhole size={18} />
            </span>
            <div>
              <strong>This moment is part of your story.</strong>
              <p>
                Make a new version to change its description, references, duration, or render quality.
                {project.sample
                  ? " This example demonstrates the approved state; no video was generated."
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="revision-box">
            <div>
              <Sparkles size={17} />
              <label htmlFor="revision-request">
                What would you like to change?
              </label>
            </div>
            <textarea
              id="revision-request"
              rows={2}
              value={request}
              onChange={(e) => {
                setRequest(e.target.value);
                onChange({ requestedChange: e.target.value });
              }}
              placeholder="Make the light warmer, move the camera closer…"
            />
            <div className="revision-bottom">
              <span>Just describe it. We’ll take care of the prompt.</span>
              <button
                aria-label="Submit revision to writing assistant"
                disabled={!request.trim()}
                onClick={() => onCompile()}
              >
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}
        <div className="clip-settings-line">
          <div className="clip-settings-group">
            <label htmlFor="clip-duration">
              <Clock3 size={14} /> Duration
            </label>
            <span className="locked-option">
              <select
                id="clip-duration"
                value={clip.duration}
                disabled={locked}
                onChange={(e) => onChange({ duration: Number(e.target.value) })}
              >
                {[5, 10, 15].map((d) => (
                  <option key={d} value={d}>
                    {d} seconds
                  </option>
                ))}
              </select>
              {locked && (
                <span className="option-lock-wrap">
                  <button
                    type="button"
                    className="option-lock"
                    aria-label="Why duration is locked"
                    aria-expanded={openLockHelp === "duration"}
                    onClick={() => setOpenLockHelp((current) => current === "duration" ? null : "duration")}
                  >
                    <LockKeyhole size={13} />
                  </button>
                  {openLockHelp === "duration" && (
                    <span className="option-tooltip" role="tooltip">Regenerate this clip to change its duration.</span>
                  )}
                </span>
              )}
            </span>
          </div>
          <div className="clip-settings-group">
            <label htmlFor="clip-render-preset">
              <Sparkles size={14} /> Render
            </label>
            <span className="locked-option">
              <select
                id="clip-render-preset"
                value={chainRenderPreset}
                disabled={locked || isChainFollower}
                onChange={(e) => onChange({ renderPreset: e.target.value as "quick" | "cinematic" })}
              >
              <option value="quick">Quick preview · 4-step</option>
                <option value="cinematic">Cinematic detail · 8-step</option>
              </select>
              {(locked || isChainFollower) && (
                <span className="option-lock-wrap">
                  <button
                    type="button"
                    className="option-lock"
                    aria-label={locked ? "Why render is locked" : "Why this render profile is inherited"}
                    aria-expanded={openLockHelp === "render"}
                    onClick={() => setOpenLockHelp((current) => current === "render" ? null : "render")}
                  >
                    <LockKeyhole size={13} />
                  </button>
                  {openLockHelp === "render" && (
                    <span className="option-tooltip" role="tooltip">
                      {locked
                        ? "Regenerate this clip to change its render profile."
                        : "This render profile comes from the first clip in this take."}
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>
          {isChainFollower ? (
            <span>Set by the first clip in this take</span>
          ) : locked ? (
            <span>Regenerate to change settings</span>
          ) : (
            <span>Draft timing · checked before rendering</span>
          )}
        </div>
      </div>
      {renderState?.status === "failed" && renderState.error && (
        <p role="alert">Render status: {renderState.error}</p>
      )}
      <div className="editor-footer">
        {(() => {
          const isValidateStep = !locked && clip.videoUrl && clip.status === "ready";
          const activeReason = isValidateStep ? validateBlockReason : generateBlockReason;
          return (
            <div>
              <span
                className={`small muted${activeReason && !locked ? " warning" : ""}${shakeGenerate ? " shake" : ""}`}
                onAnimationEnd={() => setShakeGenerate(false)}
              >
                {locked
                  ? "Approved motion context is retained if you regenerate from here."
                  : (activeReason ?? "Your story. Your creative direction.")}
              </span>
              {project.sample && (
                <span className="example-label">EXAMPLE WORKSPACE</span>
              )}
            </div>
          );
        })()}
        {locked ? (
          <div className="editor-footer-actions">
            <button className="button secondary" onClick={onRegenerate}>
              <Sparkles size={16} /> Regenerate from here
            </button>
            <button className="button primary" disabled={!nextExists} onClick={onNext}>
              Next clip <ArrowRight size={16} />
            </button>
          </div>
        ) : clip.videoUrl && clip.status === "ready" ? (
          <button
            className="button primary"
            aria-disabled={!!validateBlockReason}
            onClick={() => {
              if (validateBlockReason) {
                setShakeGenerate(true);
                return;
              }
              onValidate();
            }}
          >
            <CheckCheck size={16} /> Validate clip
          </button>
        ) : (
          <button
            className={`button primary ${rendering ? "working" : ""}`}
            disabled={rendering}
            aria-disabled={!rendering && !!generateBlockReason}
            onClick={() => {
              if (rendering) return;
              if (generateBlockReason) {
                setShakeGenerate(true);
                return;
              }
              onGenerate();
            }}
          >
            {rendering ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {renderState?.status === "preparing"
              ? "Preparing references…"
              : renderState?.status === "queued"
                ? "Waiting for worker…"
                : renderState?.status === "running"
                  ? "Generating clip…"
                  : "Generate clip"}
          </button>
        )}
      </div>
      {previewOpen && (
        <Modal
          title={clip.title}
          eyebrow={(clip.videoUrl || clip.videoAssetId) ? "GENERATED CLIP" : "REFERENCE STILL"}
          onClose={() => setPreviewOpen(false)}
          wide
        >
          {(clip.videoUrl || clip.videoAssetId) ? (
            clip.videoAssetId ? <VolumeBackedVideo assetId={clip.videoAssetId} /> : <video className="video-preview" controls src={clip.videoUrl} />
          ) : (
            <>
              <Photo
                className="reference-preview"
                src={clip.image || usedRefs[0]?.url}
                alt={`${clip.title} reference still`}
              />
              <p className="modal-intro">
                This image sets the visual direction. A generated video will
                appear here once the rendering backend is connected.
              </p>
            </>
          )}
        </Modal>
      )}
    </article>
  );
}
