import { env } from "cloudflare:workers";
import { getOrCreateApplicationVisitor, noStoreHeaders } from "@/lib/application-public";

const bindings = env as typeof env & { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string };

export async function GET(request: Request) {
  try {
    const visitor = await getOrCreateApplicationVisitor(request);
    const settings = await env.DB.prepare(`SELECT recruitment_open AS recruitmentOpen FROM application_settings WHERE id = 'primary' LIMIT 1`).first<{ recruitmentOpen: number }>();
    const databaseRecruitmentOpen = Number(settings?.recruitmentOpen ?? 0) === 1;
    const turnstileReady = Boolean(bindings.TURNSTILE_SITE_KEY && bindings.TURNSTILE_SECRET_KEY);
    const applicationOpen = databaseRecruitmentOpen && turnstileReady;
    const policy = await env.DB.prepare(`
      SELECT id, version, title, introduction, policy_content AS policyContent,
             privacy_notice AS privacyNotice, published_at AS publishedAt
      FROM policy_versions
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT 1
    `).first<{
      id: string;
      version: string;
      title: string;
      introduction: string;
      policyContent: string;
      privacyNotice: string;
      publishedAt: string | null;
    }>();

    if (!policy) {
      const response = Response.json({ published: false, accepted: false, acceptedKeys: [], applicationOpen, policy: null, acknowledgements: [], questions: [], turnstileSiteKey: bindings.TURNSTILE_SITE_KEY ?? "", turnstileReady }, {
        headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
      });
      return response;
    }

    const [ackResult, acceptance, questionResult] = await Promise.all([
      env.DB.prepare(`
        SELECT acknowledgement_key AS key, label, explanation,
               is_required AS isRequired, acknowledgement_type AS type,
               sort_order AS sortOrder
        FROM policy_acknowledgements
        WHERE policy_version_id = ?
        ORDER BY sort_order ASC
      `).bind(policy.id).all<{ key: string; label: string; explanation: string; isRequired: number; type: string; sortOrder: number }>(),
      env.DB.prepare(`
        SELECT accepted_items_json AS acceptedItems, accepted_at AS acceptedAt
        FROM policy_acceptances
        WHERE visitor_key_hash = ? AND policy_version_id = ?
        LIMIT 1
      `).bind(visitor.visitorKeyHash, policy.id).first<{ acceptedItems: string; acceptedAt: string }>(),
      env.DB.prepare(`
        SELECT id, question_key AS questionKey, section_title AS sectionTitle,
               prompt, help_text AS helpText, question_type AS questionType,
               options_json AS optionsJson, is_required AS isRequired,
               sort_order AS sortOrder
        FROM application_questions
        WHERE is_active = 1
        ORDER BY sort_order ASC
      `).all(),
    ]);

    const acknowledgements = (ackResult.results ?? []).map((row) => ({
      ...row,
      isRequired: Number(row.isRequired) === 1,
    }));
    let acceptedItems: string[] = [];
    if (acceptance?.acceptedItems) {
      try {
        const parsed: unknown = JSON.parse(acceptance.acceptedItems);
        if (Array.isArray(parsed)) acceptedItems = parsed.filter((item): item is string => typeof item === "string");
      } catch {
        acceptedItems = [];
      }
    }
    const requiredKeys = acknowledgements.filter((row) => row.isRequired).map((row) => row.key);
    const accepted = Boolean(acceptance && requiredKeys.every((key) => acceptedItems.includes(key)));
    const questions = (questionResult.results ?? []).map((row) => {
      const question = row as Record<string, unknown>;
      let options: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(question.optionsJson ?? "[]"));
        if (Array.isArray(parsed)) options = parsed.filter((entry): entry is string => typeof entry === "string");
      } catch {
        options = [];
      }
      return {
        id: question.id,
        questionKey: question.questionKey,
        sectionTitle: question.sectionTitle,
        prompt: question.prompt,
        helpText: question.helpText,
        questionType: question.questionType,
        options,
        isRequired: Number(question.isRequired) === 1,
      };
    });

    return Response.json({
      published: true,
      accepted,
      acceptedKeys: acceptedItems,
      applicationOpen,
      acceptedAt: accepted ? acceptance?.acceptedAt : null,
      policy: {
        id: policy.id,
        version: policy.version,
        title: policy.title,
        introduction: policy.introduction,
        policyContent: policy.policyContent,
        privacyNotice: policy.privacyNotice,
        publishedAt: policy.publishedAt,
      },
      acknowledgements,
      questions,
      turnstileSiteKey: bindings.TURNSTILE_SITE_KEY ?? "",
      turnstileReady,
    }, { headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined) });
  } catch (error) {
    console.error("[public-application-context]", error);
    return Response.json({ error: "The application information is temporarily unavailable." }, {
      status: 503,
      headers: noStoreHeaders(),
    });
  }
}
