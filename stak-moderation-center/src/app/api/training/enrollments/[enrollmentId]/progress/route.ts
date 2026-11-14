import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

type RouteContext = { params: Promise<{ enrollmentId: string }> };
const PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (request.method === "PATCH") return trainingJson({ error: "The legacy training register is read-only. Use STAK Academy." }, 410);
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
    const status = trainingText(body.status);
    const notes = trainingText(body.notes);
    if (!requirementId) return trainingJson({ error: "A learning item is required." }, 400);
    if (!PROGRESS_STATUSES.includes(status as (typeof PROGRESS_STATUSES)[number])) {
      return trainingJson({ error: "Invalid progress status." }, 400);
    }
    if (notes.length > 2000) return trainingJson({ error: "The progress note is too long." }, 400);

    const requirement = await env.DB.prepare(`
      SELECT id FROM training_requirements WHERE id = ? AND program_id = ? LIMIT 1
    `).bind(requirementId, enrollment.programId).first();
    if (!requirement) return trainingJson({ error: "Learning item not found for this programme." }, 404);

    const completedAt = status === "completed" ? new Date().toISOString() : null;
    const completedBy = status === "completed" ? auth.user.discordUserId : null;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO training_progress (id, enrollment_id, requirement_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), enrollmentId, requirementId).run();

    await env.DB.prepare(`
      UPDATE training_progress
      SET status = ?, notes = ?, completed_by_discord_id = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE enrollment_id = ? AND requirement_id = ?
    `).bind(status, notes || null, completedBy, completedAt, enrollmentId, requirementId).run();

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

    return trainingJson({ success: true });
  } catch (error) {
    console.error("[training-progress-patch]", error);
    return trainingJson({ error: "Unable to update training progress." }, 500);
  }
}
