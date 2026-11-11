import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;

  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const note = isPlainObject(body) && typeof body.note === "string" ? body.note.trim() : "";
    if (note.length < 3 || note.length > 5000) {
      return Response.json({ error: "Notes must contain between 3 and 5000 characters." }, { status: 400, headers: noStoreHeaders() });
    }
    const exists = await env.DB.prepare(`SELECT id FROM applications WHERE id = ? LIMIT 1`).bind(id).first();
    if (!exists) return Response.json({ error: "Application not found." }, { status: 404, headers: noStoreHeaders() });

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO application_notes (id, application_id, author_discord_id, note) VALUES (?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, authorization.user.discordUserId, note),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'application_note', ?, 'created', ?)`)
        .bind(crypto.randomUUID(), authorization.user.discordUserId, id, JSON.stringify({ noteLength: note.length })),
    ]);
    return Response.json({ saved: true }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-note]", error);
    return Response.json({ error: "Unable to save the note." }, { status: 500, headers: noStoreHeaders() });
  }
}
