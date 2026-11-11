import { guard, json, errorResponse, readJson, db, newId, audit, stringValue, nullableString } from "@/lib/http";
const TYPES = ["permanent_ban","temporary_ban","unban","kick","timeout","warning","project_exclusion","other"];
export async function GET(request: Request) {
  const { response } = await guard(request, "trailModerator"); if (response) return response;
  const url = new URL(request.url); const search = (url.searchParams.get("search") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 100); const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  const q = `%${search}%`;
  const result = await db().prepare(`SELECT p.*, (SELECT COUNT(*) FROM cases c WHERE c.player_id=p.id) AS case_count,
    (SELECT MAX(c.created_at) FROM cases c WHERE c.player_id=p.id) AS last_case_at
    FROM players p WHERE (?='' OR p.player_name LIKE ? OR p.discord_name LIKE ? OR p.discord_id LIKE ? OR EXISTS(SELECT 1 FROM player_identities pi WHERE pi.player_id=p.id AND (pi.game_player_id LIKE ? OR pi.game_player_name LIKE ?)))
    ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).bind(search,q,q,q,q,q,limit,offset).all();
  const players = await Promise.all((result.results ?? []).map(async (p: any) => {
    const identities = await db().prepare("SELECT id, game, game_player_id AS gamePlayerId, game_player_name AS gamePlayerName FROM player_identities WHERE player_id=? ORDER BY created_at").bind(p.id).all();
    return { ...p, caseCount: p.case_count, lastCaseAt: p.last_case_at, identities: identities.results ?? [] };
  }));
  return json({ players, pagination: { limit, offset, returned: players.length } });
}
export async function POST(request: Request) {
  const { user, response } = await guard(request, "trailModerator"); if (response) return response;
  try {
    const body = await readJson<any>(request);
    const playerName = stringValue(body.playerName, 120); const reason = stringValue(body.initialCase?.reason, 2000); const sanctionType = stringValue(body.initialCase?.sanctionType, 40);
    if (!playerName || !reason || !TYPES.includes(sanctionType)) return errorResponse("Player name and a valid initial case (type and reason) are required.");
    const playerId = newId(); const caseId = newId(); const year = new Date().getUTCFullYear();
    const caseNumber = `STAK-${year}-${Date.now().toString().slice(-7)}`;
    const duration = body.initialCase.durationSeconds == null ? null : Math.max(0, Number(body.initialCase.durationSeconds) || 0);
    const expiresAt = sanctionType === "temporary_ban" && duration ? new Date(Date.now() + duration * 1000).toISOString() : null;
    const staff = await db().prepare("SELECT id FROM staff_users WHERE discord_user_id=?").bind(user!.discordUserId).first<{id:string}>();
    const statements: D1PreparedStatement[] = [
      db().prepare("INSERT INTO players (id, player_name, discord_name, discord_id, internal_notes, created_by, created_by_discord_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(playerId, playerName, nullableString(body.discordName,100), nullableString(body.discordId,40), nullableString(body.internalNotes,4000), staff?.id ?? null, user!.discordUserId),
      db().prepare("INSERT INTO cases (id, case_number, player_id, game, sanction_type, reason, notes, duration_seconds, expires_at, created_by, created_by_discord_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(caseId, caseNumber, playerId, nullableString(body.initialCase.game,80), sanctionType, reason, nullableString(body.initialCase.notes,4000), duration, expiresAt, staff?.id ?? null, user!.discordUserId),
    ];
    if (Array.isArray(body.identities)) for (const identity of body.identities.slice(0,10)) {
      const game=stringValue(identity.game,80), gameId=stringValue(identity.gamePlayerId,120); if (game && gameId) statements.push(db().prepare("INSERT INTO player_identities (id, player_id, game, game_player_id, game_player_name) VALUES (?, ?, ?, ?, ?)").bind(newId(),playerId,game,gameId,nullableString(identity.gamePlayerName,120)));
    }
    await db().batch(statements); await audit({ actorDiscordId:user!.discordUserId, entityType:"player", entityId:playerId, action:"created_with_initial_case", newValues:{playerName,caseNumber,sanctionType}, reason });
    return json({ playerId, caseId, caseNumber }, 201);
  } catch (error) { return errorResponse(error instanceof Error ? error.message : "Could not create player record."); }
}
