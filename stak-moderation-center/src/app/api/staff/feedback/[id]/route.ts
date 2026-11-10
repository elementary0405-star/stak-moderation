import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

const FEEDBACK_STATUSES = [
  "new",
  "under_review",
  "addressed",
  "archived",
] as const;

type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function requireOwner(request: Request) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      allowed: false,
      response: json({ error: "Authentication required." }, 401),
    };
  }

  // The feedback inbox and its management actions are Owner-only.
  if (!hasPortalAccess(user.stakRole, "owner")) {
    return {
      allowed: false,
      response: json({ error: "Owner access required." }, 403),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}

/**
 * PATCH /api/staff/feedback/:id
 *
 * Allows the Owner to update a feedback status and internal note.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireOwner(request);

    if (!auth.allowed) {
      return auth.response;
    }

    const { id } = await context.params;

    if (!id || id.length > 80) {
      return json({ error: "Invalid feedback ID." }, 400);
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const status =
      typeof body.status === "string" ? body.status : null;

    const ownerNote =
      typeof body.ownerNote === "string" ? body.ownerNote.trim() : null;

    if (
      status !== null &&
      !FEEDBACK_STATUSES.includes(status as FeedbackStatus)
    ) {
      return json({ error: "Invalid feedback status." }, 400);
    }

    if (ownerNote !== null && ownerNote.length > 3000) {
      return json(
        { error: "The internal note must not exceed 3000 characters." },
        400,
      );
    }

    if (status === null && ownerNote === null) {
      return json(
        { error: "No changes were provided." },
        400,
      );
    }

    const existing = await env.DB.prepare(`
      SELECT id, status, owner_note AS ownerNote
      FROM staff_feedback
      WHERE id = ?
    `)
      .bind(id)
      .first<{
        id: string;
        status: FeedbackStatus;
        ownerNote: string | null;
      }>();

    if (!existing) {
      return json({ error: "Feedback message not found." }, 404);
    }

    const nextStatus = status ?? existing.status;
    const nextOwnerNote = ownerNote ?? existing.ownerNote;

    const updated = await env.DB.prepare(`
      UPDATE staff_feedback
      SET
        status = ?,
        owner_note = ?,
        reviewed_at = CASE
          WHEN ? IN ('under_review', 'addressed', 'archived')
            THEN COALESCE(reviewed_at, datetime('now'))
          ELSE NULL
        END,
        updated_at = datetime('now')
      WHERE id = ?
      RETURNING
        id,
        discord_user_id AS discordUserId,
        category,
        subject,
        message,
        status,
        owner_note AS ownerNote,
        reviewed_at AS reviewedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
    `)
      .bind(
        nextStatus,
        nextOwnerNote,
        nextStatus,
        id,
      )
      .first();

    if (!updated) {
      return json({ error: "The feedback message could not be updated." }, 500);
    }

    return json({
      message: "Feedback message updated successfully.",
      feedback: updated,
    });
  } catch (error) {
    console.error("[staff-feedback-update]", error);
    return json({ error: "Unable to update the feedback message." }, 500);
  }
}