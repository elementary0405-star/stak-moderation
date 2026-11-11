"use client";

import PortalShell from "@/components/PortalShell";
import styles from "./staff-training.module.css";

const ROLE_PATHS = [
  ["TRIAL MODERATOR", "General Support, supervised handling, escalation and clear limits during the qualification phase."],
  ["MODERATOR", "Player Reports, Unban Requests, evidence review, permitted actions and case documentation."],
  ["STAFF MANAGER", "Team coordination, internal questions, absence workflows, staff-report routing and quality oversight."],
  ["MANAGEMENT", "Management Contact, serious incidents, policy/permission decisions and independent review."],
  ["CO-OWNER / OWNER", "Optional confidential governance and leadership material when the assigned responsibilities require it."],
] as const;

const MODULES = [
  ["01", "STAK foundations", "Community scope, team structure, role boundaries and escalation routes."],
  ["02", "Rules and moderation evidence", "Apply community rules to reports, review context and preserve reliable evidence."],
  ["03", "Ticket handling", "Take ownership, classify requests, investigate within scope and hand over clearly."],
  ["04", "Internal systems and OPSEC", "Use staff systems safely and protect accounts, access and confidential information."],
  ["05", "Role-specific learning path", "Complete the procedures and permissions relevant to the assigned STAK role."],
  ["06", "Assessment and practical sign-off", "Complete knowledge checks, practical cases and trainer approval before full release."],
] as const;

export default function StaffTrainingClient({ courseUrl }: { courseUrl: string }) {
  return (
    <PortalShell access="trailModerator">
      {() => (
        <section className={styles.section}>
          <span className={styles.eyebrow}>STAFF DEVELOPMENT</span>
          <h1>Staff Training<span>.</span></h1>
          <p className={styles.description}>The STAK Staff Qualification is delivered in Moodle through Gnomio. This portal provides the entry point and the qualification overview; Moodle remains the source of truth for course completion and grades.</p>

          <div className={styles.panel}>
            <span className={styles.status}>STAK ACADEMY · MOODLE / GNOMIO</span>
            <h2>Continue your qualification</h2>
            <p>Open the assigned course with your Moodle account. Your course progress, quiz results and activity completion are managed inside Moodle. This website does not claim a completion status unless a verified Moodle integration is configured.</p>
            {courseUrl ? <a className={styles.courseButton} href={courseUrl} target="_blank" rel="noopener noreferrer">Open STAK Academy <span>↗</span></a> : <span className={styles.pending}>Course URL not configured yet · Set MOODLE_COURSE_URL in the Cloudflare Worker variables.</span>}
          </div>

          <div className={styles.moduleHeading}><span>QUALIFICATION STRUCTURE</span><h2>Your learning path</h2><p>All staff members complete the common core. Role-specific content and practical sign-off depend on the responsibilities assigned by STAK.</p></div>
          <div className={styles.moduleGrid}>
            {MODULES.map(([number, title, description]) => <article className={styles.moduleCard} key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
          </div>
          <div className={styles.roleHeading}><span>ROLE-SPECIFIC LEARNING PATHS</span><h2>Only the content relevant to the assigned role</h2><p>The shared core comes first. Management confirms the target role and its additional path. Exact task permissions must always be checked against the current STAK permission matrix.</p></div>
          <div className={styles.roleGrid}>{ROLE_PATHS.map(([role, description]) => <article className={styles.roleCard} key={role}><span>{role}</span><p>{description}</p></article>)}</div>
          <div className={styles.notice}><strong>Course completion is not automatic role approval.</strong><p>A qualification is complete only after the required learning path, assessments and practical evidence have been reviewed and the responsible trainer or management member has confirmed readiness.</p></div>
        </section>
      )}
    </PortalShell>
  );
}
