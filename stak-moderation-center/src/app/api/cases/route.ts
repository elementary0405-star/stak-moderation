import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

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

const CASE_STATUSES = [
  "active",
  "expired",
  "lifted",
  "completed",
] as const;

type SanctionType = (typeof SANCTION_TYPES)[number];

type CaseRecord = {
  id: string;
  case_number: string;
  player_id: string;
  player_name: string;
  discord_name: string | null;
  discord_id: string | null;
  game: string | null;
  sanction_type: SanctionType;
  reason: string;
  notes: string | null;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  expires_at: string | null;
  created_by_discord_id: string | null;
  created_at: string;
  updated_at: string;
};

type CaseInput = {
  playerId?: unknown;
  game?: unknown;
  sanctionType?: unknown;
  reason?: unknown;
  notes?: unknown;
  startedAt?: unknown;
  durationSeconds?: unknown;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function authorize(request: Request) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json(
        { success: false, error: "Authentication required." },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, "trailModerator")) {
    return {
      user: null,
      response: json(
        { success: false, error: "You do not have permission." },
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
 * GET /api/cases
 *
 * Search and retrieve moderation cases.
 *
 * Query parameters:
 * - search
 * - playerId
 * - status
 * - sanctionType
 * - limit
 * - offset
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const url = new URL(request.url);

    const search = (url.searchParams.get("search") ?? "").trim();
    const playerId = url.searchParams.get("playerId");
    const status = url.searchParams.get("status");
    const sanctionType = url.searchParams.get("sanctionType");

    const requestedLimit = Number(
      url.searchParams.get("limit") ?? "25",
    );

    const requestedOffset = Number(
      url.searchParams.get("offset") ?? "0",
    );

    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 25;

    const offset = Number.isInteger(requestedOffset)
      ? Math.max(requestedOffset, 0)
      : 0;

    if (
      status &&
      !CASE_STATUSES.includes(
        status as (typeof CASE_STATUSES)[number],
      )
    ) {
      return json(
        { success: false, error: "Invalid case status." },
        400,
      );
    }

    if (
      sanctionType &&
      !SANCTION_TYPES.includes(sanctionType as SanctionType)
    ) {
      return json(
        { success: false, error: "Invalid sanction type." },
        400,
      );
    }

    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (search) {
      const pattern = `%${escapeLike(search)}%`;

      conditions.push(`(
        c.case_number LIKE ? ESCAPE '\\'
        OR p.player_name LIKE ? ESCAPE '\\'
        OR p.discord_name LIKE ? ESCAPE '\\'
        OR p.discord_id LIKE ? ESCAPE '\\'
      )`);

      parameters.push(pattern, pattern, pattern, pattern);
    }

    if (playerId) {
      conditions.push("c.player_id = ?");
      parameters.push(playerId);
    }

    if (status) {
      conditions.push("(CASE WHEN c.status = 'lifted' OR EXISTS (SELECT 1 FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted') THEN 'lifted' ELSE c.status END) = ?");
      parameters.push(status);
    }

    if (sanctionType) {
      conditions.push("c.sanction_type = ?");
      parameters.push(sanctionType);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const recordsQuery = env.DB.prepare(`
      SELECT
        c.id,
        c.case_number,
        c.player_id,
        p.player_name,
        p.discord_name,
        p.discord_id,
        c.game,
        c.sanction_type,
        c.reason,
        c.notes,
        CASE WHEN c.status = 'lifted' OR EXISTS (SELECT 1 FROM sanction_events se WHERE se.case_id = c.id AND se.event_type = 'lifted') THEN 'lifted' ELSE c.status END AS status,
        c.started_at,
        c.duration_seconds,
        c.expires_at,
        c.created_by_discord_id,
        c.created_at,
        c.updated_at
      FROM cases c
      INNER JOIN players p ON p.id = c.player_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ?
      OFFSET ?
    `).bind(...parameters, limit, offset);

    const countQuery = env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM cases c
      INNER JOIN players p ON p.id = c.player_id
      ${whereClause}
    `).bind(...parameters);

    const [recordsResult, countResult] = await Promise.all([
      recordsQuery.all<CaseRecord>(),
      countQuery.first<{ total: number }>(),
    ]);

    return json({
      success: true,
      cases: recordsResult.results ?? [],
      pagination: {
        total: countResult?.total ?? 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("GET /api/cases failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve moderation cases.",
      },
      500,
    );
  }
}

/**
 * POST /api/cases
 *
 * Creates a new moderation case and automatically generates
 * a unique case number.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, error: "Invalid JSON request." },
        400,
      );
    }

    if (!isRecord(body)) {
      return json(
        { success: false, error: "Invalid request data." },
        400,
      );
    }

    const input = body as CaseInput;

    const playerId =
      typeof input.playerId === "string"
        ? input.playerId.trim()
        : "";

    const sanctionType =
      typeof input.sanctionType === "string"
        ? input.sanctionType
        : "";

    const reason =
      typeof input.reason === "string"
        ? input.reason.trim()
        : "";

    const game =
      typeof input.game === "string"
        ? input.game.trim() || null
        : null;

    const notes =
      typeof input.notes === "string"
        ? input.notes.trim() || null
        : null;

    if (!playerId || playerId.length > 100) {
      return json(
        { success: false, error: "A valid player ID is required." },
        400,
      );
    }

    if (!SANCTION_TYPES.includes(sanctionType as SanctionType)) {
      return json(
        { success: false, error: "Invalid sanction type." },
        400,
      );
    }

    if (!reason || reason.length > 5000) {
      return json(
        {
          success: false,
          error: "Reason must contain between 1 and 5000 characters.",
        },
        400,
      );
    }

    if (game && game.length > 100) {
      return json(
        { success: false, error: "Game name is too long." },
        400,
      );
    }

    if (notes && notes.length > 10000) {
      return json(
        { success: false, error: "Notes must not exceed 10000 characters." },
        400,
      );
    }

    const selectedType = sanctionType as SanctionType;

    let startedAt = new Date().toISOString();

    if (input.startedAt !== undefined) {
      if (typeof input.startedAt !== "string") {
        return json(
          { success: false, error: "Invalid start date." },
          400,
        );
      }

      const parsedStartDate = new Date(input.startedAt);

      if (Number.isNaN(parsedStartDate.getTime())) {
        return json(
          { success: false, error: "Invalid start date." },
          400,
        );
      }

      startedAt = parsedStartDate.toISOString();
    }

    let durationSeconds: number | null = null;
    let expiresAt: string | null = null;

    if (input.durationSeconds !== undefined && input.durationSeconds !== null) {
      const duration = Number(input.durationSeconds);

      if (
        !Number.isSafeInteger(duration) ||
        duration <= 0 ||
        duration > 315360000
      ) {
        return json(
          {
            success: false,
            error: "Duration must be a positive whole number of seconds.",
          },
          400,
        );
      }

      durationSeconds = duration;
    }

    if (selectedType === "temporary_ban" && durationSeconds === null) {
      return json(
        {
          success: false,
          error: "A duration is required for temporary bans.",
        },
        400,
      );
    }

    if (
      selectedType !== "temporary_ban" &&
      selectedType !== "timeout" &&
      durationSeconds !== null
    ) {
      return json(
        {
          success: false,
          error: "A duration is only supported for temporary bans and timeouts.",
        },
        400,
      );
    }

    if (durationSeconds !== null) {
      expiresAt = new Date(
        new Date(startedAt).getTime() + durationSeconds * 1000,
      ).toISOString();
    }

    const player = await env.DB.prepare(`
      SELECT id, player_name
      FROM players
      WHERE id = ?
      LIMIT 1
    `)
      .bind(playerId)
      .first<{ id: string; player_name: string }>();

    if (!player) {
      return json(
        { success: false, error: "Player record not found." },
        404,
      );
    }

    const year = new Date().getUTCFullYear();

    const counter = await env.DB.prepare(`
      INSERT INTO case_counters (year, last_number)
      VALUES (?, 1)
      ON CONFLICT(year)
      DO UPDATE SET last_number = last_number + 1
      RETURNING last_number
    `)
      .bind(year)
      .first<{ last_number: number }>();

    if (!counter) {
      throw new Error("Unable to allocate a case number.");
    }

    const caseNumber =
      `STAK-${year}-${String(counter.last_number).padStart(5, "0")}`;

    const caseId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`
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
          created_by_discord_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `).bind(
        caseId,
        caseNumber,
        playerId,
        game,
        selectedType,
        reason,
        notes,
        startedAt,
        durationSeconds,
        expiresAt,
        authorization.user.discordUserId,
        now,
        now,
      ),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          new_values,
          created_at
        )
        VALUES (?, ?, 'case', ?, 'case_created', ?, ?)
      `).bind(
        auditId,
        authorization.user.discordUserId,
        caseId,
        JSON.stringify({
          caseNumber,
          playerId,
          sanctionType: selectedType,
          reason,
          startedAt,
          durationSeconds,
          expiresAt,
        }),
        now,
      ),
    ]);

    return json(
      {
        success: true,
        message: "Moderation case created successfully.",
        case: {
          id: caseId,
          caseNumber,
          playerId,
          playerName: player.player_name,
          game,
          sanctionType: selectedType,
          reason,
          notes,
          status: "active",
          startedAt,
          durationSeconds,
          expiresAt,
          createdByDiscordId: authorization.user.discordUserId,
          createdAt: now,
          updatedAt: now,
        },
      },
      201,
    );
  } catch (error) {
    console.error("POST /api/cases failed:", error);

    return json(
      {
        success: false,
        error: "Unable to create the moderation case.",
      },
      500,
    );
  }
}
