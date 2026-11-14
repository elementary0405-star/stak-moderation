"use client";

import PortalShell from "@/components/PortalShell";
import type { DiscordSessionUser } from "@/lib/auth";
import { hasPortalAccess } from "@/lib/portal-access";
import styles from "./team-hub.module.css";

type AccessLevel = "staff" | "staffManager" | "owner";

type HubCard = {
  number: string;
  category: string;
  title: string;
  description: string;
  href: string;
  access: AccessLevel;
  badge?: string;
};

const PERSONAL_CARDS: HubCard[] = [
  {
    number: "01",
    category: "PERSONAL PROFILE",
    title: "My Staff Record",
    description:
      "View your personal staff information, current rank and relevant staff history.",
    href: "/team-hub/my-record",
    access: "staff",
  },
  {
    number: "02",
    category: "AVAILABILITY",
    title: "Absence Management",
    description:
      "Submit absence notifications, communicate your availability and review previous absences.",
    href: "/team-hub/absence",
    access: "staff",
  },
  {
    number: "03",
    category: "COMMUNICATION",
    title: "Staff Announcements",
    description:
      "Read team updates and acknowledge important notices when requested.",
    href: "/team-hub/announcements",
    access: "staff",
  },
  {
    number: "04",
    category: "COMMUNICATION",
    title: "Feedback Box",
    description:
      "Send confidential feedback, suggestions or concerns directly to the Owner.",
    href: "/team-hub/feedback",
    access: "staff",
  },
];

const MANAGEMENT_CARDS: HubCard[] = [
  {
    number: "05",
    category: "STAFF OVERVIEW",
    title: "Staff Directory",
    description:
      "Browse the STAK staff team, search members and access individual staff records.",
    href: "/team-hub/staff-directory",
    access: "staffManager",
  },
  {
    number: "06",
    category: "STAFF ADMINISTRATION",
    title: "Warnings & History",
    description:
      "Review staff warnings, document relevant incidents and maintain disciplinary history.",
    href: "/team-hub/warnings",
    access: "staffManager",
  },
  {
    number: "07",
    category: "RECRUITMENT",
    title: "Staff Applications",
    description:
      "Review applicant submissions, maintain the form and publish versioned staff policies.",
    href: "/team-hub/applications",
    access: "staffManager",
  },
  {
    number: "08",
    category: "STAFF DEVELOPMENT",
    title: "Academy Reviews",
    description:
      "Assign course paths, review practical work, and approve completion with an auditable history.",
    href: "/team-hub/training-progress",
    access: "staffManager",
  },
];

const OWNER_CARDS: HubCard[] = [
  {
    number: "09",
    category: "OWNER TOOLS",
    title: "Feedback Inbox",
    description:
      "Review confidential feedback submissions, manage their status and maintain internal notes.",
    href: "/team-hub/feedback-inbox",
    access: "owner",
    badge: "OWNER ONLY",
  },
];

function FeatureCard({ card }: { card: HubCard }) {
  return (
    <a href={card.href} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardNumber}>{card.number}</span>

        {card.badge && (
          <span className={styles.cardBadge}>{card.badge}</span>
        )}

        <span className={styles.cardArrow}>↗</span>
      </div>

      <span className={styles.cardCategory}>{card.category}</span>

      <h3>{card.title}</h3>

      <p>{card.description}</p>

      <span className={styles.cardAction}>
        Open section <span>→</span>
      </span>
    </a>
  );
}

function CardGroup({
  title,
  description,
  cards,
  label,
}: {
  title: string;
  description: string;
  cards: HubCard[];
  label: string;
}) {
  if (cards.length === 0) return null;

  return (
    <section className={styles.group}>
      <div className={styles.groupHeader}>
        <div>
          <span className={styles.groupLabel}>{label}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <span className={styles.groupCount}>
          {String(cards.length).padStart(2, "0")} SECTIONS
        </span>
      </div>

      <div className={styles.grid}>
        {cards.map((card) => (
          <FeatureCard key={card.number} card={card} />
        ))}
      </div>
    </section>
  );
}

function TeamHubContent({ user }: { user: DiscordSessionUser }) {
  const personalCards = PERSONAL_CARDS.filter((card) =>
    hasPortalAccess(user.stakRole, card.access),
  );

  const managementCards = MANAGEMENT_CARDS.filter((card) =>
    hasPortalAccess(user.stakRole, card.access),
  );

  const ownerCards = OWNER_CARDS.filter((card) =>
    hasPortalAccess(user.stakRole, card.access),
  );

  const totalSections =
    personalCards.length +
    managementCards.length +
    ownerCards.length;

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingContent}>
          <span className={styles.eyebrow}>
            STAK INTERNAL PLATFORM
          </span>

          <h1>
            Team <span>Hub</span>
          </h1>

          <p>
            Your central workspace for staff information,
            internal communication and team administration.
          </p>
        </div>

        <div className={styles.headingStatus}>
          <span className={styles.statusDot} />
          STAFF WORKSPACE
        </div>
      </section>

      <section className={styles.overview}>
        <div>
          <span className={styles.overviewLabel}>
            WORKSPACE OVERVIEW
          </span>

          <h2>Your staff workspace</h2>

          <p>
            Access your personal staff functions and,
            depending on your permissions, additional
            management tools.
          </p>
        </div>

        <div className={styles.overviewStat}>
          <strong>{String(totalSections).padStart(2, "0")}</strong>
          <span>AVAILABLE SECTIONS</span>
        </div>
      </section>

      <CardGroup
        label="PERSONAL WORKSPACE"
        title="My Staff Area"
        description="Personal information and internal staff functions."
        cards={personalCards}
      />

      <CardGroup
        label="MANAGEMENT TOOLS"
        title="Staff Administration"
        description="Tools for maintaining and managing the STAK staff team."
        cards={managementCards}
      />

      <CardGroup
        label="OWNER ACCESS"
        title="Administrative Overview"
        description="Restricted functions for the Owner."
        cards={ownerCards}
      />

      <section className={styles.information}>
        <div className={styles.informationIcon}>i</div>

        <div>
          <strong>Access and confidentiality</strong>

          <p>
            Available sections depend on your current STAK
            Discord role. Personal staff information and
            confidential submissions are only accessible
            to authorized users.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>STAK MODERATION CENTER</span>
        <span>TEAM HUB</span>
      </footer>
    </main>
  );
}

export default function TeamHubPage() {
  return (
    <PortalShell access="staff">
      {(user) => <TeamHubContent user={user} />}
    </PortalShell>
  );
}
