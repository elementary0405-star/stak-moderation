import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import { getAcademyCourse, roleRank } from "@/lib/academy-content";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStoreHeaders() });

async function getReviewer(request: Request) {
  const user = await getFreshDiscordSession(request);
  if (!user) return { user: null, response: json({ error: "Authentication required." }, 401) };
  if (!hasPortalAccess(user.stakRole, "staffManager")) return { user: null, response: json({ error: "Staff Manager access required." }, 403) };
  return { user, response: null };
}

export async function GET(request: Request) {
  try {
    const auth = await getReviewer(request);
    if (!auth.user) return auth.response!;
    const rows = await env.DB.prepare(`
      SELECT a.id AS assignmentId, a.discord_user_id AS discordUserId,
        a.course_key AS courseKey, a.course_version AS courseVersion,
        a.role_at_assignment AS roleAtAssignment, a.assigned_at AS assignedAt,
        s.id AS submissionId, s.submission_number AS submissionNumber,
        s.answers_json AS answersJson, s.practical_response AS practicalResponse,
        s.submitted_at AS submittedAt, s.status AS submissionStatus,
        COALESCE(p.global_name, p.username, a.discord_user_id) AS staffName,
        active.stak_role AS currentRole
      FROM academy_assignments a
      JOIN academy_submissions s ON s.assignment_id = a.id
        AND s.submission_number = (SELECT MAX(s2.submission_number) FROM academy_submissions s2 WHERE s2.assignment_id = a.id)
      LEFT JOIN staff_profiles p ON p.discord_user_id = a.discord_user_id
      LEFT JOIN (
        SELECT discord_user_id, stak_role, ROW_NUMBER() OVER (PARTITION BY discord_user_id ORDER BY created_at DESC) AS rn
        FROM discord_sessions WHERE datetime(expires_at) > datetime('now')
      ) active ON active.discord_user_id = a.discord_user_id AND active.rn = 1
      WHERE a.status = 'submitted' AND s.status = 'submitted'
      ORDER BY s.submitted_at ASC LIMIT 200
    `).all<Record<string, unknown>>();
    const submissions = (rows.results ?? []).map((row) => {
      const course = getAcademyCourse(String(row.courseKey));
      let answers: Record<string, string> = {};
      try { answers = JSON.parse(String(row.answersJson)) as Record<string, string>; } catch { answers = {}; }
      const canReview = Boolean(course && row.currentRole && roleRank(String(row.currentRole)) > 0 && roleRank(auth.user!.stakRole) >= roleRank(course.reviewRole) && roleRank(auth.user!.stakRole) > roleRank(String(row.currentRole)));
      return { ...row, answers, course: course ? { key: course.key, title: course.title, questions: course.questions, practicalPrompt: course.practicalPrompt } : null, canReview };
    });
    return json({ submissions });
  } catch (error) {
    console.error("[academy-reviews-get]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to load submitted Academy work." }, 500);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  try {
    const auth = await getReviewer(request);
    if (!auth.user) return auth.response!;
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body)) return json({ error: "Invalid review request." }, 400);
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
    const decision = body.decision === "approve" || body.decision === "changes_requested" ? body.decision : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (!assignmentId || !decision || notes.length > 5000 || (decision === "changes_requested" && notes.length < 10)) return json({ error: "Choose a decision and provide clear feedback when requesting changes." }, 400);
    const assignment = await env.DB.prepare(`
      SELECT a.id, a.discord_user_id AS discordUserId, a.course_key AS courseKey, a.status,
        active.stak_role AS currentRole,
        s.id AS submissionId, s.submission_number AS submissionNumber, s.status AS submissionStatus
      FROM academy_assignments a
      JOIN academy_submissions s ON s.assignment_id = a.id
        AND s.submission_number = (SELECT MAX(s2.submission_number) FROM academy_submissions s2 WHERE s2.assignment_id = a.id)
      LEFT JOIN (SELECT discord_user_id, stak_role, ROW_NUMBER() OVER (PARTITION BY discord_user_id ORDER BY created_at DESC) AS rn FROM discord_sessions WHERE datetime(expires_at) > datetime('now')) active
        ON active.discord_user_id = a.discord_user_id AND active.rn = 1
      WHERE a.id = ? LIMIT 1
    `).bind(assignmentId).first<{ id: string; discordUserId: string; courseKey: string; status: string; currentRole: string | null; submissionId: string; submissionNumber: number; submissionStatus: string }>();
    if (!assignment || assignment.status !== "submitted" || assignment.submissionStatus !== "submitted") return json({ error: "This submission is no longer awaiting review." }, 409);
    const course = getAcademyCourse(assignment.courseKey);
    if (!assignment.currentRole) return json({ error: "The staff member must sign in again so their current Discord role can be verified." }, 409);
    if (!course || roleRank(assignment.currentRole) === 0 || roleRank(auth.user.stakRole) < roleRank(course.reviewRole) || roleRank(auth.user.stakRole) <= roleRank(assignment.currentRole)) return json({ error: "A higher authorized role must review this course." }, 403);
    const now = new Date().toISOString();
    const submissionStatus = decision === "approve" ? "approved" : "changes_requested";
    const assignmentStatus = submissionStatus;
    await env.DB.batch([
      env.DB.prepare(`UPDATE academy_submissions SET status = ?, reviewed_by_discord_id = ?, reviewed_at = ?, reviewer_notes = ? WHERE id = ? AND status = 'submitted'`)
        .bind(submissionStatus, auth.user.discordUserId, now, notes || null, assignment.submissionId),
      env.DB.prepare(`UPDATE academy_assignments SET status = ?, updated_at = ? WHERE id = ? AND status = 'submitted'`)
        .bind(assignmentStatus, now, assignment.id),
      env.DB.prepare(`INSERT INTO academy_history (id, assignment_id, actor_discord_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), assignment.id, auth.user.discordUserId, submissionStatus, JSON.stringify({ submissionId: assignment.submissionId, submissionNumber: assignment.submissionNumber, notes }), now),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values, reason, created_at) VALUES (?, ?, 'academy_assignment', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), auth.user.discordUserId, assignment.id, submissionStatus, JSON.stringify({ discordUserId: assignment.discordUserId, courseKey: assignment.courseKey, submissionId: assignment.submissionId }), notes || null, now),
    ]);
    return json({ reviewed: true, status: assignmentStatus });
  } catch (error) {
    console.error("[academy-review-patch]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to save this Academy review." }, 500);
  }
}
