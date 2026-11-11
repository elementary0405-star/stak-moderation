import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const TYPES = new Set(["text", "textarea", "single_choice", "multiple_choice", "yes_no"]);
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!isPlainObject(body)) return Response.json({ error: "Invalid question." }, { status: 400, headers: noStoreHeaders() });
    const current = await env.DB.prepare(`SELECT id FROM application_questions WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: "Question not found." }, { status: 404, headers: noStoreHeaders() });
    const sectionTitle = typeof body.sectionTitle === "string" ? body.sectionTitle.trim().slice(0, 100) : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
    const helpText = typeof body.helpText === "string" ? body.helpText.trim().slice(0, 1000) : "";
    const questionType = typeof body.questionType === "string" ? body.questionType : "";
    const options = Array.isArray(body.options) ? body.options.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().slice(0, 150)).filter(Boolean).slice(0, 30) : [];
    if (!sectionTitle || prompt.length < 8 || !TYPES.has(questionType)) return Response.json({ error: "Enter a section, a clear question and a supported question type." }, { status: 400, headers: noStoreHeaders() });
    if ((questionType === "single_choice" || questionType === "multiple_choice") && options.length < 2) return Response.json({ error: "Choice questions need at least two options." }, { status: 400, headers: noStoreHeaders() });
    await env.DB.prepare(`
      UPDATE application_questions
      SET section_title = ?, prompt = ?, help_text = ?, question_type = ?, options_json = ?,
          is_required = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sectionTitle, prompt, helpText, questionType, JSON.stringify(options), body.isRequired === false ? 0 : 1, body.isActive === false ? 0 : 1, Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0, id).run();
    await env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'application_question', ?, 'updated', ?)`)
      .bind(crypto.randomUUID(), authorization.user.discordUserId, id, JSON.stringify({ prompt, questionType })).run();
    return Response.json({ updated: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-question-update]", error);
    return Response.json({ error: "Unable to update the question." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;
  try {
    const { id } = await context.params;
    await env.DB.prepare(`UPDATE application_questions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
    await env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action) VALUES (?, ?, 'application_question', ?, 'deactivated')`)
      .bind(crypto.randomUUID(), authorization.user.discordUserId, id).run();
    return Response.json({ deactivated: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-question-delete]", error);
    return Response.json({ error: "Unable to deactivate the question." }, { status: 500, headers: noStoreHeaders() });
  }
}
