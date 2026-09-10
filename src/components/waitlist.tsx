"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import styles from "@/app/landing.module.css";

type WaitlistEntry = {
  queue_position: number;
  masked_email: string;
  discount_percent: number;
};

export default function Waitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<WaitlistEntry>();

  async function refresh() {
    if (!supabase) return;
    const { data } = await supabase.rpc("comfyTR_public_waitlist");
    if (data) setEntries(data as WaitlistEntry[]);
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.rpc("comfyTR_public_waitlist").then(({ data }) => {
      if (active && data) setEntries(data as WaitlistEntry[]);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError("The waitlist connection is not configured yet.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: requestError } = await supabase.rpc("comfyTR_join_waitlist", {
      submitted_email: email,
      submitted_name: name,
    });
    setBusy(false);
    if (requestError || !data?.[0]) {
      setError(requestError?.message ?? "We could not save your place. Please try again.");
      return;
    }
    setJoined(data[0] as WaitlistEntry);
    await refresh();
  }

  return (
    <div className={styles.waitlistCard}>
      {joined ? (
        <div className={styles.success} role="status">
          <span><Check size={24} /></span>
          <small>YOUR PLACE IS RESERVED</small>
          <strong>#{joined.queue_position}</strong>
          <p>{joined.masked_email} is on the list.{joined.discount_percent ? " You are in the first-ten discount group." : " We’ll email you when access opens."}</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className={styles.formHeading}><div><small>JOIN THE EARLY LIST</small><strong>{entries.length ? `${entries.length} ${entries.length === 1 ? "creator" : "creators"} waiting` : "Reserve your position"}</strong></div><span>{String(entries.length + 1).padStart(2, "0")}</span></div>
          <label>Your name <span>Optional</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" placeholder="What should we call you?" /></label>
          <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" /></label>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <button disabled={busy}>{busy ? <LoaderCircle className={styles.spin} size={18} /> : null}Join the waitlist <ArrowRight size={18} /></button>
          <p className={styles.privacy}>Your full email stays private. Only a masked version appears below.</p>
        </form>
      )}
      {entries.length > 0 && (
        <div className={styles.queue}>
          <div><strong>Launch queue</strong><span>LIVE POSITIONS</span></div>
          <ol>{entries.slice(0, 12).map((entry) => <li key={entry.queue_position}><span>#{entry.queue_position}</span><code>{entry.masked_email}</code>{entry.discount_percent > 0 && <b>20% OFF</b>}</li>)}</ol>
        </div>
      )}
    </div>
  );
}
