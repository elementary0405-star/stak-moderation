"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./staff-record.module.css";

type RecordData = {
  member: { discordUserId: string; username: string; globalName: string | null; role: string };
  profile: { staffStatus: string; joinedAt: string | null; internalNotes: string | null };
  absences: { id: string; startDate: string; expectedReturnDate: string | null; reason: string; status: string; managementNote: string | null }[];
  warnings: { id: string; warningType: string; reason: string; internalNotes: string | null; status: string; createdAt: string; resolutionReason: string | null }[];
  academyAssignments: { id: string; courseKey: string; courseVersion: string; status: string; assignedAt: string; submissionCount: number }[];
};
const courseNames: Record<string, string> = { "general-staff": "General Staff Training", ingame: "Ingame Training", "staff-manager": "Staff Manager Training", management: "Management Training" };
const statusLabels: Record<string, string> = { active: "Active", on_leave: "On leave", inactive: "Inactive", submitted: "Awaiting approval", in_progress: "In progress", assigned: "Assigned", changes_requested: "Changes requested", approved: "Approved", reviewed: "Reviewed", resolved: "Resolved", revoked: "Revoked" };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "The request could not be completed.");
  return payload as T;
}

export default function StaffRecordClient({ discordUserId }: { discordUserId: string }) {
  const [data, setData] = useState<RecordData | null>(null);
  const [joinedAt, setJoinedAt] = useState("");
  const [staffStatus, setStaffStatus] = useState("active");
  const [internalNotes, setInternalNotes] = useState("");
  const [courseKey, setCourseKey] = useState("ingame");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await requestJson<RecordData>(`/api/staff/records/${encodeURIComponent(discordUserId)}`);
      setData(next); setJoinedAt(next.profile?.joinedAt ?? ""); setStaffStatus(next.profile?.staffStatus ?? "active"); setInternalNotes(next.profile?.internalNotes ?? "");
    } catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to load staff record."); }
    finally { setLoading(false); }
  }, [discordUserId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveProfile() {
    setSaving(true); setError(""); setNotice("");
    try { await requestJson("/api/staff/records", { method: "PATCH", body: JSON.stringify({ discordUserId, staffStatus, joinedAt, internalNotes }) }); setNotice("Staff record updated and audit history saved."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to save staff record."); }
    finally { setSaving(false); }
  }

  async function assignCourse() {
    setSaving(true); setError(""); setNotice("");
    try { await requestJson("/api/academy/assignments", { method: "POST", body: JSON.stringify({ discordUserId, courseKey }) }); setNotice("Course assigned."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to assign course."); }
    finally { setSaving(false); }
  }

  if (loading && !data) return <main className={styles.page}><p>Loading staff record...</p></main>;
  return <main className={styles.page}>
    <Link className={styles.back} href="/team-hub/staff-directory">← Staff Directory</Link>
    {error && <div className={styles.error}>{error}</div>}{notice && <div className={styles.notice}>{notice}</div>}
    {!data ? <section className={styles.panel}><h1>Staff record unavailable</h1><p>Confirm the member still has an active, verified STAK staff role.</p></section> : <>
      <header className={styles.header}><div><span className={styles.eyebrow}>CONFIDENTIAL STAFF RECORD</span><h1>{data.member.globalName || data.member.username}</h1><p>{data.member.username} · {data.member.discordUserId}</p></div><span className={styles.role}>{data.member.role.replaceAll("-", " ").toUpperCase()}</span></header>
      <section className={styles.panel}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>PROFILE</span><h2>Staff information</h2></div></div>
        <div className={styles.formGrid}><label>Status<select value={staffStatus} onChange={(event) => setStaffStatus(event.target.value)}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label><label>Joined date<input type="date" value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} /></label></div>
        <label className={styles.field}>Internal management notes<textarea rows={5} maxLength={5000} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></label><button type="button" className={styles.primary} disabled={saving} onClick={() => void saveProfile()}>{saving ? "Saving..." : "Save staff record"}</button>
      </section>
      <section className={styles.panel}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>ACADEMY</span><h2>Training and qualifications</h2></div></div><div className={styles.assignRow}><select value={courseKey} onChange={(event) => setCourseKey(event.target.value)}><option value="ingame">Ingame Training</option><option value="general-staff">General Staff Training · repeat</option><option value="staff-manager">Staff Manager Training · repeat</option><option value="management">Management Training · repeat</option></select><button type="button" className={styles.secondary} disabled={saving} onClick={() => void assignCourse()}>Assign course</button></div>
        {data.academyAssignments.length ? <div className={styles.list}>{data.academyAssignments.map((item) => <article key={item.id}><div><strong>{courseNames[item.courseKey] ?? item.courseKey}</strong><small>Version {item.courseVersion} · {new Date(item.assignedAt).toLocaleDateString("en-GB")}</small></div><span className={styles.status}>{statusLabels[item.status] ?? item.status}</span><small>{item.submissionCount} submission(s)</small></article>)}</div> : <p className={styles.muted}>No courses assigned yet. General Staff Training will be assigned automatically when this staff member opens the Academy.</p>}
      </section>
      <section className={styles.panel}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>AVAILABILITY</span><h2>Absence history</h2></div></div>{data.absences.length ? <div className={styles.list}>{data.absences.map((item) => <article key={item.id}><div><strong>{item.startDate} → {item.expectedReturnDate || "No return date"}</strong><p>{item.reason}</p>{item.managementNote && <small>Management note: {item.managementNote}</small>}</div><span className={styles.status}>{statusLabels[item.status] ?? item.status}</span></article>)}</div> : <p className={styles.muted}>No absence records.</p>}</section>
      <section className={styles.panel}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>HISTORY</span><h2>Warnings and resolutions</h2></div></div>{data.warnings.length ? <div className={styles.list}>{data.warnings.map((item) => <article key={item.id}><div><strong>{item.warningType.replaceAll("_", " ")} · {statusLabels[item.status] ?? item.status}</strong><p>{item.reason}</p>{item.internalNotes && <small>Internal note: {item.internalNotes}</small>}{item.resolutionReason && <small>Resolution: {item.resolutionReason}</small>}<small>{new Date(item.createdAt).toLocaleString("en-GB")}</small></div></article>)}</div> : <p className={styles.muted}>No warning history.</p>}</section>
    </>}
  </main>;
}
