"use client";

import PortalShell from "@/components/PortalShell";
import type { PortalAccess } from "@/lib/portal-access";
import styles from "./PortalFeaturePage.module.css";

type PortalFeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  access: PortalAccess;
  statusNote?: string;
  backHref?: string;
  backLabel?: string;
};

export default function PortalFeaturePage({
  eyebrow,
  title,
  description,
  access,
  statusNote = "This section is prepared in the portal structure. Its database workflows and Discord bot connection will be implemented in the next development stage.",
  backHref = "/team-hub",
  backLabel = "Back to Team Hub",
}: PortalFeaturePageProps) {
  return (
    <PortalShell access={access}>
      {() => (
        <section className={styles.pageSection}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}<span>.</span></h1>
          <p className={styles.description}>{description}</p>

          <div className={styles.notice}>
            <span className={styles.noticeLabel}>MODULE STATUS</span>
            <h2>Structure created</h2>
            <p>{statusNote}</p>
            <p className={styles.note}>No records are created, edited or deleted from this placeholder page.</p>
          </div>

          <a href={backHref} className={styles.backLink}>← {backLabel}</a>
        </section>
      )}
    </PortalShell>
  );
}
