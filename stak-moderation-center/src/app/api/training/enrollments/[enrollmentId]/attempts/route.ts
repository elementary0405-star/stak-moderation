import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

type RouteContext = { params: Promise<{ enrollmentId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (request.method === "POST") return trainingJson({ error: "The legacy training register is read-only. Use STAK Academy." }, 410);
  /* Legacy implementation retained for reference; the current qualification flow is /api/academy. */
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    const { enrollmentId } = await context.params;
    const enrollment = await env.DB.prepare(`
      SELECT e.id, e.program_id AS programId, p.status AS programStatus
      FROM training_enrollments e
      JOIN training_programs p ON p.id = e.program_id
      WHERE e.id = ? LIMIT 1
    `).bind(enrollmentId).first<{ id: string; programId: string; programStatus: string }>();
    if (!enrollment) return trainingJson({ error: "Training enrolment not found." }, 404);
    if (enrollment.programStatus !== "active") return trainingJson({ error: "Archived programmes are read-only." }, 409);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return trainingJson({ error: "Invalid request body." }, 400);
    }
    if (!isTrainingObject(body)) return trainingJson({ error: "Invalid request body." }, 400);

    const requirementId = trainingText(body.requirementId);
    const score = typeof body.score === "number" ? body.score : Number(body.score);
    const notes = trainingText(body.notes);

    if (!requirementId) return trainingJson({ error: "An assessment is required." }, 400);
    if (!Number.isFinite(score) || score < 0) return trainingJson({ error: "Enter a valid assessment score." }, 400);
    if (notes.length > 2000) return trainingJson({ error: "The assessment note is too long." }, 400);

    const requirement = await env.DB.prepare(`
      SELECT id, max_points AS maxPoints, passing_percentage AS passingPercentage
      FROM training_requirements
      WHERE id = ? AND program_id = ? AND item_type = 'assessment'
      LIMIT 1
    `).bind(requirementId, enrollment.programId).first<{
      id: string;
      maxPoints: number;
      passingPercentage: number;
    }>();
    if (!requirement) return trainingJson({ error: "Assessment not found for this programme." }, 404);
    if (score > requirement.maxPoints) return trainingJson({ error: `The score cannot exceed ${requirement.maxPoints} points.` }, 400);

    const percentage = requirement.maxPoints > 0 ? (score / requirement.maxPoints) * 100 : 0;
    const passed = percentage >= requirement.passingPercentage;
    const attemptId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO training_assessment_attempts (
        id, enrollment_id, requirement_id, score, max_points, passed, notes, assessed_by_discord_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attemptId,
      enrollmentId,
      requirementId,
      score,
      requirement.maxPoints,
      passed ? 1 : 0,
      notes || null,
      auth.user.discordUserId,
    ).run();

    await env.DB.prepare(`
      INSERT INTO training_progress (
        id, enrollment_id, requirement_id, status, completed_by_discord_id, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(enrollment_id, requirement_id) DO UPDATE SET
        status = CASE WHEN excluded.status = 'completed' THEN 'completed'
                      WHEN training_progress.status = 'completed' THEN 'completed'
                      ELSE 'in_progress' END,
        completed_by_discord_id = CASE WHEN excluded.status = 'completed'
                                       THEN excluded.completed_by_discord_id
                                       ELSE training_progress.completed_by_discord_id END,
        completed_at = CASE WHEN excluded.status = 'completed'
                            THEN excluded.completed_at
                            ELSE training_progress.completed_at END,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      crypto.randomUUID(),
      enrollmentId,
      requirementId,
      passed ? "completed" : "in_progress",
      passed ? auth.user.discordUserId : null,
      passed ? new Date().toISOString() : null,
    ).run();

    await env.DB.prepare(`
      UPDATE training_enrollments
      SET status = CASE
        WHEN EXISTS (
          SELECT 1 FROM training_requirements r
          WHERE r.program_id = ? AND r.is_required = 1
        ) AND NOT EXISTS (
          SELECT 1 FROM training_requirements r
          LEFT JOIN training_progress p
            ON p.requirement_id = r.id AND p.enrollment_id = ?
          WHERE r.program_id = ? AND r.is_required = 1
            AND COALESCE(p.status, 'not_started') != 'completed'
        ) THEN 'completed'
        WHEN EXISTS (
          SELECT 1 FROM training_progress p
          JOIN training_requirements r ON r.id = p.requirement_id
          WHERE p.enrollment_id = ? AND p.status != 'not_started'
        ) THEN 'in_progress'
        ELSE 'enrolled'
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(enrollment.programId, enrollmentId, enrollment.programId, enrollmentId, enrollmentId).run();

    return trainingJson({
      attempt: {
        id: attemptId,
        score,
        maxPoints: requirement.maxPoints,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        attemptedAt: new Date().toISOString(),
      },
    }, 201);
  } catch (error) {
    console.error("[training-assessment-post]", error);
    return trainingJson({ error: "Unable to record the assessment result." }, 500);
  }
}
