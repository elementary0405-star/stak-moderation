"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

type PortalUser = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  stakRole: string;
};

type AuthState = "loading" | "authenticated" | "guest";

const ROLE_NAMES: Record<string, string> = {
  owner: "Owner",
  "co-owner": "Co-Owner",
  management: "Management",
  "staff-manager": "Staff Manager",
  moderator: "Moderator",
  "trail-moderator": "Trial Moderator",
  "trial-moderator": "Trial Moderator",
  "community-member": "Community Member",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePortalUser(data: unknown): PortalUser | null {
  if (!isRecord(data)) return null;

  let candidate = data;

  if (isRecord(data.user)) {
    candidate = data.user;
  } else if (isRecord(data.session)) {
    candidate = data.session;
  }

  if (typeof candidate.discordUserId !== "string") {
    return null;
  }

  return {
    discordUserId: candidate.discordUserId,
    username:
      typeof candidate.username === "string"
        ? candidate.username
        : "STAK Member",
    globalName:
      typeof candidate.globalName === "string"
        ? candidate.globalName
        : null,
    avatar:
      typeof candidate.avatar === "string"
        ? candidate.avatar
        : null,
    stakRole:
      typeof candidate.stakRole === "string"
        ? candidate.stakRole
        : "community-member",
  };
}

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!active) return;

        if (!response.ok) {
          setUser(null);
          setAuthState("guest");
          return;
        }

        const data: unknown = await response.json();
        const authenticatedUser = parsePortalUser(data);

        if (!authenticatedUser) {
          setUser(null);
          setAuthState("guest");
          return;
        }

        setUser(authenticatedUser);
        setAuthState("authenticated");
      } catch {
        if (active) {
          setUser(null);
          setAuthState("guest");
        }
      }
    }

    void checkAuthentication();

    return () => {
      active = false;
    };
  }, []);

  const displayName =
    user?.globalName || user?.username || "STAK Member";

  const role = user?.stakRole
    ? ROLE_NAMES[user.stakRole] || user.stakRole
    : "Community Member";

  const avatarExtension = user?.avatar?.startsWith("a_")
    ? "gif"
    : "png";

  const avatarUrl =
    user?.avatar && user.discordUserId
      ? `https://cdn.discordapp.com/avatars/${user.discordUserId}/${user.avatar}.${avatarExtension}?size=128`
      : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="STAK Home">
          <span className={styles.brandMark}>S</span>

          <span className={styles.brandText}>
            <strong>STAK</strong>
            <small>MODERATION CENTER</small>
          </span>
        </a>

        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="/community-guidelines">Community Guidelines</a>
          <a href="/apply">Apply</a>

          {authState === "authenticated" ? (
            <a href="/dashboard" className={styles.navButton}>
              Open Portal
            </a>
          ) : (
            <a href="/api/auth/discord" className={styles.navButton}>
              Sign In
            </a>
          )}
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} />
            STAK INTERNAL PLATFORM
          </div>

          <p className={styles.heroEyebrow}>
            COMMUNITY MANAGEMENT & MODERATION
          </p>

          <h1>
            One platform.
            <br />
            <span>Clear responsibilities.</span>
          </h1>

          <p className={styles.heroDescription}>
            The central platform for STAK staff management,
            moderation records and community information.
            Everything organized in one place.
          </p>

          <div className={styles.heroActions}>
            {authState === "authenticated" ? (
              <a href="/dashboard" className={styles.primaryButton}>
                Open Dashboard <span aria-hidden="true">→</span>
              </a>
            ) : (
              <a
                href="/api/auth/discord"
                className={styles.primaryButton}
              >
                Continue with Discord <span aria-hidden="true">→</span>
              </a>
            )}

            <a href="#about" className={styles.secondaryButton}>
              Explore the Platform
            </a>
          </div>

          <div className={styles.heroFooter}>
            <span>Secure Discord Authentication</span>
            <span className={styles.separator}>/</span>
            <span>Role-Based Access</span>
            <span className={styles.separator}>/</span>
            <span>Centralized Management</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.visualGlow} />

          <div className={styles.visualCard}>
            <div className={styles.visualHeader}>
              <div>
                <span className={styles.visualLabel}>STAK SYSTEM</span>
                <strong>Management Center</strong>
              </div>

              <span className={styles.visualIndicator} />
            </div>

            <div className={styles.visualDivider} />

            <div className={styles.visualRow}>
              <span className={styles.visualIcon}>01</span>
              <div>
                <strong>Team Hub</strong>
                <small>Staff & management</small>
              </div>
              <span className={styles.visualArrow}>→</span>
            </div>

            <div className={styles.visualRow}>
              <span className={styles.visualIcon}>02</span>
              <div>
                <strong>Cases & Records</strong>
                <small>Moderation database</small>
              </div>
              <span className={styles.visualArrow}>→</span>
            </div>

            <div className={styles.visualRow}>
              <span className={styles.visualIcon}>03</span>
              <div>
                <strong>Staff Resources</strong>
                <small>Internal documentation</small>
              </div>
              <span className={styles.visualArrow}>→</span>
            </div>

            <div className={styles.visualBottom}>
              <span className={styles.visualBottomDot} />
              SYSTEM OVERVIEW
              <span>STAK</span>
            </div>
          </div>
        </div>
      </section>

      {authState === "authenticated" && user && (
        <section className={styles.accountBar}>
          <div className={styles.accountInfo}>
            <div className={styles.avatar}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <strong>Welcome back, {displayName}</strong>
              <span>{role}</span>
            </div>
          </div>

          <a href="/dashboard" className={styles.accountLink}>
            Go to your portal →
          </a>
        </section>
      )}

      <section className={styles.features} id="about">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionEyebrow}>
            PLATFORM OVERVIEW
          </span>

          <h2>
            Everything you need.
            <br />
            <span>Nothing you don't.</span>
          </h2>

          <p>
            The STAK Moderation Center brings essential internal
            functions together in a structured and accessible
            environment.
          </p>
        </div>

        <div className={styles.featureGrid}>
          <a href="/team-hub" className={styles.featureCard}>
            <span className={styles.featureNumber}>01</span>
            <h3>Team Hub</h3>
            <p>
              Personal staff workspace, absence management,
              feedback and internal management tools.
            </p>
            <span className={styles.featureLink}>
              Explore section →
            </span>
          </a>

          <a href="/cases-records" className={styles.featureCard}>
            <span className={styles.featureNumber}>02</span>
            <h3>Cases & Records</h3>
            <p>
              Centralized player profiles, moderation cases,
              sanctions and supporting evidence.
            </p>
            <span className={styles.featureLink}>
              Explore section →
            </span>
          </a>

          <a href="/staff-resources" className={styles.featureCard}>
            <span className={styles.featureNumber}>03</span>
            <h3>Staff Resources</h3>
            <p>
              Access important internal documents, procedures
              and staff reference materials.
            </p>
            <span className={styles.featureLink}>
              Explore section →
            </span>
          </a>

          <a
            href="/community-guidelines"
            className={styles.featureCard}
          >
            <span className={styles.featureNumber}>04</span>
            <h3>Community Guidelines</h3>
            <p>
              Find the standards and rules that apply to
              the STAK community.
            </p>
            <span className={styles.featureLink}>
              Explore section →
            </span>
          </a>
        </div>
      </section>

      <section className={styles.accessSection}>
        <div>
          <span className={styles.sectionEyebrow}>PORTAL ACCESS</span>
          <h2>Part of the STAK team?</h2>
          <p>
            Sign in using your Discord account to access the
            functions available to your current STAK role.
          </p>
        </div>

        {authState === "authenticated" ? (
          <a href="/dashboard" className={styles.primaryButton}>
            Open Portal →
          </a>
        ) : (
          <a
            href="/api/auth/discord"
            className={styles.primaryButton}
          >
            Sign In with Discord →
          </a>
        )}
      </section>

      <footer className={styles.footer}>
        <a href="/" className={styles.footerBrand}>
          STAK <span>MODERATION CENTER</span>
        </a>

        <p>Internal platform for the STAK community.</p>

        <div className={styles.footerLinks}>
          <a href="/community-guidelines">Guidelines</a>
          <a href="/apply">Apply</a>
          <a
            href="https://discord.gg/SptuYQ6FP6"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </a>
        </div>

        <span className={styles.copyright}>
          © {new Date().getFullYear()} STAK. All rights reserved.
        </span>
      </footer>
    </main>
  );
}