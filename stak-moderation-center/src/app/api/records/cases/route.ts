import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "../../../../lib/discord-auth";
import { hasPortalAccess } from "../../../../lib/portal-access";

const MAX_LIMIT = 100;

const SANCTION_TYPES = [
  "permanent_ban",
  "temporary_ban",
  "unban",
  "kick",
  "timeout",
  "warning",
  "project_exclusion",
  "other",
] as const;

type SanctionType = (typeof SANCTION_TYPES)[number];

const CASE_STATUSES = [
  "active",
  "expired",
  "lifted",
  "completed",
] as const;

type CaseStatus = (typeof CASE_STATUSES)[number];

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

function nullableText(value: unknown): string | null {
  const result = textValue(value);
  return result || null;
}

function isSanctionType(value: string): value is SanctionType {
  return SANCTION_TYPES.includes(value as SanctionType);
}

function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus);
}

async function authorize(request: Request) {
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

  if (!hasPortalAccess(user.stakRole, "trailModerator")) {
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
 * GET /api/records/cases
 *
 * Lädt Moderationsfälle mit optionaler Suche und Filterung.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
    }

    const url = new URL(request.url);

    const search = textValue(
      url.searchParams.get("search"),
    );

    const playerId = textValue(
      url.searchParams.get("playerId"),
    );

    const status = textValue(
      url.searchParams.get("status"),
    );

    const sanctionType = textValue(
      url.searchParams.get("sanctionType"),
    );

    const requestedLimit = Number(
      url.searchParams.get("limit") ?? 50,
    );

    const requestedOffset = Number(
      url.searchParams.get("offset") ?? 0,
    );

    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : 50;

    const offset = Number.isInteger(requestedOffset)
      ? Math.max(requestedOffset, 0)
      : 0;

    if (status && !isCaseStatus(status)) {
      return json(
        { error: "Invalid case status." },
        400,
      );
    }

    if (sanctionType && !isSanctionType(sanctionType)) {
      return json(
        { error: "Invalid sanction type." },
        400,
      );
    }

    const searchTerm = `%${search}%`;

    const result = await env.DB.prepare(`
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

      WHERE
        (
          ? = ''
          OR c.case_number LIKE ?
          OR p.player_name LIKE ?
          OR p.discord_name LIKE ?
          OR p.discord_id LIKE ?
          OR c.reason LIKE ?
        )

        AND (
          ? = ''
          OR c.player_id = ?
        )

        AND (
          ? = ''
          OR CASE WHEN c.status = 'lifted' OR EXISTS (SELECT 1 FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted') THEN 'lifted' ELSE c.status END = ?
        )

        AND (
          ? = ''
          OR c.sanction_type = ?
        )

      ORDER BY c.created_at DESC

      LIMIT ? OFFSET ?
    `)
      .bind(
        search,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        playerId,
        playerId,
        status,
        status,
        sanctionType,
        sanctionType,
        limit,
        offset,
      )
      .all();

    const cases = result.results ?? [];

    return json({
      cases,
      pagination: {
        limit,
        offset,
        returned: cases.length,
      },
    });
  } catch (error) {
    console.error("[cases-get]", error);

    return json(
      { error: "Unable to load moderation cases." },
      500,
    );
  }
}

/**
 * POST /api/records/cases
 *
 * Erstellt einen Moderationsfall für einen bestehenden Spieler.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
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

    const playerId = textValue(body.playerId);
    const game = textValue(body.game);
    const sanctionTypeValue = textValue(body.sanctionType);
    const reason = textValue(body.reason);
    const notes = textValue(body.notes);

    const durationSeconds =
      body.durationSeconds === null ||
      body.durationSeconds === undefined ||
      body.durationSeconds === ""
        ? null
        : Number(body.durationSeconds);

    if (!playerId) {
      return json(
        { error: "A player ID is required." },
        400,
      );
    }

    if (!isSanctionType(sanctionTypeValue)) {
      return json(
        { error: "Invalid sanction type." },
        400,
      );
    }

    if (!reason || reason.length > 5000) {
      return json(
        { error: "A valid case reason is required." },
        400,
      );
    }

    if (game.length > 50) {
      return json(
        { error: "Game name is too long." },
        400,
      );
    }

    if (notes.length > 10000) {
      return json(
        { error: "Internal notes are too long." },
        400,
      );
    }

    if (
      durationSeconds !== null &&
      (
        !Number.isSafeInteger(durationSeconds) ||
        durationSeconds <= 0
      )
    ) {
      return json(
        { error: "Invalid case duration." },
        400,
      );
    }

    const sanctionType = sanctionTypeValue as SanctionType;

    if (
      (
        sanctionType === "temporary_ban" ||
        sanctionType === "timeout"
      ) &&
      durationSeconds === null
    ) {
      return json(
        {
          error: "This sanction type requires a duration.",
        },
        400,
      );
    }

    const player = await env.DB.prepare(`
      SELECT
        id,
        player_name
      FROM players
      WHERE id = ?
      LIMIT 1
    `)
      .bind(playerId)
      .first<{
        id: string;
        player_name: string;
      }>();

    if (!player) {
      return json(
        { error: "Player record not found." },
        404,
      );
    }

    const caseId = crypto.randomUUID();
    const year = new Date().getFullYear();

    const startedAt = new Date().toISOString();

    const expiresAt =
      durationSeconds !== null
        ? new Date(
            Date.now() + durationSeconds * 1000,
          ).toISOString()
        : null;

    /**
     * Die Fallnummer wird direkt beim INSERT erzeugt.
     *
     * Die Jahresnummer wird anhand der bereits vorhandenen
     * Fälle desselben Jahres ermittelt.
     *
     * Die Berechnung erfolgt innerhalb desselben
     * Datenbank-Schreibvorgangs.
     */
    const createCaseStatement = env.DB.prepare(`
      INSERT INTO cases (
        id,
        case_number,
        player_id,
        game,
        sanction_type,
        reason,
        notes,
        status,
        started_at,
        duration_seconds,
        expires_at,
        created_by_discord_id
      )

      SELECT
        ?,

        'STAK-' || ? || '-' ||
        printf(
          '%05d',
          COALESCE(
            MAX(
              CAST(
                substr(case_number, 11) AS INTEGER
              )
            ),
            0
          ) + 1
        ),

        ?,
        ?,
        ?,
        ?,
        ?,
        'active',
        ?,
        ?,
        ?,
        ?

      FROM cases

      WHERE case_number LIKE ?

      RETURNING id
    `).bind(
      caseId,
      year,
      playerId,
      game || null,
      sanctionType,
      reason,
      notes || null,
      startedAt,
      durationSeconds,
      expiresAt,
      auth.user.discordUserId,
      `STAK-${year}-%`,
    );

    /**
     * Der Audit-Eintrag wird zusammen mit dem Fall
     * innerhalb eines D1-Batches gespeichert.
     */
    const auditStatement = env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        new_values
      )

      SELECT
        ?,
        ?,
        'case',
        id,
        'created',
        ?

      FROM cases

      WHERE id = ?
    `).bind(
      crypto.randomUUID(),
      auth.user.discordUserId,
      JSON.stringify({
        playerId,
        playerName: player.player_name,
        game: game || null,
        sanctionType,
        reason,
        notes: notes || null,
        durationSeconds,
        expiresAt,
      }),
      caseId,
    );

    await env.DB.batch([
      createCaseStatement,
      auditStatement,
    ]);

    const createdCase = await env.DB.prepare(`
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
        created_at AS createdAt
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first();

    if (!createdCase) {
      return json(
        { error: "The case could not be retrieved after creation." },
        500,
      );
    }

    return json(
      {
        message: "Moderation case created.",
        case: createdCase,
      },
      201,
    );
  } catch (error) {
    console.error("[cases-create]", error);

    return json(
      { error: "Unable to create moderation case." },
      500,
    );
  }
}
