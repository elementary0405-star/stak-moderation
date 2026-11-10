import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type IdentityRecord = {
  id: string;
  player_id: string;
  game: string;
  game_player_id: string;
  game_player_name: string | null;
  created_at: string;
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

async function playerExists(playerId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT id
    FROM players
    WHERE id = ?
    LIMIT 1
  `)
    .bind(playerId)
    .first<{ id: string }>();

  return Boolean(result);
}

/**
 * GET /api/players/[id]/identities
 *
 * Returns all game identities associated with a player.
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        { success: false, error: "Invalid player ID." },
        400,
      );
    }

    if (!(await playerExists(id))) {
      return json(
        { success: false, error: "Player record not found." },
        404,
      );
    }

    const result = await env.DB.prepare(`
      SELECT
        id,
        player_id,
        game,
        game_player_id,
        game_player_name,
        created_at
      FROM player_identities
      WHERE player_id = ?
      ORDER BY created_at DESC
    `)
      .bind(id)
      .all<IdentityRecord>();

    return json({
      success: true,
      identities: result.results ?? [],
      total: result.results?.length ?? 0,
    });
  } catch (error) {
    console.error("GET player identities failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve game identities.",
      },
      500,
    );
  }
}

/**
 * POST /api/players/[id]/identities
 *
 * Adds a new game identity to an existing player.
 *
 * Required:
 * - game
 * - gamePlayerId
 *
 * Optional:
 * - gamePlayerName
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        { success: false, error: "Invalid player ID." },
        400,
      );
    }

    if (!(await playerExists(id))) {
      return json(
        { success: false, error: "Player record not found." },
        404,
      );
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

    const game =
      typeof body.game === "string"
        ? body.game.trim()
        : "";

    const gamePlayerId =
      typeof body.gamePlayerId === "string"
        ? body.gamePlayerId.trim()
        : "";

    const gamePlayerName =
      typeof body.gamePlayerName === "string"
        ? body.gamePlayerName.trim() || null
        : null;

    if (!game || game.length > 100) {
      return json(
        {
          success: false,
          error: "Game name must contain between 1 and 100 characters.",
        },
        400,
      );
    }

    if (!gamePlayerId || gamePlayerId.length > 150) {
      return json(
        {
          success: false,
          error: "Game player ID must contain between 1 and 150 characters.",
        },
        400,
      );
    }

    if (gamePlayerName && gamePlayerName.length > 150) {
      return json(
        {
          success: false,
          error: "Game player name must not exceed 150 characters.",
        },
        400,
      );
    }

    const duplicate = await env.DB.prepare(`
      SELECT
        pi.id,
        pi.player_id,
        p.player_name
      FROM player_identities pi
      INNER JOIN players p ON p.id = pi.player_id
      WHERE LOWER(pi.game) = LOWER(?)
        AND pi.game_player_id = ?
      LIMIT 1
    `)
      .bind(game, gamePlayerId)
      .first<{
        id: string;
        player_id: string;
        player_name: string;
      }>();

    if (duplicate) {
      return json(
        {
          success: false,
          error: "This game identity is already registered.",
          alreadyAssignedToThisPlayer: duplicate.player_id === id,
        },
        409,
      );
    }

    const identityId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();

    const identity = {
      id: identityId,
      playerId: id,
      game,
      gamePlayerId,
      gamePlayerName,
      createdAt: now,
    };

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO player_identities (
          id,
          player_id,
          game,
          game_player_id,
          game_player_name,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        identity.id,
        identity.playerId,
        identity.game,
        identity.gamePlayerId,
        identity.gamePlayerName,
        identity.createdAt,
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
        VALUES (?, ?, 'player_identity', ?, 'identity_created', ?, ?)
      `).bind(
        auditId,
        authorization.user.discordUserId,
        identityId,
        JSON.stringify({
          playerId: id,
          game,
          gamePlayerId,
          gamePlayerName,
        }),
        now,
      ),
    ]);

    return json(
      {
        success: true,
        message: "Game identity added successfully.",
        identity,
      },
      201,
    );
  } catch (error) {
    console.error("POST player identity failed:", error);

    return json(
      {
        success: false,
        error: "Unable to add game identity.",
      },
      500,
    );
  }
}