import Link from "next/link";
import styles from "./access.module.css";

export default function AccessPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src="/stak-logo.png" alt="STAK" />
        <span className={styles.eyebrow}>STAK MODERATION</span>
        <h1>Your access role is not assigned yet.</h1>
        <p>
          Discord confirms that you are a member of the STAK server, but no recognized Community or Staff role is assigned to your account.
          Please contact the STAK team in Discord to have your access checked.
        </p>
        <Link href="/">Return to STAK Moderation</Link>
      </section>
    </main>
  );
}
