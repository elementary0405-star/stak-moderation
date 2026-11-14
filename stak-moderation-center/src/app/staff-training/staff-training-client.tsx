"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./staff-training.module.css";

type Lesson = { id: string; title: string; content: { heading: string; text: string; points?: string[] }[] };
type Course = { key: string; version: string; title: string; shortDescription: string; audience: string; questions: { id: string; prompt: string }[]; practicalPrompt: string; lessons: Lesson[] };
type Submission = { id: string; submissionNumber: number; status: string; submittedAt: string; reviewedAt: string | null; reviewerNotes: string | null };
type Assignment = { id: string; courseKey: string; courseVersion: string; status: string; assignedAt: string; course: Course | null; lessons: { lessonId: string; completedAt: string }[]; submissions: Submission[] };
type ApiData = { assignments: Assignment[]; courses: { key: string; version: string; title: string; shortDescription: string; audience: string }[] };

const COURSE_ORDER = ["general-staff", "ingame", "staff-manager", "management"];
const labels: Record<string, string> = { assigned: "Assigned", in_progress: "In progress", submitted: "Awaiting approval", changes_requested: "Changes requested", approved: "Approved" };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "The request could not be completed.");
  return data as T;
}

function AcademyContent() {
  const [data, setData] = useState<ApiData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [practical, setPractical] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await requestJson<ApiData>("/api/academy");
      setData(next);
      setSelectedId((current) => next.assignments.some((assignment) => assignment.id === current) ? current : next.assignments[0]?.id ?? "");
    } catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to load the Academy."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const assignmentByKey = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const assignment of data?.assignments ?? []) if (!map.has(assignment.courseKey)) map.set(assignment.courseKey, assignment);
    return map;
  }, [data]);
  const selected = data?.assignments.find((assignment) => assignment.id === selectedId) ?? null;
  const course = selected?.course ?? null;
  const completed = new Set(selected?.lessons.map((lesson) => lesson.lessonId) ?? []);
  const canWork = Boolean(selected && ["assigned", "in_progress", "changes_requested"].includes(selected.status));

  async function saveLesson(lessonId: string) {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try { await requestJson("/api/academy", { method: "POST", body: JSON.stringify({ action: "lesson", courseKey: selected.courseKey, lessonId }) }); setNotice("Lesson progress saved."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to save lesson progress."); }
    finally { setSaving(false); }
  }

  async function submit() {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try { await requestJson("/api/academy", { method: "POST", body: JSON.stringify({ action: "submit", courseKey: selected.courseKey, answers, practicalResponse: practical }) }); setAnswers({}); setPractical(""); setNotice("Your course work was submitted for review."); await load(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "Unable to submit the course work."); }
    finally { setSaving(false); }
  }

  return <main className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>STAFF DEVELOPMENT</span><h1>STAK Academy</h1><p>Complete assigned learning on this site. Training content is in German; the Academy interface is in English.</p></div><button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={loading}>Refresh</button></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}{notice && <div role="status" className={styles.notice}>{notice}</div>}
    {loading ? <div className={styles.panel}>Loading your Academy...</div> : <>
      <section className={styles.courseGrid} aria-label="STAK Academy courses">
        {COURSE_ORDER.map((key, index) => {
          const info = data?.courses.find((item) => item.key === key);
          const assignment = assignmentByKey.get(key);
          return <button type="button" key={key} className={`${styles.courseCard} ${selectedId === assignment?.id ? styles.selectedCard : ""}`} onClick={() => { if (assignment) { setSelectedId(assignment.id); setAnswers({}); setPractical(""); } }} disabled={!assignment}>
            <span className={styles.courseNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.audience}>{info?.audience}</span><h2>{info?.title}</h2><p>{info?.shortDescription}</p><span className={styles.courseStatus}>{assignment ? labels[assignment.status] ?? assignment.status : key === "ingame" ? "Assigned by management" : "Not assigned"}</span>
          </button>;
        })}
      </section>
      {!selected ? <section className={styles.panel}><h2>Assigned courses appear here</h2><p>General Staff Training is automatically assigned when a staff member opens the Academy. Ingame Training is assigned by a Staff Manager or higher through the staff record.</p></section> : !course ? <section className={styles.panel}><p>This course version is no longer available. Contact a manager for the current assignment.</p></section> : <>
        <section className={styles.courseHeader}><div><span className={styles.eyebrow}>{course.audience.toUpperCase()} · VERSION {selected.courseVersion}</span><h2>{course.title}</h2><p>{course.shortDescription}</p></div><span className={styles.statusPill}>{labels[selected.status] ?? selected.status}</span></section>
        <section className={styles.lessonList} aria-label="Course lessons">
          {course.lessons.map((lesson, index) => <article className={styles.lesson} key={lesson.id}>
            <div className={styles.lessonHeading}><div><span className={styles.eyebrow}>LESSON {String(index + 1).padStart(2, "0")}</span><h3>{lesson.title}</h3></div><button type="button" className={completed.has(lesson.id) ? styles.completedButton : styles.secondaryButton} disabled={!canWork || saving || completed.has(lesson.id)} onClick={() => void saveLesson(lesson.id)}>{completed.has(lesson.id) ? "Completed" : "Mark complete"}</button></div>
            {lesson.content.map((section) => <div className={styles.lessonSection} key={section.heading}><h4>{section.heading}</h4><p>{section.text}</p>{section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}</div>)}
          </article>)}
        </section>
        <section className={styles.reviewPanel}><span className={styles.eyebrow}>KNOWLEDGE REVIEW</span><h3>Explain how you would apply the standard</h3><p>There is no automatic pass score. A higher authorized staff member reviews your answers and practical response.</p>
          {course.questions.map((question, index) => <label className={styles.field} key={question.id}><span>{String(index + 1).padStart(2, "0")} · {question.prompt}</span><textarea rows={4} maxLength={5000} value={answers[question.id] ?? ""} disabled={!canWork || saving} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /></label>)}
          <label className={styles.field}><span>Practical exercise · {course.practicalPrompt}</span><textarea rows={6} maxLength={12000} value={practical} disabled={!canWork || saving} onChange={(event) => setPractical(event.target.value)} /></label>
          {canWork && <button type="button" className={styles.primaryButton} disabled={saving} onClick={() => void submit()}>{saving ? "Submitting..." : "Submit for approval"}</button>}
        </section>
        {selected.submissions.length > 0 && <section className={styles.panel}><span className={styles.eyebrow}>ATTEMPT HISTORY</span><h3>Submissions and feedback</h3><div className={styles.history}>{selected.submissions.map((submission) => <article key={submission.id}><strong>Attempt {submission.submissionNumber} · {labels[submission.status] ?? submission.status}</strong><time>{new Date(submission.submittedAt).toLocaleString("en-GB")}</time>{submission.reviewerNotes && <p>{submission.reviewerNotes}</p>}</article>)}</div></section>}
      </>}
      <footer className={styles.footerNote}>A course is approved only after review by the required higher role. An approved course can be repeated only through a new management assignment; prior attempts and approvals remain in history.</footer>
    </>}
  </main>;
}

export default function StaffTrainingClient() {
  return <PortalShell access="staff">{() => <AcademyContent />}</PortalShell>;
}
