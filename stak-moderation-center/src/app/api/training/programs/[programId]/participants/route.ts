import { env } from "cloudflare:workers";
import {
  authorizeTrainingManager,
  isTrainingObject,
  trainingJson,
  trainingText,
} from "@/lib/training-api";

type RouteContext = { params: Promise<{ programId: string }> };

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

    const discordUserId = trainingText(body.discordUserId);
    const participantName = trainingText(body.participantName);
    const teamName = trainingText(body.teamName);

    if (!/^\d{17,20}$/.test(discordUserId)) {
      return trainingJson({ error: "Enter a valid Discord user ID (17–20 digits)." }, 400);
    }
    if (!participantName || participantName.length > 100) {
      return trainingJson({ error: "A participant name of up to 100 characters is required." }, 400);
    }
    if (teamName.length > 100) return trainingJson({ error: "The team/group name is too long." }, 400);

    const existing = await env.DB.prepare(`
      SELECT id FROM training_enrollments WHERE program_id = ? AND discord_user_id = ? LIMIT 1
    `).bind(programId, discordUserId).first();
    if (existing) return trainingJson({ error: "This member is already enrolled in the programme." }, 409);

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO training_enrollments (
        id, program_id, discord_user_id, participant_name, team_name, enrolled_by_discord_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, programId, discordUserId, participantName, teamName || null, auth.user.discordUserId).run();

    const requirements = await env.DB.prepare(`
      SELECT id FROM training_requirements WHERE program_id = ? ORDER BY sort_order ASC
    `).bind(programId).all<{ id: string }>();

    const statements = (requirements.results ?? []).map((item) => env.DB.prepare(`
      INSERT OR IGNORE INTO training_progress (id, enrollment_id, requirement_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), id, item.id));
    if (statements.length > 0) await env.DB.batch(statements);

    return trainingJson({
      participant: { id, discordUserId, participantName, teamName: teamName || null, status: "enrolled" },
    }, 201);
  } catch (error) {
    console.error("[training-participant-post]", error);
    return trainingJson({ error: "Unable to add the participant." }, 500);
  }
}
