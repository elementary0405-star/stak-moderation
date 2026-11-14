import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import { ACADEMY_COURSES, getAcademyCourse, roleRank } from "@/lib/academy-content";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStoreHeaders() });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  try {
    const user = await getFreshDiscordSession(request);
    if (!user) return json({ error: "Authentication required." }, 401);
    if (!hasPortalAccess(user.stakRole, "staffManager")) return json({ error: "Staff Manager access required." }, 403);
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body)) return json({ error: "Invalid assignment request." }, 400);
    const discordUserId = typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
    const courseKey = typeof body.courseKey === "string" ? body.courseKey : "";
    const course = getAcademyCourse(courseKey);
    if (!/^\d{17,20}$/.test(discordUserId) || !course) return json({ error: "Choose a valid staff member and course." }, 400);
    if (!ACADEMY_COURSES.some((item) => item.key === course.key)) return json({ error: "Course not found." }, 404);
    const target = await env.DB.prepare(`SELECT discord_user_id, stak_role AS role FROM discord_sessions WHERE discord_user_id = ? AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC LIMIT 1`).bind(discordUserId).first<{ discord_user_id: string; role: string }>();
    if (!target || roleRank(target.role) === 0) return json({ error: "The staff member needs a current verified staff session." }, 404);
    if (roleRank(user.stakRole) <= roleRank(target.role)) return json({ error: "Only a higher role can assign training to this staff member." }, 403);
    if (course.key === "staff-manager" && roleRank(target.role) < roleRank("staff-manager")) return json({ error: "Staff Manager Training is assigned to Staff Managers and higher roles." }, 400);
    if (course.key === "management" && roleRank(target.role) < roleRank("management")) return json({ error: "Management Training is assigned to Management and higher roles." }, 400);

    const existing = await env.DB.prepare(`SELECT id, status FROM academy_assignments WHERE discord_user_id = ? AND course_key = ? ORDER BY assigned_at DESC LIMIT 1`).bind(discordUserId, course.key).first<{ id: string; status: string }>();
    if (existing && !["approved"].includes(existing.status)) return json({ error: "An assignment for this course is already active." }, 409);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO academy_assignments (id, discord_user_id, course_key, course_version, role_at_assignment, status, assigned_by_discord_id, supersedes_assignment_id, assigned_at, updated_at) VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?, ?, ?)`)
        .bind(id, discordUserId, course.key, course.version, target.role, user.discordUserId, existing?.id ?? null, now, now),
      env.DB.prepare(`INSERT INTO academy_history (id, assignment_id, actor_discord_id, action, details_json, created_at) VALUES (?, ?, ?, 'assigned', ?, ?)`)
        .bind(crypto.randomUUID(), id, user.discordUserId, JSON.stringify({ courseKey: course.key, courseVersion: course.version, assignedTo: discordUserId, supersedes: existing?.id ?? null }), now),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values, created_at) VALUES (?, ?, 'academy_assignment', ?, 'assigned', ?, ?)`)
        .bind(crypto.randomUUID(), user.discordUserId, id, JSON.stringify({ discordUserId, courseKey: course.key }), now),
    ]);
    return json({ assigned: true, assignmentId: id, courseKey: course.key }, 201);
  } catch (error) {
    console.error("[academy-assignment-post]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to assign this course." }, 500);
  }
}
