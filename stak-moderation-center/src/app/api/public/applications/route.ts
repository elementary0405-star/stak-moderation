import { env } from "cloudflare:workers";
import { getPublicPolicyAcknowledgements, hashPrivacyNotice, isPrivacyNoticeReady } from "@/lib/application-policy";
import { createApplicationSubmissionVisitorKey, isPlainObject, isSameOriginRequest, noStoreHeaders, parseJsonArray } from "@/lib/application-public";
import { getFreshDiscordSession, StakAccessRoleMissingError } from "@/lib/discord-auth";
import type { DiscordSessionUser } from "@/lib/auth";

const bindings = env as typeof env & { TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string };
const MAX_ANSWER_LENGTH = 8000;
const MAX_BODY_BYTES = 400_000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 3;

type QuestionRow = {
  id: string;
  questionKey: string;
  sectionTitle: string;
  prompt: string;
  helpText: string;
  questionType: string;
  optionsJson: string;
  isRequired: number;
  sortOrder: number;
  pageNumber: number;
  dependsOnQuestionKey: string | null;
  dependsOnValue: string | null;
};

type TurnstileResult = "valid" | "invalid" | "unavailable";

async function verifyTurnstile(request: Request, token: string): Promise<TurnstileResult> {
  const secret = bindings.TURNSTILE_SECRET_KEY;
  const siteKey = bindings.TURNSTILE_SITE_KEY;
  if (!secret || !siteKey || !token || token.length > 2048) return "invalid";
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, idempotency_key: crypto.randomUUID() }),
      cache: "no-store",
    });
    if (response.status === 429 || response.status >= 500) return "unavailable";
    if (!response.ok) return "invalid";
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    const expectedHost = new URL(request.url).hostname;
    return result.success === true && result.hostname === expectedHost && result.action === "stak_application"
      ? "valid"
      : "invalid";
  } catch {
    return "unavailable";
  }
}

function authResponse(error?: unknown) {
  if (error instanceof StakAccessRoleMissingError) {
    return Response.json({ error: "Your STAK access role has not been assigned yet.", access: "missing_role" }, { status: 403, headers: noStoreHeaders() });
  }
  return Response.json({ error: "Connect your Discord account before applying." }, { status: 401, headers: noStoreHeaders() });
}

async function getApplicant(request: Request): Promise<DiscordSessionUser | Response> {
  try {
    const user = await getFreshDiscordSession(request);
    if (!user) return authResponse();
    if (user.stakRole !== "community-member") {
      return Response.json({ error: "Staff applications can only be submitted from a Community member account." }, { status: 403, headers: noStoreHeaders() });
    }
    return user;
  } catch (error) {
    if (error instanceof StakAccessRoleMissingError) return authResponse(error);
    console.error("[application-auth]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Discord access verification is temporarily unavailable." }, { status: 503, headers: noStoreHeaders() });
  }
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function answerIsValid(question: QuestionRow, value: unknown): boolean {
  const required = Number(question.isRequired) === 1;
  if (value === undefined || value === null || value === "") return !required;

  const options = parseJsonArray(question.optionsJson);
  if (question.questionType === "multiple_choice") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return false;
    const values = value as string[];
    if (values.length === 0) return !required;
    return new Set(values).size === values.length && values.every((item) => options.includes(item));
  }

  if (typeof value !== "string" || value.length > MAX_ANSWER_LENGTH) return false;
  const normalized = value.trim();
  if (!normalized) return !required;
  if (question.questionKey === "age" && !/^\d{1,3}$/.test(normalized)) return false;
  if (question.questionType === "single_choice") return options.includes(value);
  if (question.questionType === "yes_no") return options.length ? options.includes(value) : value === "yes" || value === "no";
  return question.questionType === "text" || question.questionType === "textarea";
}

function isConditionalQuestionVisible(question: QuestionRow, questionsByKey: Map<string, QuestionRow>, answers: Record<string, unknown>) {
  if (!question.dependsOnQuestionKey) return true;
  const parent = questionsByKey.get(question.dependsOnQuestionKey);
  return Boolean(parent) && answers[parent!.id] === question.dependsOnValue;
}

function getPrimaryPlatform(questions: QuestionRow[], answers: Record<string, unknown>): string {
  const platformQuestion = questions.find((question) => question.questionKey === "primary_platform");
  const value = platformQuestion ? cleanText(answers[platformQuestion.id], 40).toLowerCase() : "";
  if (value.includes("pc") || value.includes("laptop")) return "pc";
  if (value.includes("playstation")) return "playstation";
  if (value.includes("xbox")) return "xbox";
  if (value.includes("smartphone")) return "smartphone";
  if (value.includes("tablet")) return "tablet";
  return "other";
}

async function readLatestApplication(discordUserId: string) {
  return env.DB.prepare(`
    SELECT reference_code AS referenceCode, status, submitted_at AS submittedAt
    FROM applications WHERE discord_user_id = ? ORDER BY submitted_at DESC LIMIT 1
  `).bind(discordUserId).first<{ referenceCode: string; status: string; submittedAt: string }>();
}

export async function GET(request: Request) {
  const user = await getApplicant(request);
  if (user instanceof Response) return user;
  try {
    const application = await readLatestApplication(user.discordUserId);
    return Response.json({ application: application ?? null }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[applicant-status]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Application status could not be checked right now." }, { status: 503, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  }
  const user = await getApplicant(request);
  if (user instanceof Response) return user;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "The application is too large. Shorten your answers and try again." }, { status: 413, headers: noStoreHeaders() });
  }

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || !isPlainObject(body.answers)) {
      return Response.json({ error: "Invalid application data." }, { status: 400, headers: noStoreHeaders() });
    }
    const answers: Record<string, unknown> = body.answers;
    const privacyAcknowledged = body.privacyAcknowledged === true;
    const privacyNoticeVersionId = cleanText(body.privacyNoticeVersionId, 100);
    const turnstileToken = cleanText(body.turnstileToken, 2048);

    const [settings, policy] = await Promise.all([
      env.DB.prepare(`SELECT recruitment_open AS recruitmentOpen FROM application_settings WHERE id = 'primary' LIMIT 1`)
        .first<{ recruitmentOpen: number }>(),
      env.DB.prepare(`
        SELECT id, privacy_notice AS privacyNotice FROM policy_versions
        WHERE status = 'published' ORDER BY published_at DESC LIMIT 1
      `).first<{ id: string; privacyNotice: string }>(),
    ]);
    if (Number(settings?.recruitmentOpen ?? 0) !== 1) {
      return Response.json({ error: "Applications are currently closed." }, { status: 423, headers: noStoreHeaders() });
    }
    if (!policy || !isPrivacyNoticeReady(policy.privacyNotice) || !bindings.TURNSTILE_SITE_KEY || !bindings.TURNSTILE_SECRET_KEY) {
      return Response.json({ error: "Applications are currently closed while the Staff Guidelines, privacy notice or application safeguards are being configured." }, { status: 423, headers: noStoreHeaders() });
    }
    if (privacyNoticeVersionId !== policy.id || !privacyAcknowledged) {
      return Response.json({ error: "Read and separately acknowledge the current application privacy notice before submitting." }, { status: 400, headers: noStoreHeaders() });
    }

    const existing = await readLatestApplication(user.discordUserId);
    if (existing && ["new", "in_review", "interview"].includes(existing.status)) {
      return Response.json({ error: "An application is already under review for this Discord account.", referenceCode: existing.referenceCode, application: existing }, { status: 409, headers: noStoreHeaders() });
    }

    const acceptances = await env.DB.prepare(`
      SELECT acknowledgement_key AS key, label, explanation,
             is_required AS isRequired, acknowledgement_type AS type,
             sort_order AS sortOrder
      FROM policy_acknowledgements WHERE policy_version_id = ?
    `).bind(policy.id).all<{ key: string; label: string; explanation: string; isRequired: number; type: string; sortOrder: number }>();
    const requiredKeys = getPublicPolicyAcknowledgements((acceptances.results ?? []).map((row) => ({
      ...row,
      isRequired: Number(row.isRequired) === 1,
      sortOrder: Number(row.sortOrder),
    }))).filter((row) => row.isRequired).map((row) => row.key);
    if (requiredKeys.length === 0) {
      return Response.json({ error: "Applications are currently closed until the required Staff Guidelines acknowledgements are configured." }, { status: 423, headers: noStoreHeaders() });
    }

    const guidelineAcceptance = await env.DB.prepare(`
      SELECT accepted_keys_json AS acceptedKeys, accepted_at AS acceptedAt
      FROM staff_guideline_acceptances WHERE discord_user_id = ? AND policy_version_id = ? LIMIT 1
    `).bind(user.discordUserId, policy.id).first<{ acceptedKeys: string; acceptedAt: string }>();
    const acceptedKeys = parseJsonArray(guidelineAcceptance?.acceptedKeys);
    if (!guidelineAcceptance || !requiredKeys.every((key) => acceptedKeys.includes(key))) {
      return Response.json({ error: "Read and acknowledge the current Staff Guidelines before applying.", requiresGuidelines: true }, { status: 403, headers: noStoreHeaders() });
    }

    const questionResult = await env.DB.prepare(`
      SELECT id, question_key AS questionKey, section_title AS sectionTitle, prompt,
             help_text AS helpText, question_type AS questionType, options_json AS optionsJson,
             is_required AS isRequired, sort_order AS sortOrder, page_number AS pageNumber,
             depends_on_question_key AS dependsOnQuestionKey, depends_on_value AS dependsOnValue
      FROM application_questions WHERE is_active = 1 ORDER BY page_number ASC, sort_order ASC
    `).all<QuestionRow>();
    const questions = questionResult.results ?? [];
    const knownIds = new Set(questions.map((question) => question.id));
    if (Object.keys(answers).some((key) => !knownIds.has(key))) {
      return Response.json({ error: "The application form changed. Reload it and review your answers." }, { status: 409, headers: noStoreHeaders() });
    }
    const questionsByKey = new Map(questions.map((question) => [question.questionKey, question]));
    const visibleQuestions = questions.filter((question) => isConditionalQuestionVisible(question, questionsByKey, answers));
    const missingQuestion = visibleQuestions.find((question) => !answerIsValid(question, answers[question.id]));
    if (missingQuestion) {
      return Response.json({ error: `Please complete the required field: ${missingQuestion.prompt}.` }, { status: 400, headers: noStoreHeaders() });
    }
    const visibleAnswers = Object.fromEntries(visibleQuestions
      .filter((question) => answers[question.id] !== undefined)
      .map((question) => [question.id, answers[question.id]]));

    const verification = await verifyTurnstile(request, turnstileToken);
    if (verification === "unavailable") {
      return Response.json({ error: "The application security check is temporarily unavailable. Your answers were not submitted." }, { status: 503, headers: noStoreHeaders() });
    }
    if (verification !== "valid") {
      return Response.json({ error: "Complete the anti-bot verification and try again." }, { status: 400, headers: noStoreHeaders() });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const existingLimit = await env.DB.prepare(`
      SELECT window_started_at AS windowStartedAt, submission_count AS submissionCount
      FROM application_submission_rate_limits WHERE discord_user_id = ? LIMIT 1
    `).bind(user.discordUserId).first<{ windowStartedAt: string; submissionCount: number }>();
    const withinRateWindow = existingLimit && nowDate.getTime() - Date.parse(existingLimit.windowStartedAt) < RATE_WINDOW_MS;
    if (withinRateWindow && Number(existingLimit!.submissionCount) >= MAX_SUBMISSIONS_PER_WINDOW) {
      return Response.json({ error: "Too many submissions were attempted. Wait a while before trying again." }, { status: 429, headers: noStoreHeaders() });
    }

    const rateWindowStart = withinRateWindow ? existingLimit!.windowStartedAt : now;
    await env.DB.prepare(`
      INSERT INTO application_submission_rate_limits (discord_user_id, window_started_at, submission_count, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(discord_user_id) DO UPDATE SET
        window_started_at = excluded.window_started_at,
        submission_count = CASE WHEN ? = 1 THEN application_submission_rate_limits.submission_count + 1 ELSE 1 END,
        updated_at = excluded.updated_at
    `).bind(user.discordUserId, rateWindowStart, now, withinRateWindow ? 1 : 0).run();

    const visitorKeyHash = await createApplicationSubmissionVisitorKey();
    const applicationId = crypto.randomUUID();
    const referenceSuffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    const referenceCode = `STAK-APP-${nowDate.getUTCFullYear()}-${referenceSuffix}`;
    const privacyNoticeHash = await hashPrivacyNotice(policy.privacyNotice);
    const applicantName = cleanText(user.globalName || user.username, 100) || user.username;
    const platform = getPrimaryPlatform(questions, visibleAnswers);
    const questionSnapshot = visibleQuestions.map((question) => ({
      id: question.id,
      questionKey: question.questionKey,
      sectionTitle: question.sectionTitle,
      prompt: question.prompt,
      questionType: question.questionType,
      options: question.optionsJson,
      isRequired: question.isRequired,
      pageNumber: question.pageNumber,
      dependsOnQuestionKey: question.dependsOnQuestionKey,
      dependsOnValue: question.dependsOnValue,
    }));

    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO applications (
          id, reference_code, visitor_key_hash, policy_version_id, policy_accepted_at,
          applicant_name, discord_username, discord_user_id, primary_device,
          answers_json, questions_snapshot_json, status, submitted_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?
        WHERE NOT EXISTS (
          SELECT 1 FROM applications WHERE discord_user_id = ? AND status IN ('new','in_review','interview')
        )
      `).bind(
        applicationId,
        referenceCode,
        visitorKeyHash,
        policy.id,
        guidelineAcceptance.acceptedAt,
        applicantName,
        user.username,
        user.discordUserId,
        platform,
        JSON.stringify(visibleAnswers),
        JSON.stringify(questionSnapshot),
        now,
        user.discordUserId,
      ),
      env.DB.prepare(`
        INSERT INTO privacy_notice_acknowledgements (discord_user_id, policy_version_id, notice_hash, acknowledged_at)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM applications WHERE id = ?)
        ON CONFLICT(discord_user_id, policy_version_id, notice_hash) DO UPDATE SET acknowledged_at = excluded.acknowledged_at
      `).bind(user.discordUserId, policy.id, privacyNoticeHash, now, applicationId),
      env.DB.prepare(`
        INSERT INTO application_status_history (id, application_id, previous_status, new_status, changed_by_discord_id, explanation, created_at)
        SELECT ?, ?, NULL, 'new', ?, 'Application submitted.', ?
        WHERE EXISTS (SELECT 1 FROM applications WHERE id = ?)
      `).bind(crypto.randomUUID(), applicationId, user.discordUserId, now, applicationId),
    ]);
    if (Number(results[0]?.meta?.changes ?? 0) === 0) {
      const currentApplication = await readLatestApplication(user.discordUserId);
      return Response.json({ error: "An application is already under review for this Discord account.", referenceCode: currentApplication?.referenceCode, application: currentApplication }, { status: 409, headers: noStoreHeaders() });
    }

    return Response.json({
      submitted: true,
      referenceCode,
      status: "new",
      submittedAt: now,
    }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("[application-submit]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Your application could not be saved. Try again or contact STAK management." }, { status: 500, headers: noStoreHeaders() });
  }
}
