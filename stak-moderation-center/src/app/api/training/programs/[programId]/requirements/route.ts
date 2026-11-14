import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

type RouteContext = { params: Promise<{ programId: string }> };
const ITEM_TYPES = ["module", "assessment", "practical"] as const;

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (request.method === "POST") return trainingJson({ error: "The legacy training register is read-only. Use STAK Academy." }, 410);
  /* Legacy implementation retained for reference; the current qualification flow is /api/academy. */
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    const { programId } = await context.params;
    const program = await env.DB.prepare(`SELECT id, status FROM training_programs WHERE id = ? LIMIT 1`)
      .bind(programId).first<{ id: string; status: string }>();
    if (!program) return trainingJson({ error: "Training programme not found." }, 404);
    if (program.status !== "active") return trainingJson({ error: "Archived programmes are read-only." }, 409);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return trainingJson({ error: "Invalid request body." }, 400);
    }
    if (!isTrainingObject(body)) return trainingJson({ error: "Invalid request body." }, 400);

    const title = trainingText(body.title);
    const itemType = trainingText(body.itemType) || "module";
    const rawMaxPoints = body.maxPoints;
    const rawPassingPercentage = body.passingPercentage;
    const isRequired = body.isRequired !== false;

    if (!title || title.length > 150) return trainingJson({ error: "A requirement title of up to 150 characters is required." }, 400);
    if (!ITEM_TYPES.includes(itemType as (typeof ITEM_TYPES)[number])) return trainingJson({ error: "Invalid requirement type." }, 400);

    let maxPoints: number | null = null;
    if (itemType === "assessment") {
      maxPoints = typeof rawMaxPoints === "number" ? rawMaxPoints : Number(rawMaxPoints);
      if (!Number.isFinite(maxPoints) || maxPoints <= 0 || maxPoints > 100000) {
        return trainingJson({ error: "Enter a valid maximum score for this assessment." }, 400);
      }
    }

    const passingPercentage = rawPassingPercentage === undefined ? 60 : Number(rawPassingPercentage);
    if (!Number.isFinite(passingPercentage) || passingPercentage < 0 || passingPercentage > 100) {
      return trainingJson({ error: "The passing percentage must be between 0 and 100." }, 400);
    }

    const currentOrder = await env.DB.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS lastOrder FROM training_requirements WHERE program_id = ?
    `).bind(programId).first<{ lastOrder: number }>();
    const sortOrder = (currentOrder?.lastOrder ?? 0) + 10;
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO training_requirements (
        id, program_id, title, item_type, max_points, passing_percentage, is_required, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, programId, title, itemType, maxPoints, passingPercentage, isRequired ? 1 : 0, sortOrder).run();

    const enrollments = await env.DB.prepare(`
      SELECT id FROM training_enrollments WHERE program_id = ?
    `).bind(programId).all<{ id: string }>();
    const statements = (enrollments.results ?? []).map((enrollment) => env.DB.prepare(`
      INSERT OR IGNORE INTO training_progress (id, enrollment_id, requirement_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), enrollment.id, id));
    if (statements.length > 0) await env.DB.batch(statements);
    if (isRequired) {
      await env.DB.prepare(`
        UPDATE training_enrollments
        SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        WHERE program_id = ? AND status = 'completed'
      `).bind(programId).run();
    }

    return trainingJson({
      requirement: { id, title, itemType, maxPoints, passingPercentage, isRequired, sortOrder },
    }, 201);
  } catch (error) {
    console.error("[training-requirement-post]", error);
    return trainingJson({ error: "Unable to add the learning item." }, 500);
  }
}
