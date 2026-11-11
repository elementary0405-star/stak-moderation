import type { ReactNode } from "react";
import styles from "./PublicWorkflowLayout.module.css";

export default function PublicWorkflowLayout({ children, active }: { children: ReactNode; active: "guidelines" | "apply" }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="STAK home">
          <img src="/stak-logo.png" alt="STAK" />
          <span><strong>STAK</strong><small>MODERATION CENTER</small></span>
        </a>
        <nav className={styles.nav} aria-label="Public navigation">
          <a href="/community-guidelines" aria-current={active === "guidelines" ? "page" : undefined} className={active === "guidelines" ? styles.active : ""}>Guidelines</a>
          <a href="/apply" aria-current={active === "apply" ? "page" : undefined} className={active === "apply" ? styles.active : ""}>Application</a>
          <a href="/api/auth/discord" className={styles.signIn}>Staff sign in</a>
        </nav>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>STAK · Moderation Center <span>Public recruitment portal</span></footer>
    </main>
  );
}
