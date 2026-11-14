import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { hasPermission } from "@/lib/portal-access";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

type RouteContext = { params: Promise<{ id: string }> };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStoreHeaders() });

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const auth = await authorizePortalRequest(request, "staff");
  if ("response" in auth) return auth.response;
  if (!hasPermission(auth.user.stakRole, "announcements.manage")) return json({ error: "Access denied." }, 403);
  try {
    const { id } = await context.params;
    const failed = await env.DB.prepare(`SELECT id FROM staff_announcement_outbox WHERE announcement_id = ? AND status = 'failed' LIMIT 1`).bind(id).first<{ id: string }>();
    if (!failed) return json({ error: "No failed Discord delivery is available to retry." }, 409);
    await env.DB.batch([
      env.DB.prepare(`UPDATE staff_announcement_outbox SET status = 'pending', last_error = NULL, updated_at = datetime('now') WHERE id = ? AND status = 'failed'`).bind(failed.id),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values, created_at) VALUES (?, ?, 'staff_announcement', ?, 'delivery_requeued', ?, datetime('now'))`).bind(crypto.randomUUID(), auth.user.discordUserId, id, JSON.stringify({ outboxId: failed.id })),
    ]);
    return json({ queued: true, deliveryStatus: "pending" });
  } catch (error) {
    console.error("[staff-announcement-retry]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to queue another delivery attempt." }, 500);
  }
}
