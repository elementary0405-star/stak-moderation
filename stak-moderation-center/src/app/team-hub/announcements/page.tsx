"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import PortalShell from "@/components/PortalShell";
import { hasPermission } from "@/lib/portal-access";
import styles from "./announcements.module.css";

type Announcement = {
  id: string; title: string; body: string; acknowledgementRequired: number;
  acknowledgementDueAt: string | null; createdByDiscordId: string; createdAt: string;
  acknowledgedAt: string | null; acknowledgementCount: number;
  deliveryStatus: "pending" | "processing" | "delivered" | "failed" | "not_queued";
  deliveryDeliveredCount: number; deliveryFailedCount: number; deliveryQueuedCount: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

async function fetchAnnouncements() {
  const response = await fetch("/api/staff/announcements", { credentials: "include", cache: "no-store" });
  const data = await response.json() as { error?: string; announcements?: Announcement[] };
  if (!response.ok) throw new Error(data.error || "Unable to load staff announcements.");
  return data.announcements ?? [];
}

function AnnouncementsContent({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await fetchAnnouncements());
  }, []);

  useEffect(() => {
    let active = true;
    fetchAnnouncements().then((announcements) => { if (active) setItems(announcements); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load staff announcements."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/staff/announcements", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, acknowledgementRequired: requiresAcknowledgement }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to publish announcement.");
      setTitle(""); setBody(""); setRequiresAcknowledgement(false);
      setMessage("Announcement saved. Discord delivery is queued and will show as delivered only after the bot confirms it.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to publish announcement."); }
    finally { setSaving(false); }
  }

  async function acknowledge(id: string) {
    setError(null); setMessage(null);
    try {
      const response = await fetch("/api/staff/announcements/" + id + "/acknowledge", { method: "POST", credentials: "include" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save acknowledgement.");
      setMessage("Your acknowledgement has been recorded.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save acknowledgement."); }
  }

  async function retryDelivery(id: string) {
    setRetryingId(id); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/staff/announcements/${encodeURIComponent(id)}/retry`, { method: "POST", credentials: "include" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to retry delivery.");
      setMessage("A new Discord delivery attempt was queued."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to retry delivery."); }
    finally { setRetryingId(null); }
  }

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>STAFF COMMUNICATION</span><h1>Announcements<span>.</span></h1><p>Team updates and important notices, in one place.</p></div>
      <a className={styles.backLink} href="/team-hub">← Team Hub</a>
    </header>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {message ? <div className={styles.success} role="status">{message}</div> : null}
    {canManage ? <form className={styles.composer} onSubmit={(event) => void publish(event)}>
      <span className={styles.eyebrow}>MANAGEMENT</span><h2>Post an announcement</h2>
      <label>Title<input required minLength={4} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Message<textarea required minLength={10} maxLength={8000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <label className={styles.ackOption}><input type="checkbox" checked={requiresAcknowledgement} onChange={(event) => setRequiresAcknowledgement(event.target.checked)} /> Ask staff to acknowledge within 48 hours</label>
      <p className={styles.note}>Acknowledgement is recorded for follow-up. The portal does not issue automatic warnings.</p>
      <button disabled={saving}>{saving ? "Publishing…" : "Publish announcement"}</button>
    </form> : null}
    <section className={styles.list}>
      <div className={styles.listHeading}><div><span className={styles.eyebrow}>TEAM UPDATES</span><h2>Latest announcements</h2></div><span>{items.length} shown</span></div>
      {loading ? <p className={styles.empty}>Loading announcements…</p> : null}
      {!loading && !items.length ? <p className={styles.empty}>There are no announcements yet.</p> : null}
      {items.map((item) => <article className={styles.card} key={item.id}>
        <div className={styles.cardTop}><span>{formatDate(item.createdAt)}</span>{item.acknowledgementRequired ? <strong>ACKNOWLEDGEMENT REQUESTED</strong> : null}</div>
        <h3>{item.title}</h3><p className={styles.body}>{item.body}</p>
        <div className={styles.cardFooter}>
          <span>Posted by {item.createdByDiscordId} · {item.acknowledgementCount} acknowledgement{item.acknowledgementCount === 1 ? "" : "s"}</span>
          <span className={item.deliveryStatus === "delivered" ? styles.ackDone : styles.due}>{item.deliveryStatus === "delivered" ? "Delivered to Discord" : item.deliveryStatus === "processing" ? "Bot is processing delivery" : item.deliveryStatus === "failed" ? "Discord delivery failed" : item.deliveryStatus === "not_queued" ? "Portal only · no bot delivery record" : "Discord delivery pending"}</span>
          {canManage && item.deliveryStatus === "failed" ? <button type="button" onClick={() => void retryDelivery(item.id)} disabled={retryingId === item.id}>{retryingId === item.id ? "Queueing…" : "Retry Discord delivery"}</button> : null}
          {canManage && item.deliveryStatus !== "not_queued" ? <small className={styles.due}>{item.deliveryDeliveredCount} delivered · {item.deliveryFailedCount} failed · {item.deliveryQueuedCount} queued</small> : null}
          {item.acknowledgementRequired ? item.acknowledgedAt
            ? <span className={styles.ackDone}>Acknowledged {formatDate(item.acknowledgedAt)}</span>
            : <button type="button" onClick={() => void acknowledge(item.id)}>Mark as read</button>
            : null}
        </div>
        {item.acknowledgementDueAt ? <small className={styles.due}>Requested by {formatDate(item.acknowledgementDueAt)}</small> : null}
      </article>)}
    </section>
  </main>;
}

export default function StaffAnnouncementsPage() {
  return <PortalShell access="staff">
    {(user) => <AnnouncementsContent canManage={hasPermission(user.stakRole, "announcements.manage")} />}
  </PortalShell>;
}
