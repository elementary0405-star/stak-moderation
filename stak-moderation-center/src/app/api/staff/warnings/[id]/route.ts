import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return json({ error: "Authentication required." }, 401);
    }

    if (!hasPortalAccess(user.stakRole, "staffManager")) {
      return json({ error: "Access denied." }, 403);
    }

    const { id } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    if (!isObject(body)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const action = body.action;
    const resolutionReason =
      typeof body.resolutionReason === "string"
        ? body.resolutionReason.trim()
        : "";

    if (action !== "resolve" && action !== "revoke") {
      return json({ error: "Invalid action." }, 400);
    }

    if (resolutionReason.length < 5 || resolutionReason.length > 2000) {
      return json({
        error: "Please provide a reason between 5 and 2000 characters.",
      }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id, status, discord_user_id, warning_type, reason
      FROM staff_warnings
      WHERE id = ?
    `).bind(id).first<{
      id: string;
      status: string;
      discord_user_id: string;
      warning_type: string;
      reason: string;
    }>();

    if (!existing) {
      return json({ error: "Warning not found." }, 404);
    }

    if (existing.status !== "active") {
      return json({ error: "Only active warnings can be changed." }, 409);
    }

    const newStatus = action === "resolve" ? "resolved" : "revoked";

    await env.DB.prepare(`
      UPDATE staff_warnings
      SET
        status = ?,
        resolved_at = datetime('now'),
        resolved_by_discord_id = ?,
        resolution_reason = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      newStatus,
      user.discordUserId,
      resolutionReason,
      id,
    ).run();

    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        reason
      )
      VALUES (?, ?, 'staff_warning', ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.discordUserId,
      id,
      action,
      JSON.stringify({ status: "active" }),
      JSON.stringify({ status: newStatus }),
      resolutionReason,
    ).run();

    return json({
      message: `Warning ${newStatus}.`,
      status: newStatus,
    });
  } catch (error) {
    console.error("[staff-warning-update]", error);
    return json({ error: "Unable to update warning." }, 500);
  }
}