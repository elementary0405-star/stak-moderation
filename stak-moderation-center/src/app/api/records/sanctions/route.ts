/// <reference path="../../../../../.cloudflare/types/index.d.ts" />

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

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isSanctionType(value: string): value is SanctionType {
  return SANCTION_TYPES.includes(value as SanctionType);
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
 * GET /api/records/sanctions
 *
 * Sucht und lädt vorhandene Sanktionen.
 *
 * Optionale Parameter:
 * search
 * playerId
 * sanctionType
 * status
 * limit
 * offset
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authorize(
      request,
      "trailModerator",
    );

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

    const sanctionType = textValue(
      url.searchParams.get("sanctionType"),
    );

    const status = textValue(
      url.searchParams.get("status"),
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

    const allowedStatuses = [
      "active",
      "expired",
      "lifted",
      "completed",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return json(
        { error: "Invalid sanction status." },
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

        c.status,
        c.started_at AS startedAt,
        c.duration_seconds AS durationSeconds,
        c.expires_at AS expiresAt,

        c.lifted_at AS liftedAt,
        c.lifted_by_discord_id AS liftedByDiscordId,
        c.lifted_reason AS liftedReason,

        c.created_by_discord_id AS createdByDiscordId,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt

      FROM cases c

      INNER JOIN players p
        ON p.id = c.player_id

      WHERE
        c.sanction_type != 'unban'

        AND (
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
          OR c.sanction_type = ?
        )

        AND (
          ? = ''
          OR c.status = ?
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
        sanctionType,
        sanctionType,
        status,
        status,
        limit,
        offset,
      )
      .all();

    const now = Date.now();

    const sanctions = (result.results ?? []).map((item) => {
      const expiresAt =
        typeof item.expiresAt === "string"
          ? Date.parse(item.expiresAt)
          : Number.NaN;

      const isExpired =
        item.status === "active" &&
        Number.isFinite(expiresAt) &&
        expiresAt <= now;

      return {
        ...item,
        effectiveStatus: isExpired
          ? "expired"
          : item.status,
        isExpired,
      };
    });

    return json({
      sanctions,
      pagination: {
        limit,
        offset,
        returned: sanctions.length,
      },
    });
  } catch (error) {
    console.error("[sanctions-get]", error);

    return json(
      { error: "Unable to load sanctions." },
      500,
    );
  }
}

/**
 * PATCH /api/records/sanctions
 *
 * Hebt eine bestehende Sanktion auf.
 *
 * Erforderliche Angaben:
 * caseId
 * reason
 *
 * Nur Staff Manager und höhere Ränge dürfen
 * Sanktionen über diesen Endpunkt aufheben.
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const auth = await authorize(
      request,
      "staffManager",
    );

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

    const caseId = textValue(body.caseId);
    const reason = textValue(body.reason);

    if (!caseId) {
      return json(
        { error: "A case ID is required." },
        400,
      );
    }

    if (!reason || reason.length > 2000) {
      return json(
        { error: "A valid lifting reason is required." },
        400,
      );
    }

    const existingCase = await env.DB.prepare(`
      SELECT
        id,
        case_number AS caseNumber,
        player_id AS playerId,
        sanction_type AS sanctionType,
        status,
        reason AS caseReason,
        expires_at AS expiresAt
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first<{
        id: string;
        caseNumber: string;
        playerId: string;
        sanctionType: string;
        status: string;
        caseReason: string;
        expiresAt: string | null;
      }>();

    if (!existingCase) {
      return json(
        { error: "Sanction not found." },
        404,
      );
    }

    if (existingCase.sanctionType === "unban") {
      return json(
        { error: "An unban record cannot be lifted." },
        409,
      );
    }

    if (existingCase.status !== "active") {
      return json(
        {
          error: "Only active sanctions can be lifted.",
          currentStatus: existingCase.status,
        },
        409,
      );
    }

    const liftedAt = new Date().toISOString();

    const updateStatement = env.DB.prepare(`
      UPDATE cases

      SET
        status = 'lifted',
        lifted_at = ?,
        lifted_by_discord_id = ?,
        lifted_reason = ?,
        updated_at = CURRENT_TIMESTAMP

      WHERE id = ?
        AND status = 'active'
    `).bind(
      liftedAt,
      auth.user.discordUserId,
      reason,
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
        'sanction_lifted',
        ?,
        ?,
        ?
      )
    `).bind(
      crypto.randomUUID(),
      auth.user.discordUserId,
      caseId,
      JSON.stringify({
        status: existingCase.status,
        liftedAt: null,
        liftedByDiscordId: null,
        liftedReason: null,
      }),
      JSON.stringify({
        status: "lifted",
        liftedAt,
        liftedByDiscordId: auth.user.discordUserId,
        liftedReason: reason,
      }),
      reason,
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
        sanction_type AS sanctionType,
        status,
        reason,
        started_at AS startedAt,
        duration_seconds AS durationSeconds,
        expires_at AS expiresAt,
        lifted_at AS liftedAt,
        lifted_by_discord_id AS liftedByDiscordId,
        lifted_reason AS liftedReason,
        updated_at AS updatedAt
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first();

    return json({
      message: "Sanction lifted successfully.",
      sanction: updatedCase,
    });
  } catch (error) {
    console.error("[sanctions-lift]", error);

    return json(
      { error: "Unable to lift sanction." },
      500,
    );
  }
}