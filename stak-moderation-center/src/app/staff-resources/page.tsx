"use client";

import PortalShell from "@/components/PortalShell";
import styles from "./staff-resources.module.css";

const RESOURCES = [
  {
    number: "01",
    title: "Staff Handbook",
    description: "Responsibilities, professional conduct, moderation, internal systems, staff rights and confidentiality.",
    href: "/staff-resources/handbook",
    language: "GERMAN · INTERNAL STAFF STANDARD · 2026",
  },
  {
    number: "02",
    title: "Ticket Guide",
    description: "Support ownership, Player Reports, Unban Requests, forwarding and ticket closure.",
    href: "/staff-resources/ticket-guide",
    language: "GERMAN · INTERNAL SUPPORT STANDARD · 2026",
  },
];

export default function StaffResourcesPage() {
  return (
    <PortalShell access="staff">
      {() => (
        <main className={styles.page}>
          <section className={styles.heading}>
            <span className={styles.eyebrow}>STAFF KNOWLEDGE BASE</span>
            <h1>Resources<span>.</span></h1>
            <p>Current STAK staff guidance in its original language. Use the handbook for responsibilities and team standards; use the ticket guide for support workflows.</p>
          </section>

          <div className={styles.grid}>
            {RESOURCES.map((resource) => (
              <article className={styles.card} key={resource.number}>
                <span className={styles.number}>{resource.number}</span>
                <span className={styles.language}>{resource.language}</span>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
                <a href={resource.href}>Read {resource.title} <span aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
          <p className={styles.note}>These documents are staff-only resources. Academy course progress and confirmed qualifications are managed separately.</p>
        </main>
      )}
    </PortalShell>
  );
}
