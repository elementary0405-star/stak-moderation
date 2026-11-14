import { env } from "cloudflare:workers";
import { noStoreHeaders } from "@/lib/application-public";

type BotEnv = typeof env & { DISCORD_BOT_TOKEN?: string };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: noStoreHeaders() });

function sameSecret(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function authorize(request: Request): Response | null {
  const token = (env as BotEnv).DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token) return json({ error: "Bot integration is not configured." }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return sameSecret(supplied, token) ? null : json({ error: "Unauthorized." }, 401);
}

/** Bot integration contract: claim one pending event and report actual delivery. */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await env.DB.prepare(`
      UPDATE staff_announcement_outbox
      SET status = 'processing', attempts = attempts + 1, updated_at = datetime('now'), last_error = NULL
      WHERE id = (
        SELECT id FROM staff_announcement_outbox
        WHERE status = 'pending'
          OR (status = 'processing' AND datetime(updated_at) < datetime('now', '-5 minutes'))
        ORDER BY created_at ASC LIMIT 1
      )
      RETURNING id, announcement_id AS announcementId, event_type AS eventType, payload_json AS payloadJson, attempts
    `).first<{ id: string; announcementId: string; eventType: string; payloadJson: string; attempts: number }>();
    if (!result) return json({ event: null });
    let payload: unknown;
    try { payload = JSON.parse(result.payloadJson); }
    catch {
      await env.DB.prepare(`UPDATE staff_announcement_outbox SET status = 'failed', last_error = 'Invalid event payload', updated_at = datetime('now') WHERE id = ?`).bind(result.id).run();
      return json({ error: "Announcement payload is invalid." }, 500);
    }
    return json({ event: { id: result.id, announcementId: result.announcementId, type: result.eventType, attempts: result.attempts, payload } });
  } catch (error) {
    console.error("[bot-announcement-claim]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to claim announcement delivery." }, 500);
  }
}

export async function PATCH(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "Invalid delivery report." }, 400);
    const data = body as Record<string, unknown>;
    const id = typeof data.outboxId === "string" ? data.outboxId : "";
    const status = data.status === "delivered" || data.status === "failed" ? data.status : "";
    const errorText = typeof data.error === "string" ? data.error.trim().slice(0, 1000) : "";
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    if (!id || !status || recipients.length > 1000) return json({ error: "A valid outbox ID and delivery status are required." }, 400);
    const event = await env.DB.prepare(`SELECT announcement_id AS announcementId, status FROM staff_announcement_outbox WHERE id = ? LIMIT 1`).bind(id).first<{ announcementId: string; status: string }>();
    if (!event) return json({ error: "Announcement event not found." }, 404);
    if (event.status !== "processing") return json({ error: "This announcement event is not currently claimed." }, 409);
    const statements = [env.DB.prepare(`UPDATE staff_announcement_outbox SET status = ?, last_error = ?, updated_at = datetime('now') WHERE id = ? AND status = 'processing'`).bind(status, errorText || null, id)];
    for (const item of recipients) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return json({ error: "Invalid recipient delivery entry." }, 400);
      const recipient = item as Record<string, unknown>;
      const discordUserId = typeof recipient.discordUserId === "string" ? recipient.discordUserId : "";
      const recipientStatus = recipient.status === "delivered" ? "delivered" : recipient.status === "failed" ? "failed" : "";
      const recipientError = typeof recipient.error === "string" ? recipient.error.slice(0, 500) : "";
      if (!/^\d{17,20}$/.test(discordUserId) || !recipientStatus) return json({ error: "Invalid recipient delivery entry." }, 400);
      statements.push(env.DB.prepare(`INSERT INTO staff_announcement_delivery_receipts (id, announcement_id, recipient_discord_id, status, error, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(announcement_id, recipient_discord_id) DO UPDATE SET status = excluded.status, error = excluded.error, updated_at = excluded.updated_at`).bind(crypto.randomUUID(), event.announcementId, discordUserId, recipientStatus, recipientError || null));
    }
    await env.DB.batch(statements);
    return json({ recorded: true, status, recipientCount: recipients.length });
  } catch (error) {
    console.error("[bot-announcement-report]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to save the delivery report." }, 500);
  }
}
