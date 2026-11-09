"use client";

import PortalShell from "@/components/PortalShell";
import { hasPortalAccess } from "@/lib/portal-access";
import styles from "./team-hub.module.css";

const ITEMS = [
  {
    title: "My Staff Record",
    description: "View your own staff information, role details and recorded history.",
    href: "/team-hub/my-record",
    access: "staff" as const,
    group: "Personal workspace",
  },
  {
    title: "Absence Management",
    description: "Submit an absence and review your current or previous absence periods.",
    href: "/team-hub/absence",
    access: "staff" as const,
    group: "Personal workspace",
  },
  {
    title: "Staff Introduction",
    description: "Review the first steps, expectations and important information for newly accepted staff members.",
    href: "/team-hub/introduction",
    access: "staff" as const,
    group: "Personal workspace",
  },
  {
    title: "Feedback Box",
    description: "Send confidential feedback directly to the STAK Owner.",
    href: "/team-hub/feedback",
    access: "staff" as const,
    group: "Personal workspace",
  },
  {
    title: "Staff Directory",
    description: "View team members, ranks, current absence status and staff records.",
    href: "/team-hub/staff-directory",
    access: "staffManager" as const,
    group: "Management tools",
  },
  {
    title: "Staff Applications",
    description: "Review incoming applications and manage recruitment decisions.",
    href: "/team-hub/applications",
    access: "staffManager" as const,
    group: "Management tools",
  },
  {
    title: "Awards & Growth",
    description: "Record awards, progress, rank changes and staff development.",
    href: "/team-hub/growth",
    access: "staffManager" as const,
    group: "Management tools",
  },
  {
    title: "Warnings & History",
    description: "Review staff warnings and the documented history of team members.",
    href: "/team-hub/warnings",
    access: "staffManager" as const,
    group: "Management tools",
  },
  {
    title: "Staff Tickets",
    description: "Review and manage internal staff tickets.",
    href: "/team-hub/staff-tickets",
    access: "staffManager" as const,
    group: "Management tools",
  },
  {
    title: "Feedback Inbox",
    description: "Read confidential feedback submissions. This area is restricted to the Owner.",
    href: "/team-hub/feedback-inbox",
    access: "owner" as const,
    group: "Owner tools",
  },
];

function Card({ item, number }: { item: (typeof ITEMS)[number]; number: string }) {
  return (
    <a href={item.href} className={styles.card}>
      <span className={styles.number}>{number}</span>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <span className={styles.open}>Open section <span aria-hidden="true">→</span></span>
    </a>
  );
}

export default function TeamHubPage() {
  return (
    <PortalShell access="staff">
      {(user) => {
        const personal = ITEMS.filter((item) => item.group === "Personal workspace" && hasPortalAccess(user.stakRole, item.access));
        const management = ITEMS.filter((item) => item.group === "Management tools" && hasPortalAccess(user.stakRole, item.access));
        const owner = ITEMS.filter((item) => item.group === "Owner tools" && hasPortalAccess(user.stakRole, item.access));

        return (
          <>
            <section className={styles.heading}>
              <span className={styles.eyebrow}>STAFF WORKSPACE</span>
              <h1>Team Hub<span>.</span></h1>
              <p>Your central place for team information, personal staff tools and management functions.</p>
            </section>

            <section className={styles.group}>
              <h2>Personal workspace</h2>
              <div className={styles.grid}>
                {personal.map((item, index) => <Card item={item} number={`0${index + 1}`} key={item.title} />)}
              </div>
            </section>

            {management.length > 0 && (
              <section className={styles.group}>
                <h2>Management tools</h2>
                <div className={styles.grid}>
                  {management.map((item, index) => <Card item={item} number={`0${index + 1}`} key={item.title} />)}
                </div>
              </section>
            )}

            {owner.length > 0 && (
              <section className={styles.group}>
                <h2>Owner tools</h2>
                <div className={styles.grid}>
                  {owner.map((item, index) => <Card item={item} number={`0${index + 1}`} key={item.title} />)}
                </div>
              </section>
            )}
          </>
        );
      }}
    </PortalShell>
  );
}
