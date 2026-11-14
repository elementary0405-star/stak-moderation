import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

const PROGRAM_TYPES = ["qualification", "course", "event", "other"] as const;

type ProgramSummary = {
  id: string;
  title: string;
  description: string;
  programType: string;
  status: string;
  participantCount: number;
  requirementCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    const result = await env.DB.prepare(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.program_type AS programType,
        p.status,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM training_enrollments e WHERE e.program_id = p.id) AS participantCount,
        (SELECT COUNT(*) FROM training_requirements r WHERE r.program_id = p.id) AS requirementCount
      FROM training_programs p
      ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END, p.created_at DESC
    `).all<ProgramSummary>();

    return trainingJson({ programs: result.results ?? [] });
  } catch (error) {
    console.error("[training-programs-get]", error);
    return trainingJson({ error: "Unable to load training programmes." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (request.method === "POST") return trainingJson({ error: "The legacy training register is read-only. Use STAK Academy." }, 410);
  /* Legacy implementation retained for reference; the current qualification flow is /api/academy. */
  try {
    const auth = await authorizeTrainingManager(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return trainingJson({ error: "Invalid request body." }, 400);
    }
    if (!isTrainingObject(body)) {
      return trainingJson({ error: "Invalid request body." }, 400);
    }

    const title = trainingText(body.title);
    const description = trainingText(body.description);
    const programType = trainingText(body.programType) || "qualification";

    if (!title || title.length > 120) {
      return trainingJson({ error: "A programme title of up to 120 characters is required." }, 400);
    }
    if (description.length > 2000) {
      return trainingJson({ error: "The description is too long." }, 400);
    }
    if (!PROGRAM_TYPES.includes(programType as (typeof PROGRAM_TYPES)[number])) {
      return trainingJson({ error: "Invalid programme type." }, 400);
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO training_programs (id, title, description, program_type, created_by_discord_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, title, description, programType, auth.user.discordUserId).run();

    const program = await env.DB.prepare(`
      SELECT id, title, description, program_type AS programType, status,
             created_at AS createdAt, updated_at AS updatedAt
      FROM training_programs WHERE id = ? LIMIT 1
    `).bind(id).first();

    return trainingJson({ program }, 201);
  } catch (error) {
    console.error("[training-programs-post]", error);
    return trainingJson({ error: "Unable to create the training programme." }, 500);
  }
}
