import { env } from "cloudflare:workers";
import { getPublicPolicyAcknowledgements, hashPrivacyNotice, isPrivacyNoticeReady } from "@/lib/application-policy";
import { parseJsonArray, noStoreHeaders } from "@/lib/application-public";
import { getFreshDiscordSession, StakAccessRoleMissingError } from "@/lib/discord-auth";
import type { DiscordSessionUser } from "@/lib/auth";

const bindings = env as typeof env & { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string };

function authFailure(error?: unknown) {
  if (error instanceof StakAccessRoleMissingError) {
    return Response.json({ error: "Your STAK access role has not been assigned yet.", access: "missing_role" }, { status: 403, headers: noStoreHeaders() });
  }
  return Response.json({ error: "Connect your Discord account to view the application." }, { status: 401, headers: noStoreHeaders() });
}

export async function GET(request: Request) {
  let user: DiscordSessionUser | null;
  try {
    user = await getFreshDiscordSession(request);
  } catch (error) {
    if (error instanceof StakAccessRoleMissingError) return authFailure(error);
    console.error("[application-context-auth]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Discord access verification is temporarily unavailable." }, { status: 503, headers: noStoreHeaders() });
  }
  if (!user) return authFailure();

  try {
    const [settings, publishedPolicy] = await Promise.all([
      env.DB.prepare(`SELECT recruitment_open AS recruitmentOpen FROM application_settings WHERE id = 'primary' LIMIT 1`)
        .first<{ recruitmentOpen: number }>(),
      env.DB.prepare(`
        SELECT id, version, title, introduction, policy_content AS policyContent,
               privacy_notice AS privacyNotice, published_at AS publishedAt
        FROM policy_versions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1
      `).first<PolicyRow>(),
    ]);
    const policy = publishedPolicy ?? await env.DB.prepare(`
      SELECT id, version, title, introduction, policy_content AS policyContent,
             privacy_notice AS privacyNotice, published_at AS publishedAt
      FROM policy_versions WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1
    `).first<PolicyRow>();

    const policyRows = policy ? await env.DB.prepare(`
      SELECT acknowledgement_key AS key, label, explanation,
             is_required AS isRequired, acknowledgement_type AS type,
             sort_order AS sortOrder
      FROM policy_acknowledgements WHERE policy_version_id = ? ORDER BY sort_order ASC
    `).bind(policy.id).all<PolicyAckRow>() : { results: [] as PolicyAckRow[] };
    const acknowledgements = getPublicPolicyAcknowledgements((policyRows.results ?? []).map((row) => ({
      key: row.key,
      label: row.label,
      explanation: row.explanation,
      isRequired: Number(row.isRequired) === 1,
      type: row.type,
      sortOrder: Number(row.sortOrder),
    })));
    const requiredKeys = acknowledgements.filter((item) => item.isRequired).map((item) => item.key);

    let acceptedKeys: string[] = [];
    let guidelinesAcceptedAt: string | null = null;
    let privacyAcknowledged = false;
    if (policy && publishedPolicy) {
      const [guidelineAcceptance] = await Promise.all([
        env.DB.prepare(`
          SELECT accepted_keys_json AS acceptedKeys, accepted_at AS acceptedAt
          FROM staff_guideline_acceptances WHERE discord_user_id = ? AND policy_version_id = ? LIMIT 1
        `).bind(user.discordUserId, policy.id).first<{ acceptedKeys: string; acceptedAt: string }>(),
      ]);
      acceptedKeys = parseJsonArray(guidelineAcceptance?.acceptedKeys);
      const acceptedAllRequired = requiredKeys.length > 0 && requiredKeys.every((key) => acceptedKeys.includes(key));
      guidelinesAcceptedAt = acceptedAllRequired ? guidelineAcceptance?.acceptedAt ?? null : null;
      const privacyHash = await hashPrivacyNotice(policy.privacyNotice);
      if (isPrivacyNoticeReady(policy.privacyNotice)) {
        const privacyAcceptance = await env.DB.prepare(`
          SELECT acknowledged_at AS acknowledgedAt
          FROM privacy_notice_acknowledgements
          WHERE discord_user_id = ? AND policy_version_id = ? AND notice_hash = ? LIMIT 1
        `).bind(user.discordUserId, policy.id, privacyHash).first<{ acknowledgedAt: string }>();
        privacyAcknowledged = Boolean(privacyAcceptance);
      }
    }

    const questionsResult = await env.DB.prepare(`
      SELECT id, question_key AS questionKey, section_title AS sectionTitle,
             prompt, help_text AS helpText, question_type AS questionType,
             options_json AS optionsJson, is_required AS isRequired,
             sort_order AS sortOrder, page_number AS pageNumber,
             depends_on_question_key AS dependsOnQuestionKey,
             depends_on_value AS dependsOnValue
      FROM application_questions WHERE is_active = 1 ORDER BY page_number ASC, sort_order ASC
    `).all<Record<string, unknown>>();
    const questions = (questionsResult.results ?? []).map((row) => ({
      id: String(row.id),
      questionKey: String(row.questionKey),
      sectionTitle: String(row.sectionTitle),
      prompt: String(row.prompt),
      helpText: String(row.helpText ?? ""),
      questionType: String(row.questionType),
      options: parseJsonArray(String(row.optionsJson ?? "[]")),
      isRequired: Number(row.isRequired) === 1,
      pageNumber: Number(row.pageNumber ?? 1),
      dependsOnQuestionKey: typeof row.dependsOnQuestionKey === "string" ? row.dependsOnQuestionKey : null,
      dependsOnValue: typeof row.dependsOnValue === "string" ? row.dependsOnValue : null,
    }));

    const application = await env.DB.prepare(`
      SELECT reference_code AS referenceCode, status, submitted_at AS submittedAt
      FROM applications WHERE discord_user_id = ? ORDER BY submitted_at DESC LIMIT 1
    `).bind(user.discordUserId).first<{ referenceCode: string; status: string; submittedAt: string }>();

    const guidelinesPublished = Boolean(publishedPolicy);
    const turnstileReady = Boolean(bindings.TURNSTILE_SITE_KEY && bindings.TURNSTILE_SECRET_KEY);
    const recruitmentOpen = Number(settings?.recruitmentOpen ?? 0) === 1;
    const privacyReady = Boolean(publishedPolicy && isPrivacyNoticeReady(publishedPolicy.privacyNotice));
    const requiredAcksReady = requiredKeys.length > 0;
    const applicationOpen = recruitmentOpen && guidelinesPublished && privacyReady && turnstileReady && requiredAcksReady;
    const closedReason = !recruitmentOpen
      ? "Applications are currently closed by STAK management."
      : !guidelinesPublished
        ? "Applications are currently closed while Staff Guidelines are prepared for publication."
        : !privacyReady
          ? "Applications are currently closed while the application privacy notice is finalized."
          : !turnstileReady
            ? "Applications are currently closed while the application security check is configured."
            : !requiredAcksReady
              ? "Applications are currently closed until the required Staff Guidelines acknowledgements are configured."
              : null;

    return Response.json({
      profile: user,
      canApply: user.stakRole === "community-member",
      guidelinesPublished,
      guidelinesAccepted: Boolean(guidelinesAcceptedAt),
      guidelinesAcceptedAt,
      acceptedKeys,
      applicationOpen,
      closedReason,
      policy: policy ? {
        id: policy.id,
        version: policy.version,
        title: policy.title,
        introduction: policy.introduction,
        policyContent: policy.policyContent,
        privacyNotice: publishedPolicy ? policy.privacyNotice : "",
        publishedAt: policy.publishedAt,
      } : null,
      acknowledgements: acknowledgements.map(({ key, label, explanation, isRequired }) => ({ key, label, explanation, isRequired })),
      privacyAcknowledged,
      questions,
      turnstileSiteKey: bindings.TURNSTILE_SITE_KEY ?? "",
      turnstileReady,
      application: application ?? null,
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[application-context]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Application status could not be checked right now." }, { status: 503, headers: noStoreHeaders() });
  }
}

type PolicyRow = {
  id: string;
  version: string;
  title: string;
  introduction: string;
  policyContent: string;
  privacyNotice: string;
  publishedAt: string | null;
};

type PolicyAckRow = {
  key: string;
  label: string;
  explanation: string;
  isRequired: number;
  type: string;
  sortOrder: number;
};
