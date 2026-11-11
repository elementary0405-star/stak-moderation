import { env } from "cloudflare:workers";

export function db(): D1Database {
  if (!env?.DB) throw new Error("D1 binding DB is not configured.");
  return env.DB;
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function audit(input: {
  actorDiscordId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: unknown;
  newValues?: unknown;
  reason?: string;
}) {
  await db().prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, old_values, new_values, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId(), input.actorDiscordId, input.entityType, input.entityId, input.action,
      input.oldValues == null ? null : JSON.stringify(input.oldValues),
      input.newValues == null ? null : JSON.stringify(input.newValues), input.reason ?? null)
    .run();
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try { return await request.json() as T; } catch { throw new Error("Invalid JSON request body."); }
}
