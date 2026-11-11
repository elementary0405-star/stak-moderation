import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const VALID_STATUSES = new Set(["new", "in_review", "interview", "accepted", "rejected", "withdrawn"]);
type RouteContext = { params: Promise<{ id: string }> };

function parseJson(value: string | null | undefined): unknown {
  if (!value) return {};
  try { return JSON.parse(value) as unknown; } catch { return {}; }
}

export async function GET(request: Request, context: RouteContext) {
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;

  try {
    const { id } = await context.params;
    const application = await env.DB.prepare(`
      SELECT id, reference_code AS referenceCode, applicant_name AS applicantName,
             discord_username AS discordUsername, discord_user_id AS discordUserId,
             primary_device AS primaryDevice, answers_json AS answersJson,
             questions_snapshot_json AS questionsSnapshotJson, status,
             policy_version_id AS policyVersionId, policy_accepted_at AS policyAcceptedAt,
             submitted_at AS submittedAt, assigned_to_discord_id AS assignedToDiscordId,
             reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt
      FROM applications WHERE id = ? LIMIT 1
    `).bind(id).first<Record<string, unknown>>();
    if (!application) return Response.json({ error: "Application not found." }, { status: 404, headers: noStoreHeaders() });

    const [notes, history] = await Promise.all([
      env.DB.prepare(`SELECT id, author_discord_id AS authorDiscordId, note, created_at AS createdAt FROM application_notes WHERE application_id = ? ORDER BY created_at DESC LIMIT 100`).bind(id).all(),
      env.DB.prepare(`SELECT previous_status AS previousStatus, new_status AS newStatus, changed_by_discord_id AS changedByDiscordId, explanation, created_at AS createdAt FROM application_status_history WHERE application_id = ? ORDER BY created_at DESC LIMIT 100`).bind(id).all(),
    ]);

    return Response.json({
      application: {
        ...application,
        answers: parseJson(String(application.answersJson ?? "{}")),
        questions: parseJson(String(application.questionsSnapshotJson ?? "[]")),
      },
      notes: notes.results ?? [],
      history: history.results ?? [],
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-detail]", error);
    return Response.json({ error: "Unable to load this application." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;

  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!isPlainObject(body) || typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
      return Response.json({ error: "Select a valid application status." }, { status: 400, headers: noStoreHeaders() });
    }
    const current = await env.DB.prepare(`SELECT status FROM applications WHERE id = ? LIMIT 1`).bind(id).first<{ status: string }>();
    if (!current) return Response.json({ error: "Application not found." }, { status: 404, headers: noStoreHeaders() });

    const explanation = typeof body.explanation === "string" ? body.explanation.trim().slice(0, 2000) : "";
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE applications SET status = ?, assigned_to_discord_id = COALESCE(assigned_to_discord_id, ?), reviewed_at = ?, updated_at = ? WHERE id = ?`)
        .bind(body.status, authorization.user.discordUserId, now, now, id),
      env.DB.prepare(`INSERT INTO application_status_history (id, application_id, previous_status, new_status, changed_by_discord_id, explanation) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, current.status, body.status, authorization.user.discordUserId, explanation || null),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, old_values, new_values, reason) VALUES (?, ?, 'application', ?, 'status_changed', ?, ?, ?)`)
        .bind(crypto.randomUUID(), authorization.user.discordUserId, id, JSON.stringify({ status: current.status }), JSON.stringify({ status: body.status }), explanation || null),
    ]);

    return Response.json({ updated: true, status: body.status }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-update]", error);
    return Response.json({ error: "Unable to update the application." }, { status: 500, headers: noStoreHeaders() });
  }
}
