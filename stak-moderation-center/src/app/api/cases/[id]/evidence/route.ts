import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EvidenceRecord = {
  id: string;
  case_id: string;
  file_name: string | null;
  file_key: string | null;
  evidence_url: string | null;
  description: string | null;
  uploaded_by_discord_id: string | null;
  created_at: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function authorize(
  request: Request,
  requiredAccess: "trailModerator" | "staffManager",
) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: "Authentication required.",
        },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, requiredAccess)) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: "You do not have permission to perform this action.",
        },
        403,
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

async function caseExists(caseId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT id
    FROM cases
    WHERE id = ?
    LIMIT 1
  `)
    .bind(caseId)
    .first<{ id: string }>();

  return Boolean(result);
}

async function evidenceExists(
  caseId: string,
  evidenceId: string,
): Promise<EvidenceRecord | null> {
  return env.DB.prepare(`
    SELECT
      id,
      case_id,
      file_name,
      file_key,
      evidence_url,
      description,
      uploaded_by_discord_id,
      created_at
    FROM case_evidence
    WHERE id = ?
      AND case_id = ?
    LIMIT 1
  `)
    .bind(evidenceId, caseId)
    .first<EvidenceRecord>();
}

/**
 * GET /api/cases/[id]/evidence
 *
 * Returns all evidence entries belonging to a moderation case.
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(
      request,
      "trailModerator",
    );

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        {
          success: false,
          error: "Invalid case ID.",
        },
        400,
      );
    }

    if (!(await caseExists(id))) {
      return json(
        {
          success: false,
          error: "Moderation case not found.",
        },
        404,
      );
    }

    const result = await env.DB.prepare(`
      SELECT
        id,
        case_id,
        file_name,
        file_key,
        evidence_url,
        description,
        uploaded_by_discord_id,
        created_at
      FROM case_evidence
      WHERE case_id = ?
      ORDER BY created_at DESC
    `)
      .bind(id)
      .all<EvidenceRecord>();

    return json({
      success: true,
      evidence: result.results ?? [],
      total: result.results?.length ?? 0,
    });
  } catch (error) {
    console.error("GET case evidence failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve case evidence.",
      },
      500,
    );
  }
}

/**
 * POST /api/cases/[id]/evidence
 *
 * Adds an external HTTPS evidence link to a moderation case.
 *
 * Supported properties:
 * - evidenceUrl
 * - fileName
 * - description
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(
      request,
      "trailModerator",
    );

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        {
          success: false,
          error: "Invalid case ID.",
        },
        400,
      );
    }

    if (!(await caseExists(id))) {
      return json(
        {
          success: false,
          error: "Moderation case not found.",
        },
        404,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          success: false,
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    if (!isRecord(body)) {
      return json(
        {
          success: false,
          error: "Invalid request data.",
        },
        400,
      );
    }

    if (typeof body.evidenceUrl !== "string") {
      return json(
        {
          success: false,
          error: "An evidence URL is required.",
        },
        400,
      );
    }

    const evidenceUrl = body.evidenceUrl.trim();

    if (!evidenceUrl || evidenceUrl.length > 2048) {
      return json(
        {
          success: false,
          error: "The evidence URL is invalid or too long.",
        },
        400,
      );
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(evidenceUrl);
    } catch {
      return json(
        {
          success: false,
          error: "Please provide a valid URL.",
        },
        400,
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return json(
        {
          success: false,
          error: "Only secure HTTPS links are permitted.",
        },
        400,
      );
    }

    const fileName =
      typeof body.fileName === "string"
        ? body.fileName.trim() || null
        : null;

    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;

    if (fileName && fileName.length > 255) {
      return json(
        {
          success: false,
          error: "The evidence title must not exceed 255 characters.",
        },
        400,
      );
    }

    if (description && description.length > 2000) {
      return json(
        {
          success: false,
          error: "The description must not exceed 2000 characters.",
        },
        400,
      );
    }

    const evidenceId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO case_evidence (
          id,
          case_id,
          file_name,
          file_key,
          evidence_url,
          description,
          uploaded_by_discord_id,
          created_at
        )
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
      `).bind(
        evidenceId,
        id,
        fileName,
        evidenceUrl,
        description,
        authorization.user.discordUserId,
        now,
      ),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          new_values,
          created_at
        )
        VALUES (?, ?, 'case_evidence', ?, 'evidence_added', ?, ?)
      `).bind(
        auditId,
        authorization.user.discordUserId,
        evidenceId,
        JSON.stringify({
          caseId: id,
          fileName,
          evidenceUrl,
          description,
        }),
        now,
      ),
    ]);

    return json(
      {
        success: true,
        message: "Evidence link added successfully.",
        evidence: {
          id: evidenceId,
          caseId: id,
          fileName,
          evidenceUrl,
          description,
          uploadedByDiscordId:
            authorization.user.discordUserId,
          createdAt: now,
        },
      },
      201,
    );
  } catch (error) {
    console.error("POST case evidence failed:", error);

    return json(
      {
        success: false,
        error: "Unable to add case evidence.",
      },
      500,
    );
  }
}

/**
 * DELETE /api/cases/[id]/evidence
 *
 * Removes an evidence entry.
 * Management permission and a removal reason are required.
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorization = await authorize(
      request,
      "staffManager",
    );

    if (!authorization.user) {
      return authorization.response!;
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        {
          success: false,
          error: "Invalid case ID.",
        },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          success: false,
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    if (!isRecord(body)) {
      return json(
        {
          success: false,
          error: "Invalid request data.",
        },
        400,
      );
    }

    const evidenceId =
      typeof body.evidenceId === "string"
        ? body.evidenceId.trim()
        : "";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (!evidenceId) {
      return json(
        {
          success: false,
          error: "An evidence ID is required.",
        },
        400,
      );
    }

    if (!reason || reason.length > 2000) {
      return json(
        {
          success: false,
          error: "A removal reason is required (maximum 2000 characters).",
        },
        400,
      );
    }

    const evidence = await evidenceExists(id, evidenceId);

    if (!evidence) {
      return json(
        {
          success: false,
          error: "Evidence entry not found.",
        },
        404,
      );
    }

    if (evidence.file_key) {
      return json(
        {
          success: false,
          error: "Stored files must be removed through the file storage service.",
        },
        409,
      );
    }

    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM case_evidence
        WHERE id = ?
          AND case_id = ?
          AND file_key IS NULL
      `).bind(evidenceId, id),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          old_values,
          reason,
          created_at
        )
        VALUES (?, ?, 'case_evidence', ?, 'evidence_removed', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        authorization.user.discordUserId,
        evidenceId,
        JSON.stringify(evidence),
        reason,
        now,
      ),
    ]);

    return json({
      success: true,
      message: "Evidence entry removed successfully.",
      evidenceId,
    });
  } catch (error) {
    console.error("DELETE case evidence failed:", error);

    return json(
      {
        success: false,
        error: "Unable to remove case evidence.",
      },
      500,
    );
  }
}