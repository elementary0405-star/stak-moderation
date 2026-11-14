import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const TYPES = new Set(["text", "textarea", "single_choice", "multiple_choice", "yes_no"]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) return Response.json({ error: "Invalid question." }, { status: 400, headers: noStoreHeaders() });
    const sectionTitle = typeof body.sectionTitle === "string" ? body.sectionTitle.trim().slice(0, 100) : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
    const helpText = typeof body.helpText === "string" ? body.helpText.trim().slice(0, 1000) : "";
    const questionType = typeof body.questionType === "string" ? body.questionType : "";
    const pageNumber = Number.isInteger(Number(body.pageNumber)) ? Math.max(1, Math.min(30, Number(body.pageNumber))) : 1;
    const dependsOnQuestionKey = typeof body.dependsOnQuestionKey === "string" ? body.dependsOnQuestionKey.trim().slice(0, 100) : "";
    const dependsOnValue = typeof body.dependsOnValue === "string" ? body.dependsOnValue.trim().slice(0, 150) : "";
    const options = Array.isArray(body.options) ? body.options.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().slice(0, 150)).filter(Boolean).slice(0, 30) : [];
    if (!sectionTitle || prompt.length < 8 || !TYPES.has(questionType)) return Response.json({ error: "Enter a section, a clear question and a supported question type." }, { status: 400, headers: noStoreHeaders() });
    if ((questionType === "single_choice" || questionType === "multiple_choice") && options.length < 2) return Response.json({ error: "Choice questions need at least two options." }, { status: 400, headers: noStoreHeaders() });
    if (Boolean(dependsOnQuestionKey) !== Boolean(dependsOnValue)) return Response.json({ error: "A condition needs both a parent question and an exact matching answer." }, { status: 400, headers: noStoreHeaders() });
    if (dependsOnQuestionKey) {
      const parent = await env.DB.prepare(`SELECT question_type AS questionType, options_json AS optionsJson, page_number AS pageNumber, depends_on_question_key AS dependsOnQuestionKey FROM application_questions WHERE question_key = ? AND is_active = 1 LIMIT 1`).bind(dependsOnQuestionKey).first<{ questionType: string; optionsJson: string; pageNumber: number; dependsOnQuestionKey: string | null }>();
      let parentOptions: string[] = [];
      try { const parsed: unknown = JSON.parse(parent?.optionsJson ?? "[]"); if (Array.isArray(parsed)) parentOptions = parsed.filter((item): item is string => typeof item === "string"); } catch { parentOptions = []; }
      if (!parent || parent.dependsOnQuestionKey || parent.pageNumber > pageNumber || !(parent.questionType === "yes_no" ? ["yes", "no"].includes(dependsOnValue) : parentOptions.includes(dependsOnValue))) {
        return Response.json({ error: "Choose an unconditional choice question on this step or an earlier step, plus one of its exact answer options." }, { status: 400, headers: noStoreHeaders() });
      }
    }
    const id = crypto.randomUUID();
    const questionKey = `custom_${id.replace(/-/g, "").slice(0, 16)}`;
    await env.DB.prepare(`
      INSERT INTO application_questions (id, question_key, section_title, prompt, help_text, question_type, options_json, is_required, is_active, sort_order, page_number, depends_on_question_key, depends_on_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).bind(id, questionKey, sectionTitle, prompt, helpText, questionType, JSON.stringify(options), body.isRequired === false ? 0 : 1, Date.now(), pageNumber, dependsOnQuestionKey || null, dependsOnValue || null).run();
    await env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'application_question', ?, 'created', ?)`)
      .bind(crypto.randomUUID(), authorization.user.discordUserId, id, JSON.stringify({ prompt, questionType })).run();
    return Response.json({ created: true, id }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-question-create]", error);
    return Response.json({ error: "Unable to create the question." }, { status: 500, headers: noStoreHeaders() });
  }
}
