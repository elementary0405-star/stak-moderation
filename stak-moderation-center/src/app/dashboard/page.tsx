"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

type DiscordUser = {
  username?: string;
  globalName?: string;
  discordRole?: string;
  avatar?: string;
};

type AuthResponse = {
  user?: DiscordUser;
  username?: string;
  globalName?: string;
  discordRole?: string;
  avatar?: string;
};

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

        setUser(data.user ?? data);
      } catch (error) {
        console.error("Failed to load user:", error);
        window.location.href = "/";
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.logo}>
          <img src="/stak-logo.png" alt="STAK" />
        </a>

        <div className={styles.role}>
          {user.discordRole || "ROLE NOT SYNCHRONIZED"}
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

        <div className={styles.grid}>
          <a href="/staff" className={styles.card}>
            <span>01</span>
            <h3>Staff Center</h3>
            <p>
              Access staff-related systems and information.
            </p>
          </a>

          <a href="/moderation" className={styles.card}>
            <span>02</span>
            <h3>Moderation Center</h3>
            <p>
              Access moderation tools and player records.
            </p>
          </a>

          <a href="/handbook" className={styles.card}>
            <span>03</span>
            <h3>Staff Handbook</h3>
            <p>
              Read important staff information and guidelines.
            </p>
          </a>

          <a href="/training" className={styles.card}>
            <span>04</span>
            <h3>Staff Training</h3>
            <p>
              Access training materials and qualifications.
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}