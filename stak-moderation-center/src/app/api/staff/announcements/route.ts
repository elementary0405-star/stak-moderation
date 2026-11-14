import { env } from "cloudflare:workers";
import { hasPermission } from "@/lib/portal-access";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

export async function GET(request: Request) {
  const authorization = await authorizePortalRequest(request, "staff");
  if ("response" in authorization) return authorization.response;
  try {
    const rows = await env.DB.prepare("SELECT a.id, a.title, a.body, a.acknowledgement_required AS acknowledgementRequired, a.acknowledgement_due_at AS acknowledgementDueAt, a.created_by_discord_id AS createdByDiscordId, a.created_at AS createdAt, mine.acknowledged_at AS acknowledgedAt, (SELECT COUNT(*) FROM staff_announcement_acknowledgements all_ack WHERE all_ack.announcement_id = a.id) AS acknowledgementCount, COALESCE(o.status, 'not_queued') AS deliveryStatus, (SELECT COUNT(*) FROM staff_announcement_delivery_receipts dr WHERE dr.announcement_id = a.id AND dr.status = 'delivered') AS deliveryDeliveredCount, (SELECT COUNT(*) FROM staff_announcement_delivery_receipts dr WHERE dr.announcement_id = a.id AND dr.status = 'failed') AS deliveryFailedCount, (SELECT COUNT(*) FROM staff_announcement_delivery_receipts dr WHERE dr.announcement_id = a.id AND dr.status = 'queued') AS deliveryQueuedCount FROM staff_announcements a LEFT JOIN staff_announcement_acknowledgements mine ON mine.announcement_id = a.id AND mine.discord_user_id = ? LEFT JOIN staff_announcement_outbox o ON o.announcement_id = a.id ORDER BY a.created_at DESC LIMIT 100")
      .bind(authorization.user.discordUserId).all();
    return Response.json({ announcements: rows.results ?? [], canManage: hasPermission(authorization.user.stakRole, "announcements.manage") }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[staff-announcements-get]", error);
    return Response.json({ error: "Unable to load staff announcements." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staff");
  if ("response" in authorization) return authorization.response;
  if (!hasPermission(authorization.user.stakRole, "announcements.manage")) return Response.json({ error: "forbidden" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) return Response.json({ error: "Invalid announcement." }, { status: 400, headers: noStoreHeaders() });
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const content = typeof body.body === "string" ? body.body.trim().slice(0, 8000) : "";
    const acknowledgementRequired = body.acknowledgementRequired === true;
    if (title.length < 4 || content.length < 10) return Response.json({ error: "Enter a title and announcement text." }, { status: 400, headers: noStoreHeaders() });
    const id = crypto.randomUUID();
    const dueAt = acknowledgementRequired ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO staff_announcements (id, title, body, acknowledgement_required, acknowledgement_due_at, created_by_discord_id) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, title, content, acknowledgementRequired ? 1 : 0, dueAt, authorization.user.discordUserId),
      env.DB.prepare("INSERT INTO staff_announcement_outbox (id, announcement_id, payload_json) VALUES (?, ?, ?)")
        .bind(crypto.randomUUID(), id, JSON.stringify({ announcementId: id, title, body: content, acknowledgementRequired, acknowledgementDueAt: dueAt })),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'staff_announcement', ?, 'created', ?)")
        .bind(crypto.randomUUID(), authorization.user.discordUserId, id, JSON.stringify({ title, acknowledgementRequired, dueAt })),
    ]);
    return Response.json({ created: true, id, acknowledgementDueAt: dueAt, deliveryStatus: "pending" }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("[staff-announcements-post]", error);
    return Response.json({ error: "Unable to create the announcement." }, { status: 500, headers: noStoreHeaders() });
  }
}
