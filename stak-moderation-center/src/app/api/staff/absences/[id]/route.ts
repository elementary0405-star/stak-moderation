import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AbsenceRecord = {
  id: string;
  discord_user_id: string;
  start_date: string;
  expected_return_date: string | null;
  reason: string;
  status: string;
  management_note: string | null;
  reviewed_by_discord_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
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

async function findAbsence(id: string): Promise<AbsenceRecord | null> {
  return env.DB.prepare(`
    SELECT
      id,
      discord_user_id,
      start_date,
      expected_return_date,
      reason,
      status,
      management_note,
      reviewed_by_discord_id,
      reviewed_at,
      created_at,
      updated_at
    FROM staff_absences
    WHERE id = ?
    LIMIT 1
  `)
    .bind(id)
    .first<AbsenceRecord>();
}

/**
 * PATCH /api/staff/absences/[id]
 *
 * Supported actions:
 * - withdraw: The submitting staff member withdraws their notification.
 * - review: Management acknowledges a submitted notification.
 * - complete: Management marks the absence as completed.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return json(
        { success: false, error: "Authentication required." },
        401,
      );
    }

    if (!hasPortalAccess(user.stakRole, "staff")) {
      return json(
        { success: false, error: "Staff access required." },
        403,
      );
    }

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return json(
        { success: false, error: "Invalid absence ID." },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, error: "Invalid JSON request." },
        400,
      );
    }

    if (!isRecord(body) || typeof body.action !== "string") {
      return json(
        { success: false, error: "A valid action is required." },
        400,
      );
    }

    const absence = await findAbsence(id);

    if (!absence) {
      return json(
        { success: false, error: "Absence notification not found." },
        404,
      );
    }

    const isManagement = hasPortalAccess(
      user.stakRole,
      "staffManager",
    );

    const isOwner = absence.discord_user_id === user.discordUserId;

    if (!isOwner && !isManagement) {
      return json(
        {
          success: false,
          error: "You cannot access this absence notification.",
        },
        403,
      );
    }

    const action = body.action;
    const now = new Date().toISOString();

    let newStatus = absence.status;
    let managementNote = absence.management_note;
    let auditAction = "";
    let auditReason: string | null = null;

    if (action === "withdraw") {
      if (absence.status !== "submitted" && absence.status !== "reviewed") {
        return json(
          {
            success: false,
            error: "This notification can no longer be withdrawn.",
          },
          409,
        );
      }

      newStatus = "withdrawn";
      auditAction = "absence_withdrawn";

      if (typeof body.reason === "string") {
        auditReason = body.reason.trim() || null;
      }
    } else if (action === "review") {
      if (!isManagement) {
        return json(
          {
            success: false,
            error: "Management permission required.",
          },
          403,
        );
      }

      if (absence.status !== "submitted") {
        return json(
          {
            success: false,
            error: "Only submitted notifications can be reviewed.",
          },
          409,
        );
      }

      newStatus = "reviewed";
      auditAction = "absence_reviewed";

      if (body.managementNote !== undefined) {
        if (
          typeof body.managementNote !== "string" &&
          body.managementNote !== null
        ) {
          return json(
            {
              success: false,
              error: "Management note must be text or null.",
            },
            400,
          );
        }

        managementNote =
          typeof body.managementNote === "string"
            ? body.managementNote.trim() || null
            : null;
      }
    } else if (action === "complete") {
      if (!isManagement) {
        return json(
          {
            success: false,
            error: "Management permission required.",
          },
          403,
        );
      }

      if (absence.status !== "reviewed") {
        return json(
          {
            success: false,
            error: "Only reviewed notifications can be completed.",
          },
          409,
        );
      }

      newStatus = "completed";
      auditAction = "absence_completed";
    } else {
      return json(
        {
          success: false,
          error: "Unsupported absence action.",
        },
        400,
      );
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE staff_absences
        SET
          status = ?,
          management_note = ?,
          reviewed_by_discord_id = CASE
            WHEN ? IN ('reviewed', 'completed') THEN ?
            ELSE reviewed_by_discord_id
          END,
          reviewed_at = CASE
            WHEN ? IN ('reviewed', 'completed') THEN ?
            ELSE reviewed_at
          END,
          updated_at = ?
        WHERE id = ?
      `).bind(
        newStatus,
        managementNote,
        newStatus,
        user.discordUserId,
        newStatus,
        now,
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
        VALUES (?, ?, 'staff_absence', ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.discordUserId,
        id,
        auditAction,
        JSON.stringify({
          status: absence.status,
          managementNote: absence.management_note,
        }),
        JSON.stringify({
          status: newStatus,
          managementNote,
        }),
        auditReason,
        now,
      ),
    ]);

    const updatedAbsence = await findAbsence(id);

    return json({
      success: true,
      message: "Absence notification updated successfully.",
      absence: updatedAbsence,
    });
  } catch (error) {
    console.error("PATCH /api/staff/absences/[id] failed:", error);

    return json(
      {
        success: false,
        error: "Unable to update absence notification.",
      },
      500,
    );
  }
}