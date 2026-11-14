import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staff");
  if ("response" in authorization) return authorization.response;
  try {
    const { id } = await context.params;
    const announcement = await env.DB.prepare("SELECT id FROM staff_announcements WHERE id = ? AND acknowledgement_required = 1 LIMIT 1").bind(id).first();
    if (!announcement) return Response.json({ error: "This announcement does not require acknowledgement." }, { status: 404, headers: noStoreHeaders() });
    const acknowledgedAt = new Date().toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO staff_announcement_acknowledgements (announcement_id, discord_user_id, acknowledged_at) VALUES (?, ?, ?)")
      .bind(id, authorization.user.discordUserId, acknowledgedAt).run();
    return Response.json({ acknowledged: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[staff-announcement-acknowledge]", error);
    return Response.json({ error: "Unable to save acknowledgement." }, { status: 500, headers: noStoreHeaders() });
  }
}
