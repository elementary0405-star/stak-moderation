import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import styles from "./staff-tickets.module.css";

function StaffTicketsInfo() {
  return <main className={styles.page}>
    <Link href="/team-hub" className={styles.back}>← Team Hub</Link>
    <section className={styles.panel}><span className={styles.eyebrow}>DISCORD SUPPORT</span><h1>Staff Tickets</h1><p>STAK support tickets are created and managed in Discord by the official ticket bot. Use the relevant Discord ticket channel for member requests and follow the ticket workflow in the internal guide.</p><p>This website keeps staff records, Academy progress, applications and moderation cases. It does not create a second ticket system or claim to deliver Discord messages.</p><Link href="/staff-resources/ticket-guide" className={styles.action}>Open the Ticket Guide →</Link></section>
  </main>;
}

export default function StaffTicketsPage() { return <PortalShell access="staff">{() => <StaffTicketsInfo />}</PortalShell>; }
