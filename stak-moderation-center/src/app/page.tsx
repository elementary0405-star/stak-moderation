"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

export default function HomePage() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (response.ok) {
          setConnected(true);
        }
      } catch {
        setConnected(false);
      } finally {
        setChecking(false);
      }
    }

    checkAccount();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          <img src="/stak-logo.png" alt="STAK Logo" />
        </a>

        <nav className={styles.navigation}>
          <a href="/">Home</a>
          {connected && <a href="/about">About</a>}
          {connected && <a href="/community">Community</a>}
          {connected && <a href="/dashboard">Portal</a>}
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.backgroundLetter}>S</div>

        <div className={styles.content}>
          <span className={styles.label}>
            THE OFFICIAL STAK PLATFORM
          </span>

          <h1>
            Welcome to
            <br />
            <span>STAK</span>
          </h1>

          <p>
            Connect your Discord account to access the official
            STAK platform.
          </p>

          {!checking && (
            <a
              href={
                connected
                  ? "/dashboard"
                  : "/api/auth/discord"
              }
              className={styles.connectButton}
            >
              {connected ? "Open Portal" : "Connect with Discord"}
              <span>→</span>
            </a>
          )}

          <div className={styles.security}>
            Secure Discord Authentication
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>STAK OFFICIAL PLATFORM</span>
        <span>© {new Date().getFullYear()} STAK</span>
      </footer>
    </main>
  );
}