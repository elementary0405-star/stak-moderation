import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

type RouteContext = { params: Promise<{ programId: string }> };
type RequirementRow = {
  id: string;
  programId: string;
  title: string;
  itemType: string;
  maxPoints: number | null;
  passingPercentage: number;
  isRequired: number;
  sortOrder: number;
  createdAt: string;
};
type EnrollmentRow = {
  id: string;
  programId: string;
  discordUserId: string;
  participantName: string;
  teamName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
type ProgressRow = {
  id: string;
  enrollmentId: string;
  requirementId: string;
  status: string;
  notes: string | null;
  completedByDiscordId: string | null;
  completedAt: string | null;
  updatedAt: string;
};
type AttemptRow = {
  id: string;
  enrollmentId: string;
  requirementId: string;
  score: number;
  maxPoints: number;
  passed: number;
  notes: string | null;
  assessedByDiscordId: string;
  attemptedAt: string;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    const { programId } = await context.params;
    const program = await env.DB.prepare(`
      SELECT id, title, description, program_type AS programType, status,
             created_at AS createdAt, updated_at AS updatedAt
      FROM training_programs WHERE id = ? LIMIT 1
    `).bind(programId).first();

    if (!program) return trainingJson({ error: "Training programme not found." }, 404);

    const [requirementResult, enrollmentResult] = await Promise.all([
      env.DB.prepare(`
        SELECT id, program_id AS programId, title, item_type AS itemType,
               max_points AS maxPoints, passing_percentage AS passingPercentage,
               is_required AS isRequired, sort_order AS sortOrder, created_at AS createdAt
        FROM training_requirements WHERE program_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `).bind(programId).all<RequirementRow>(),
      env.DB.prepare(`
        SELECT id, program_id AS programId, discord_user_id AS discordUserId,
               participant_name AS participantName, team_name AS teamName,
               status, notes, created_at AS createdAt, updated_at AS updatedAt
        FROM training_enrollments WHERE program_id = ?
        ORDER BY participant_name COLLATE NOCASE ASC
      `).bind(programId).all<EnrollmentRow>(),
    ]);

    const requirements = requirementResult.results ?? [];
    const enrollments = enrollmentResult.results ?? [];
    let progressRows: ProgressRow[] = [];
    let attemptRows: AttemptRow[] = [];

    if (enrollments.length > 0) {
      const placeholders = enrollments.map(() => "?").join(", ");
      const ids = enrollments.map((item) => item.id);
      const [progressResult, attemptResult] = await Promise.all([
        env.DB.prepare(`
          SELECT id, enrollment_id AS enrollmentId, requirement_id AS requirementId,
                 status, notes, completed_by_discord_id AS completedByDiscordId,
                 completed_at AS completedAt, updated_at AS updatedAt
          FROM training_progress WHERE enrollment_id IN (${placeholders})
        `).bind(...ids).all<ProgressRow>(),
        env.DB.prepare(`
          SELECT id, enrollment_id AS enrollmentId, requirement_id AS requirementId,
                 score, max_points AS maxPoints, passed, notes,
                 assessed_by_discord_id AS assessedByDiscordId, attempted_at AS attemptedAt
          FROM training_assessment_attempts WHERE enrollment_id IN (${placeholders})
          ORDER BY attempted_at DESC
        `).bind(...ids).all<AttemptRow>(),
      ]);
      progressRows = progressResult.results ?? [];
      attemptRows = attemptResult.results ?? [];
    }

    const participants = enrollments.map((enrollment) => ({
      ...enrollment,
      progress: progressRows.filter((item) => item.enrollmentId === enrollment.id),
      attempts: attemptRows.filter((item) => item.enrollmentId === enrollment.id),
    }));

    return trainingJson({ program, requirements, participants });
  } catch (error) {
    console.error("[training-program-get]", error);
    return trainingJson({ error: "Unable to load training programme details." }, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (request.method === "PATCH") return trainingJson({ error: "The legacy training register is read-only. Use STAK Academy." }, 410);
  /* Legacy implementation retained for reference; the current qualification flow is /api/academy. */
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    const { programId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return trainingJson({ error: "Invalid request body." }, 400);
    }
    if (!isTrainingObject(body)) return trainingJson({ error: "Invalid request body." }, 400);

    const current = await env.DB.prepare(`SELECT id FROM training_programs WHERE id = ? LIMIT 1`)
      .bind(programId).first();
    if (!current) return trainingJson({ error: "Training programme not found." }, 404);

    const updates: string[] = [];
    const values: Array<string> = [];
    if (Object.hasOwn(body, "title")) {
      const title = trainingText(body.title);
      if (!title || title.length > 120) return trainingJson({ error: "A valid title is required." }, 400);
      updates.push("title = ?"); values.push(title);
    }
    if (Object.hasOwn(body, "description")) {
      const description = trainingText(body.description);
      if (description.length > 2000) return trainingJson({ error: "The description is too long." }, 400);
      updates.push("description = ?"); values.push(description);
    }
    if (Object.hasOwn(body, "status")) {
      const status = trainingText(body.status);
      if (status !== "active" && status !== "archived") return trainingJson({ error: "Invalid programme status." }, 400);
      updates.push("status = ?"); values.push(status);
    }
    if (updates.length === 0) return trainingJson({ error: "No valid changes were provided." }, 400);

    updates.push("updated_at = CURRENT_TIMESTAMP");
    await env.DB.prepare(`UPDATE training_programs SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values, programId).run();

    return trainingJson({ success: true });
  } catch (error) {
    console.error("[training-program-patch]", error);
    return trainingJson({ error: "Unable to update the training programme." }, 500);
  }
}
