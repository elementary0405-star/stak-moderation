"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DiscordSessionUser } from "@/lib/auth";
import {
  hasPortalAccess,
  isStaffRole,
  ROLE_LABELS,
  type PortalAccess,
} from "@/lib/portal-access";
import styles from "./PortalShell.module.css";

export type PortalUser = DiscordSessionUser;

type PortalShellProps = {
  children: (user: PortalUser) => ReactNode;
  access?: PortalAccess;
};

type AuthResponse = {
  authenticated?: boolean;
  user?: PortalUser | null;
  message?: string;
};

export default function PortalShell({
  children,
  access = "any",
}: PortalShellProps) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.replace("/");
          return;
        }

        const data = (await response.json()) as AuthResponse;

        if (!response.ok) {
          throw new Error(
            data.message || "Your Discord role could not be verified."
          );
        }

        if (!data.authenticated || !data.user) {
          window.location.replace("/");
          return;
        }

        if (active) setUser(data.user);
      } catch (error) {
        console.error("Failed to load portal user:", error);
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The portal could not verify your account."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  async function confirmSignOut() {
    setSigningOut(true);
    setSignOutError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sign out failed. Please try again.");
      }

      window.location.replace("/");
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Sign out failed."
      );
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.fullState}>
        <div className={styles.stateCard}>Verifying STAK account...</div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={styles.fullState}>
        <div className={styles.stateCard}>
          <span className={styles.eyebrow}>STAK PORTAL</span>
          <h1>Verification unavailable</h1>
          <p>{loadError}</p>
          <button
            className={styles.primaryButton}
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
          <a className={styles.backLink} href="/">Return to Home</a>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const allowed = hasPortalAccess(user.stakRole, access);
  const staff = isStaffRole(user.stakRole);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.logo} aria-label="STAK Portal home">
          <img src="/stak-logo.png" alt="STAK" />
        </a>

        <div className={styles.headerRight}>
          <span className={styles.roleBadge}>
            {ROLE_LABELS[user.stakRole] ?? "UNVERIFIED ROLE"}
          </span>
          <button
            className={styles.signOutButton}
            onClick={() => {
              setSignOutError(null);
              setShowSignOut(true);
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <nav className={styles.navigation} aria-label="Portal navigation">
        <a href="/dashboard">Overview</a>
        {staff ? (
          <>
            <a href="/team-hub">Team Hub</a>
            <a href="/cases-records">Cases &amp; Records</a>
            <a href="/staff-resources">Staff Resources</a>
            {hasPortalAccess(user.stakRole, "staffManager") && <a href="/team-hub/applications">Applications</a>}
            {hasPortalAccess(user.stakRole, "trailModerator") && (
              <a href="/staff-training">Staff Training</a>
            )}
          </>
        ) : (
          <>
            <a href="/apply">Apply</a>
            <a href="/community-guidelines">Community Guidelines</a>
          </>
        )}
      </nav>

      <div className={styles.content}>
        {!allowed ? (
          <section className={styles.restricted}>
            <span className={styles.eyebrow}>ACCESS RESTRICTED</span>
            <h1>You do not have access to this area.</h1>
            <p>Your current STAK role does not have permission to open this page.</p>
            <a className={styles.primaryLink} href="/dashboard">Return to Overview</a>
          </section>
        ) : (
          children(user)
        )}
      </div>

      {showSignOut && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !signingOut) {
              setShowSignOut(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
          >
            <span className={styles.eyebrow}>STAK PORTAL</span>
            <h2 id="signout-title">Are you sure you want to sign out?</h2>
            <p>You will need to connect your Discord account again to access the portal.</p>
            {signOutError && <p className={styles.modalError}>{signOutError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowSignOut(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                className={styles.confirmButton}
                onClick={confirmSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing Out..." : "Yes, Sign Out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
