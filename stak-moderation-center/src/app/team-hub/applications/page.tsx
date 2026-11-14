"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./applications.module.css";

type Status = "new" | "in_review" | "interview" | "accepted" | "rejected" | "withdrawn";
type ApplicationSummary = {
  id: string; referenceCode: string; applicantName: string; discordUsername: string;
  discordUserId: string | null; primaryDevice: string; status: Status; submittedAt: string;
};
type Question = {
  id: string; questionKey: string; sectionTitle: string; prompt: string; helpText: string;
  questionType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number;
  pageNumber: number; dependsOnQuestionKey: string | null; dependsOnValue: string | null;
};
type Acknowledgement = { id?: string; key: string; label: string; explanation: string; sortOrder: number; isRequired: boolean; type: "policy" | "privacy_notice" };
type Policy = { id: string; version: string; title: string; introduction: string; policyContent: string; privacyNotice: string; status: string; isDraft: boolean };
type Config = { policy: Policy | null; acknowledgements: Acknowledgement[]; questions: Question[]; activePolicy: { version: string; publishedAt: string } | null; sourceFormNote: string; recruitmentOpen: boolean; turnstileReady: boolean };
type Detail = { application: Record<string, unknown> & { answers: Record<string, unknown>; questions: Array<Record<string, unknown>> }; notes: Array<{ id: string; authorDiscordId: string; note: string; createdAt: string }>; history: Array<{ previousStatus: string | null; newStatus: string; changedByDiscordId: string; explanation: string | null; createdAt: string }> };
type Tab = "inbox" | "form" | "policies";

const STATUS_LABELS: Record<Status, string> = { new: "New", in_review: "In review", interview: "Interview", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" };
const STATUS_OPTIONS: Status[] = ["new", "in_review", "interview", "accepted", "rejected", "withdrawn"];
const EMPTY_QUESTION = { sectionTitle: "New section", prompt: "", helpText: "", questionType: "textarea", options: "", isRequired: true, isActive: true, sortOrder: 100, pageNumber: 1, dependsOnQuestionKey: "", dependsOnValue: "" };

function formatDate(value: unknown) {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return String(value);
}

export default function StaffApplicationsPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusDraft, setStatusDraft] = useState<Status>("new");
  const [statusExplanation, setStatusExplanation] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState({ ...EMPTY_QUESTION });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [policyDraft, setPolicyDraft] = useState<Policy | null>(null);
  const [ackDraft, setAckDraft] = useState<Acknowledgement[]>([]);
  const [recruitmentOpen, setRecruitmentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    const params = new URLSearchParams({ status: statusFilter, search });
    const response = await fetch("/api/admin/applications?" + params, { credentials: "include", cache: "no-store" });
    const data = await response.json() as { error?: string; applications?: ApplicationSummary[]; counts?: Array<{ status: string; count: number }> };
    if (!response.ok) throw new Error(data.error || "Unable to load applications.");
    return data;
  }, [search, statusFilter]);

  const loadApplications = useCallback(async () => {
    const data = await fetchApplications();
    setApplications(data.applications ?? []);
    setCounts(Object.fromEntries((data.counts ?? []).map((item) => [item.status, item.count])));
  }, [fetchApplications]);

  const fetchConfig = useCallback(async () => {
    const response = await fetch("/api/admin/application-config", { credentials: "include", cache: "no-store" });
    const data = await response.json() as Config & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load application configuration.");
    return data;
  }, []);

  const applyConfig = useCallback((data: Config) => {
    setConfig(data);
    setPolicyDraft(data.policy);
    setAckDraft(data.acknowledgements ?? []);
    setRecruitmentOpen(data.recruitmentOpen === true);
  }, []);

  const loadConfig = useCallback(async () => {
    applyConfig(await fetchConfig());
  }, [applyConfig, fetchConfig]);

  const fetchDetail = useCallback(async (id: string) => {
    const response = await fetch("/api/admin/applications/" + id, { credentials: "include", cache: "no-store" });
    const data = await response.json() as Detail & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load the application.");
    return data;
  }, []);

  const applyDetail = useCallback((data: Detail) => {
    setDetail(data);
    setStatusDraft(data.application.status as Status);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    applyDetail(await fetchDetail(id));
  }, [applyDetail, fetchDetail]);

  useEffect(() => {
    let active = true;
    fetchApplications().then((data) => {
      if (!active) return;
      setApplications(data.applications ?? []);
      setCounts(Object.fromEntries((data.counts ?? []).map((item) => [item.status, item.count])));
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load applications."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchApplications]);

  useEffect(() => {
    if (tab !== "form" && tab !== "policies") return;
    let active = true;
    fetchConfig().then((data) => { if (active) applyConfig(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load configuration."); });
    return () => { active = false; };
  }, [tab, fetchConfig, applyConfig]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    fetchDetail(selectedId).then((data) => { if (active) applyDetail(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load the application."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, fetchDetail, applyDetail]);

  async function refreshAll() {
    setMessage(null); setError(null);
    try { await loadApplications(); if (selectedId) await loadDetail(selectedId); if (tab !== "inbox") await loadConfig(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Refresh failed."); }
  }

  async function saveStatus() {
    if (!selectedId) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/admin/applications/${selectedId}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: statusDraft, explanation: statusExplanation }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Status update failed.");
      setMessage("Application status updated."); setStatusExplanation("");
      await loadApplications(); await loadDetail(selectedId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Status update failed."); }
    finally { setSaving(false); }
  }

  async function addNote() {
    if (!selectedId || noteDraft.trim().length < 3) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/admin/applications/${selectedId}/notes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: noteDraft }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save note.");
      setNoteDraft(""); setMessage("Internal note saved."); await loadDetail(selectedId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save note."); }
    finally { setSaving(false); }
  }

  function startNewQuestion() { setEditingQuestionId(null); setQuestionDraft({ ...EMPTY_QUESTION }); }
  function startEditQuestion(question: Question) {
    setEditingQuestionId(question.id);
    setQuestionDraft({ sectionTitle: question.sectionTitle, prompt: question.prompt, helpText: question.helpText, questionType: question.questionType, options: question.options.join("\n"), isRequired: question.isRequired, isActive: question.isActive, sortOrder: question.sortOrder, pageNumber: question.pageNumber, dependsOnQuestionKey: question.dependsOnQuestionKey ?? "", dependsOnValue: question.dependsOnValue ?? "" });
  }

  async function saveQuestion() {
    setSaving(true); setError(null); setMessage(null);
    const body = { ...questionDraft, options: questionDraft.options.split("\n").map((item) => item.trim()).filter(Boolean) };
    try {
      const response = await fetch(editingQuestionId ? `/api/admin/application-questions/${editingQuestionId}` : "/api/admin/application-questions", {
        method: editingQuestionId ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save question.");
      setMessage(editingQuestionId ? "Question updated." : "Question created."); startNewQuestion(); await loadConfig();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save question."); }
    finally { setSaving(false); }
  }

  async function deactivateQuestion(id: string) {
    if (!window.confirm("Deactivate this question? Existing applications keep their original question snapshot.")) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/admin/application-questions/${id}`, { method: "DELETE", credentials: "include" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to deactivate question.");
      setMessage("Question deactivated."); if (editingQuestionId === id) startNewQuestion(); await loadConfig();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to deactivate question."); }
    finally { setSaving(false); }
  }

  async function savePolicy() {
    if (!policyDraft) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/admin/application-config", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy: policyDraft, acknowledgements: ackDraft }) });
      const data = await response.json() as { error?: string; policyVersion?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save policy.");
      setMessage(`Policy draft ${data.policyVersion ?? ""} saved. It remains unpublished until you explicitly publish it.`); await loadConfig();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save policy."); }
    finally { setSaving(false); }
  }

  async function publishPolicy() {
    if (!window.confirm("Publish this policy version? It will become the public policy for all new acknowledgements and applications.")) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/admin/policies/publish", { method: "POST", credentials: "include" });
      const data = await response.json() as { error?: string; version?: string };
      if (!response.ok) throw new Error(data.error || "Unable to publish policy.");
      setMessage(`Policy version ${data.version} is now published.`); await loadConfig();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to publish policy."); }
    finally { setSaving(false); }
  }

  async function toggleRecruitment(nextValue: boolean) {
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/admin/application-settings", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recruitmentOpen: nextValue }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update recruitment availability.");
      setRecruitmentOpen(nextValue);
      setMessage(nextValue ? "Public recruitment has been opened." : "Public recruitment has been closed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update recruitment availability.");
    } finally { setSaving(false); }
  }

  const activeApplications = useMemo(() => applications.filter((item) => item.status === "new" || item.status === "in_review" || item.status === "interview").length, [applications]);

  return (
    <PortalShell access="staffManager">
      {(user) => (
        <section className={styles.page}>
          <div className={styles.heading}>
            <div><span className={styles.eyebrow}>RECRUITMENT MANAGEMENT</span><h1>Staff applications<span>.</span></h1><p>Review applicants, manage the public application form and maintain the versioned policy acknowledgements.</p></div>
            <button className={styles.refreshButton} onClick={() => void refreshAll()}>Refresh</button>
          </div>

          <div className={styles.stats}>
            <div><span>OPEN INBOX</span><strong>{activeApplications}</strong></div>
            <div><span>NEW</span><strong>{counts.new ?? 0}</strong></div>
            <div><span>ACCEPTED</span><strong>{counts.accepted ?? 0}</strong></div>
            <div><span>ACTIVE POLICY</span><strong className={styles.policyValue}>{config?.activePolicy?.version ?? "Not published"}</strong></div>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Application management sections">
            <button className={tab === "inbox" ? styles.tabActive : styles.tab} onClick={() => setTab("inbox")}>Application inbox</button>
            <button className={tab === "form" ? styles.tabActive : styles.tab} onClick={() => setTab("form")}>Form builder</button>
            <button className={tab === "policies" ? styles.tabActive : styles.tab} onClick={() => setTab("policies")}>Policy builder</button>
          </div>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {message ? <div className={styles.success} role="status">{message}</div> : null}

          {tab === "inbox" ? (
            <div className={styles.inboxLayout}>
              <section className={styles.listPanel}>
                <div className={styles.filters}>
                  <input aria-label="Search applications" placeholder="Search name, Discord or reference…" value={search} onChange={(event) => { setLoading(true); setError(null); setSearch(event.target.value); }} />
                  <select aria-label="Filter application status" value={statusFilter} onChange={(event) => { setLoading(true); setError(null); setStatusFilter(event.target.value); }}><option value="all">All statuses</option>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select>
                </div>
                <div className={styles.applicationList}>
                  {loading && !applications.length ? <p className={styles.empty}>Loading applications…</p> : null}
                  {!loading && !applications.length ? <p className={styles.empty}>No applications match this filter.</p> : null}
                  {applications.map((item) => (
                    <button key={item.id} onClick={() => setSelectedId(item.id)} className={`${styles.applicationItem} ${selectedId === item.id ? styles.applicationSelected : ""}`}>
                      <span className={styles.itemTop}><strong>{item.applicantName}</strong><em className={`${styles.status} ${styles[`status_${item.status}`]}`}>{STATUS_LABELS[item.status]}</em></span>
                      <span className={styles.itemMeta}>{item.discordUsername} · {item.referenceCode}</span>
                      <span className={styles.itemMeta}>{item.primaryDevice.toUpperCase()} · {formatDate(item.submittedAt)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.detailPanel}>
                {!selectedId || !detail ? <div className={styles.emptyDetail}><span>APPLICATION DETAILS</span><h2>Select an application</h2><p>Applicant answers, review history and internal notes will appear here.</p></div> : (
                  <>
                    <div className={styles.detailHeader}><div><span className={styles.eyebrow}>{String(detail.application.referenceCode)}</span><h2>{String(detail.application.applicantName)}</h2><p>{String(detail.application.discordUsername)}{detail.application.discordUserId ? ` · ${String(detail.application.discordUserId)}` : ""}</p></div><span className={`${styles.status} ${styles[`status_${String(detail.application.status)}`]}`}>{STATUS_LABELS[detail.application.status as Status]}</span></div>
                    <div className={styles.detailFacts}><span>PRIMARY DEVICE<strong>{String(detail.application.primaryDevice).toUpperCase()}</strong></span><span>SUBMITTED<strong>{formatDate(detail.application.submittedAt)}</strong></span><span>POLICY ACCEPTED<strong>{formatDate(detail.application.policyAcceptedAt)}</strong></span></div>
                    {detail.application.status === "accepted" ? <div className={styles.onboardingCallout}><span className={styles.eyebrow}>NEXT STAGE · STAK ACADEMY</span><h3>Move the applicant into training onboarding</h3><p>Acceptance starts onboarding; it does not automatically grant full moderation permissions. Assign the applicable course path, review the knowledge answers and practical work, and approve completion from a higher authorized role before changing permissions.</p><a href="/staff-training">Open STAK Academy →</a><small>Course progress, submission attempts, feedback, and approval history are kept in this portal.</small></div> : null}
                    <div className={styles.answers}><h3>Applicant responses</h3>
                      {detail.application.questions.map((question) => {
                        const id = String(question.id); const answer = detail.application.answers[id];
                        return <article className={styles.answerItem} key={id}><span>{String(question.sectionTitle ?? "Application")}</span><h4>{String(question.prompt ?? "Question")}</h4><p>{displayValue(answer)}</p></article>;
                      })}
                    </div>
                    <div className={styles.reviewBox}><h3>Review decision</h3>
                      <label>Status<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as Status)}>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select></label>
                      <label>Decision explanation (internal)<textarea value={statusExplanation} onChange={(event) => setStatusExplanation(event.target.value)} rows={3} maxLength={2000} placeholder="Optional internal reason or next step…" /></label>
                      <button disabled={saving} onClick={() => void saveStatus()}>{saving ? "Saving…" : "Save review status"}</button>
                    </div>
                    <div className={styles.notesBox}><h3>Internal notes</h3>
                      <textarea rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={5000} placeholder="Add a private management note…" />
                      <button disabled={saving || noteDraft.trim().length < 3} onClick={() => void addNote()}>Add internal note</button>
                      <div className={styles.noteList}>{detail.notes.map((note) => <article key={note.id}><p>{note.note}</p><small>{note.authorDiscordId} · {formatDate(note.createdAt)}</small></article>)}{!detail.notes.length ? <p className={styles.muted}>No internal notes yet.</p> : null}</div>
                    </div>
                    <div className={styles.historyBox}><h3>Status history</h3>{detail.history.map((entry, index) => <div key={`${entry.createdAt}-${index}`}><strong>{entry.previousStatus ? STATUS_LABELS[entry.previousStatus as Status] : "Submitted"} → {STATUS_LABELS[entry.newStatus as Status] ?? entry.newStatus}</strong><small>{formatDate(entry.createdAt)} · {entry.changedByDiscordId}</small>{entry.explanation ? <p>{entry.explanation}</p> : null}</div>)}</div>
                  </>
                )}
              </section>
            </div>
          ) : null}

          {tab === "form" ? (
            <div className={styles.builderLayout}>
              <section className={styles.builderMain}>
                <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>FORM STRUCTURE</span><h2>Questions and sections</h2><p>Questions are stored with each application so edits do not change existing submissions.</p></div><button onClick={startNewQuestion}>Add question</button></div>
                <div className={styles.questionList}>{(config?.questions ?? []).map((question) => <article key={question.id} className={`${styles.questionCard} ${!question.isActive ? styles.questionInactive : ""}`}><div><span>{question.sectionTitle} · {question.questionType.replaceAll("_", " ")}</span><h3>{question.prompt}</h3><small>{question.isRequired ? "Required" : "Optional"} · {question.isActive ? "Active" : "Inactive"}</small></div><div className={styles.questionActions}><button onClick={() => startEditQuestion(question)}>Edit</button>{question.isActive ? <button className={styles.dangerButton} onClick={() => void deactivateQuestion(question.id)}>Deactivate</button> : null}</div></article>)}</div>
              </section>
              <aside className={styles.editorPanel}><span className={styles.eyebrow}>{editingQuestionId ? "EDIT QUESTION" : "NEW QUESTION"}</span><h2>{editingQuestionId ? "Update field" : "Create a field"}</h2>
                <label>Section<input value={questionDraft.sectionTitle} onChange={(event) => setQuestionDraft((current) => ({ ...current, sectionTitle: event.target.value }))} /></label>
                <label>Question<textarea rows={4} value={questionDraft.prompt} onChange={(event) => setQuestionDraft((current) => ({ ...current, prompt: event.target.value }))} /></label>
                <label>Help text<textarea rows={2} value={questionDraft.helpText} onChange={(event) => setQuestionDraft((current) => ({ ...current, helpText: event.target.value }))} /></label>
                <label>Field type<select value={questionDraft.questionType} onChange={(event) => setQuestionDraft((current) => ({ ...current, questionType: event.target.value }))}><option value="text">Short text</option><option value="textarea">Long answer</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="yes_no">Yes / No</option></select></label>
                {questionDraft.questionType === "single_choice" || questionDraft.questionType === "multiple_choice" ? <label>Options (one per line)<textarea rows={5} value={questionDraft.options} onChange={(event) => setQuestionDraft((current) => ({ ...current, options: event.target.value }))} /></label> : null}
                <label>Application step<input type="number" min={1} max={30} value={questionDraft.pageNumber} onChange={(event) => setQuestionDraft((current) => ({ ...current, pageNumber: Number(event.target.value) }))} /></label>
                <label>Show only when a previous answer matches<select value={questionDraft.dependsOnQuestionKey} onChange={(event) => setQuestionDraft((current) => ({ ...current, dependsOnQuestionKey: event.target.value }))}><option value="">Always show</option>{(config?.questions ?? []).filter((question) => question.id !== editingQuestionId && (question.questionType === "yes_no" || question.questionType === "single_choice")).map((question) => <option value={question.questionKey} key={question.id}>{question.prompt}</option>)}</select></label>
                {questionDraft.dependsOnQuestionKey ? <label>Matching answer<input value={questionDraft.dependsOnValue} onChange={(event) => setQuestionDraft((current) => ({ ...current, dependsOnValue: event.target.value }))} placeholder="Exact answer, e.g. Ja" /></label> : null}
                <label>Sort order<input type="number" value={questionDraft.sortOrder} onChange={(event) => setQuestionDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
                <label className={styles.toggle}><input type="checkbox" checked={questionDraft.isRequired} onChange={(event) => setQuestionDraft((current) => ({ ...current, isRequired: event.target.checked }))} />Required question</label>
                {editingQuestionId ? <label className={styles.toggle}><input type="checkbox" checked={questionDraft.isActive} onChange={(event) => setQuestionDraft((current) => ({ ...current, isActive: event.target.checked }))} />Active on public form</label> : null}
                <button className={styles.saveButton} onClick={() => void saveQuestion()} disabled={saving}>{saving ? "Saving…" : "Save question"}</button>
                {editingQuestionId ? <button className={styles.cancelButton} onClick={startNewQuestion}>Cancel editing</button> : null}
              </aside>
            </div>
          ) : null}

          {tab === "policies" ? (
            <div className={styles.policyBuilder}>
              {!config?.turnstileReady ? <div className={styles.error}>Cloudflare Turnstile is not configured. Public recruitment cannot be opened or applications submitted until both the site key and server secret are configured.</div> : null}
              {user.stakRole === "owner" ? <div className={styles.recruitmentSwitch}><label><input type="checkbox" checked={recruitmentOpen} disabled={saving} onChange={(event) => void toggleRecruitment(event.target.checked)} /> Public recruitment is open</label><span>{recruitmentOpen && !config?.turnstileReady ? "The database is set to open, but submissions are blocked until Turnstile is configured." : recruitmentOpen ? "Applicants may submit once the published policy is accepted." : "The public application form is closed."}</span></div> : <div className={styles.info}>Only the Owner can open or close public recruitment. Managers may prepare the form and policy drafts.</div>}
              <div className={styles.policyStatus}><div><span className={styles.eyebrow}>PUBLIC POLICY</span><h2>Policy and acknowledgement builder</h2><p>Changes are saved as a draft. The previously published policy remains active until the new version is explicitly published.</p></div><span className={config?.activePolicy ? styles.publishedBadge : styles.draftBadge}>{config?.activePolicy ? `Published: ${config.activePolicy.version}` : "No public policy"}</span></div>
              {!config?.policy ? <div className={styles.error}>No policy configuration was returned. Apply the database migration and reload.</div> : null}
              {config?.sourceFormNote ? <div className={styles.info}>{config.sourceFormNote}</div> : null}
              {policyDraft ? <>
                <div className={styles.policyFields}>
                  <label>Document title<input value={policyDraft.title} onChange={(event) => setPolicyDraft((current) => current ? { ...current, title: event.target.value } : current)} /></label>
                  <label>Introduction<textarea rows={3} value={policyDraft.introduction} onChange={(event) => setPolicyDraft((current) => current ? { ...current, introduction: event.target.value } : current)} /></label>
                  <label>Staff standards<textarea rows={18} value={policyDraft.policyContent} onChange={(event) => setPolicyDraft((current) => current ? { ...current, policyContent: event.target.value } : current)} /></label>
                  <label>Privacy notice<textarea rows={16} value={policyDraft.privacyNotice} onChange={(event) => setPolicyDraft((current) => current ? { ...current, privacyNotice: event.target.value } : current)} /></label>
                </div>
                <section className={styles.ackEditor}><div className={styles.sectionHeader}><div><h3>Individual required confirmations</h3><p>Keep acknowledgement of the privacy notice separate from policy agreement.</p></div><button onClick={() => setAckDraft((current) => [...current, { key: `confirmation_${current.length + 1}`, label: "New required confirmation", explanation: "", sortOrder: (current.length + 1) * 10, isRequired: true, type: "policy" }])}>Add confirmation</button></div>
                  {ackDraft.map((item, index) => <article className={styles.ackRow} key={`${item.key}-${index}`}>
                    <label>Key<input value={item.key} onChange={(event) => setAckDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, key: event.target.value } : row))} /></label>
                    <label>Checkbox wording<input value={item.label} onChange={(event) => setAckDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></label>
                    <label>Explanation<input value={item.explanation} onChange={(event) => setAckDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, explanation: event.target.value } : row))} /></label>
                    <label>Type<select value={item.type} onChange={(event) => setAckDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, type: event.target.value as "policy" | "privacy_notice" } : row))}><option value="policy">Staff policy</option><option value="privacy_notice">Privacy notice</option></select></label>
                    <label className={styles.toggle}><input type="checkbox" checked={item.isRequired} onChange={(event) => setAckDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, isRequired: event.target.checked } : row))} />Required</label>
                    <button className={styles.dangerButton} onClick={() => setAckDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
                  </article>)}
                </section>
                <div className={styles.policyActions}><button onClick={() => void savePolicy()} disabled={saving}>{saving ? "Saving…" : "Save policy draft"}</button>{user.stakRole === "owner" ? <button className={styles.publishButton} onClick={() => void publishPolicy()} disabled={saving || policyDraft.status === "published"}>Publish policy version</button> : null}</div>
                <p className={styles.legalNote}>Publishing is blocked while bracketed placeholders remain. Before publishing, have the responsible STAK decision-makers verify the legal controller details, purposes, legal bases, processors, retention periods and rights information. This editor does not replace legal review.</p>
              </> : null}
            </div>
          ) : null}
          <p className={styles.signedIn}>Management access verified for {user.username}.</p>
        </section>
      )}
    </PortalShell>
  );
}
