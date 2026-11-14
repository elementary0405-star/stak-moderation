"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import styles from "./apply.module.css";

type ApplicationQuestion = {
  id: string;
  questionKey: string;
  sectionTitle: string;
  prompt: string;
  helpText: string;
  questionType: "text" | "textarea" | "single_choice" | "multiple_choice" | "yes_no";
  options: string[];
  isRequired: boolean;
  pageNumber: number;
  dependsOnQuestionKey: string | null;
  dependsOnValue: string | null;
};

type ApplicationRecord = {
  referenceCode: string;
  status: string;
  submittedAt: string;
};

type ApplicationContext = {
  profile: Pick<DiscordSessionUser, "discordUserId" | "username" | "globalName" | "avatar" | "stakRole">;
  guidelinesPublished: boolean;
  guidelinesAccepted: boolean;
  acceptedKeys: string[];
  applicationOpen: boolean;
  closedReason: string | null;
  policy: null | {
    id: string;
    version: string;
    title: string;
    privacyNotice: string;
  };
  acknowledgements: { key: string; label: string; explanation: string; isRequired: boolean }[];
  questions: ApplicationQuestion[];
  turnstileSiteKey: string;
  turnstileReady: boolean;
  application: ApplicationRecord | null;
};

type PublicApplication = ApplicationRecord & { submitted?: boolean };
type AnswerValue = string | string[];

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function isAnswered(value: AnswerValue | undefined) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
}

function ApplicationForm({ user }: { user: DiscordSessionUser }) {
  const [context, setContext] = useState<ApplicationContext | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicApplication | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileIdRef = useRef<string | null>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public/application-context", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json() as ApplicationContext & { error?: string };
      if (!response.ok) throw new Error(data.error || "Application status could not be loaded.");
      setContext(data);
      setReceipt(data.application);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContext(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContext]);

  useEffect(() => {
    const siteKey = context?.turnstileSiteKey;
    if (!context?.applicationOpen || !siteKey || !turnstileRef.current) return;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !window.turnstile || !turnstileRef.current) return;
      if (turnstileIdRef.current) window.turnstile.remove(turnstileIdRef.current);
      turnstileIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        action: "stak_application",
        callback: (token: string) => { setTurnstileToken(token); setTurnstileError(null); },
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileError("Anti-bot verification could not be loaded. Reload this page and try again."),
      });
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-stak-turnstile]");
    if (window.turnstile) {
      renderWidget();
    } else if (existing) {
      existing.addEventListener("load", renderWidget, { once: true });
      existing.addEventListener("error", () => setTurnstileError("Anti-bot verification could not be loaded."), { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.stakTurnstile = "true";
      script.addEventListener("load", renderWidget, { once: true });
      script.addEventListener("error", () => setTurnstileError("Anti-bot verification could not be loaded."), { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (turnstileIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileIdRef.current);
        turnstileIdRef.current = null;
      }
    };
  }, [context?.applicationOpen, context?.turnstileSiteKey]);

  const visibleQuestions = useMemo(() => {
    if (!context) return [];
    const byKey = new Map(context.questions.map((question) => [question.questionKey, question]));
    return context.questions.filter((question) => {
      if (!question.dependsOnQuestionKey) return true;
      const parent = byKey.get(question.dependsOnQuestionKey);
      return Boolean(parent) && answers[parent!.id] === question.dependsOnValue;
    });
  }, [context, answers]);

  const pageNumbers = useMemo(
    () => [...new Set(visibleQuestions.map((question) => question.pageNumber))].sort((a, b) => a - b),
    [visibleQuestions],
  );
  const pageQuestions = visibleQuestions.filter((question) => question.pageNumber === pageNumber);
  const activePageIndex = Math.max(0, pageNumbers.indexOf(pageNumber));
  const isLastPage = pageNumbers.length > 0 && activePageIndex === pageNumbers.length - 1;

  function updateAnswer(question: ApplicationQuestion, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  function continueForm() {
    const missing = pageQuestions.find((question) => question.isRequired && !isAnswered(answers[question.id]));
    if (missing) {
      setError(`Please complete: ${missing.prompt}`);
      return;
    }
    setError(null);
    if (!isLastPage && pageNumbers[activePageIndex + 1] !== undefined) {
      setPageNumber(pageNumbers[activePageIndex + 1]);
    }
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !context.applicationOpen || !context.guidelinesAccepted || !privacyAcknowledged || !turnstileToken) return;
    const missing = visibleQuestions.find((question) => question.isRequired && !isAnswered(answers[question.id]));
    if (missing) {
      setPageNumber(missing.pageNumber);
      setError(`Please complete: ${missing.prompt}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/public/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          privacyNoticeVersionId: context.policy?.id,
          privacyAcknowledged,
          turnstileToken,
        }),
      });
      const data = await response.json() as PublicApplication & { error?: string };
      if (!response.ok || !data.submitted) throw new Error(data.error || "Your application could not be submitted.");
      setReceipt(data);
      setTurnstileToken("");
      if (turnstileIdRef.current && window.turnstile) window.turnstile.reset(turnstileIdRef.current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className={styles.page}><div className={styles.state}>Loading application status…</div></main>;
  }

  if (error && !context) {
    return <main className={styles.page}><div className={styles.error} role="alert"><p>{error}</p><button onClick={() => void loadContext()}>Try Again</button></div></main>;
  }

  if (!context) return null;

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href="/community-area">← Community Area</a>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>STAK MODERATION · RECRUITMENT</span>
        <h1>Staff <span>Application</span></h1>
        <p>Your application is linked to the Discord account you connected.</p>
      </header>

      <section className={styles.identity} aria-label="Connected Discord account">
        <span className={styles.identityLabel}>CONNECTED DISCORD ACCOUNT</span>
        <strong>{user.globalName || user.username}</strong>
        <span>@{user.username}</span>
      </section>

      {receipt ? (
        <section className={styles.receipt} aria-live="polite">
          <span className={styles.eyebrow}>APPLICATION STATUS</span>
          <h2>Application {receipt.status.replaceAll("_", " ")}.</h2>
          <p>Reference <strong>{receipt.referenceCode}</strong> · Submitted {new Date(receipt.submittedAt).toLocaleString()}</p>
          {receipt.status === "accepted" ? <p>The STAK team will contact you through Discord about next steps.</p> : null}
          {receipt.status === "rejected" ? <p>Contact the STAK team through Discord if you need information about the outcome or a possible new application.</p> : null}
        </section>
      ) : !context.applicationOpen ? (
        <section className={styles.closed} role="status">
          <span className={styles.eyebrow}>APPLICATIONS CLOSED</span>
          <h2>Applications are currently closed.</h2>
          <p>{context.closedReason || "STAK management will open the application when recruitment and the required safeguards are ready."}</p>
          <a href="/staff-guidelines">Read Staff Guidelines</a>
        </section>
      ) : !context.guidelinesAccepted ? (
        <section className={styles.closed} role="status">
          <span className={styles.eyebrow}>STAFF GUIDELINES REQUIRED</span>
          <h2>Read and acknowledge the current Staff Guidelines first.</h2>
          <p>The application opens after your acknowledgement is saved against your Discord account and the current version.</p>
          <a href="/staff-guidelines">Read Staff Guidelines</a>
        </section>
      ) : !context.policy ? (
        <section className={styles.closed} role="status">
          <h2>Applications are currently closed.</h2>
          <p>The current guidelines and application safeguards must be configured before applications can be submitted.</p>
        </section>
      ) : !context.turnstileReady ? (
        <section className={styles.closed} role="status">
          <h2>Applications are currently closed.</h2>
          <p>The application safety check is not configured for this environment yet.</p>
        </section>
      ) : (
        <form className={styles.form} onSubmit={(event) => void submitApplication(event)}>
          <section className={styles.formIntro}>
            <div>
              <span className={styles.eyebrow}>APPLICATION FORM</span>
              <h2>{pageQuestions[0]?.sectionTitle || "Your application"}</h2>
              <p>Required questions are marked. Your Discord name and ID are taken from your verified session rather than entered again.</p>
            </div>
            <span className={styles.progress}>STEP {activePageIndex + 1} OF {pageNumbers.length}</span>
          </section>

          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${((activePageIndex + 1) / Math.max(pageNumbers.length, 1)) * 100}%` }} /></div>

          <section className={styles.questionList}>
            {pageQuestions.map((question) => (
              <fieldset className={styles.question} key={question.id}>
                <legend>{question.prompt}{question.isRequired ? <span aria-label="required"> *</span> : null}</legend>
                {question.helpText ? <p className={styles.helpText}>{question.helpText}</p> : null}
                {question.questionType === "textarea" ? (
                  <textarea value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} maxLength={8000} rows={5} onChange={(event) => updateAnswer(question, event.target.value)} />
                ) : question.questionType === "multiple_choice" ? (
                  <div className={styles.options}>
                    {question.options.map((option) => {
                      const selected = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                      return (
                        <label className={styles.option} key={option}>
                          <input type="checkbox" checked={selected.includes(option)} onChange={(event) => updateAnswer(question, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : question.questionType === "single_choice" || question.questionType === "yes_no" ? (
                  <div className={styles.options}>
                    {(question.options.length ? question.options : ["yes", "no"]).map((option) => (
                      <label className={styles.option} key={option}>
                        <input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => updateAnswer(question, option)} />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input type="text" value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} maxLength={8000} onChange={(event) => updateAnswer(question, event.target.value)} />
                )}
              </fieldset>
            ))}
          </section>

          {isLastPage ? (
            <>
              <section className={styles.privacyNotice}>
                <span className={styles.eyebrow}>PRIVACY NOTICE · VERSION {context.policy.version}</span>
                <h2>How application information is handled</h2>
                <div>{context.policy.privacyNotice.split(/\n{2,}/).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 18)}`}>{paragraph.trim()}</p>)}</div>
                <label className={styles.privacyCheck}>
                  <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
                  <span>I acknowledge that I have read the privacy notice for this application version. This acknowledgement is separate from the Staff Guidelines.</span>
                </label>
              </section>
              <div className={styles.securityCheck}>
                <span className={styles.eyebrow}>APPLICATION SECURITY CHECK</span>
                <div ref={turnstileRef} />
                {!turnstileToken ? <p>Complete the security check before submitting.</p> : <p className={styles.verified}>Security check completed.</p>}
                {turnstileError ? <p className={styles.inlineError} role="alert">{turnstileError}</p> : null}
              </div>
            </>
          ) : null}

          {error ? <p className={styles.inlineError} role="alert">{error}</p> : null}
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => { setError(null); setPageNumber(pageNumbers[Math.max(0, activePageIndex - 1)]); }} disabled={activePageIndex === 0}>Back</button>
            {!isLastPage ? (
              <button type="button" className={styles.primaryButton} onClick={continueForm}>Next <span aria-hidden="true">→</span></button>
            ) : (
              <button type="submit" className={styles.primaryButton} disabled={submitting || !privacyAcknowledged || !turnstileToken}>
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}

export default function ApplyPage() {
  return (
    <PortalShell access="community">
      {(user) => user.stakRole === "community-member"
        ? <ApplicationForm user={user} />
        : <main className={styles.page}><section className={styles.closed}><h1>Applications are for Community members.</h1><p>Your verified STAK account can open the Staff Area.</p><a href="/staff-area">Open Staff Area</a></section></main>}
    </PortalShell>
  );
}
