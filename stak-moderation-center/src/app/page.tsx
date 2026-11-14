"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

type AuthPayload = {
  authenticated?: boolean;
  user?: { stakRole?: string } | null;
  access?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: "Discord sign-in could not be completed. Please try again.",
  invalid_state: "The security check expired. Please connect again.",
  configuration_error:
    "Discord sign-in is not configured in this environment. Check the local OAuth settings listed in the setup guide.",
  redirect_uri_mismatch:
    "The Discord callback URL does not match this environment. Check DISCORD_REDIRECT_URI.",
  token_exchange_failed: "Discord could not verify the sign-in. Please try again.",
  user_lookup_failed: "Your Discord account could not be retrieved. Please try again.",
  member_lookup_failed: "STAK server membership could not be verified. Please try again shortly.",
  no_stak_role: "You are on the STAK server, but your STAK access role has not been assigned yet.",
  bots_not_allowed: "Bot accounts cannot access the STAK platform.",
  authentication_failed: "Discord authentication failed. Please try again.",
};

export default function HomePage() {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("discord_error");
    if (errorCode) {
      const detail = params.get("missing");
      const base = ERROR_MESSAGES[errorCode] || "Discord sign-in could not be completed. Please try again.";
      const message = errorCode === "configuration_error" && detail
        ? `${base} Missing: ${detail.split(",").join(", ")}.`
        : base;
      const errorTimer = window.setTimeout(() => setAuthError(message), 0);
      window.history.replaceState({}, "", window.location.pathname);
      return () => window.clearTimeout(errorTimer);
    }

    let active = true;

    async function redirectAuthenticatedUser() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!active) return;
        if (response.status === 403) {
          const payload = (await response.json()) as AuthPayload;
          if (payload.access === "missing_role") {
            window.location.replace("/access?reason=role");
          }
          return;
        }
        if (!response.ok) return;

        const payload = (await response.json()) as AuthPayload;
        if (!payload.authenticated || !payload.user?.stakRole) return;

        const destination = payload.user.stakRole === "community-member"
          ? "/community-area"
          : "/staff-area";
        window.location.replace(destination);
      } catch {
        // Keep the public sign-in page available if Discord cannot be checked.
      }
    }

    void redirectAuthenticatedUser();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.page}>
      <span className={styles.backgroundMark} aria-hidden="true">S</span>
      <section className={styles.content} aria-labelledby="home-title">
        <img className={styles.logo} src="/stak-logo.png" alt="STAK" />
        <h1 id="home-title">STAK Moderation</h1>
        <a className={styles.connectButton} href="/api/auth/discord">
          Connect with Discord
          <span aria-hidden="true">→</span>
        </a>
        {authError ? (
          <p className={styles.errorMessage} role="alert">{authError}</p>
        ) : (
          <p className={styles.securityNote}>
            Your STAK membership and access role are verified with Discord.
          </p>
        )}
      </section>
    </main>
  );
}
