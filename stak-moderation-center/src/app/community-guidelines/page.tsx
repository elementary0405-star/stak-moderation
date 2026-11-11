"use client";

import { useEffect, useMemo, useState } from "react";
import PublicWorkflowLayout from "@/components/PublicWorkflowLayout";
import styles from "./public-workflow.module.css";

type Acknowledgement = { key: string; label: string; explanation: string; isRequired: boolean; type: string };
type ContextResponse = {
  published: boolean;
  accepted: boolean;
  acceptedKeys?: string[];
  acceptedAt?: string | null;
  policy: null | { id: string; version: string; title: string; introduction: string; policyContent: string; privacyNotice: string; publishedAt: string | null };
  acknowledgements: Acknowledgement[];
};

export default function CommunityGuidelinesPage() {
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/public/application-context", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The published policy could not be loaded.");
        return response.json() as Promise<ContextResponse>;
      })
      .then((data) => { if (active) { setContext(data); setChecked(data.acceptedKeys ?? []); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load the policy."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const requiredKeys = useMemo(() => context?.acknowledgements.filter((item) => item.isRequired).map((item) => item.key) ?? [], [context]);
  const allRequiredChecked = requiredKeys.every((key) => checked.includes(key));

  async function submitAcceptance() {
    if (!context?.policy || !allRequiredChecked) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/public/policy-acceptance", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyVersionId: context.policy.id, acceptedKeys: checked }),
      });
      const data = await response.json() as { error?: string; accepted?: boolean };
      if (!response.ok || !data.accepted) throw new Error(data.error || "Your acknowledgement could not be saved.");
      setSaved(true);
      setContext((current) => current ? { ...current, accepted: true, acceptedKeys: checked } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your acknowledgement.");
    } finally { setSaving(false); }
  }

  return (
    <PublicWorkflowLayout active="guidelines">
      <section className={styles.hero}>
        <span className={styles.eyebrow}>PUBLIC INFORMATION · STAK</span>
        <h1>Community &amp; staff <span>guidelines.</span></h1>
        <p>Review the current published standards before starting a staff application. The application remains locked until every required acknowledgement has been recorded.</p>
      </section>

      {loading ? <div className={styles.panel}>Loading the current policy…</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {!loading && !context?.published ? (
        <div className={styles.notice} role="status">
          <strong>Policies are being finalized.</strong>
          <p>The public application is temporarily closed. STAK must review and publish the current rules and privacy information before applicants can accept them.</p>
          <a href="/apply" className={styles.secondaryButton}>View application status</a>
        </div>
      ) : null}

      {context?.published && context.policy ? (
        <>
          <article className={styles.panel}>
            <div className={styles.panelTop}><span>POLICY VERSION {context.policy.version}</span><span>{context.policy.publishedAt ? new Date(context.policy.publishedAt).toLocaleDateString() : "Published"}</span></div>
            <h2>{context.policy.title}</h2>
            <p className={styles.intro}>{context.policy.introduction}</p>
            <div className={styles.policyText}>{context.policy.policyContent}</div>
          </article>
          <article className={styles.panel}>
            <span className={styles.panelLabel}>PRIVACY INFORMATION</span>
            <h2>How application information is handled</h2>
            <div className={styles.policyText}>{context.policy.privacyNotice}</div>
          </article>
          <section className={styles.acceptance}>
            <span className={styles.panelLabel}>REQUIRED ACKNOWLEDGEMENTS</span>
            <h2>Confirm each statement</h2>
            <p>Each statement must be reviewed and checked separately. Acknowledging the privacy notice is kept separate from the staff-policy acknowledgements.</p>
            <div className={styles.checkList}>
              {context.acknowledgements.map((item) => (
                <label key={item.key} className={styles.checkItem}>
                  <input type="checkbox" checked={checked.includes(item.key)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key))} />
                  <span><strong>{item.label}</strong>{item.explanation ? <small>{item.explanation}</small> : null}<em>{item.isRequired ? "Required" : "Optional"}{item.type === "privacy_notice" ? " · Privacy notice" : " · Staff policy"}</em></span>
                </label>
              ))}
            </div>
            {saved || context.accepted ? <div className={styles.success}>Your acknowledgement for version {context.policy.version} has been recorded. You can now continue to the application.</div> : null}
            {error ? <div className={styles.error} role="alert">{error}</div> : null}
            <button className={styles.primaryButton} onClick={submitAcceptance} disabled={!allRequiredChecked || saving || context.accepted}>
              {saving ? "Saving acknowledgement…" : context.accepted ? "Acknowledgement recorded" : "Accept guidelines and continue"}
            </button>
            <p className={styles.smallNote}>Your confirmation is stored with the policy version and timestamp. It does not waive rights that cannot legally be waived or create blanket consent for unrelated data processing.</p>
            {(saved || context.accepted) ? <a href="/apply" className={styles.continueLink}>Continue to application →</a> : null}
          </section>
        </>
      ) : null}
    </PublicWorkflowLayout>
  );
}
