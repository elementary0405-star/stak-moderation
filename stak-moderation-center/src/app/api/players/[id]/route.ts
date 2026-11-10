import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

type PlayerIdentity = {
  id: string;
  game: string;
  game_player_id: string;
  game_player_name: string | null;
  created_at: string;
};

type ModerationCase = {
  id: string;
  case_number: string;
  game: string | null;
  sanction_type: string;
  reason: string;
  notes: string | null;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_reason: string | null;
  created_by_discord_id: string | null;
  created_at: string;
  updated_at: string;
};

type PlayerInput = {
  playerName?: unknown;
  discordName?: unknown;
  discordId?: unknown;
  internalNotes?: unknown;
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
        {
          success: false,
          error: "Authentication required.",
        },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, "trailModerator")) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: "You do not have permission to access player records.",
        },
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
 * GET /api/players/[id]
 *
 * Returns a player profile, associated game identities
 * and the player's moderation history.
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
        {
          success: false,
          error: "Invalid player ID.",
        },
        400,
      );
    }

    const player = await env.DB.prepare(`
      SELECT
        id,
        player_name,
        discord_name,
        discord_id,
        internal_notes,
        created_by_discord_id,
        created_at,
        updated_at
      FROM players
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first<PlayerRecord>();

    if (!player) {
      return json(
        {
          success: false,
          error: "Player record not found.",
        },
        404,
      );
    }

    const [identityResult, caseResult] = await Promise.all([
      env.DB.prepare(`
        SELECT
          id,
          game,
          game_player_id,
          game_player_name,
          created_at
        FROM player_identities
        WHERE player_id = ?
        ORDER BY created_at DESC
      `)
        .bind(id)
        .all<PlayerIdentity>(),

      env.DB.prepare(`
        SELECT
          id,
          case_number,
          game,
          sanction_type,
          reason,
          notes,
          status,
          started_at,
          duration_seconds,
          expires_at,
          lifted_at,
          lifted_reason,
          created_by_discord_id,
          created_at,
          updated_at
        FROM cases
        WHERE player_id = ?
        ORDER BY created_at DESC
      `)
        .bind(id)
        .all<ModerationCase>(),
    ]);

    return json({
      success: true,
      player,
      identities: identityResult.results ?? [],
      cases: caseResult.results ?? [],
      summary: {
        totalIdentities: identityResult.results?.length ?? 0,
        totalCases: caseResult.results?.length ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/players/[id] failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve the player profile.",
      },
      500,
    );
  }
}

/**
 * PATCH /api/players/[id]
 *
 * Updates permitted player information.
 * All changes are recorded in the audit log.
 */
export async function PATCH(
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
        {
          success: false,
          error: "Invalid player ID.",
        },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          success: false,
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    if (!isRecord(body)) {
      return json(
        {
          success: false,
          error: "Invalid request data.",
        },
        400,
      );
    }

    const input = body as PlayerInput;

    const existingPlayer = await env.DB.prepare(`
      SELECT
        id,
        player_name,
        discord_name,
        discord_id,
        internal_notes,
        created_by_discord_id,
        created_at,
        updated_at
      FROM players
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first<PlayerRecord>();

    if (!existingPlayer) {
      return json(
        {
          success: false,
          error: "Player record not found.",
        },
        404,
      );
    }

    const updates: Array<{
      column: string;
      value: string | null;
      key: string;
    }> = [];

    if (input.playerName !== undefined) {
      if (typeof input.playerName !== "string") {
        return json(
          {
            success: false,
            error: "Player name must be text.",
          },
          400,
        );
      }

      const value = input.playerName.trim();

      if (!value || value.length > 100) {
        return json(
          {
            success: false,
            error: "Player name must contain between 1 and 100 characters.",
          },
          400,
        );
      }

      if (value !== existingPlayer.player_name) {
        updates.push({
          column: "player_name",
          value,
          key: "playerName",
        });
      }
    }

    if (input.discordName !== undefined) {
      if (
        input.discordName !== null &&
        typeof input.discordName !== "string"
      ) {
        return json(
          {
            success: false,
            error: "Discord name must be text or null.",
          },
          400,
        );
      }

      const value =
        typeof input.discordName === "string"
          ? input.discordName.trim() || null
          : null;

      if (value && value.length > 100) {
        return json(
          {
            success: false,
            error: "Discord name must not exceed 100 characters.",
          },
          400,
        );
      }

      if (value !== existingPlayer.discord_name) {
        updates.push({
          column: "discord_name",
          value,
          key: "discordName",
        });
      }
    }

    if (input.discordId !== undefined) {
      if (
        input.discordId !== null &&
        typeof input.discordId !== "string"
      ) {
        return json(
          {
            success: false,
            error: "Discord ID must be text or null.",
          },
          400,
        );
      }

      const value =
        typeof input.discordId === "string"
          ? input.discordId.trim() || null
          : null;

      if (value && !/^\d{17,20}$/.test(value)) {
        return json(
          {
            success: false,
            error: "The Discord ID is invalid.",
          },
          400,
        );
      }

      if (value && value !== existingPlayer.discord_id) {
        const duplicate = await env.DB.prepare(`
          SELECT id
          FROM players
          WHERE discord_id = ?
            AND id != ?
          LIMIT 1
        `)
          .bind(value, id)
          .first<{ id: string }>();

        if (duplicate) {
          return json(
            {
              success: false,
              error: "Another player already uses this Discord ID.",
            },
            409,
          );
        }
      }

      if (value !== existingPlayer.discord_id) {
        updates.push({
          column: "discord_id",
          value,
          key: "discordId",
        });
      }
    }

    if (input.internalNotes !== undefined) {
      if (
        input.internalNotes !== null &&
        typeof input.internalNotes !== "string"
      ) {
        return json(
          {
            success: false,
            error: "Internal notes must be text or null.",
          },
          400,
        );
      }

      const value =
        typeof input.internalNotes === "string"
          ? input.internalNotes.trim() || null
          : null;

      if (value && value.length > 5000) {
        return json(
          {
            success: false,
            error: "Internal notes must not exceed 5000 characters.",
          },
          400,
        );
      }

      if (value !== existingPlayer.internal_notes) {
        updates.push({
          column: "internal_notes",
          value,
          key: "internalNotes",
        });
      }
    }

    if (updates.length === 0) {
      return json({
        success: true,
        message: "No changes were necessary.",
        player: existingPlayer,
      });
    }

    const now = new Date().toISOString();

    const setClause = updates
      .map((update) => `${update.column} = ?`)
      .join(", ");

    const values = updates.map((update) => update.value);

    const oldValues: Record<string, string | null> = {};
    const newValues: Record<string, string | null> = {};

    for (const update of updates) {
      const existingValue = existingPlayer[
        update.column as keyof PlayerRecord
      ];

      oldValues[update.key] =
        typeof existingValue === "string"
          ? existingValue
          : null;

      newValues[update.key] = update.value;
    }

    const auditId = crypto.randomUUID();

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE players
        SET ${setClause},
            updated_at = ?
        WHERE id = ?
      `).bind(...values, now, id),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          old_values,
          new_values,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        auditId,
        authorization.user.discordUserId,
        "player",
        id,
        "player_updated",
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        now,
      ),
    ]);

    const updatedPlayer = await env.DB.prepare(`
      SELECT
        id,
        player_name,
        discord_name,
        discord_id,
        internal_notes,
        created_by_discord_id,
        created_at,
        updated_at
      FROM players
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first<PlayerRecord>();

    return json({
      success: true,
      message: "Player record updated successfully.",
      player: updatedPlayer,
    });
  } catch (error) {
    console.error("PATCH /api/players/[id] failed:", error);

    return json(
      {
        success: false,
        error: "Unable to update the player record.",
      },
      500,
    );
  }
}