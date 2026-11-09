"use client";

import PortalShell from "@/components/PortalShell";
import styles from "./cases-records.module.css";

const AREAS = [
  {
    number: "01",
    title: "Moderation Cases",
    description: "Review moderation cases, actions and case history.",
    href: "/cases-records/moderation-cases",
  },
  {
    number: "02",
    title: "Ban & Sanction Records",
    description: "Manage permanent and temporary sanctions and their records.",
    href: "/cases-records/sanction-records",
  },
  {
    number: "03",
    title: "Player Records",
    description: "Find player records and review relevant moderation history.",
    href: "/cases-records/player-records",
  },
];

export default function CasesRecordsPage() {
  return (
    <PortalShell access="trailModerator">
      {() => (
        <>
          <section className={styles.heading}>
            <span className={styles.eyebrow}>MODERATION WORKSPACE</span>
            <h1>Cases &amp; Records<span>.</span></h1>
            <p>Moderation activity, player records and sanctions, organised in one central area.</p>
          </section>
          <div className={styles.grid}>
            {AREAS.map((area) => (
              <a className={styles.card} href={area.href} key={area.number}>
                <span>{area.number}</span>
                <h2>{area.title}</h2>
                <p>{area.description}</p>
                <strong>Open section →</strong>
              </a>
            ))}
          </div>
        </>
      )}
    </PortalShell>
  );
}
