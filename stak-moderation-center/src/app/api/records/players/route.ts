/// <reference path="../../../../../.cloudflare/types/index.d.ts" />

import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type Env = {
  DB: D1Database;
};

type InitialCase = {
  sanctionType: string;
  reason: string;
  notes?: string | null;
  game?: string | null;
  durationSeconds?: number | null;
};

type PlayerIdentityInput = {
  game: string;
  gamePlayerId: string;
  gamePlayerName?: string | null;
};

const ALLOWED_SANCTION_TYPES = [
  "permanent_ban",
  "temporary_ban",
  "unban",
  "kick",
  "timeout",
  "warning",
  "project_exclusion",
  "other",
] as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function getEnv(): Env {
  return (globalThis as { __env?: Env }).__env as Env;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidSanctionType(
  value: string,
): value is (typeof ALLOWED_SANCTION_TYPES)[number] {
  return ALLOWED_SANCTION_TYPES.includes(
    value as (typeof ALLOWED_SANCTION_TYPES)[number],
  );
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getAuthorizedUser(
  request: Request,
): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getFreshDiscordSession>>> }
  | { response: Response }
> {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      response: json({ error: "Nicht angemeldet." }, 401),
    };
  }

  if (!hasPortalAccess(user.stakRole, "trailModerator")) {
    return {
      response: json(
        { error: "Du hast keine Berechtigung für diesen Bereich." },
        403,
      ),
    };
  }

  return { user };
}

export async function GET(request: Request): Promise<Response> {
  const authorization = await getAuthorizedUser(request);

  if ("response" in authorization) {
    return authorization.response;
  }

  const env = getEnv();
  const url = new URL(request.url);

  const search = normalizeString(url.searchParams.get("search"));
  const limitParam = Number(url.searchParams.get("limit") ?? "25");
  const offsetParam = Number(url.searchParams.get("offset") ?? "0");

  const limit = Math.min(
    Math.max(Number.isFinite(limitParam) ? limitParam : 25, 1),
    100,
  );

  const offset = Math.max(
    Number.isFinite(offsetParam) ? offsetParam : 0,
    0,
  );

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (search) {
    conditions.push(`(
      p.player_name LIKE ?
      OR p.discord_name LIKE ?
      OR p.discord_id LIKE ?
      OR p.id LIKE ?
    )`);

    const searchValue = `%${search}%`;
    values.push(searchValue, searchValue, searchValue, searchValue);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM players p
    ${whereClause}
  `)
    .bind(...values)
    .first<{ total: number }>();

  const playersResult = await env.DB.prepare(`
    SELECT
      p.id,
      p.player_name AS playerName,
      p.discord_name AS discordName,
      p.discord_id AS discordId,
      p.internal_notes AS internalNotes,
      p.created_by AS createdBy,
      p.created_by_discord_id AS createdByDiscordId,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM cases c
        WHERE c.player_id = p.id
      ) AS caseCount,
      (
        SELECT COUNT(*)
        FROM cases c
        WHERE c.player_id = p.id
          AND c.status = 'active'
      ) AS activeCaseCount
    FROM players p
    ${whereClause}
    ORDER BY p.updated_at DESC
    LIMIT ?
    OFFSET ?
  `)
    .bind(...values, limit, offset)
    .all();

  const players = playersResult.results ?? [];
  const playerIds = players
    .map((player) => (player as { id: string }).id)
    .filter(Boolean);

  let identities: Record<string, unknown[]> = {};

  if (playerIds.length > 0) {
    const placeholders = playerIds.map(() => "?").join(",");

    const identityResult = await env.DB.prepare(`
      SELECT
        id,
        player_id AS playerId,
        game,
        game_player_id AS gamePlayerId,
        game_player_name AS gamePlayerName,
        created_at AS createdAt
      FROM player_identities
      WHERE player_id IN (${placeholders})
      ORDER BY game ASC
    `)
      .bind(...playerIds)
      .all();

    for (const identity of identityResult.results ?? []) {
      const item = identity as {
        playerId: string;
      };

      if (!identities[item.playerId]) {
        identities[item.playerId] = [];
      }

      identities[item.playerId].push(identity);
    }
  }

  const playersWithIdentities = players.map((player) => {
    const item = player as { id: string };

    return {
      ...player,
      identities: identities[item.id] ?? [],
    };
  });

  return json({
    players: playersWithIdentities,
    pagination: {
      total: countResult?.total ?? 0,
      limit,
      offset,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const authorization = await getAuthorizedUser(request);

  if ("response" in authorization) {
    return authorization.response;
  }

  const user = authorization.user;
  const env = getEnv();

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const playerName = normalizeString(body.playerName);
  const discordName = normalizeString(body.discordName);
  const discordId = normalizeString(body.discordId);
  const internalNotes = normalizeString(body.internalNotes);

  if (!playerName) {
    return json(
      { error: "Bitte gib einen Spielernamen an." },
      400,
    );
  }

  const initialCaseInput = body.initialCase as
    | InitialCase
    | null
    | undefined;

  if (!initialCaseInput || typeof initialCaseInput !== "object") {
    return json(
      {
        error:
          "Beim Anlegen eines Spielers muss ein erster Akteneintrag erstellt werden.",
      },
      400,
    );
  }

  const sanctionType = normalizeString(initialCaseInput.sanctionType);
  const reason = normalizeString(initialCaseInput.reason);
  const caseNotes = normalizeString(initialCaseInput.notes);
  const game = normalizeString(initialCaseInput.game);

  const durationSeconds =
    typeof initialCaseInput.durationSeconds === "number"
      ? initialCaseInput.durationSeconds
      : null;

  if (!sanctionType || !isValidSanctionType(sanctionType)) {
    return json(
      { error: "Bitte wähle eine gültige Sanktionsart aus." },
      400,
    );
  }

  if (!reason) {
    return json(
      { error: "Bitte gib einen Grund für den Akteneintrag an." },
      400,
    );
  }

  if (
    (sanctionType === "temporary_ban" || sanctionType === "timeout") &&
    (!durationSeconds ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0)
  ) {
    return json(
      {
        error:
          "Für einen temporären Bann oder Timeout muss eine gültige Dauer angegeben werden.",
      },
      400,
    );
  }

  const identitiesInput = Array.isArray(body.identities)
    ? (body.identities as PlayerIdentityInput[])
    : [];

  const identities: {
    game: string;
    gamePlayerId: string;
    gamePlayerName: string | null;
  }[] = [];

  for (const identity of identitiesInput) {
    const identityGame = normalizeString(identity.game);
    const gamePlayerId = normalizeString(identity.gamePlayerId);
    const gamePlayerName = normalizeString(identity.gamePlayerName);

    if (!identityGame || !gamePlayerId) {
      return json(
        {
          error:
            "Jede Spielidentität benötigt ein Spiel und eine Kennung.",
        },
        400,
      );
    }

    identities.push({
      game: identityGame,
      gamePlayerId,
      gamePlayerName,
    });
  }

  if (discordId) {
    const existingDiscordPlayer = await env.DB.prepare(`
      SELECT id, player_name AS playerName
      FROM players
      WHERE discord_id = ?
      LIMIT 1
    `)
      .bind(discordId)
      .first<{
        id: string;
        playerName: string;
      }>();

    if (existingDiscordPlayer) {
      return json(
        {
          error: "Diese Discord-Kennung ist bereits einem Spieler zugeordnet.",
          existingPlayer: existingDiscordPlayer,
        },
        409,
      );
    }
  }

  for (const identity of identities) {
    const existingIdentity = await env.DB.prepare(`
      SELECT
        pi.id,
        pi.player_id AS playerId,
        p.player_name AS playerName
      FROM player_identities pi
      INNER JOIN players p ON p.id = pi.player_id
      WHERE pi.game = ?
        AND pi.game_player_id = ?
      LIMIT 1
    `)
      .bind(identity.game, identity.gamePlayerId)
      .first<{
        id: string;
        playerId: string;
        playerName: string;
      }>();

    if (existingIdentity) {
      return json(
        {
          error: `Diese Kennung ist für ${identity.game} bereits einem Spieler zugeordnet.`,
          existingPlayer: existingIdentity,
        },
        409,
      );
    }
  }

  const playerId = generateId();
  const caseId = generateId();
  const currentDate = new Date();
  const year = currentDate.getFullYear();

  const expiresAt =
    durationSeconds !== null &&
    (sanctionType === "temporary_ban" || sanctionType === "timeout")
      ? new Date(
          currentDate.getTime() + durationSeconds * 1000,
        ).toISOString()
      : null;

  const caseNumberResult = await env.DB.prepare(`
    SELECT
      COALESCE(
        MAX(CAST(substr(case_number, 11) AS INTEGER)),
        0
      ) AS lastNumber
    FROM cases
    WHERE case_number LIKE ?
  `)
    .bind(`STAK-${year}-%`)
    .first<{ lastNumber: number }>();

  const nextNumber = (caseNumberResult?.lastNumber ?? 0) + 1;
  const caseNumber = `STAK-${year}-${String(nextNumber).padStart(5, "0")}`;

  const statements: D1PreparedStatement[] = [];

  statements.push(
    env.DB.prepare(`
      INSERT INTO players (
        id,
        player_name,
        discord_name,
        discord_id,
        internal_notes,
        created_by_discord_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      playerId,
      playerName,
      discordName,
      discordId,
      internalNotes,
      user.discordUserId,
    ),
  );

  for (const identity of identities) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO player_identities (
          id,
          player_id,
          game,
          game_player_id,
          game_player_name
        )
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        generateId(),
        playerId,
        identity.game,
        identity.gamePlayerId,
        identity.gamePlayerName,
      ),
    );
  }

  statements.push(
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
        created_by_discord_id
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?
      )
    `).bind(
      caseId,
      caseNumber,
      playerId,
      game,
      sanctionType,
      reason,
      caseNotes,
      currentDate.toISOString(),
      durationSeconds,
      expiresAt,
      user.discordUserId,
    ),
  );

  statements.push(
    env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        new_values,
        reason
      )
      VALUES (?, ?, 'player', ?, 'created', ?, ?)
    `).bind(
      generateId(),
      user.discordUserId,
      playerId,
      JSON.stringify({
        playerName,
        discordName,
        discordId,
        internalNotes,
        identities,
      }),
      "Spieler wurde angelegt.",
    ),
  );

  statements.push(
    env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        new_values,
        reason
      )
      VALUES (?, ?, 'case', ?, 'created', ?, ?)
    `).bind(
      generateId(),
      user.discordUserId,
      caseId,
      JSON.stringify({
        caseNumber,
        playerId,
        game,
        sanctionType,
        reason,
        notes: caseNotes,
        durationSeconds,
        expiresAt,
      }),
      "Erster Akteneintrag beim Anlegen des Spielers.",
    ),
  );

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error("Fehler beim Anlegen des Spielers:", error);

    return json(
      {
        error:
          "Der Spieler konnte nicht angelegt werden. Bitte überprüfe die Angaben und versuche es erneut.",
      },
      500,
    );
  }

  return json(
    {
      success: true,
      player: {
        id: playerId,
        playerName,
        discordName,
        discordId,
        internalNotes,
        identities,
      },
      case: {
        id: caseId,
        caseNumber,
        playerId,
        game,
        sanctionType,
        reason,
        notes: caseNotes,
        status: "active",
        startedAt: currentDate.toISOString(),
        durationSeconds,
        expiresAt,
      },
    },
    201,
  );
}