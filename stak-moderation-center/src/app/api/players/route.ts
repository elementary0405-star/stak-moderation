import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type PlayerRecord = {
  id: string;
  player_name: string;
  discord_name: string | null;
  discord_id: string | null;
  internal_notes: string | null;
  created_by_discord_id: string | null;
  created_at: string;
  updated_at: string;
};

type PlayerInput = {
  playerName?: unknown;
  discordName?: unknown;
  discordId?: unknown;
  internalNotes?: unknown;
  identities?: unknown;
};

function json(
  data: unknown,
  status = 200,
): Response {
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

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * GET /api/players
 *
 * Returns a searchable list of player records.
 *
 * Query parameters:
 * - search: Search by player name, Discord name or Discord ID.
 * - limit: Maximum number of results (1-100).
 * - offset: Pagination offset.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const url = new URL(request.url);

    const search = (url.searchParams.get("search") ?? "").trim();

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

    const pattern = search
      ? `%${escapeLike(search)}%`
      : null;

    const recordsQuery = env.DB.prepare(`
      SELECT
        p.id,
        p.player_name,
        p.discord_name,
        p.discord_id,
        p.internal_notes,
        p.created_by_discord_id,
        p.created_at,
        p.updated_at
      FROM players p
      WHERE
        (
          ? IS NULL
          OR p.player_name LIKE ? ESCAPE '\\'
          OR p.discord_name LIKE ? ESCAPE '\\'
          OR p.discord_id LIKE ? ESCAPE '\\'
          OR EXISTS (
            SELECT 1
            FROM player_identities pi
            WHERE pi.player_id = p.id
              AND (
                pi.game_player_id LIKE ? ESCAPE '\\'
                OR pi.game_player_name LIKE ? ESCAPE '\\'
              )
          )
        )
      ORDER BY p.updated_at DESC
      LIMIT ?
      OFFSET ?
    `).bind(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      limit,
      offset,
    );

    const countQuery = env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM players p
      WHERE
        (
          ? IS NULL
          OR p.player_name LIKE ? ESCAPE '\\'
          OR p.discord_name LIKE ? ESCAPE '\\'
          OR p.discord_id LIKE ? ESCAPE '\\'
          OR EXISTS (
            SELECT 1
            FROM player_identities pi
            WHERE pi.player_id = p.id
              AND (
                pi.game_player_id LIKE ? ESCAPE '\\'
                OR pi.game_player_name LIKE ? ESCAPE '\\'
              )
          )
        )
    `).bind(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
    );

    const [recordsResult, countResult] = await Promise.all([
      recordsQuery.all<PlayerRecord>(),
      countQuery.first<{ total: number }>(),
    ]);

    return json({
      success: true,
      players: recordsResult.results ?? [],
      pagination: {
        total: countResult?.total ?? 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("GET /api/players failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve player records.",
      },
      500,
    );
  }
}

/**
 * POST /api/players
 *
 * Creates a new player record.
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

    const input = body as PlayerInput;

    const playerName =
      typeof input.playerName === "string"
        ? input.playerName.trim()
        : "";

    const discordName =
      typeof input.discordName === "string"
        ? input.discordName.trim()
        : null;

    const discordId =
      typeof input.discordId === "string"
        ? input.discordId.trim()
        : null;

    const internalNotes =
      typeof input.internalNotes === "string"
        ? input.internalNotes.trim()
        : null;

    if (!playerName) {
      return json(
        {
          success: false,
          error: "A player name is required.",
        },
        400,
      );
    }

    if (playerName.length > 100) {
      return json(
        {
          success: false,
          error: "Player name must not exceed 100 characters.",
        },
        400,
      );
    }

    if (discordName && discordName.length > 100) {
      return json(
        {
          success: false,
          error: "Discord name must not exceed 100 characters.",
        },
        400,
      );
    }

    if (
      discordId &&
      (!/^\d{17,20}$/.test(discordId))
    ) {
      return json(
        {
          success: false,
          error: "The Discord ID is invalid.",
        },
        400,
      );
    }

    if (internalNotes && internalNotes.length > 5000) {
      return json(
        {
          success: false,
          error: "Internal notes must not exceed 5000 characters.",
        },
        400,
      );
    }

    const rawIdentities = Array.isArray(input.identities) ? input.identities : [];
    const identityKeys = new Set<string>();
    const identities = rawIdentities.map((value) => {
      if (!isRecord(value)) return null;
      const game = typeof value.game === "string" ? value.game.trim().normalize("NFKC") : "";
      const gamePlayerId = typeof value.gamePlayerId === "string" ? value.gamePlayerId.trim().normalize("NFKC") : "";
      const gamePlayerName = typeof value.gamePlayerName === "string" ? value.gamePlayerName.trim() || null : null;
      if (!game || game.length > 100 || !gamePlayerId || gamePlayerId.length > 150 || (gamePlayerName && gamePlayerName.length > 150)) return null;
      const identityKey = `${game.toLocaleLowerCase("en")}\u0000${gamePlayerId.toLocaleLowerCase("en")}`;
      if (identityKeys.has(identityKey)) return null;
      identityKeys.add(identityKey);
      return { game, gamePlayerId, gamePlayerName };
    });
    if (!identities.length || identities.some((identity) => identity === null)) {
      return json({ success: false, error: "At least one valid Game Name and Player ID is required." }, 400);
    }
    for (const identity of identities) {
      if (!identity) continue;
      const existingIdentity = await env.DB.prepare(`SELECT pi.id, pi.player_id AS playerId, p.player_name AS playerName FROM player_identities pi JOIN players p ON p.id = pi.player_id WHERE lower(trim(pi.game)) = lower(?) AND lower(trim(pi.game_player_id)) = lower(?) LIMIT 1`)
        .bind(identity.game, identity.gamePlayerId).first<{ id: string; playerId: string; playerName: string }>();
      if (existingIdentity) return json({ success: false, error: "This normalized game identity is already registered.", existingPlayer: existingIdentity }, 409);
    }

    const playerId = crypto.randomUUID();

    const player = {
      id: playerId,
      playerName,
      discordName: discordName || null,
      discordId: discordId || null,
      internalNotes: internalNotes || null,
      createdByDiscordId: authorization.user.discordUserId,
    };

    const auditId = crypto.randomUUID();

    const now = new Date().toISOString();

    const statements: D1PreparedStatement[] = [
      env.DB.prepare(`
        INSERT INTO players (
          id,
          player_name,
          discord_name,
          discord_id,
          internal_notes,
          created_by_discord_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        player.id,
        player.playerName,
        player.discordName,
        player.discordId,
        player.internalNotes,
        player.createdByDiscordId,
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
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        auditId,
        authorization.user.discordUserId,
        "player",
        playerId,
        "player_created",
        JSON.stringify({
          playerName,
          discordName: player.discordName,
          discordId: player.discordId,
        }),
        now,
      ),
    ];
    for (const identity of identities) {
      if (!identity) continue;
      statements.push(env.DB.prepare(`INSERT INTO player_identities (id, player_id, game, game_player_id, game_player_name, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), playerId, identity.game, identity.gamePlayerId, identity.gamePlayerName, now));
    }
    await env.DB.batch(statements);

    return json(
      {
        success: true,
        message: "Player record created successfully.",
        player: {
          id: player.id,
          playerName: player.playerName,
          discordName: player.discordName,
          discordId: player.discordId,
          identities: identities.filter((identity): identity is NonNullable<typeof identity> => identity !== null),
          internalNotes: player.internalNotes,
          createdByDiscordId: player.createdByDiscordId,
          createdAt: now,
          updatedAt: now,
        },
      },
      201,
    );
  } catch (error) {
    console.error("POST /api/players failed:", error);

    return json(
      {
        success: false,
        error: "Unable to create the player record.",
      },
      500,
    );
  }
}
