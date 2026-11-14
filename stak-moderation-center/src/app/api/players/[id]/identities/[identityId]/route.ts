import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
    identityId: string;
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

  if (!hasPortalAccess(user.stakRole, "staffManager")) {
    return {
      user: null,
      response: json(
        { success: false, error: "Management permission required." },
        403,
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

async function findIdentity(
  playerId: string,
  identityId: string,
): Promise<IdentityRecord | null> {
  return env.DB.prepare(`
    SELECT
      id,
      player_id,
      game,
      game_player_id,
      game_player_name,
      created_at
    FROM player_identities
    WHERE id = ?
      AND player_id = ?
    LIMIT 1
  `)
    .bind(identityId, playerId)
    .first<IdentityRecord>();
}

/**
 * PATCH /api/players/[id]/identities/[identityId]
 *
 * Updates an existing game identity.
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

    const { id, identityId } = await context.params;

    if (!id || !identityId) {
      return json(
        { success: false, error: "Invalid identity reference." },
        400,
      );
    }

    const existing = await findIdentity(id, identityId);

    if (!existing) {
      return json(
        { success: false, error: "Game identity not found." },
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

    const updates: Array<{
      column: string;
      key: string;
      value: string | null;
    }> = [];

    if (body.game !== undefined) {
      if (typeof body.game !== "string") {
        return json(
          { success: false, error: "Game name must be text." },
          400,
        );
      }

      const value = body.game.trim().normalize("NFKC");

      if (!value || value.length > 100) {
        return json(
          { success: false, error: "Invalid game name." },
          400,
        );
      }

      if (value !== existing.game) {
        updates.push({
          column: "game",
          key: "game",
          value,
        });
      }
    }

    if (body.gamePlayerId !== undefined) {
      if (typeof body.gamePlayerId !== "string") {
        return json(
          { success: false, error: "Game player ID must be text." },
          400,
        );
      }

      const value = body.gamePlayerId.trim().normalize("NFKC");

      if (!value || value.length > 150) {
        return json(
          { success: false, error: "Invalid game player ID." },
          400,
        );
      }

      if (value !== existing.game_player_id) {
        updates.push({
          column: "game_player_id",
          key: "gamePlayerId",
          value,
        });
      }
    }

    if (body.gamePlayerName !== undefined) {
      if (
        body.gamePlayerName !== null &&
        typeof body.gamePlayerName !== "string"
      ) {
        return json(
          { success: false, error: "Game player name must be text or null." },
          400,
        );
      }

      const value =
        typeof body.gamePlayerName === "string"
          ? body.gamePlayerName.trim().normalize("NFKC") || null
          : null;

      if (value && value.length > 150) {
        return json(
          { success: false, error: "Game player name is too long." },
          400,
        );
      }

      if (value !== existing.game_player_name) {
        updates.push({
          column: "game_player_name",
          key: "gamePlayerName",
          value,
        });
      }
    }

    if (updates.length === 0) {
      return json({
        success: true,
        message: "No changes were necessary.",
        identity: existing,
      });
    }

    const game = updates.find((item) => item.key === "game")?.value
      ?? existing.game;

    const gamePlayerId =
      updates.find((item) => item.key === "gamePlayerId")?.value
      ?? existing.game_player_id;

    const duplicate = await env.DB.prepare(`
      SELECT id
      FROM player_identities
      WHERE LOWER(TRIM(game)) = LOWER(?)
        AND LOWER(TRIM(game_player_id)) = LOWER(?)
        AND id != ?
      LIMIT 1
    `)
      .bind(game, gamePlayerId, identityId)
      .first<{ id: string }>();

    if (duplicate) {
      return json(
        {
          success: false,
          error: "This game identity is already registered.",
        },
        409,
      );
    }

    const oldValues: Record<string, string | null> = {};
    const newValues: Record<string, string | null> = {};

    for (const update of updates) {
      const oldValue = existing[
        update.column as keyof IdentityRecord
      ];

      oldValues[update.key] =
        typeof oldValue === "string" ? oldValue : null;

      newValues[update.key] = update.value;
    }

    const setClause = updates
      .map((update) => `${update.column} = ?`)
      .join(", ");

    const values = updates.map((update) => update.value);
    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE player_identities
        SET ${setClause}
        WHERE id = ?
          AND player_id = ?
      `).bind(...values, identityId, id),

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
        VALUES (?, ?, 'player_identity', ?, 'identity_updated', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        authorization.user.discordUserId,
        identityId,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        now,
      ),
    ]);

    const updated = await findIdentity(id, identityId);

    return json({
      success: true,
      message: "Game identity updated successfully.",
      identity: updated,
    });
  } catch (error) {
    console.error("PATCH player identity failed:", error);

    return json(
      {
        success: false,
        error: "Unable to update game identity.",
      },
      500,
    );
  }
}

/**
 * DELETE /api/players/[id]/identities/[identityId]
 *
 * Removes a game identity.
 * A removal reason is required and logged.
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id, identityId } = await context.params;

    if (!id || !identityId) {
      return json(
        { success: false, error: "Invalid identity reference." },
        400,
      );
    }

    const existing = await findIdentity(id, identityId);

    if (!existing) {
      return json(
        { success: false, error: "Game identity not found." },
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

    if (!isRecord(body) || typeof body.reason !== "string") {
      return json(
        { success: false, error: "A removal reason is required." },
        400,
      );
    }

    const reason = body.reason.trim();

    if (!reason || reason.length > 2000) {
      return json(
        { success: false, error: "Invalid removal reason." },
        400,
      );
    }

    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM player_identities
        WHERE id = ?
          AND player_id = ?
      `).bind(identityId, id),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          old_values,
          reason,
          created_at
        )
        VALUES (?, ?, 'player_identity', ?, 'identity_removed', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        authorization.user.discordUserId,
        identityId,
        JSON.stringify(existing),
        reason,
        now,
      ),
    ]);

    return json({
      success: true,
      message: "Game identity removed successfully.",
      identityId,
    });
  } catch (error) {
    console.error("DELETE player identity failed:", error);

    return json(
      {
        success: false,
        error: "Unable to remove game identity.",
      },
      500,
    );
  }
}
