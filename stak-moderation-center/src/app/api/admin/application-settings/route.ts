import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const bindings = env as typeof env & { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string };

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || typeof body.recruitmentOpen !== "boolean") {
      return Response.json({ error: "Provide a valid recruitment availability setting." }, { status: 400, headers: noStoreHeaders() });
    }
    if (body.recruitmentOpen && (!bindings.TURNSTILE_SITE_KEY || !bindings.TURNSTILE_SECRET_KEY)) {
      return Response.json({ error: "Configure both the Cloudflare Turnstile site key and secret before opening public recruitment." }, { status: 409, headers: noStoreHeaders() });
    }
    await env.DB.batch([
      env.DB.prepare(`UPDATE application_settings SET recruitment_open = ?, updated_by_discord_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'primary'`)
        .bind(body.recruitmentOpen ? 1 : 0, authorization.user.discordUserId),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'application_settings', 'primary', 'recruitment_availability_changed', ?)`)
        .bind(crypto.randomUUID(), authorization.user.discordUserId, JSON.stringify({ recruitmentOpen: body.recruitmentOpen })),
    ]);
    return Response.json({ updated: true, recruitmentOpen: body.recruitmentOpen }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-settings]", error);
    return Response.json({ error: "Unable to update recruitment availability." }, { status: 500, headers: noStoreHeaders() });
  }
}
