import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CaseRecord = {
  id: string;
  case_number: string;
  player_id: string;
  player_name: string;
  discord_name: string | null;
  discord_id: string | null;
  game: string | null;
  sanction_type: string;
  reason: string;
  notes: string | null;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by_discord_id: string | null;
  lifted_reason: string | null;
  created_by_discord_id: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRecord = {
  id: string;
  file_name: string | null;
  file_key: string | null;
  evidence_url: string | null;
  description: string | null;
  uploaded_by_discord_id: string | null;
  created_at: string;
};

type AuditRecord = {
  id: string;
  actor_discord_id: string | null;
  action: string;
  old_values: string | null;
  new_values: string | null;
  reason: string | null;
  created_at: string;
};

type UpdateInput = {
  action?: unknown;
  reason?: unknown;
  notes?: unknown;
  game?: unknown;
  liftReason?: unknown;
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

async function findCase(id: string): Promise<CaseRecord | null> {
  return env.DB.prepare(`
    SELECT
      c.id,
      c.case_number,
      c.player_id,
      p.player_name,
      p.discord_name,
      p.discord_id,
      c.game,
      c.sanction_type,
      c.reason,
      c.notes,
      c.status,
      c.started_at,
      c.duration_seconds,
      c.expires_at,
      c.lifted_at,
      c.lifted_by_discord_id,
      c.lifted_reason,
      c.created_by_discord_id,
      c.created_at,
      c.updated_at
    FROM cases c
    INNER JOIN players p ON p.id = c.player_id
    WHERE c.id = ?
    LIMIT 1
  `)
    .bind(id)
    .first<CaseRecord>();
}

/**
 * GET /api/cases/[id]
 *
 * Returns a complete moderation case, including evidence
 * and its recent audit history.
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

    const moderationCase = await findCase(id);

    if (!moderationCase) {
      return json(
        {
          success: false,
          error: "Moderation case not found.",
        },
        404,
      );
    }

    const [evidenceResult, auditResult] = await Promise.all([
      env.DB.prepare(`
        SELECT
          id,
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
        .all<EvidenceRecord>(),

      env.DB.prepare(`
        SELECT
          id,
          actor_discord_id,
          action,
          old_values,
          new_values,
          reason,
          created_at
        FROM audit_logs
        WHERE entity_type = 'case'
          AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `)
        .bind(id)
        .all<AuditRecord>(),
    ]);

    return json({
      success: true,
      case: moderationCase,
      evidence: evidenceResult.results ?? [],
      history: auditResult.results ?? [],
    });
  } catch (error) {
    console.error("GET /api/cases/[id] failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve the moderation case.",
      },
      500,
    );
  }
}

/**
 * PATCH /api/cases/[id]
 *
 * Management can update permitted case information
 * or lift an existing sanction.
 *
 * Supported actions:
 * - Update reason, notes or game.
 * - Lift an active sanction with a required explanation.
 */
export async function PATCH(
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

    const input = body as UpdateInput;

    const existingCase = await findCase(id);

    if (!existingCase) {
      return json(
        {
          success: false,
          error: "Moderation case not found.",
        },
        404,
      );
    }

    const action =
      typeof input.action === "string"
        ? input.action
        : "update";

    const now = new Date().toISOString();
    const actorId = authorization.user.discordUserId;

    // --------------------------------------------------------
    // LIFT SANCTION
    // --------------------------------------------------------

    if (action === "lift") {
      const liftReason =
        typeof input.liftReason === "string"
          ? input.liftReason.trim()
          : "";

      if (!liftReason) {
        return json(
          {
            success: false,
            error: "A reason is required to lift a sanction.",
          },
          400,
        );
      }

      if (liftReason.length > 2000) {
        return json(
          {
            success: false,
            error: "The lifting reason must not exceed 2000 characters.",
          },
          400,
        );
      }

      if (existingCase.status !== "active") {
        return json(
          {
            success: false,
            error: "Only active cases can be lifted.",
          },
          409,
        );
      }

      await env.DB.batch([
        env.DB.prepare(`
          UPDATE cases
          SET
            status = 'lifted',
            lifted_at = ?,
            lifted_by_discord_id = ?,
            lifted_reason = ?,
            updated_at = ?
          WHERE id = ?
            AND status = 'active'
        `).bind(
          now,
          actorId,
          liftReason,
          now,
          id,
        ),

        env.DB.prepare(`
          INSERT INTO audit_logs (
            id,
            actor_discord_id,
            entity_type,
            entity_id,
            action,
            old_values,
            new_values,
            reason,
            created_at
          )
          VALUES (?, ?, 'case', ?, 'sanction_lifted', ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          actorId,
          id,
          JSON.stringify({
            status: existingCase.status,
            liftedAt: existingCase.lifted_at,
          }),
          JSON.stringify({
            status: "lifted",
            liftedAt: now,
            liftedBy: actorId,
            liftedReason: liftReason,
          }),
          liftReason,
          now,
        ),
      ]);

      const updatedCase = await findCase(id);

      return json({
        success: true,
        message: "Sanction lifted successfully.",
        case: updatedCase,
      });
    }

    if (action !== "update") {
      return json(
        {
          success: false,
          error: "Unsupported case action.",
        },
        400,
      );
    }

    // --------------------------------------------------------
    // UPDATE CASE INFORMATION
    // --------------------------------------------------------

    const updates: Array<{
      column: string;
      key: string;
      value: string | null;
    }> = [];

    if (input.reason !== undefined) {
      if (typeof input.reason !== "string") {
        return json(
          {
            success: false,
            error: "The reason must be text.",
          },
          400,
        );
      }

      const value = input.reason.trim();

      if (!value || value.length > 5000) {
        return json(
          {
            success: false,
            error: "The reason must contain between 1 and 5000 characters.",
          },
          400,
        );
      }

      if (value !== existingCase.reason) {
        updates.push({
          column: "reason",
          key: "reason",
          value,
        });
      }
    }

    if (input.notes !== undefined) {
      if (
        input.notes !== null &&
        typeof input.notes !== "string"
      ) {
        return json(
          {
            success: false,
            error: "Notes must be text or null.",
          },
          400,
        );
      }

      const value =
        typeof input.notes === "string"
          ? input.notes.trim() || null
          : null;

      if (value && value.length > 10000) {
        return json(
          {
            success: false,
            error: "Notes must not exceed 10000 characters.",
          },
          400,
        );
      }

      if (value !== existingCase.notes) {
        updates.push({
          column: "notes",
          key: "notes",
          value,
        });
      }
    }

    if (input.game !== undefined) {
      if (
        input.game !== null &&
        typeof input.game !== "string"
      ) {
        return json(
          {
            success: false,
            error: "Game must be text or null.",
          },
          400,
        );
      }

      const value =
        typeof input.game === "string"
          ? input.game.trim() || null
          : null;

      if (value && value.length > 100) {
        return json(
          {
            success: false,
            error: "Game name must not exceed 100 characters.",
          },
          400,
        );
      }

      if (value !== existingCase.game) {
        updates.push({
          column: "game",
          key: "game",
          value,
        });
      }
    }

    if (updates.length === 0) {
      return json({
        success: true,
        message: "No changes were necessary.",
        case: existingCase,
      });
    }

    const setClause = updates
      .map((update) => `${update.column} = ?`)
      .join(", ");

    const values = updates.map((update) => update.value);

    const oldValues: Record<string, string | null> = {};
    const newValues: Record<string, string | null> = {};

    for (const update of updates) {
      oldValues[update.key] =
        existingCase[update.column as keyof CaseRecord] as string | null;

      newValues[update.key] = update.value;
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE cases
        SET ${setClause},
            updated_at = ?
        WHERE id = ?
      `).bind(...values, now, id),

      env.DB.prepare(`
        INSERT INTO audit_logs (
          id,
          actor_discord_id,
          entity_type,
          entity_id,
          action,
          old_values,
          new_values,
          created_at
        )
        VALUES (?, ?, 'case', ?, 'case_updated', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        actorId,
        id,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        now,
      ),
    ]);

    const updatedCase = await findCase(id);

    return json({
      success: true,
      message: "Moderation case updated successfully.",
      case: updatedCase,
    });
  } catch (error) {
    console.error("PATCH /api/cases/[id] failed:", error);

    return json(
      {
        success: false,
        error: "Unable to update the moderation case.",
      },
      500,
    );
  }
}