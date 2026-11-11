"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import PublicWorkflowLayout from "@/components/PublicWorkflowLayout";
import styles from "./apply.module.css";

type Question = {
  id: string;
  questionKey: string;
  sectionTitle: string;
  prompt: string;
  helpText: string;
  questionType: "text" | "textarea" | "single_choice" | "multiple_choice" | "yes_no";
  options: string[];
  isRequired: boolean;
};
type ApplicationContext = {
  published: boolean;
  accepted: boolean;
  applicationOpen: boolean;
  policy: null | { id: string; version: string; title: string };
  questions: Question[];
  turnstileSiteKey?: string;
};
type Answers = Record<string, string | string[]>;
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const DEVICE_OPTIONS = [
  ["pc", "PC / Desktop"], ["laptop", "Laptop"], ["playstation", "PlayStation"],
  ["xbox", "Xbox"], ["smartphone", "Smartphone"], ["tablet", "Tablet"], ["other", "Other"],
] as const;

function Field({ question, value, onChange }: { question: Question; value: string | string[] | undefined; onChange: (value: string | string[]) => void }) {
  const inputClass = styles.input;
  if (question.questionType === "textarea") {
    return <textarea className={styles.textarea} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} maxLength={8000} rows={5} />;
  }
  if (question.questionType === "single_choice") {
    return <select className={inputClass} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>;
  }
  if (question.questionType === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return <div className={styles.optionList}>{question.options.map((option) => <label key={option} className={styles.option}>
      <input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}
    </label>)}</div>;
  }
  if (question.questionType === "yes_no") {
    return <div className={styles.optionList}><label className={styles.option}><input type="radio" name={question.id} checked={value === "yes"} onChange={() => onChange("yes")} />Yes</label><label className={styles.option}><input type="radio" name={question.id} checked={value === "no"} onChange={() => onChange("no")} />No</label></div>;
  }
  return <input className={inputClass} type="text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} maxLength={1000} />;
}

export default function ApplyPage() {
  const [context, setContext] = useState<ApplicationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [primaryDevice, setPrimaryDevice] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public/application-context", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Application information is currently unavailable.");
        return response.json() as Promise<ApplicationContext>;
      })
      .then((data) => { if (active) setContext(data); })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "Unable to load the application."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const siteKey = context?.turnstileSiteKey;
    if (!siteKey || !context?.published || !context.applicationOpen || !context.accepted || !turnstileContainerRef.current) return;
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current || turnstileWidgetRef.current) return;
      turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        action: "stak_application",
        theme: "dark",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };
    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-stak-turnstile="true"]');
      if (existing) {
        existing.addEventListener("load", renderWidget, { once: true });
      } else {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.stakTurnstile = "true";
        script.addEventListener("load", renderWidget, { once: true });
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      if (turnstileWidgetRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetRef.current);
        turnstileWidgetRef.current = null;
      }
    };
  }, [context?.turnstileSiteKey, context?.published, context?.applicationOpen, context?.accepted]);

  const groupedQuestions = useMemo(() => {
    const groups = new Map<string, Question[]>();
    for (const question of context?.questions ?? []) {
      const group = groups.get(question.sectionTitle) ?? [];
      group.push(question); groups.set(question.sectionTitle, group);
    }
    return [...groups.entries()];
  }, [context]);

  const deviceIsEligible = primaryDevice === "pc" || primaryDevice === "laptop";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context?.published || !context.accepted || !deviceIsEligible) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const response = await fetch("/api/public/applications", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantName, discordUsername, discordUserId, primaryDevice, answers, website, turnstileToken }),
      });
      const data = await response.json() as { error?: string; referenceCode?: string; requiresPolicyAcceptance?: boolean };
      if (!response.ok) {
        if (data.requiresPolicyAcceptance) setContext((current) => current ? { ...current, accepted: false } : current);
        throw new Error(data.error || "Your application could not be submitted.");
      }
      setReferenceCode(data.referenceCode ?? "STAK-APP-RECEIVED");
      setTurnstileToken("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your application could not be submitted.");
      setTurnstileToken("");
      if (turnstileWidgetRef.current && window.turnstile) window.turnstile.reset(turnstileWidgetRef.current);
    } finally { setSubmitting(false); }
  }

  return (
    <PublicWorkflowLayout active="apply">
      <section className={styles.hero}>
        <span className={styles.eyebrow}>STAK RECRUITMENT</span>
        <h1>Staff <span>application.</span></h1>
        <p>Complete the application carefully and answer in your own words. The management team reviews each submission. Sending an application does not guarantee acceptance.</p>
      </section>

      {loading ? <div className={styles.panel}>Loading the application form…</div> : null}
      {loadError ? <div className={styles.error} role="alert">{loadError}</div> : null}

      {!loading && (!context?.published || !context.applicationOpen || !context.accepted) ? (
        <div className={styles.locked} role="alert">
          <strong>{!context?.published ? "The policy documents are not published yet." : !context.applicationOpen ? "STAK is not accepting applications at the moment." : "Read and accept the guidelines first."}</strong>
          <p>{!context?.published ? "STAK is preparing the current policy and privacy information. The application cannot be submitted until the documents have been approved and published." : !context.applicationOpen ? "The application form is currently closed. Please check back later or follow official STAK recruitment announcements." : "You must review the current guidelines and individually acknowledge every required statement before the application form becomes available."}</p>
          <a href="/community-guidelines" className={styles.button}>Open guidelines and acknowledgements →</a>
        </div>
      ) : null}

      {referenceCode ? (
        <section className={styles.success}>
          <span className={styles.eyebrow}>APPLICATION RECEIVED</span>
          <h2>Thank you for applying.</h2>
          <p>Your application has been recorded. Keep this reference code for future correspondence:</p>
          <strong className={styles.reference}>{referenceCode}</strong>
          <p>The STAK management team will review your information. Do not submit another application unless the team asks you to do so.</p>
          <a href="/" className={styles.button}>Return to STAK home</a>
        </section>
      ) : null}

      {context?.published && context.applicationOpen && context.accepted && !referenceCode ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}><span>APPLICATION FORM</span><strong>Policy {context.policy?.version}</strong></div>
          <section className={styles.formSection}>
            <h2>Applicant details</h2>
            <p>Use the Discord account you intend to use as a STAK team member.</p>
            <label className={styles.field}><span>Preferred name <em>Required</em></span><input className={styles.input} value={applicantName} onChange={(event) => setApplicantName(event.target.value)} required minLength={2} maxLength={100} /></label>
            <label className={styles.field}><span>Discord username <em>Required</em></span><input className={styles.input} value={discordUsername} onChange={(event) => setDiscordUsername(event.target.value)} required minLength={2} maxLength={100} placeholder="Your Discord username" /></label>
            <label className={styles.field}><span>Discord user ID <small>Optional, but helps identify the correct account</small></span><input className={styles.input} inputMode="numeric" value={discordUserId} onChange={(event) => setDiscordUserId(event.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="17–20 digit ID" /></label>
          </section>

          <section className={styles.formSection}>
            <h2>Work device requirement</h2>
            <p>STAK staff duties require a desktop-class workflow for moderation tools, tickets and team activities. Select the primary device you would use for staff work.</p>
            <label className={styles.field}><span>Primary device <em>Required</em></span><select className={styles.input} value={primaryDevice} onChange={(event) => setPrimaryDevice(event.target.value)} required>
              <option value="">Select your primary device</option>{DEVICE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            {primaryDevice && !deviceIsEligible ? <div className={styles.deviceError} role="alert">A PC or laptop is required for STAK staff work. The selected device does not meet this requirement, so you cannot submit this application.</div> : null}
            {deviceIsEligible ? <div className={styles.deviceSuccess}>This device meets the current STAK work-device requirement.</div> : null}
          </section>

          {groupedQuestions.map(([section, questions]) => (
            <section className={styles.formSection} key={section}>
              <h2>{section}</h2>
              {questions.map((question) => (
                <label className={styles.field} key={question.id}>
                  <span>{question.prompt}{question.isRequired ? <em>Required</em> : <small>Optional</small>}</span>
                  {question.helpText ? <small>{question.helpText}</small> : null}
                  <Field question={question} value={answers[question.id]} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
                </label>
              ))}
            </section>
          ))}

          <label className={styles.honeypot} aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          {context.turnstileSiteKey ? <div className={styles.turnstileBlock}><span>SECURITY VERIFICATION</span><div ref={turnstileContainerRef} /><small>Complete the security check before submitting.</small></div> : null}
          {submitError ? <div className={styles.error} role="alert">{submitError}</div> : null}
          <div className={styles.submitArea}>
            <p>By submitting, you confirm that the information above is accurate and that you have accepted the current STAK policy version.</p>
            <button type="submit" className={styles.button} disabled={submitting || !deviceIsEligible || Boolean(context.turnstileSiteKey && !turnstileToken)}>{submitting ? "Submitting…" : "Submit application"}</button>
          </div>
        </form>
      ) : null}
    </PublicWorkflowLayout>
  );
}
