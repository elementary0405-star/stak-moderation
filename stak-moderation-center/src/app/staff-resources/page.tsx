"use client";

import PortalShell from "@/components/PortalShell";
import styles from "./staff-resources.module.css";

export default function StaffResourcesPage() {
  return (
    <PortalShell access="staff">
      {() => (
        <>
          <section className={styles.heading}>
            <span className={styles.eyebrow}>STAFF KNOWLEDGE BASE</span>
            <h1>Staff Resources<span>.</span></h1>
            <p>Important staff information and procedures, collected in one central place.</p>
          </section>

          <div className={styles.grid}>
            <article className={styles.card}>
              <span className={styles.number}>01</span>
              <h2>Staff Handbook</h2>
              <p>The central source for staff rules, procedures and information about moderation, support and internal team processes.</p>
              <a href="https://docs.google.com/document/d/1gZ3mwuOSPnRycoAXPlH6IqO7Fc8hgz86ExiObKsA-Wo/edit?usp=sharing" target="_blank" rel="noopener noreferrer">Open Staff Handbook ↗</a>
            </article>

            <article className={styles.card}>
              <span className={styles.number}>02</span>
              <h2>Ticket Guide</h2>
              <p>Instructions for handling support tickets consistently, from claiming a ticket through to closing it.</p>
              <a href="https://docs.google.com/document/d/1taSuo43oBpdw5BBXk2smRXgfn6bnoyXWZja60WMM6RU/edit?tab=t.6d96qdfuxe07" target="_blank" rel="noopener noreferrer">Open Ticket Guide ↗</a>
            </article>
          </div>

          <p className={styles.note}>These documents currently remain hosted in Google Docs. They can be moved into the portal after their contents have been reviewed.</p>
        </>
      )}
    </PortalShell>
  );
}
