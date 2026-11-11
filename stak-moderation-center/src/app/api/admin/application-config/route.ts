import { env } from "cloudflare:workers";

const bindings = env as typeof env & { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string };
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

async function getDraftOrPublished() {
  const draft = await env.DB.prepare(`
    SELECT id, version, title, introduction, policy_content AS policyContent,
           privacy_notice AS privacyNotice, status, published_at AS publishedAt
    FROM policy_versions WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1
  `).first<Record<string, unknown>>();
  if (draft) return draft;
  return env.DB.prepare(`
    SELECT id, version, title, introduction, policy_content AS policyContent,
           privacy_notice AS privacyNotice, status, published_at AS publishedAt
    FROM policy_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1
  `).first<Record<string, unknown>>();
}

export async function GET(request: Request) {
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;
  try {
    const policy = await getDraftOrPublished();
    const [acknowledgements, questions, activePolicy, recruitmentSettings] = await Promise.all([
      policy ? env.DB.prepare(`
        SELECT id, acknowledgement_key AS key, label, explanation,
               sort_order AS sortOrder, is_required AS isRequired,
               acknowledgement_type AS type
        FROM policy_acknowledgements WHERE policy_version_id = ? ORDER BY sort_order ASC
      `).bind(String(policy.id)).all() : Promise.resolve({ results: [] }),
      env.DB.prepare(`
        SELECT id, question_key AS questionKey, section_title AS sectionTitle,
               prompt, help_text AS helpText, question_type AS questionType,
               options_json AS optionsJson, is_required AS isRequired,
               is_active AS isActive, sort_order AS sortOrder
        FROM application_questions ORDER BY sort_order ASC
      `).all(),
      env.DB.prepare(`SELECT version, published_at AS publishedAt FROM policy_versions WHERE status = 'published' LIMIT 1`).first(),
      env.DB.prepare(`SELECT recruitment_open AS recruitmentOpen FROM application_settings WHERE id = 'primary' LIMIT 1`).first<{ recruitmentOpen: number }>(),
    ]);
    const mappedQuestions = (questions.results ?? []).map((item) => {
      const row = item as Record<string, unknown>;
      let options: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(row.optionsJson ?? "[]"));
        if (Array.isArray(parsed)) options = parsed.filter((entry): entry is string => typeof entry === "string");
      } catch { options = []; }
      return { ...row, options, isRequired: Number(row.isRequired) === 1, isActive: Number(row.isActive) === 1 };
    });
    return Response.json({
      policy: policy ? { ...policy, isDraft: policy.status === "draft" } : null,
      acknowledgements: (acknowledgements.results ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return { ...row, isRequired: Number(row.isRequired) === 1 };
      }),
      questions: mappedQuestions,
      activePolicy,
      recruitmentOpen: Number(recruitmentSettings?.recruitmentOpen ?? 0) === 1,
      turnstileReady: Boolean(bindings.TURNSTILE_SITE_KEY && bindings.TURNSTILE_SECRET_KEY),
      sourceFormNote: "Starter questions are editable examples based on the confirmed STAK requirements. The complete 17-page Tally form has not yet been fully captured, so these questions are not represented as a verified copy of that form.",
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-config-get]", error);
    return Response.json({ error: "Unable to load application configuration." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || !isPlainObject(body.policy) || !Array.isArray(body.acknowledgements)) {
      return Response.json({ error: "Invalid policy configuration." }, { status: 400, headers: noStoreHeaders() });
    }
    const title = typeof body.policy.title === "string" ? body.policy.title.trim().slice(0, 160) : "";
    const introduction = typeof body.policy.introduction === "string" ? body.policy.introduction.trim().slice(0, 2000) : "";
    const policyContent = typeof body.policy.policyContent === "string" ? body.policy.policyContent.trim().slice(0, 30000) : "";
    const privacyNotice = typeof body.policy.privacyNotice === "string" ? body.policy.privacyNotice.trim().slice(0, 20000) : "";
    if (title.length < 5 || introduction.length < 10 || policyContent.length < 100 || privacyNotice.length < 100) {
      return Response.json({ error: "Complete the title, introduction, policy text and privacy notice before saving." }, { status: 400, headers: noStoreHeaders() });
    }

    const acknowledgements = body.acknowledgements.filter(isPlainObject).map((item, index) => ({
      key: typeof item.key === "string" ? item.key.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_").slice(0, 50) : "",
      label: typeof item.label === "string" ? item.label.trim().slice(0, 300) : "",
      explanation: typeof item.explanation === "string" ? item.explanation.trim().slice(0, 1000) : "",
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Math.max(0, Math.min(999, Number(item.sortOrder))) : index + 1,
      isRequired: item.isRequired === true,
      type: item.type === "privacy_notice" ? "privacy_notice" : "policy",
    }));
    if (!acknowledgements.length || acknowledgements.some((item) => !item.key || !item.label) || new Set(acknowledgements.map((item) => item.key)).size !== acknowledgements.length || !acknowledgements.some((item) => item.isRequired) || !acknowledgements.some((item) => item.type === "privacy_notice" && item.isRequired)) {
      return Response.json({ error: "Add unique acknowledgement keys, at least one required policy acknowledgement and one required privacy-notice acknowledgement." }, { status: 400, headers: noStoreHeaders() });
    }

    let policy = await env.DB.prepare(`SELECT id, version FROM policy_versions WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1`).first<{ id: string; version: string }>();
    if (!policy) {
      const published = await env.DB.prepare(`SELECT id, version, title, introduction, policy_content AS policyContent, privacy_notice AS privacyNotice FROM policy_versions WHERE status = 'published' LIMIT 1`).first<Record<string, unknown>>();
      if (!published) {
        policy = { id: "stak-policy-draft-1", version: "1.0-draft" };
        await env.DB.prepare(`UPDATE policy_versions SET status = 'draft' WHERE id = ?`).bind(policy.id).run();
      } else {
        const versionMatch = String(published.version).match(/^(\d+)\.(\d+)/);
        const version = versionMatch ? `${versionMatch[1]}.${Number(versionMatch[2]) + 1}-draft` : `${new Date().getFullYear()}.1-draft`;
        policy = { id: crypto.randomUUID(), version };
        await env.DB.prepare(`
          INSERT INTO policy_versions (id, version, title, introduction, policy_content, privacy_notice, status, created_by_discord_id)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
        `).bind(policy.id, version, published.title, published.introduction, published.policyContent, published.privacyNotice, authorization.user.discordUserId).run();
      }
    }

    const statements = [
      env.DB.prepare(`UPDATE policy_versions SET title = ?, introduction = ?, policy_content = ?, privacy_notice = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(title, introduction, policyContent, privacyNotice, policy.id),
      env.DB.prepare(`DELETE FROM policy_acknowledgements WHERE policy_version_id = ?`).bind(policy.id),
      ...acknowledgements.map((item) => env.DB.prepare(`
        INSERT INTO policy_acknowledgements (id, policy_version_id, acknowledgement_key, label, explanation, sort_order, is_required, acknowledgement_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), policy!.id, item.key, item.label, item.explanation, item.sortOrder, item.isRequired ? 1 : 0, item.type)),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'policy_version', ?, 'draft_updated', ?)`)
        .bind(crypto.randomUUID(), authorization.user.discordUserId, policy.id, JSON.stringify({ version: policy.version })),
    ];
    await env.DB.batch(statements);
    return Response.json({ saved: true, policyVersion: policy.version }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-application-config-put]", error);
    return Response.json({ error: "Unable to save the policy configuration." }, { status: 500, headers: noStoreHeaders() });
  }
}
