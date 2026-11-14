"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import styles from "./community-area.module.css";

type CommunityContext = {
  canApply: boolean;
  applicationOpen: boolean;
  closedReason?: string | null;
  guidelinesPublished: boolean;
  guidelinesAccepted: boolean;
  application?: { referenceCode: string; status: string; submittedAt: string } | null;
};

function CommunityAreaContent() {
  const [context, setContext] = useState<CommunityContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/public/application-context", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("context unavailable");
        return await response.json() as CommunityContext;
      })
      .then((data) => { if (active) setContext(data); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const application = context?.application ?? null;
  const canOpenApplication = Boolean(context?.canApply && context.applicationOpen && context.guidelinesAccepted);
  const hasActiveApplication = Boolean(context?.canApply && application && ["new", "in_review", "interview"].includes(application.status));
  const applicationHref = hasActiveApplication || canOpenApplication ? "/apply" : undefined;
  const applicationAction = hasActiveApplication ? "View Application" : "Start Application";

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <span className={styles.eyebrow}>STAK MODERATION</span>
        <h1>Community <span>Area</span></h1>
        <p>Read the staff expectations and check the current recruitment status.</p>
      </section>

      {loadError ? (
        <p className={styles.loadError} role="status">
          Application status could not be checked right now. Reload this page to try again.
        </p>
      ) : null}

      <section className={styles.grid} aria-label="Community Area options">
        <article className={styles.card} id="staff-application-card" data-tour="community-application">
          <div className={styles.cardTop}>
            <span className={styles.number}>01</span>
            <span className={`${styles.status} ${context?.applicationOpen ? styles.open : styles.closed}`}>
              {loading ? "CHECKING" : context?.applicationOpen ? "APPLICATIONS OPEN" : "APPLICATIONS CLOSED"}
            </span>
          </div>
          <span className={styles.cardEyebrow}>JOIN THE STAK TEAM</span>
          <h2>Staff Application</h2>
          <p>Apply to join the STAK staff team. Your answers are linked to the Discord account you connected.</p>
          {application ? (
            <p className={styles.applicationStatus}>
              {hasActiveApplication ? "Your application is being reviewed." : `Latest application: ${application.status.replaceAll("_", " ")}.`}
              <span>Reference {application.referenceCode}</span>
            </p>
          ) : null}
          <div className={styles.cardFooter}>
            <span className={styles.requirement}>
              {loading ? "Checking current requirements…" : loadError
                ? "Application availability could not be verified."
                : context?.canApply === false
                  ? "Applications are available to STAK Community members."
                : context?.applicationOpen
                  ? context.guidelinesAccepted
                    ? "Current Staff Guidelines acknowledged."
                    : "Read and acknowledge the current Staff Guidelines first."
                  : context?.closedReason || "Applications are currently closed."}
            </span>
            {applicationHref ? (
              <a className={styles.action} href={applicationHref}>
                {applicationAction}<span aria-hidden="true">→</span>
              </a>
            ) : (
              <button className={styles.action} type="button" disabled>
                {applicationAction}<span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </article>

        <article className={styles.card} id="staff-guidelines-card" data-tour="community-guidelines">
          <div className={styles.cardTop}>
            <span className={styles.number}>02</span>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.cardEyebrow}>APPLICATION REQUIREMENTS</span>
          <h2>Staff Guidelines</h2>
          <p>Review the staff expectations and application agreement. The current version must be acknowledged before applying.</p>
          <div className={styles.cardFooter}>
            <span className={styles.requirement}>
              {context?.guidelinesAccepted
                ? "Current version acknowledged."
                : context?.guidelinesPublished === false
                  ? "A draft is available for review; applications stay closed until a version is published."
                  : "Read and acknowledge the published version before applying."}
            </span>
            <a className={styles.action} href="/staff-guidelines">
              Read Guidelines<span aria-hidden="true">→</span>
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}

export default function CommunityAreaPage() {
  return (
    <PortalShell access="community">
      {() => <CommunityAreaContent />}
    </PortalShell>
  );
}
