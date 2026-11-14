"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import styles from "./feedback.module.css";

type Feedback = { id: string; category: string; subject: string; message: string; status: string; createdAt: string; updatedAt: string };
type FeedbackResponse = { feedback: Feedback[] };
const statusLabels: Record<string, string> = { new: "New", under_review: "Under review", addressed: "Addressed", archived: "Archived" };

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "The request could not be completed.");
  return data as T;
}

function FeedbackBox() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { const data = await readResponse<FeedbackResponse>(await fetch("/api/staff/feedback?limit=50", { credentials: "include", cache: "no-store" })); setItems(data.feedback ?? []); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to load your feedback history."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const data = await readResponse<{ feedback: Feedback }>(await fetch("/api/staff/feedback", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, subject, message }) }));
      setSubject(""); setMessage(""); setNotice("Your message was saved to the Owner-only inbox."); setItems((current) => [data.feedback, ...current]);
    } catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to submit feedback."); }
    finally { setSaving(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><Link className={styles.back} href="/team-hub">← Team Hub</Link><span className={styles.eyebrow}>CONFIDENTIAL STAFF TOOL</span><h1>Feedback Box</h1><p>Send a private suggestion, concern or process question to the STAK Owner.</p></div></header>
    <section className={styles.privacy}><strong>Owner-only access</strong><p>Your message and Discord account are visible to the Owner. Other staff members cannot read it. Do not use this form for urgent safety issues or to submit passwords, authentication codes, or unnecessary personal information.</p></section>
    {error && <div className={styles.error} role="alert">{error}</div>}{notice && <div className={styles.notice} role="status">{notice}</div>}
    <div className={styles.grid}><form className={styles.form} onSubmit={(event) => void submit(event)}><span className={styles.eyebrow}>NEW MESSAGE</span><h2>Write to the Owner</h2>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)} disabled={saving}><option value="general">General</option><option value="suggestion">Suggestion</option><option value="concern">Concern</option><option value="procedure">Procedure</option><option value="other">Other</option></select></label>
      <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={120} required disabled={saving} /></label>
      <label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={5000} rows={8} required disabled={saving} /></label>
      <button type="submit" disabled={saving}>{saving ? "Sending..." : "Send confidential feedback"}</button>
    </form><section className={styles.history}><div className={styles.historyHeading}><span className={styles.eyebrow}>YOUR MESSAGES</span><h2>Submission history</h2></div>
      {loading ? <p className={styles.empty}>Loading your messages...</p> : items.length === 0 ? <p className={styles.empty}>You have not sent a feedback message yet.</p> : items.map((item) => <article className={styles.item} key={item.id}><div className={styles.itemTop}><span>{item.category}</span><strong>{statusLabels[item.status] ?? item.status}</strong></div><h3>{item.subject}</h3><p>{item.message}</p><time>{new Date(item.createdAt.replace(" ", "T") + (item.createdAt.includes("Z") ? "" : "Z")).toLocaleString("en-GB")}</time></article>)}
    </section></div>
  </main>;
}

export default function FeedbackPage() { return <PortalShell access="staff">{() => <FeedbackBox />}</PortalShell>; }
