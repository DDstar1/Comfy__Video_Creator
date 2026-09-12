"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, Film, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/studio-model";

type Export = { videoUrl: string; downloadUrl: string; signature: string };

export function ProjectMerge({ project }: { project: Project }) {
  const eligible = !project.sample && project.clips.length > 0 &&
    project.clips.every((clip) => clip.status === "validated" && clip.videoStoragePath);
  const [result, setResult] = useState<Export>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signature = project.clips.map((clip) => `${clip.id}:${clip.videoStoragePath}:${clip.continuesPrevious}`).join("|");
  const current = result?.signature === signature ? result : undefined;
  useEffect(() => {
    let active = true;
    if (!eligible || !supabase) return;
    const client = supabase;
    void (async () => {
      const { data } = await client.auth.getSession();
      if (!data.session) return;
      const response = await fetch(`/api/projects/merge?projectId=${project.id}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store",
      });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error ?? "Could not check the saved video.");
      if (active && output.videoUrl) setResult({ ...output, signature });
    })().catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not check the saved video. Try Merge videos again.");
    });
    return () => { active = false; };
  }, [eligible, project.id, signature]);

  async function merge() {
    if (!supabase || !eligible || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to merge your project.");
      const response = await fetch("/api/projects/merge", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ projectId: project.id }),
      });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error ?? "The merge failed. Try again.");
      setResult({ ...output, signature });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The merge failed. Try again.");
    } finally { setBusy(false); }
  }

  return <div className="project-merge">
    <div className="project-merge-actions">
      {current && eligible ? <a className="button primary" href={current.downloadUrl}><ArrowDownToLine size={16} /> Download merged video</a> :
        <button className="button primary" disabled={!eligible || busy} onClick={() => void merge()}
          title={!eligible ? "Validate every clip to merge the project" : "Merge all scenes into one MP4"}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Film size={16} />}
          {busy ? "Merging videos..." : "Merge videos"}
        </button>}
      {!eligible && <span className="small muted">Validate every clip to merge.</span>}
      {busy && <span role="status" className="small muted">Joining your saved videos...</span>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {current && eligible && <video className="merged-project-preview" controls preload="metadata" src={current.videoUrl} aria-label="Merged project video" />}
  </div>;
}
