"use client";

import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import { hasPortalAccess } from "@/lib/portal-access";
import styles from "./staff-area.module.css";

type StaffCard = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  access: "staff" | "trailModerator";
};

const STAFF_CARDS: StaffCard[] = [
  {
    number: "01",
    eyebrow: "TEAM WORKSPACE",
    title: "Staff Hub",
    description: "Access your staff profile, team communication and role-based staff administration tools.",
    href: "/team-hub",
    access: "staff",
  },
  {
    number: "02",
    eyebrow: "MODERATION DATABASE",
    title: "Cases & Records",
    description: "Review moderation cases, player records and documented sanctions.",
    href: "/cases-records",
    access: "trailModerator",
  },
  {
    number: "03",
    eyebrow: "INTERNAL KNOWLEDGE",
    title: "Staff Resources",
    description: "Open the staff handbook and practical guides for internal procedures.",
    href: "/staff-resources",
    access: "staff",
  },
  {
    number: "04",
    eyebrow: "STAFF DEVELOPMENT",
    title: "Staff Academy",
    description: "Complete your assigned STAK Academy course and track review status.",
    href: "/staff-training",
    access: "staff",
  },
];

function StaffAreaContent({ user }: { user: DiscordSessionUser }) {
  const available = STAFF_CARDS.filter((card) => hasPortalAccess(user.stakRole, card.access));

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <span className={styles.eyebrow}>THE OFFICIAL STAK PLATFORM</span>
        <h1>Staff <span>Area</span></h1>
        <p>Your internal STAK workspace. Available sections are determined by your current Discord staff role.</p>
      </section>

      <section className={styles.accessBar}>
        <div>
          <span className={styles.accessLabel}>AUTHENTICATED STAK ACCOUNT</span>
          <strong>{user.globalName || user.username}</strong>
        </div>
        <span className={styles.roleBadge}>{user.stakRole.replaceAll("-", " ").toUpperCase()}</span>
      </section>

      <section className={styles.grid} aria-label="Staff areas">
        {available.map((card) => (
          <a
            className={styles.card}
            href={card.href}
            key={card.number}
            data-tour={card.href === "/team-hub" ? "staff-hub" : card.href === "/cases-records" ? "staff-records" : card.href === "/staff-resources" ? "staff-resources" : "staff-academy"}
            id={card.href === "/team-hub" ? "staff-area-hub-card" : card.href === "/cases-records" ? "staff-area-records-card" : card.href === "/staff-resources" ? "staff-area-resources-card" : "staff-area-academy-card"}
          >
            <div className={styles.cardTop}>
              <span className={styles.number}>{card.number}</span>
              <span className={styles.arrow} aria-hidden="true">↗</span>
            </div>
            <span className={styles.cardEyebrow}>{card.eyebrow}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <span className={styles.action}>Open section <span aria-hidden="true">→</span></span>
          </a>
        ))}
      </section>

      <section className={styles.notice}>
        <span className={styles.noticeIcon}>i</span>
        <p>Confidential staff information is available only to authorized roles. Your permissions are checked against the STAK Discord server.</p>
      </section>

      <footer className={styles.footer}>
        <span>STAK OFFICIAL PLATFORM</span>
        <span>STAFF AREA</span>
      </footer>
    </main>
  );
}

export default function StaffAreaPage() {
  return (
    <PortalShell access="staff">
      {(user) => <StaffAreaContent user={user} />}
    </PortalShell>
  );
}
