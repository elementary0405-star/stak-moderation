import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "../../../../../lib/discord-auth";
import { hasPortalAccess } from "../../../../../lib/portal-access";

type RouteContext = {
  params: Promise<{
    caseId: string;
  }>;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function authorize(
  request: Request,
  requiredAccess: "trailModerator" | "staffManager",
) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json(
        { error: "Authentication required." },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, requiredAccess)) {
    return {
      user: null,
      response: json(
        { error: "Access denied." },
        403,
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

/**
 * GET /api/records/cases/[caseId]
 *
 * Ruft einen einzelnen Moderationsfall mit Spielerdaten ab.
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const auth = await authorize(
      request,
      "trailModerator",
    );

    if (!auth.user) {
      return auth.response!;
    }

    const { caseId } = await context.params;

    if (!caseId) {
      return json(
        { error: "A case ID is required." },
        400,
      );
    }

    const moderationCase = await env.DB.prepare(`
      SELECT
        c.id,
        c.case_number AS caseNumber,
        c.player_id AS playerId,

        p.player_name AS playerName,
        p.discord_name AS discordName,
        p.discord_id AS discordId,

        c.game,
        c.sanction_type AS sanctionType,
        c.reason,
        c.notes,
        CASE WHEN c.status = 'lifted' OR EXISTS (SELECT 1 FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted') THEN 'lifted' ELSE c.status END AS status,

        c.started_at AS startedAt,
        c.duration_seconds AS durationSeconds,
        c.expires_at AS expiresAt,

        COALESCE(c.lifted_at, (SELECT se.created_at FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted' ORDER BY se.created_at DESC LIMIT 1)) AS liftedAt,
        COALESCE(c.lifted_by_discord_id, (SELECT se.actor_discord_id FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted' ORDER BY se.created_at DESC LIMIT 1)) AS liftedByDiscordId,
        COALESCE(c.lifted_reason, (SELECT se.reason FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted' ORDER BY se.created_at DESC LIMIT 1)) AS liftedReason,

        c.created_by_discord_id AS createdByDiscordId,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt

      FROM cases c

      INNER JOIN players p
        ON p.id = c.player_id

      WHERE c.id = ?

      LIMIT 1
    `)
      .bind(caseId)
      .first();

    if (!moderationCase) {
      return json(
        { error: "Moderation case not found." },
        404,
      );
    }

    const identities = await env.DB.prepare(`
      SELECT
        id,
        game,
        game_player_id AS gamePlayerId,
        game_player_name AS gamePlayerName
      FROM player_identities
      WHERE player_id = ?
      ORDER BY game ASC
    `)
      .bind(moderationCase.playerId)
      .all();

    const evidence = await env.DB.prepare(`
      SELECT
        id,
        file_name AS fileName,
        evidence_url AS evidenceUrl,
        description,
        uploaded_by_discord_id AS uploadedByDiscordId,
        created_at AS createdAt
      FROM case_evidence
      WHERE case_id = ?
      ORDER BY created_at DESC
    `)
      .bind(caseId)
      .all();

    return json({
      case: {
        ...moderationCase,
        identities: identities.results ?? [],
        evidence: evidence.results ?? [],
      },
    });
  } catch (error) {
    console.error("[case-detail-get]", error);

    return json(
      { error: "Unable to load moderation case." },
      500,
    );
  }
}

/**
 * PATCH /api/records/cases/[caseId]
 *
 * Aktualisiert erlaubte Falldetails.
 *
 * Nur Staff Manager und höhere Ränge dürfen
 * bestehende Moderationsfälle bearbeiten.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const auth = await authorize(
      request,
      "staffManager",
    );

    if (!auth.user) {
      return auth.response!;
    }

    const { caseId } = await context.params;

    if (!caseId) {
      return json(
        { error: "A case ID is required." },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        { error: "Invalid request body." },
        400,
      );
    }

    if (!isObject(body)) {
      return json(
        { error: "Invalid request body." },
        400,
      );
    }

    const allowedFields = [
      "game",
      "reason",
      "notes",
    ];

    const suppliedFields = Object.keys(body);

    if (
      suppliedFields.length === 0 ||
      suppliedFields.some(
        (field) => !allowedFields.includes(field),
      )
    ) {
      return json(
        { error: "Invalid or unsupported update fields." },
        400,
      );
    }

    const existingCase = await env.DB.prepare(`
      SELECT
        id,
        case_number AS caseNumber,
        game,
        reason,
        notes,
        CASE WHEN status = 'lifted' OR EXISTS (SELECT 1 FROM sanction_events se WHERE se.case_id = cases.id AND se.event_type = 'lifted') THEN 'lifted' ELSE status END AS status
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first<{
        id: string;
        caseNumber: string;
        game: string | null;
        reason: string;
        notes: string | null;
        status: string;
      }>();

    if (!existingCase) {
      return json(
        { error: "Moderation case not found." },
        404,
      );
    }

    if (
      existingCase.status === "lifted" ||
      existingCase.status === "completed"
    ) {
      return json(
        {
          error: "This case is finalized and cannot be edited.",
        },
        409,
      );
    }

    const updates: {
      game?: string | null;
      reason?: string;
      notes?: string | null;
    } = {};

    if (Object.hasOwn(body, "game")) {
      if (typeof body.game !== "string") {
        return json(
          { error: "Invalid game value." },
          400,
        );
      }

      const game = textValue(body.game);

      if (game.length > 50) {
        return json(
          { error: "Game name is too long." },
          400,
        );
      }

      updates.game = game || null;
    }

    if (Object.hasOwn(body, "reason")) {
      if (typeof body.reason !== "string") {
        return json(
          { error: "Invalid reason value." },
          400,
        );
      }

      const reason = textValue(body.reason);

      if (!reason || reason.length > 5000) {
        return json(
          { error: "A valid case reason is required." },
          400,
        );
      }

      updates.reason = reason;
    }

    if (Object.hasOwn(body, "notes")) {
      if (
        body.notes !== null &&
        typeof body.notes !== "string"
      ) {
        return json(
          { error: "Invalid notes value." },
          400,
        );
      }

      const notes = textValue(body.notes);

      if (notes.length > 10000) {
        return json(
          { error: "Internal notes are too long." },
          400,
        );
      }

      updates.notes = notes || null;
    }

    const assignments: string[] = [];
    const values: unknown[] = [];

    if (Object.hasOwn(updates, "game")) {
      assignments.push("game = ?");
      values.push(updates.game);
    }

    if (Object.hasOwn(updates, "reason")) {
      assignments.push("reason = ?");
      values.push(updates.reason);
    }

    if (Object.hasOwn(updates, "notes")) {
      assignments.push("notes = ?");
      values.push(updates.notes);
    }

    if (assignments.length === 0) {
      return json(
        { error: "No valid changes provided." },
        400,
      );
    }

    const newValues = {
      ...existingCase,
      ...updates,
    };

    const updateStatement = env.DB.prepare(`
      UPDATE cases

      SET
        ${assignments.join(", ")},
        updated_at = CURRENT_TIMESTAMP

      WHERE id = ?
    `).bind(
      ...values,
      caseId,
    );

    const auditStatement = env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        reason
      )

      VALUES (
        ?,
        ?,
        'case',
        ?,
        'updated',
        ?,
        ?,
        ?
      )
    `).bind(
      crypto.randomUUID(),
      auth.user.discordUserId,
      caseId,
      JSON.stringify(existingCase),
      JSON.stringify(newValues),
      "Moderation case details updated.",
    );

    await env.DB.batch([
      updateStatement,
      auditStatement,
    ]);

    const updatedCase = await env.DB.prepare(`
      SELECT
        id,
        case_number AS caseNumber,
        player_id AS playerId,
        game,
        sanction_type AS sanctionType,
        reason,
        notes,
        status,
        started_at AS startedAt,
        duration_seconds AS durationSeconds,
        expires_at AS expiresAt,
        created_by_discord_id AS createdByDiscordId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first();

    return json({
      message: "Moderation case updated successfully.",
      case: updatedCase,
    });
  } catch (error) {
    console.error("[case-detail-update]", error);

    return json(
      { error: "Unable to update moderation case." },
      500,
    );
  }
}
