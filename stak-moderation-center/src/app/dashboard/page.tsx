"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

type StakRole =
  | "owner"
  | "co-owner"
  | "management"
  | "staff-manager"
  | "moderator"
  | "trail-moderator"
  | "community-member";

type DiscordUser = {
  discordUserId?: string;
  username?: string;
  globalName?: string | null;
  stakRole?: StakRole;
  avatar?: string | null;
};

type AuthResponse = {
  authenticated?: boolean;
  user?: DiscordUser | null;
};

const ROLE_LABELS: Record<StakRole, string> = {
  owner: "OWNER",
  "co-owner": "CO-OWNER",
  management: "MANAGEMENT",
  "staff-manager": "STAFF MANAGER",
  moderator: "MODERATOR",
  "trail-moderator": "TRAIL-MODERATOR",
  "community-member": "COMMUNITY MEMBER",
};

const STAFF_CARDS = [
  {
    number: "01",
    title: "Staff Center",
    description:
      "Access internal staff information, team resources and important staff tools.",
  },
  {
    number: "02",
    title: "Moderation Center",
    description:
      "Access moderation systems, cases and player records.",
  },
  {
    number: "03",
    title: "Staff Handbook",
    description:
      "Read the staff handbook, responsibilities and internal guidelines.",
  },
  {
    number: "04",
    title: "Staff Training",
    description:
      "Access staff training materials and qualification content.",
  },
];

const COMMUNITY_CARDS = [
  {
    number: "01",
    title: "Apply",
    description:
      "Learn about available team positions and submit an application.",
  },
  {
    number: "02",
    title: "Community Guidelines",
    description:
      "Read the rules and guidelines that apply to the STAK community.",
  },
];

const STAFF_ROLES: StakRole[] = [
  "owner",
  "co-owner",
  "management",
  "staff-manager",
  "moderator",
  "trail-moderator",
];

export default function DashboardPage() {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!response.ok) {
          window.location.href = "/";
          return;
        }

        const data: AuthResponse = await response.json();

        if (!data.user) {
          window.location.href = "/";
          return;
        }

        setUser(data.user);
      } catch (error) {
        console.error("Failed to load user:", error);
        window.location.href = "/";
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/";
    }
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        Loading STAK Portal...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const role = user.stakRole;
  const isStaff = role ? STAFF_ROLES.includes(role) : false;
  const isCommunityMember = role === "community-member";
  const hasValidRole = isStaff || isCommunityMember;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.logo}>
          <img src="/stak-logo.png" alt="STAK" />
        </a>

        <div className={styles.role}>
          {role && ROLE_LABELS[role]
            ? ROLE_LABELS[role]
            : "ROLE NOT SYNCHRONIZED"}
        </div>

        <button
          className={styles.logout}
          onClick={logout}
        >
          Sign Out
        </button>
      </header>

      <section className={styles.welcome}>
        <span className={styles.label}>STAK PORTAL</span>

        <h1>
          Welcome back<span>.</span>
        </h1>

        <p>
          {user.globalName || user.username || "STAK Member"}
        </p>
      </section>

      <section className={styles.overview}>
        <h2>Overview</h2>

        {!hasValidRole && (
          <p>
            Your STAK role could not be verified. Please make sure
            you have an active role in the STAK Discord server.
          </p>
        )}

        {isStaff && (
          <div className={styles.grid}>
            {STAFF_CARDS.map((card) => (
              <article
                key={card.number}
                className={styles.card}
              >
                <span>{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        )}

        {isCommunityMember && (
          <div className={styles.grid}>
            {COMMUNITY_CARDS.map((card) => (
              <article
                key={card.number}
                className={styles.card}
              >
                <span>{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}