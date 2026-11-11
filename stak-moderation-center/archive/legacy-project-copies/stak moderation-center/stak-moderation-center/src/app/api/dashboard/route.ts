import { guard, json, db } from "@/lib/http";
export async function GET(request: Request) {
  const { user, response } = await guard(request, "staff"); if (response) return response;
  const database = db();
  const [players, cases, activeSanctions, staff, openTickets] = await Promise.all([
    database.prepare("SELECT COUNT(*) AS count FROM players").first<{ count: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM cases").first<{ count: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM cases WHERE status='active' AND sanction_type IN ('permanent_ban','temporary_ban','project_exclusion')").first<{ count: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM staff_profiles WHERE staff_status='active'").first<{ count: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM staff_tickets WHERE status!='closed'").first<{ count: number }>(),
  ]);
  return json({ user, stats: { players: players?.count ?? 0, cases: cases?.count ?? 0, activeSanctions: activeSanctions?.count ?? 0, activeStaff: staff?.count ?? 0, openTickets: openTickets?.count ?? 0 } });
}
