"use client";

import PortalShell from "@/components/PortalShell";
import styles from "./staff-training.module.css";

export default function StaffTrainingPage() {
  return (
    <PortalShell access="trailModerator">
      {() => (
        <section className={styles.section}>
          <span className={styles.eyebrow}>STAFF DEVELOPMENT</span>
          <h1>Staff Training<span>.</span></h1>
          <p className={styles.description}>The Staff Qualification prepares team members for their responsibilities and the procedures used across STAK.</p>
          <div className={styles.panel}>
            <span className={styles.status}>TRAINING CONNECTION</span>
            <h2>STAK Academy</h2>
            <p>The training is managed in Moodle through Gnomio. The final course link can be connected here once the course structure has been reviewed and the destination URL is confirmed.</p>
            <span className={styles.pending}>Course link not configured yet</span>
          </div>
        </section>
      )}
    </PortalShell>
  );
}
