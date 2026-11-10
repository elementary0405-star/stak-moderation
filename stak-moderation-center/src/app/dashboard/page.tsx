"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard.module.css";

type StakRole =
  | "owner"
  | "co-owner"
  | "management"
  | "staff-manager"
  | "moderator"
  | "trail-moderator"
  | "trial-moderator"
  | "community-member";

type PortalUser = {
  discordUserId: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  stakRole: StakRole;
};

type PortalCard = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  access: "staff" | "staffManager" | "all";
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  "co-owner": "Co-Owner",
  management: "Management",
  "staff-manager": "Staff Manager",
  moderator: "Moderator",
  "trail-moderator": "Trial Moderator",
  "trial-moderator": "Trial Moderator",
  "community-member": "Community Member",
};

const STAFF_ROLES: StakRole[] = [
  "owner",
  "co-owner",
  "management",
  "staff-manager",
  "moderator",
  "trail-moderator",
  "trial-moderator",
];

const MANAGEMENT_ROLES: StakRole[] = [
  "owner",
  "co-owner",
  "management",
  "staff-manager",
];

const PORTAL_CARDS: PortalCard[] = [
  {
    number: "01",
    eyebrow: "STAFF WORKSPACE",
    title: "Team Hub",
    description:
      "Access your staff record, manage absences, submit feedback and use internal management tools.",
    href: "/team-hub",
    access: "staff",
  },
  {
    number: "02",
    eyebrow: "MODERATION DATABASE",
    title: "Cases & Records",
    description:
      "Search player records, review moderation cases and manage sanctions.",
    href: "/cases-records",
    access: "staff",
  },
  {
    number: "03",
    eyebrow: "INTERNAL DOCUMENTATION",
    title: "Staff Resources",
    description:
      "Find important staff documentation, guidelines and internal reference materials.",
    href: "/staff-resources",
    access: "staff",
  },
  {
    number: "04",
    eyebrow: "COMMUNITY INFORMATION",
    title: "Community Guidelines",
    description:
      "Review the rules and standards that apply throughout the STAK community.",
    href: "/community-guidelines",
    access: "all",
  },
  {
    number: "05",
    eyebrow: "COMMUNITY OPPORTUNITIES",
    title: "Apply",
    description:
      "Find information about joining the STAK team and future recruitment opportunities.",
    href: "/apply",
    access: "all",
  },
];

function getUserFromResponse(data: unknown): PortalUser | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const response = data as Record<string, unknown>;
  const candidate =
    (response.user as Record<string, unknown> | undefined) ??
    (response.session as Record<string, unknown> | undefined) ??
    response;

  if (
    typeof candidate.discordUserId !== "string" ||
    typeof candidate.username !== "string" ||
    typeof candidate.stakRole !== "string"
  ) {
    return null;
  }

  return {
    discordUserId: candidate.discordUserId,
    username: candidate.username,
    globalName:
      typeof candidate.globalName === "string"
        ? candidate.globalName
        : null,
    avatar:
      typeof candidate.avatar === "string"
        ? candidate.avatar
        : null,
    stakRole: candidate.stakRole as StakRole,
  };
}

function canAccessCard(
  card: PortalCard,
  role: StakRole,
): boolean {
  if (card.access === "all") {
    return true;
  }

  if (card.access === "staff") {
    return STAFF_ROLES.includes(role);
  }

  if (card.access === "staffManager") {
    return MANAGEMENT_ROLES.includes(role);
  }

  return false;
}

export default function DashboardPage() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load your account.");
      }

      const data: unknown = await response.json();
      const account = getUserFromResponse(data);

      if (!account) {
        throw new Error("The account information is incomplete.");
      }

      setUser(account);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sign out failed.");
      }

      window.location.replace("/");
    } catch {
      setSigningOut(false);
      setError("Unable to sign out. Please try again.");
    }
  }

  const role = user?.stakRole ?? "community-member";
  const isStaff = STAFF_ROLES.includes(role);

  const displayName =
    user?.globalName || user?.username || "STAK Member";

  const roleLabel =
    ROLE_LABELS[role] || "Community Member";

  const avatarExtension = user?.avatar?.startsWith("a_")
    ? "gif"
    : "png";

  const avatarUrl =
    user?.avatar && user.discordUserId
      ? `https://cdn.discordapp.com/avatars/${user.discordUserId}/${user.avatar}.${avatarExtension}?size=128`
      : null;

  const visibleCards = user
    ? PORTAL_CARDS.filter((card) =>
        canAccessCard(card, role),
      )
    : [];

  if (loading) {
    return (
      <main className={styles.loadingPage}>
        <div className={styles.loader} />
        <p>Loading your workspace...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.loadingPage}>
        <div className={styles.errorPanel}>
          <span className={styles.errorIcon}>!</span>
          <h1>Unable to load your account</h1>
          <p>{error || "Please sign in again."}</p>
          <button
            type="button"
            onClick={() => window.location.replace("/")}
          >
            Return to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <span className={styles.brandText}>
            <strong>STAK</strong>
            <small>MODERATION CENTER</small>
          </span>
        </a>

        <nav className={styles.headerNav}>
          <a href="/dashboard" className={styles.activeNav}>
            Overview
          </a>

          {isStaff && <a href="/team-hub">Team Hub</a>}
          {isStaff && <a href="/cases-records">Cases & Records</a>}

          <a href="/community-guidelines">
            Guidelines
          </a>
        </nav>

        <button
          type="button"
          className={styles.signOutButton}
          onClick={() => setSignOutOpen(true)}
        >
          Sign Out
        </button>
      </header>

      <div className={styles.content}>
        <section className={styles.welcome}>
          <div className={styles.welcomeContent}>
            <span className={styles.eyebrow}>
              STAK MEMBER PORTAL
            </span>

            <h1>
              Welcome back,
              <br />
              <span>{displayName}</span>
            </h1>

            <p>
              Your central workspace for STAK community
              information and available portal functions.
            </p>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Discord avatar" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>

            <div className={styles.profileDetails}>
              <strong>{displayName}</strong>
              <span>@{user.username}</span>
              <div className={styles.roleBadge}>
                <span />
                {roleLabel}
              </div>
            </div>

            <span className={styles.profileStatus}>
              CONNECTED
            </span>
          </div>
        </section>

        {error && (
          <div className={styles.errorNotice}>
            {error}
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>
                YOUR WORKSPACE
              </span>
              <h2>Available Sections</h2>
              <p>
                Select a section to access its available functions.
              </p>
            </div>

            <span className={styles.sectionCount}>
              {String(visibleCards.length).padStart(2, "0")} MODULES
            </span>
          </div>

          <div className={styles.moduleGrid}>
            {visibleCards.map((card) => (
              <a
                href={card.href}
                className={styles.moduleCard}
                key={card.number}
              >
                <div className={styles.moduleTop}>
                  <span className={styles.moduleNumber}>
                    {card.number}
                  </span>
                  <span className={styles.moduleArrow}>↗</span>
                </div>

                <span className={styles.moduleEyebrow}>
                  {card.eyebrow}
                </span>

                <h3>{card.title}</h3>

                <p>{card.description}</p>

                <span className={styles.moduleLink}>
                  Open section <span>→</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.informationGrid}>
          <div className={styles.informationCard}>
            <span className={styles.eyebrow}>
              ACCOUNT INFORMATION
            </span>

            <h3>Your STAK Account</h3>

            <div className={styles.informationRow}>
              <span>Discord Username</span>
              <strong>{user.username}</strong>
            </div>

            <div className={styles.informationRow}>
              <span>Discord ID</span>
              <strong className={styles.discordId}>
                {user.discordUserId}
              </strong>
            </div>

            <div className={styles.informationRow}>
              <span>Current Role</span>
              <strong>{roleLabel}</strong>
            </div>

            <div className={styles.informationRow}>
              <span>Authentication</span>
              <strong className={styles.connected}>
                Discord Connected
              </strong>
            </div>
          </div>

          <div className={styles.informationCard}>
            <span className={styles.eyebrow}>
              IMPORTANT INFORMATION
            </span>

            <h3>Using the Portal</h3>

            <p className={styles.infoDescription}>
              Portal access is based on your current STAK
              Discord role. Available functions may change
              when your role changes.
            </p>

            <div className={styles.notice}>
              <span className={styles.noticeIcon}>i</span>
              <p>
                Keep your Discord account secure. Never share
                your login session or authentication details.
              </p>
            </div>

            <a
              href="/community-guidelines"
              className={styles.textLink}
            >
              View Community Guidelines →
            </a>
          </div>
        </section>

        <footer className={styles.footer}>
          <a href="/" className={styles.footerBrand}>
            STAK <span>MODERATION CENTER</span>
          </a>

          <div className={styles.footerLinks}>
            <a href="/community-guidelines">
              Guidelines
            </a>
            <a href="https://discord.gg/SptuYQ6FP6">
              Discord
            </a>
          </div>

          <span className={styles.footerCopyright}>
            © {new Date().getFullYear()} STAK. All rights reserved.
          </span>
        </footer>
      </div>

      {signOutOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSignOutOpen(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
          >
            <div className={styles.modalIcon}>↗</div>

            <span className={styles.eyebrow}>
              ACCOUNT SESSION
            </span>

            <h2 id="signout-title">Sign out?</h2>

            <p>
              Are you sure you want to sign out of the
              STAK Moderation Center?
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={signingOut}
                onClick={() => setSignOutOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.confirmButton}
                disabled={signingOut}
                onClick={handleSignOut}
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}