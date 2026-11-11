import { env } from "cloudflare:workers";
import { getOrCreateApplicationVisitor, isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

const bindings = env as typeof env & { TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string };
const ALLOWED_DEVICES = new Set(["pc", "laptop"]);
const ALL_DEVICES = new Set(["pc", "laptop", "playstation", "xbox", "smartphone", "tablet", "other"]);
const MAX_ANSWER_LENGTH = 8000;


async function verifyTurnstile(request: Request, token: string): Promise<boolean> {
  const secret = bindings.TURNSTILE_SECRET_KEY;
  const siteKey = bindings.TURNSTILE_SITE_KEY;
  if (!secret || !siteKey) return false;
  if (!token || token.length > 2048) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, idempotency_key: crypto.randomUUID() }),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  const expectedHost = new URL(request.url).hostname;
  return result.success === true && result.hostname === expectedHost && result.action === "stak_application";
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validAnswer(question: Record<string, unknown>, value: unknown): boolean {
  const required = Number(question.isRequired) === 1;
  if (value === undefined || value === null || value === "") return !required;
  const type = String(question.questionType);
  let options: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(question.optionsJson ?? "[]"));
    if (Array.isArray(parsed)) options = parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    options = [];
  }
  if (type === "multiple_choice") {
    if (Array.isArray(value) && value.length === 0) return !required;
    return Array.isArray(value) && value.length <= options.length && value.every((entry) => typeof entry === "string" && options.includes(entry));
  }
  if (typeof value !== "string" || value.length > MAX_ANSWER_LENGTH) return false;
  if (type === "single_choice") return options.includes(value);
  if (type === "yes_no") return value === "yes" || value === "no";
  return value.trim().length > 0 || !required;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) {
      return Response.json({ error: "Invalid application data." }, { status: 400, headers: noStoreHeaders() });
    }

    // Honeypot: respond as if accepted, without storing bot submissions.
    if (typeof body.website === "string" && body.website.trim()) {
      return Response.json({ submitted: true, referenceCode: "STAK-APP-RECEIVED" }, { status: 201, headers: noStoreHeaders() });
    }

    const applicantName = cleanText(body.applicantName, 100);
    const discordUsername = cleanText(body.discordUsername, 100);
    const discordUserId = cleanText(body.discordUserId, 30);
    const primaryDevice = cleanText(body.primaryDevice, 30).toLowerCase();
    const turnstileToken = cleanText(body.turnstileToken, 2048);
    const answers = isPlainObject(body.answers) ? body.answers : {};

    if (applicantName.length < 2 || discordUsername.length < 2) {
      return Response.json({ error: "Enter your name and Discord username." }, { status: 400, headers: noStoreHeaders() });
    }
    if (discordUserId && !/^\d{17,20}$/.test(discordUserId)) {
      return Response.json({ error: "The Discord user ID must contain 17–20 digits, or be left empty." }, { status: 400, headers: noStoreHeaders() });
    }
    if (!bindings.TURNSTILE_SITE_KEY || !bindings.TURNSTILE_SECRET_KEY) {
      return Response.json({ error: "The application anti-bot verification is not fully configured. Please contact STAK management." }, { status: 503, headers: noStoreHeaders() });
    }
    if (!(await verifyTurnstile(request, turnstileToken))) {
      return Response.json({ error: "Complete the anti-bot verification and try again." }, { status: 400, headers: noStoreHeaders() });
    }
    if (!ALL_DEVICES.has(primaryDevice)) {
      return Response.json({ error: "Select the device you primarily use for staff work." }, { status: 400, headers: noStoreHeaders() });
    }
    if (!ALLOWED_DEVICES.has(primaryDevice)) {
      return Response.json({
        error: "STAK staff work currently requires a PC or laptop. The selected device does not meet this requirement, so the application cannot be submitted.",
        eligible: false,
      }, { status: 422, headers: noStoreHeaders() });
    }

    const visitor = await getOrCreateApplicationVisitor(request);
    const settings = await env.DB.prepare(`SELECT recruitment_open AS recruitmentOpen FROM application_settings WHERE id = 'primary' LIMIT 1`).first<{ recruitmentOpen: number }>();
    if (Number(settings?.recruitmentOpen ?? 0) !== 1) {
      return Response.json({ error: "STAK is not accepting applications at the moment." }, { status: 423, headers: noStoreHeaders() });
    }
    const policy = await env.DB.prepare(`
      SELECT id, version FROM policy_versions WHERE status = 'published' LIMIT 1
    `).first<{ id: string; version: string }>();
    if (!policy) {
      return Response.json({ error: "Applications are currently closed while the staff policies are being finalized." }, { status: 423, headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined) });
    }

    const acceptance = await env.DB.prepare(`
      SELECT accepted_items_json AS acceptedItems, accepted_at AS acceptedAt
      FROM policy_acceptances WHERE visitor_key_hash = ? AND policy_version_id = ? LIMIT 1
    `).bind(visitor.visitorKeyHash, policy.id).first<{ acceptedItems: string; acceptedAt: string }>();
    let acceptedKeys: string[] = [];
    if (acceptance?.acceptedItems) {
      try {
        const parsed: unknown = JSON.parse(acceptance.acceptedItems);
        if (Array.isArray(parsed)) acceptedKeys = parsed.filter((item): item is string => typeof item === "string");
      } catch {
        acceptedKeys = [];
      }
    }
    const requiredAcknowledgements = await env.DB.prepare(`
      SELECT acknowledgement_key AS key FROM policy_acknowledgements
      WHERE policy_version_id = ? AND is_required = 1
    `).bind(policy.id).all<{ key: string }>();
    const hasAllRequiredAcknowledgements = Boolean(acceptance) && (requiredAcknowledgements.results ?? []).every((item) => acceptedKeys.includes(item.key));
    if (!hasAllRequiredAcknowledgements) {
      return Response.json({ error: "Read and accept all required STAK policies before submitting an application.", requiresPolicyAcceptance: true }, {
        status: 403,
        headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
      });
    }

    const duplicate = await env.DB.prepare(`
      SELECT reference_code AS referenceCode FROM applications
      WHERE status IN ('new','in_review','interview')
        AND (visitor_key_hash = ? OR (? IS NOT NULL AND discord_user_id = ?))
      ORDER BY submitted_at DESC LIMIT 1
    `).bind(visitor.visitorKeyHash, discordUserId || null, discordUserId || null).first<{ referenceCode: string }>();
    if (duplicate) {
      return Response.json({ error: `An application is already under review for this browser session (${duplicate.referenceCode}). Contact STAK management if you need to correct it.` }, { status: 409, headers: noStoreHeaders() });
    }

    const questionResult = await env.DB.prepare(`
      SELECT id, question_key AS questionKey, section_title AS sectionTitle, prompt,
             help_text AS helpText, question_type AS questionType, options_json AS optionsJson,
             is_required AS isRequired, sort_order AS sortOrder
      FROM application_questions WHERE is_active = 1 ORDER BY sort_order ASC
    `).all();
    const questions = (questionResult.results ?? []) as unknown as Record<string, unknown>[];
    const knownQuestionIds = new Set(questions.map((question) => String(question.id)));
    const unknownAnswers = Object.keys(answers).filter((key) => !knownQuestionIds.has(key));
    if (unknownAnswers.length) {
      return Response.json({ error: "The application form has changed. Reload it and check your answers again." }, { status: 409, headers: noStoreHeaders() });
    }

    for (const question of questions) {
      if (!validAnswer(question, answers[String(question.id)])) {
        return Response.json({ error: `Please complete the required field: ${String(question.prompt)}.` }, { status: 400, headers: noStoreHeaders() });
      }
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const randomCode = Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    const referenceCode = `STAK-APP-${new Date().getUTCFullYear()}-${randomCode}`;

    await env.DB.prepare(`
      INSERT INTO applications (
        id, reference_code, visitor_key_hash, policy_version_id, policy_accepted_at,
        applicant_name, discord_username, discord_user_id, primary_device,
        answers_json, questions_snapshot_json, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    `).bind(
      id,
      referenceCode,
      visitor.visitorKeyHash,
      policy.id,
      acceptance!.acceptedAt,
      applicantName,
      discordUsername,
      discordUserId || null,
      primaryDevice,
      JSON.stringify(answers),
      JSON.stringify(questions.map((question) => ({
        id: question.id,
        questionKey: question.questionKey,
        sectionTitle: question.sectionTitle,
        prompt: question.prompt,
        questionType: question.questionType,
        options: question.optionsJson,
        isRequired: question.isRequired,
      }))),
      now,
    ).run();

    await env.DB.prepare(`
      INSERT INTO application_status_history (id, application_id, previous_status, new_status, changed_by_discord_id, explanation)
      VALUES (?, ?, NULL, 'new', 'system:public', 'Application submitted by applicant.')
    `).bind(crypto.randomUUID(), id).run();
    await env.DB.prepare(`
      UPDATE application_visitors SET last_submission_at = ? WHERE visitor_key_hash = ?
    `).bind(now, visitor.visitorKeyHash).run();

    return Response.json({ submitted: true, referenceCode }, {
      status: 201,
      headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
    });
  } catch (error) {
    console.error("[public-application-submit]", error);
    return Response.json({ error: "The application could not be submitted. Please try again later." }, { status: 500, headers: noStoreHeaders() });
  }
}
