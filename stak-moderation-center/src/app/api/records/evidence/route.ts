/// <reference path="../../../../../.cloudflare/types/index.d.ts" />

import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "../../../../lib/discord-auth";
import { hasPortalAccess } from "../../../../lib/portal-access";

const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_FILENAME_LENGTH = 255;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

async function authorize(request: Request) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json(
        { error: "Authentication required." },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, "trailModerator")) {
    return {
      user: null,
      response: json(
        { error: "Access denied." },
        403,
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

/**
 * GET /api/records/evidence?caseId=...
 *
 * Lädt alle hinterlegten Beweise eines Moderationsfalls.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
    }

    const url = new URL(request.url);
    const caseId = textValue(url.searchParams.get("caseId"));

    if (!caseId) {
      return json(
        { error: "A case ID is required." },
        400,
      );
    }

    const moderationCase = await env.DB.prepare(`
      SELECT id, case_number
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first<{
        id: string;
        case_number: string;
      }>();

    if (!moderationCase) {
      return json(
        { error: "Moderation case not found." },
        404,
      );
    }

    const result = await env.DB.prepare(`
      SELECT
        id,
        case_id AS caseId,
        file_name AS fileName,
        evidence_url AS evidenceUrl,
        description,
        uploaded_by_discord_id AS uploadedByDiscordId,
        created_at AS createdAt
      FROM case_evidence
      WHERE case_id = ?
      ORDER BY created_at DESC
    `)
      .bind(caseId)
      .all();

    return json({
      case: {
        id: moderationCase.id,
        caseNumber: moderationCase.case_number,
      },
      evidence: result.results ?? [],
    });
  } catch (error) {
    console.error("[evidence-get]", error);

    return json(
      { error: "Unable to load case evidence." },
      500,
    );
  }
}

/**
 * POST /api/records/evidence
 *
 * Speichert einen externen HTTPS-Beweislink zu einem Moderationsfall.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        { error: "Invalid request body." },
        400,
      );
    }

    if (!isObject(body)) {
      return json(
        { error: "Invalid request body." },
        400,
      );
    }

    const caseId = textValue(body.caseId);
    const evidenceUrl = textValue(body.evidenceUrl);
    const fileName = textValue(body.fileName);
    const description = textValue(body.description);

    if (!caseId) {
      return json(
        { error: "A case ID is required." },
        400,
      );
    }

    if (!evidenceUrl || evidenceUrl.length > 2048) {
      return json(
        { error: "A valid evidence URL is required." },
        400,
      );
    }

    if (!validEvidenceUrl(evidenceUrl)) {
      return json(
        { error: "Only valid HTTPS evidence links are accepted." },
        400,
      );
    }

    if (fileName.length > MAX_FILENAME_LENGTH) {
      return json(
        { error: "The file name is too long." },
        400,
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return json(
        { error: "The evidence description is too long." },
        400,
      );
    }

    const moderationCase = await env.DB.prepare(`
      SELECT id, case_number
      FROM cases
      WHERE id = ?
      LIMIT 1
    `)
      .bind(caseId)
      .first<{
        id: string;
        case_number: string;
      }>();

    if (!moderationCase) {
      return json(
        { error: "Moderation case not found." },
        404,
      );
    }

    const evidenceId = crypto.randomUUID();

    const evidenceStatement = env.DB.prepare(`
      INSERT INTO case_evidence (
        id,
        case_id,
        file_name,
        evidence_url,
        description,
        uploaded_by_discord_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      evidenceId,
      caseId,
      fileName || null,
      evidenceUrl,
      description || null,
      auth.user.discordUserId,
    );

    const auditStatement = env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        new_values
      )
      VALUES (?, ?, 'case_evidence', ?, 'created', ?)
    `).bind(
      crypto.randomUUID(),
      auth.user.discordUserId,
      evidenceId,
      JSON.stringify({
        caseId,
        caseNumber: moderationCase.case_number,
        fileName: fileName || null,
        evidenceUrl,
        description: description || null,
      }),
    );

    await env.DB.batch([
      evidenceStatement,
      auditStatement,
    ]);

    return json(
      {
        message: "Evidence added successfully.",
        evidence: {
          id: evidenceId,
          caseId,
          caseNumber: moderationCase.case_number,
          fileName: fileName || null,
          evidenceUrl,
          description: description || null,
          uploadedByDiscordId: auth.user.discordUserId,
        },
      },
      201,
    );
  } catch (error) {
    console.error("[evidence-create]", error);

    return json(
      { error: "Unable to add case evidence." },
      500,
    );
  }
}