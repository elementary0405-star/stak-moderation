import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import { ACADEMY_COURSES, getAcademyCourse } from "@/lib/academy-content";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStoreHeaders() });
}

async function authorize(request: Request) {
  const user = await getFreshDiscordSession(request);
  if (!user) return { user: null, response: json({ error: "Authentication required." }, 401) };
  if (!hasPortalAccess(user.stakRole, "staff")) return { user: null, response: json({ error: "Staff access required." }, 403) };
  return { user, response: null };
}

async function ensureAssigned(user: NonNullable<Awaited<ReturnType<typeof getFreshDiscordSession>>>) {
  const eligible = ACADEMY_COURSES.filter((course) =>
    course.key === "general-staff"
    || (course.key === "staff-manager" && ["staff-manager", "management", "co-owner", "owner"].includes(user.stakRole))
    || (course.key === "management" && ["management", "co-owner", "owner"].includes(user.stakRole)),
  );
  const now = new Date().toISOString();
  const inserts = [];
  for (const course of eligible) {
    const existing = await env.DB.prepare(`
      SELECT id FROM academy_assignments
      WHERE discord_user_id = ? AND course_key = ? AND course_version = ?
      ORDER BY assigned_at DESC LIMIT 1
    `).bind(user.discordUserId, course.key, course.version).first<{ id: string }>();
    if (existing) continue;
    const previous = await env.DB.prepare(`
      SELECT id FROM academy_assignments WHERE discord_user_id = ? AND course_key = ?
      ORDER BY assigned_at DESC LIMIT 1
    `).bind(user.discordUserId, course.key).first<{ id: string }>();
    const id = crypto.randomUUID();
    inserts.push(env.DB.prepare(`
      INSERT INTO academy_assignments
        (id, discord_user_id, course_key, course_version, role_at_assignment, assigned_by_discord_id, supersedes_assignment_id, assigned_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.discordUserId, course.key, course.version, user.stakRole, user.discordUserId, previous?.id ?? null, now, now));
    inserts.push(env.DB.prepare(`
      INSERT INTO academy_history (id, assignment_id, actor_discord_id, action, details_json, created_at)
      VALUES (?, ?, ?, 'assigned', ?, ?)
    `).bind(crypto.randomUUID(), id, user.discordUserId, JSON.stringify({ courseKey: course.key, automatic: true }), now));
  }
  if (inserts.length) await env.DB.batch(inserts);
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (!auth.user) return auth.response!;
    await ensureAssigned(auth.user);
    const result = await env.DB.prepare(`
      SELECT a.id, a.course_key AS courseKey, a.course_version AS courseVersion,
        a.role_at_assignment AS roleAtAssignment, a.status, a.assigned_at AS assignedAt,
        a.updated_at AS updatedAt, a.supersedes_assignment_id AS supersedesAssignmentId
      FROM academy_assignments a WHERE a.discord_user_id = ?
      ORDER BY a.assigned_at DESC
    `).bind(auth.user.discordUserId).all<Record<string, unknown>>();
    const assignments = result.results ?? [];
    const details = await Promise.all(assignments.map(async (assignment) => {
      const id = String(assignment.id);
      const [lessons, submissions, history] = await Promise.all([
        env.DB.prepare(`SELECT lesson_id AS lessonId, completed_at AS completedAt FROM academy_lesson_completions WHERE assignment_id = ? ORDER BY completed_at`).bind(id).all(),
        env.DB.prepare(`SELECT id, submission_number AS submissionNumber, status, submitted_at AS submittedAt, reviewed_at AS reviewedAt, reviewer_notes AS reviewerNotes FROM academy_submissions WHERE assignment_id = ? ORDER BY submission_number DESC`).bind(id).all(),
        env.DB.prepare(`SELECT action, details_json AS details, created_at AS createdAt FROM academy_history WHERE assignment_id = ? ORDER BY created_at DESC LIMIT 50`).bind(id).all(),
      ]);
      return { ...assignment, course: getAcademyCourse(String(assignment.courseKey)) ?? null, lessons: lessons.results ?? [], submissions: submissions.results ?? [], history: history.results ?? [] };
    }));
    return json({ assignments: details, courses: ACADEMY_COURSES.map(({ key, version, title, shortDescription, audience }) => ({ key, version, title, shortDescription, audience })) });
  } catch (error) {
    console.error("[academy-self-get]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to load your Academy progress." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  try {
    const auth = await authorize(request);
    if (!auth.user) return auth.response!;
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body)) return json({ error: "Invalid Academy request." }, 400);
    const courseKey = typeof body.courseKey === "string" ? body.courseKey : "";
    const course = getAcademyCourse(courseKey);
    if (!course) return json({ error: "Course not found." }, 404);
    await ensureAssigned(auth.user);
    const assignment = await env.DB.prepare(`
      SELECT id, status FROM academy_assignments WHERE discord_user_id = ? AND course_key = ? AND course_version = ?
      ORDER BY assigned_at DESC LIMIT 1
    `).bind(auth.user.discordUserId, course.key, course.version).first<{ id: string; status: string }>();
    if (!assignment) return json({ error: "This course has not been assigned to you." }, 403);
    if (assignment.status === "approved") return json({ error: "This assignment is approved. Ask a manager to assign a new attempt if refresher training is required." }, 409);

    const action = body.action;
    const now = new Date().toISOString();
    if (action === "lesson") {
      const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
      if (!course.lessons.some((lesson) => lesson.id === lessonId)) return json({ error: "Lesson not found." }, 404);
      await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO academy_lesson_completions (assignment_id, lesson_id, completed_at) VALUES (?, ?, ?)`)
          .bind(assignment.id, lessonId, now),
        env.DB.prepare(`UPDATE academy_assignments SET status = CASE WHEN status = 'assigned' THEN 'in_progress' ELSE status END, updated_at = ? WHERE id = ?`)
          .bind(now, assignment.id),
        env.DB.prepare(`INSERT INTO academy_history (id, assignment_id, actor_discord_id, action, details_json, created_at) VALUES (?, ?, ?, 'lesson_completed', ?, ?)`)
          .bind(crypto.randomUUID(), assignment.id, auth.user.discordUserId, JSON.stringify({ lessonId }), now),
      ]);
      return json({ saved: true, lessonId });
    }
    if (action !== "submit") return json({ error: "Unknown Academy action." }, 400);

    const completed = await env.DB.prepare(`SELECT lesson_id AS lessonId FROM academy_lesson_completions WHERE assignment_id = ?`).bind(assignment.id).all<{ lessonId: string }>();
    const completeIds = new Set((completed.results ?? []).map((item) => item.lessonId));
    const missing = course.lessons.filter((lesson) => !completeIds.has(lesson.id));
    if (missing.length) return json({ error: `Complete all lessons before submitting. Missing: ${missing.map((item) => item.title).join(", ")}` }, 409);
    const rawAnswers = body.answers;
    if (!isPlainObject(rawAnswers)) return json({ error: "Answer all review questions before submitting." }, 400);
    const answers: Record<string, string> = {};
    for (const question of course.questions) {
      const rawAnswer = rawAnswers[question.id];
      const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
      if (!answer || answer.length > 5000) return json({ error: "Answer all review questions in clear detail (maximum 5,000 characters per answer)." }, 400);
      answers[question.id] = answer;
    }
    const practicalResponse = typeof body.practicalResponse === "string" ? body.practicalResponse.trim() : "";
    if (practicalResponse.length < 40 || practicalResponse.length > 12000) return json({ error: "Provide a practical response between 40 and 12,000 characters." }, 400);
    const prior = await env.DB.prepare(`SELECT COALESCE(MAX(submission_number), 0) AS lastNumber FROM academy_submissions WHERE assignment_id = ?`).bind(assignment.id).first<{ lastNumber: number }>();
    const submissionNumber = (prior?.lastNumber ?? 0) + 1;
    const submissionId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO academy_submissions (id, assignment_id, submission_number, answers_json, practical_response, status, submitted_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?)`)
        .bind(submissionId, assignment.id, submissionNumber, JSON.stringify(answers), practicalResponse, now),
      env.DB.prepare(`UPDATE academy_assignments SET status = 'submitted', updated_at = ? WHERE id = ?`)
        .bind(now, assignment.id),
      env.DB.prepare(`INSERT INTO academy_history (id, assignment_id, actor_discord_id, action, details_json, created_at) VALUES (?, ?, ?, 'submitted', ?, ?)`)
        .bind(crypto.randomUUID(), assignment.id, auth.user.discordUserId, JSON.stringify({ submissionId, submissionNumber }), now),
    ]);
    return json({ submitted: true, submissionId, submissionNumber }, 201);
  } catch (error) {
    console.error("[academy-self-post]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to save Academy progress." }, 500);
  }
}
