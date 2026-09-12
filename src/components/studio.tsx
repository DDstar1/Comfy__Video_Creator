"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { loadAccountProjects, saveAccountProject } from "@/lib/project-store";
import {
  applyCompiledClip,
  canChangeProjectSettings,
  chainIndexes,
  createSampleProject,
  newClip,
  sampleReferences,
  updateClip,
  validateClip,
  type Clip,
  type Project,
  type ReferenceImage,
} from "@/lib/studio-model";
import { AuthForm, NewProjectForm, UploadForm } from "./studio-forms";
import { directorOutputSchema } from "@/lib/director-contract";
import { assembleH3Workflow } from "@/lib/render-workflow";
import { Mentions, Modal, Photo } from "./ui";

type View = "projects" | "studio" | "library";
type Tab = "story" | "references" | "clips";
type Dialog =
  "new" | "auth" | "upload" | "help" | "settings" | "validate" | "wallet" | null;
type Route = { view: View; projectId?: string; tab?: Tab };

export default function Studio() {
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
    <Workspace key={user?.id ?? "guest"} user={user} authReady={authReady} />
  );
}

function Workspace({
  user,
  authReady,
}: {
  user: User | null;
  authReady: boolean;
}) {
  // Supabase hands back a new user object on every auth event, including token
  // refreshes and tab focus. Effects keyed on the object itself therefore
  // re-ran and replaced local state with the database, discarding edits that
  // had not finished saving. Key them on the stable id instead.
  const userId = user?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([createSampleProject()]);
  const [route, setRoute] = useState<Route>({
    view: "studio",
    projectId: "sample-forest",
    tab: "clips",
  });
  const [clipId, setClipId] = useState("clip-2");
  const [references, setReferences] =
    useState<ReferenceImage[]>(sampleReferences);
  const [dialog, setDialog] = useState<Dialog>(null);
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
  const [listView, setListView] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
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
    navRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = navRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
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
      const parts = window.location.hash.replace(/^#\/?/, "").split("/");
      if (parts[0] === "projects") setRoute({ view: "projects" });
      else if (parts[0] === "library") setRoute({ view: "library" });
      else if (parts[0] === "project" && parts[1])
        setRoute({
          view: "studio",
          projectId: decodeURIComponent(parts[1]),
          tab: ["story", "references", "clips"].includes(parts[2])
            ? (parts[2] as Tab)
            : "story",
        });
    };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
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
    void loadAccountProjects(supabase, userId)
      .then((saved) => {
        if (!active) return;
        // Freshly loaded projects already match the database; recording them
        // here keeps the autosave from rewriting them on the next render.
        persisted.current = new Map(saved.map((item) => [item.id, item]));
        setProjects([...saved, createSampleProject()]);
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
  }, [userId, loadLibrary]);

  const project = projects.find((p) => p.id === route.projectId);
  const clip =
    project?.clips.find((c) => c.id === clipId) ??
    project?.clips.find((c) => c.status !== "validated") ??
    project?.clips[0];
  const tab = route.tab ?? "clips";
  function navigate(next: Route) {
    const hash =
      next.view === "studio"
        ? `#/project/${encodeURIComponent(next.projectId ?? "")}/${next.tab ?? "story"}`
        : `#/${next.view}`;
    window.location.assign(hash);
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
    if (project)
      saveProject({
        ...project,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
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
          const statusResponse = await fetch(
            `/api/renders?jobId=${encodeURIComponent(jobId)}`,
            {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
              cache: "no-store",
            },
          );
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
    if (!ready || !userId || !supabase) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const { data, error } = await client
        .from(RENDER_JOB_TABLE)
        .select("id,clip_id,project_id,status")
        .eq("owner_id", userId)
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
  }, [ready, userId, followRender]);

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
    const snapshot =
      patch && target ? updateClip(project, target.id, patch) : project;
    if (patch && target) saveProject(snapshot);
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
        const clips = parsed.clips.map((c) => ({
          ...newClip(0),
          ...c,
          image: references.find((r) => r.id === c.referenceIds[0])?.url ?? "",
          revision: 1,
          responseId: result.responseId,
        }));
        saveProject({
          ...snapshot,
          clips,
          updatedAt: new Date().toISOString(),
        });
        setClipId(clips[0].id);
        navigate({ view: "studio", projectId: snapshot.id, tab: "clips" });
      } else if (target) {
        const applied = applyCompiledClip(
          snapshot,
          target.id,
          parsed.clips[0],
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
  function openProject(p: Project) {
    setClipId(
      p.clips.find((c) => c.status !== "validated")?.id ?? p.clips[0]?.id ?? "",
    );
    navigate({
      view: "studio",
      projectId: p.id,
      tab: p.clips.length ? "clips" : "story",
    });
  }
  function createProject(p: Project) {
    setProjects((prev) => [p, ...prev]);
    setDialog(null);
    openProject(p);
    notify("Project created. Your project is saved to your account.");
  }
  function addClip() {
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
  function exportDraft() {
    if (!project) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "comfyTR-draft-v1",
            project,
            references: references
              .filter((r) => project.referenceIds.includes(r.id))
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
    link.download = `${project.title.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-draft.json`;
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
  const projectList = projects.filter(
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
        <button
          className="brand"
          onClick={() => navigate({ view: "projects" })}
          aria-label="ClipWeave projects"
        >
          <span className="brand-mark">
            <Clapperboard size={23} strokeWidth={1.65} />
          </span>
          <span>
            comfy<span className="brand-tr">TR</span>
            <span className="brand-dot">.</span>
          </span>
        </button>
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
            <span className="nav-count">{projects.length}</span>
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
          {projects.slice(0, 4).map((p) => (
            <button
              key={p.id}
              className={`recent-item ${project?.id === p.id && route.view === "studio" ? "selected" : ""}`}
              onClick={() => openProject(p)}
            >
              <span className="project-dot" />
              <span>{p.title}</span>
            </button>
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
            onClick={() => setDialog(user ? "settings" : "auth")}
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
            {route.view === "studio" && project && (
              <>
                <ChevronRight size={14} />
                <strong>{project.title}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
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
              onClick={() => setDialog(user ? "settings" : "auth")}
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
                <button onClick={exportDraft}>Download backup</button>
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
                    onClick={exportDraft}
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
                            disabled={!canChangeProjectSettings(project)}
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
                                  <div key={group.chain} className="chain-group">
                                    {group.clips.map((c, offset) => {
                                      const index = startIndex + offset;
                                      return (
                                        <button
                                          key={c.id}
                                          className={`clip-card ${clip?.id === c.id ? "selected" : ""} ${isRendering(c.id) ? "generating" : ""}`}
                                          aria-busy={isRendering(c.id)}
                                          onClick={() => setClipId(c.id)}
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
                                              {c.status === "validated" ? (
                                                <LockKeyhole size={14} />
                                              ) : (
                                                <ChevronRight size={15} />
                                              )}
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
                                              >
                                                {c.status === "validated" ? (
                                                  <Check size={12} />
                                                ) : (
                                                  <span className="tiny-dot" />
                                                )}
                                                {c.status === "validated"
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
                        {clip && (
                          <ClipEditor
                            key={`${clip.id}:${clip.revision ?? 0}`}
                            project={project}
                            clip={clip}
                            references={references}
                            onChange={(patch) =>
                              saveProject(updateClip(project, clip.id, patch))
                            }
                            onMention={showMention}
                            onCompile={(patch) =>
                              void askDirector("revise", clip, patch)
                            }
                            renderState={renders[clip.id]}
                            onGenerate={() => void generateClip(clip)}
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
                              if (next) setClipId(next.id);
                            }}
                          />
                        )}
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
                <span>ClipWeave Studio</span>
              </footer>
            </>
          ) : route.view === "studio" ? (
            <div className="empty-state panel">
              <FolderOpen size={32} />
              <h2>This project isn’t in this workspace.</h2>
              <p>Projects belong to the account where they were created.</p>
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
                    <span className="count-inline">{projects.length}</span>
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
                  <button
                    key={p.id}
                    className="project-card"
                    onClick={() => openProject(p)}
                  >
                    <div className="project-card-image">
                      <Photo src={p.image} alt={`${p.title} cover`} />
                      <span className="image-badge">
                        {p.sample ? "Example project" : "Draft"}
                      </span>
                      <span className="open-project-circle">
                        <ArrowUpRight size={20} />
                      </span>
                    </div>
                    <div className="project-card-info">
                      <h3>{p.title}</h3>
                      <p>{p.story.replace(/@/g, "")}</p>
                      <div>
                        <span>
                          <Clapperboard size={13} />
                          {p.clips.length} clips
                        </span>
                        <span>{p.ratio}</span>
                        <span>
                          {p.sample ? "Explore the studio" : "Saved to account"}
                        </span>
                      </div>
                    </div>
                  </button>
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
      {dialog === "new" && (
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
          onClose={() => setDialog(null)}
          onUploaded={(image) => {
            setReferences((prev) => [image, ...prev]);
            if (project && route.view === "studio")
              modifyProject({
                referenceIds: [...project.referenceIds, image.id],
                ...(!project.image ? { image: image.url } : {}),
              });
            setDialog(null);
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
      {dialog === "settings" && (
        <Modal
          title={
            route.view === "studio" && project
              ? "The details of your story."
              : "Your creative workspace."
          }
          eyebrow="SETTINGS"
          onClose={() => setDialog(null)}
        >
          {route.view === "studio" && project && (
            <>
              <label className="field">
                Project name
                <input
                  value={project.title}
                  maxLength={200}
                  onChange={(e) => {
                    if (e.target.value.trim())
                      modifyProject({ title: e.target.value });
                  }}
                />
              </label>
              <p className="small muted">
                Projects are saved to your account. Download a backup to keep a
                separate copy.
              </p>
              <button
                className="button secondary full-width"
                onClick={exportDraft}
              >
                <ArrowDownToLine size={16} /> Download draft backup
              </button>
              <hr />
            </>
          )}
          <div className="account-settings">
            <span className="account-avatar large">
              {userLabel[0].toUpperCase()}
            </span>
            <div>
              <strong>{user?.email ?? "You’re exploring as a guest"}</strong>
              <p>
                {user
                  ? "Account reference library connected"
                  : "Sign in to upload and reuse your own images."}
              </p>
            </div>
          </div>
          {user ? (
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
          ) : (
            <button
              className="button primary full-width"
              disabled={!authReady}
              onClick={() => setDialog("auth")}
            >
              Sign in <ArrowRight size={16} />
            </button>
          )}
        </Modal>
      )}
      {dialog === "wallet" && user && (
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
              onClick={() => {
                const next = validateClip(project, clip.id);
                if (next === project)
                  notify(
                    "Validation needs a generated video, no pending edits, and all earlier clips validated.",
                  );
                else {
                  saveProject(next);
                  notify("Clip validated and locked.");
                }
                setDialog(null);
              }}
            >
              <CheckCheck size={16} /> Validate and lock
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
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button className="button secondary" onClick={() => void onRefresh()}>Refresh balance</button><button className="button primary" disabled={busy || Number(amount) < 5} onClick={checkout}><CreditCard size={16} /> {busy ? "Opening…" : "Add funds"}</button></div>
  </Modal>;
}

function ClipEditor({
  project,
  clip,
  references,
  onChange,
  onMention,
  renderState,
  onGenerate,
  onCompile,
  onValidate,
  onRemove,
  onNotice,
  onNext,
}: {
  project: Project;
  clip: Clip;
  references: ReferenceImage[];
  onChange: (patch: Partial<Clip>) => void;
  onMention: (name: string) => void;
  renderState?: { jobId?: string; status: string; error?: string };
  onGenerate: () => void;
  onCompile: (patch?: Partial<Clip>) => void;
  onValidate: () => void;
  onRemove: () => void;
  onNotice: (message: string) => void;
  onNext: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(
    clip.pendingDescription ?? clip.description,
  );
  const [request, setRequest] = useState(clip.requestedChange ?? "");
  const [showReferences, setShowReferences] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const locked = clip.status === "validated";
  const rendering =
    !!renderState &&
    ["preparing", "queued", "running"].includes(renderState.status);
  const index = project.clips.findIndex((c) => c.id === clip.id);
  // The first clip always starts a chain; there is nothing before it to continue.
  const continues = index > 0 && clip.continuesPrevious !== false;
  const usedRefs = references.filter((r) => clip.referenceIds.includes(r.id));
  const priorReady = project.clips
    .slice(0, index)
    .every((c) => c.status === "validated");
  const nextExists = index < project.clips.length - 1;
  const editorRef = useRef<HTMLTextAreaElement>(null);
  function saveEdit() {
    if (!description.trim()) return;
    setEditing(false);
    onCompile({ pendingDescription: description.trim() });
  }
  return (
    <article className="clip-editor panel">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">
            CLIP {String(index + 1).padStart(2, "0")}{" "}
            <span className="eyebrow-divider">/</span>{" "}
            {String(project.clips.length).padStart(2, "0")}
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
                  : onChange({ continuesPrevious: !continues })
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
            {locked ? <LockKeyhole size={12} /> : <span className="tiny-dot" />}
            {locked
              ? "Validated & locked"
              : clip.pendingDescription || clip.requestedChange
                ? "Revision pending"
                : "Ready to shape"}
          </span>
          {!locked && (
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
          clip.videoUrl ? "Open generated clip preview" : "Open reference still"
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
            {clip.videoUrl
              ? "View clip preview"
              : "Scene reference · not a generated video"}
          </span>
          <span>{clip.duration}s planned</span>
        </span>
        <span className="expand-preview">
          <ExternalLink size={16} />
        </span>
      </button>
      <div className="editor-body">
        <div className="description-heading">
          <label htmlFor="clip-description">The scene, in your words</label>
          {!locked && (
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
            <textarea
              ref={editorRef}
              id="clip-description"
              aria-label="Readable clip description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
        {!locked && !editing && (
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
          {!locked && (
            <button
              className="text-button"
              onClick={() => setShowReferences(!showReferences)}
            >
              {showReferences ? "Done" : "Manage"}
              <Plus size={13} />
            </button>
          )}
        </div>
        <div className="reference-chips">
          {usedRefs.map((r) => (
            <button
              key={r.id}
              className="reference-chip"
              onClick={() => onMention(r.name)}
            >
              <Photo src={r.url} alt="" />
              {r.name}
            </button>
          ))}
          {!usedRefs.length && (
            <span className="small muted">No references assigned yet.</span>
          )}
        </div>
        {showReferences && !locked && (
          <div className="clip-reference-picker">
            {references
              .filter((r) => project.referenceIds.includes(r.id))
              .map((r) => (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    checked={clip.referenceIds.includes(r.id)}
                    disabled={
                      !clip.referenceIds.includes(r.id) &&
                      clip.referenceIds.length >= 9
                    }
                    onChange={(e) =>
                      onChange({
                        referenceIds: e.target.checked
                          ? [...clip.referenceIds, r.id]
                          : clip.referenceIds.filter((id) => id !== r.id),
                      })
                    }
                  />
                  <Photo src={r.url} alt="" />
                  <span>{r.name}</span>
                </label>
              ))}
            {!project.referenceIds.length && (
              <p className="small muted">
                Add images in the project’s References tab first.
              </p>
            )}
          </div>
        )}
        {locked ? (
          <div className="locked-note">
            <span>
              <LockKeyhole size={18} />
            </span>
            <div>
              <strong>This moment is part of your story.</strong>
              <p>
                Its description, references, and settings are locked.
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
        {!locked && (
          <div className="clip-settings-line">
            <label htmlFor="clip-duration">
              <Clock3 size={14} /> Duration
            </label>
            <select
              id="clip-duration"
              value={clip.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
            >
              {[5, 10, 15].map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
            <span>Draft timing · checked before rendering</span>
          </div>
        )}
      </div>
      <div className="editor-footer">
        <div>
          <span className="small muted">
            {locked
              ? "A foundation for what comes next."
              : priorReady
                ? "Your story. Your creative direction."
                : "Validate earlier clips before generating this one."}
          </span>
          {project.sample && (
            <span className="example-label">EXAMPLE WORKSPACE</span>
          )}
        </div>
        {locked ? (
          <button
            className="button primary"
            disabled={!nextExists}
            onClick={onNext}
          >
            Next clip <ArrowRight size={16} />
          </button>
        ) : clip.videoUrl && clip.status === "ready" ? (
          <button
            className="button primary"
            disabled={
              !priorReady ||
              !!clip.pendingDescription ||
              !!clip.requestedChange ||
              !!clip.continuityStale
            }
            onClick={onValidate}
          >
            <CheckCheck size={16} /> Validate clip
          </button>
        ) : (
          <button
            className={`button primary ${rendering ? "working" : ""}`}
            disabled={
              rendering ||
              project.sample ||
              !priorReady ||
              !clip.technicalPrompt ||
              !!clip.pendingDescription ||
              !!clip.requestedChange ||
              !!clip.continuityStale
            }
            onClick={onGenerate}
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
          eyebrow={clip.videoUrl ? "GENERATED CLIP" : "REFERENCE STILL"}
          onClose={() => setPreviewOpen(false)}
          wide
        >
          {clip.videoUrl ? (
            <video className="video-preview" controls src={clip.videoUrl} />
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
