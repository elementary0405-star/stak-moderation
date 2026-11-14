"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./staff-guidelines.module.css";

type Acknowledgement = {
  key: string;
  label: string;
  explanation: string;
  isRequired: boolean;
};

type GuidelinesContext = {
  guidelinesPublished: boolean;
  guidelinesAccepted: boolean;
  guidelinesAcceptedAt: string | null;
  applicationOpen: boolean;
  closedReason: string | null;
  policy: null | {
    id: string;
    version: string;
    title: string;
    introduction: string;
    policyContent: string;
    publishedAt: string | null;
  };
  acknowledgements: Acknowledgement[];
  acceptedKeys: string[];
};

function GuidelinesContent() {
  const [context, setContext] = useState<GuidelinesContext | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public/application-context", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json() as GuidelinesContext & { error?: string };
      if (!response.ok) throw new Error(data.error || "Staff Guidelines could not be loaded.");
      setContext(data);
      setChecked(data.acceptedKeys ?? []);
      setSaved(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Staff Guidelines could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContext(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContext]);

  const requiredKeys = useMemo(
    () => context?.acknowledgements.filter((item) => item.isRequired).map((item) => item.key) ?? [],
    [context],
  );
  const allRequiredChecked = requiredKeys.length > 0 && requiredKeys.every((key) => checked.includes(key));

  async function submitAcceptance() {
    if (!context?.policy || !context.guidelinesPublished || !allRequiredChecked || context.guidelinesAccepted) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/public/policy-acceptance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyVersionId: context.policy.id, acceptedKeys: checked }),
      });
      const result = await response.json() as { accepted?: boolean; error?: string };
      if (!response.ok || !result.accepted) throw new Error(result.error || "Your acknowledgement could not be saved.");
      setSaved(true);
      await loadContext();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your acknowledgement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href="/community-area">← Community Area</a>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>STAK MODERATION · RECRUITMENT</span>
        <h1>Staff <span>Guidelines</span></h1>
        <p>Review the expectations and application agreement before you apply to join the STAK team.</p>
      </header>

      {loading ? <div className={styles.state}>Loading Staff Guidelines…</div> : null}
      {!loading && error ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button className={styles.secondaryButton} onClick={() => void loadContext()}>Try Again</button>
        </div>
      ) : null}

      {!loading && !error && context?.policy ? (
        <>
          {!context.guidelinesPublished ? (
            <div className={styles.draftNotice} role="status">
              <strong>Draft — not yet published</strong>
              <span>This version is available for review, but it cannot be acknowledged. Applications remain closed until STAK publishes an approved version.</span>
            </div>
          ) : null}
          <article className={styles.document}>
            <div className={styles.documentHeader}>
              <div>
                <span className={styles.documentLabel}>VERSION {context.policy.version}</span>
                <h2>{context.policy.title}</h2>
              </div>
              {context.guidelinesPublished ? <span className={styles.publishedBadge}>PUBLISHED</span> : null}
            </div>
            <p className={styles.introduction}>{context.policy.introduction}</p>
            <div className={styles.policyText}>
              {context.policy.policyContent.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 18)}`}>{paragraph.trim()}</p>
              ))}
            </div>
            {context.policy.publishedAt ? (
              <p className={styles.versionDate}>Published {new Date(context.policy.publishedAt).toLocaleDateString()}</p>
            ) : null}
          </article>

          {context.guidelinesPublished ? (
            <section className={styles.acknowledgement} aria-labelledby="ack-title">
              <span className={styles.documentLabel}>REQUIRED BEFORE APPLYING</span>
              <h2 id="ack-title">Confirm the Staff Guidelines</h2>
              <p>Your confirmation is stored with your Discord account, the exact guideline version and the time you submitted it. The separate privacy notice is shown in the application flow.</p>
              {context.guidelinesAccepted || saved ? (
                <div className={styles.success} role="status">
                  Staff Guidelines version {context.policy.version} acknowledged
                  {context.guidelinesAcceptedAt ? ` on ${new Date(context.guidelinesAcceptedAt).toLocaleString()}` : "."}
                </div>
              ) : (
                <>
                  <div className={styles.checkList}>
                    {context.acknowledgements.filter((item) => item.isRequired).map((item) => (
                      <label className={styles.checkRow} key={item.key}>
                        <input
                          type="checkbox"
                          checked={checked.includes(item.key)}
                          onChange={(event) => setChecked((current) => event.target.checked
                            ? [...current, item.key]
                            : current.filter((key) => key !== item.key))}
                        />
                        <span><strong>{item.label}</strong>{item.explanation ? <small>{item.explanation}</small> : null}</span>
                      </label>
                    ))}
                  </div>
                  {requiredKeys.length === 0 ? <p className={styles.errorText}>No required acknowledgements are configured for this version. Contact STAK management.</p> : null}
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={!allRequiredChecked || saving || requiredKeys.length === 0}
                    onClick={() => void submitAcceptance()}
                  >
                    {saving ? "Saving…" : "Confirm Guidelines"}
                  </button>
                </>
              )}
              {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
            </section>
          ) : null}

          <section className={styles.nextStep}>
            <div>
              <h2>Next step</h2>
              <p>{context.applicationOpen ? "Once you have acknowledged the current version, continue to your application." : context.closedReason || "Applications are currently closed."}</p>
            </div>
            {context.applicationOpen && context.guidelinesAccepted ? (
              <a className={styles.primaryButton} href="/apply">Start Application <span aria-hidden="true">→</span></a>
            ) : (
              <a className={styles.secondaryButton} href="/community-area">Return to Community Area</a>
            )}
          </section>
        </>
      ) : null}

      {!loading && !error && !context?.policy ? (
        <div className={styles.draftNotice} role="status">
          <strong>Staff Guidelines are not yet available.</strong>
          <span>STAK management must prepare and publish the current version before applicants can acknowledge it.</span>
        </div>
      ) : null}
    </main>
  );
}

export default function StaffGuidelinesPage() {
  return <PortalShell access="community">{() => <GuidelinesContent />}</PortalShell>;
}
