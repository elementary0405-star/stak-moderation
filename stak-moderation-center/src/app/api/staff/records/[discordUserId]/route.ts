import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import type { StakRole } from "@/lib/discord-roles";
import { noStoreHeaders } from "@/lib/application-public";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStoreHeaders() });

export async function GET(request: Request, context: { params: Promise<{ discordUserId: string }> }) {
  try {
    const user = await getFreshDiscordSession(request);
    if (!user) return json({ error: "Authentication required." }, 401);
    if (!hasPortalAccess(user.stakRole, "staffManager")) return json({ error: "Access denied." }, 403);
    const { discordUserId } = await context.params;
    if (!/^\d{17,20}$/.test(discordUserId)) return json({ error: "Invalid Discord user ID." }, 400);
    const session = await env.DB.prepare(`SELECT discord_user_id, username, global_name, stak_role FROM discord_sessions WHERE discord_user_id = ? AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC LIMIT 1`)
      .bind(discordUserId).first<{ discord_user_id: string; username: string; global_name: string | null; stak_role: string }>();
    if (!session) return json({ error: "No current verified staff session exists for this member." }, 404);
    if (!hasPortalAccess(session.stak_role as StakRole, "staff")) return json({ error: "This member is no longer recognized as staff." }, 404);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO staff_profiles (discord_user_id, username, global_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(discord_user_id) DO UPDATE SET username = excluded.username, global_name = excluded.global_name, updated_at = excluded.updated_at`)
      .bind(discordUserId, session.username, session.global_name, now, now).run();
    const [profile, absences, warnings, academy, history] = await Promise.all([
      env.DB.prepare(`SELECT discord_user_id AS discordUserId, username, global_name AS globalName, staff_status AS staffStatus, joined_at AS joinedAt, internal_notes AS internalNotes, created_at AS createdAt, updated_at AS updatedAt FROM staff_profiles WHERE discord_user_id = ? LIMIT 1`).bind(discordUserId).first(),
      env.DB.prepare(`SELECT id, start_date AS startDate, expected_return_date AS expectedReturnDate, reason, status, management_note AS managementNote, reviewed_by_discord_id AS reviewedByDiscordId, reviewed_at AS reviewedAt, created_at AS createdAt FROM staff_absences WHERE discord_user_id = ? ORDER BY start_date DESC, created_at DESC LIMIT 50`).bind(discordUserId).all(),
      env.DB.prepare(`SELECT id, warning_type AS warningType, reason, internal_notes AS internalNotes, issued_by_discord_id AS issuedByDiscordId, status, resolved_at AS resolvedAt, resolved_by_discord_id AS resolvedByDiscordId, resolution_reason AS resolutionReason, created_at AS createdAt FROM staff_warnings WHERE discord_user_id = ? ORDER BY created_at DESC LIMIT 100`).bind(discordUserId).all(),
      env.DB.prepare(`SELECT a.id, a.course_key AS courseKey, a.course_version AS courseVersion, a.role_at_assignment AS roleAtAssignment, a.status, a.assigned_by_discord_id AS assignedByDiscordId, a.supersedes_assignment_id AS supersedesAssignmentId, a.assigned_at AS assignedAt, a.updated_at AS updatedAt, (SELECT COUNT(*) FROM academy_submissions s WHERE s.assignment_id = a.id) AS submissionCount FROM academy_assignments a WHERE a.discord_user_id = ? ORDER BY a.assigned_at DESC LIMIT 100`).bind(discordUserId).all(),
      env.DB.prepare(`SELECT actor_discord_id AS actorDiscordId, action, details_json AS details, created_at AS createdAt FROM audit_logs WHERE entity_type = 'staff_profile' AND entity_id = ? ORDER BY created_at DESC LIMIT 100`).bind(discordUserId).all(),
    ]);
    return json({ member: { discordUserId, username: session.username, globalName: session.global_name, role: session.stak_role }, profile, absences: absences.results ?? [], warnings: warnings.results ?? [], academyAssignments: academy.results ?? [], profileHistory: history.results ?? [] });
  } catch (error) {
    console.error("[staff-record-get]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to load this staff record." }, 500);
  }
}
