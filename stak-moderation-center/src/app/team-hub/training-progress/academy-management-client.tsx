"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./training-progress.module.css";

type StaffMember = { discordUserId: string; username: string; globalName: string | null; role: string };
type Question = { id: string; prompt: string };
type Review = { assignmentId: string; discordUserId: string; staffName: string; currentRole: string; courseKey: string; submissionId: string; submissionNumber: number; submittedAt: string; answers: Record<string, string>; practicalResponse: string; canReview: boolean; course: { title: string; questions: Question[]; practicalPrompt: string } | null };

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "The request could not be completed.");
  return payload as T;
}

export default function AcademyManagementClient() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [memberId, setMemberId] = useState("");
  const [courseKey, setCourseKey] = useState("ingame");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [staffData, reviewData] = await Promise.all([
        readJson<{ members: StaffMember[] }>("/api/staff/directory"),
        readJson<{ submissions: Review[] }>("/api/academy/reviews"),
      ]);
      setStaff(staffData.members ?? []);
      setReviews(reviewData.submissions ?? []);
      setMemberId((current) => (staffData.members ?? []).some((item) => item.discordUserId === current) ? current : staffData.members?.[0]?.discordUserId ?? "");
    } catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to load Academy management."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function assign() {
    setSaving(true); setError(""); setNotice("");
    try { await readJson("/api/academy/assignments", { method: "POST", body: JSON.stringify({ discordUserId: memberId, courseKey }) }); setNotice("Course assigned. The staff member will see it in STAK Academy."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to assign the course."); }
    finally { setSaving(false); }
  }

  async function review(assignmentId: string, decision: "approve" | "changes_requested") {
    setSaving(true); setError(""); setNotice("");
    try { await readJson("/api/academy/reviews", { method: "PATCH", body: JSON.stringify({ assignmentId, decision, notes: notes[assignmentId] ?? "" }) }); setNotice(decision === "approve" ? "Course approved and approval history saved." : "Feedback sent and the attempt remains in history."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to save the review."); }
    finally { setSaving(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>STAFF DEVELOPMENT</span><h1>Academy Reviews</h1><p>Assign courses, review submissions, and approve completion only after a higher-role review.</p></div><button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}>Refresh</button></header>
    {error && <div className={styles.error}>{error}</div>}{notice && <div className={styles.notice}>{notice}</div>}
    <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>MANUAL ASSIGNMENT</span><h2>Assign Ingame Training or a new course attempt</h2><p>General Staff Training and the role-based manager courses are assigned automatically. Ingame Training is assigned manually.</p></div></div>
      <div className={styles.assignForm}><label>Staff member<select value={memberId} onChange={(event) => setMemberId(event.target.value)} disabled={loading || saving}><option value="">Select staff member</option>{staff.map((member) => <option key={member.discordUserId} value={member.discordUserId}>{member.globalName || member.username} · {member.role}</option>)}</select></label><label>Course<select value={courseKey} onChange={(event) => setCourseKey(event.target.value)} disabled={saving}><option value="ingame">Ingame Training</option><option value="general-staff">General Staff Training · new attempt</option><option value="staff-manager">Staff Manager Training · new attempt</option><option value="management">Management Training · new attempt</option></select></label><button type="button" className={styles.primaryButton} onClick={() => void assign()} disabled={!memberId || saving}>Assign course</button></div>
    </section>
    <section className={styles.reviews}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>SUBMITTED WORK</span><h2>Awaiting approval</h2></div><span className={styles.count}>{reviews.length}</span></div>
      {loading ? <p className={styles.muted}>Loading reviews...</p> : reviews.length === 0 ? <p className={styles.muted}>No course submissions are awaiting review.</p> : reviews.map((reviewItem) => <article className={styles.reviewCard} key={reviewItem.assignmentId}>
        <header><div><span className={styles.eyebrow}>{reviewItem.course?.title ?? reviewItem.courseKey}</span><h3>{reviewItem.staffName}</h3><p>{reviewItem.discordUserId} · {reviewItem.currentRole} · Attempt {reviewItem.submissionNumber}</p></div><time>{new Date(reviewItem.submittedAt).toLocaleString("en-GB")}</time></header>
        {reviewItem.course?.questions.map((question) => <div className={styles.answer} key={question.id}><strong>{question.prompt}</strong><p>{reviewItem.answers[question.id] || "No answer provided."}</p></div>)}
        {reviewItem.course && <div className={styles.answer}><strong>{reviewItem.course.practicalPrompt}</strong><p>{reviewItem.practicalResponse}</p></div>}
        <label className={styles.reviewNote}>Review note / feedback<textarea rows={3} maxLength={5000} value={notes[reviewItem.assignmentId] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [reviewItem.assignmentId]: event.target.value }))} disabled={saving || !reviewItem.canReview} /></label>
        {reviewItem.canReview ? <div className={styles.actions}><button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void review(reviewItem.assignmentId, "approve")}>Approve course</button><button className={styles.secondaryButton} type="button" disabled={saving || (notes[reviewItem.assignmentId] ?? "").trim().length < 10} onClick={() => void review(reviewItem.assignmentId, "changes_requested")}>Request changes</button></div> : <p className={styles.muted}>This submission requires a higher authorized reviewer.</p>}
      </article>)}
    </section>
  </main>;
}
