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

type FeedbackInboxRecord = {
  id: string;
  discordUserId: string;
  category: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  ownerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

  // Intentionally Owner-only.
  // Co-Owner, Management and Staff Manager do not have access.
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
 * GET /api/staff/feedback/inbox
 *
 * Returns all feedback messages.
 * This endpoint is strictly Owner-only.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireOwner(request);

    if (!auth.allowed) {
      return auth.response;
    }

    const url = new URL(request.url);

    const statusParam = url.searchParams.get("status");
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);

    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const requestedOffset = Number(url.searchParams.get("offset") ?? 0);

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;

    const offset = Number.isFinite(requestedOffset)
      ? Math.max(Math.floor(requestedOffset), 0)
      : 0;

    const filters: string[] = [];
    const bindings: Array<string | number> = [];

    if (
      statusParam &&
      statusParam !== "all" &&
      FEEDBACK_STATUSES.includes(statusParam as FeedbackStatus)
    ) {
      filters.push("status = ?");
      bindings.push(statusParam);
    }

    if (search) {
      filters.push(`
        (
          subject LIKE ?
          OR message LIKE ?
          OR discord_user_id LIKE ?
        )
      `);

      const searchValue = `%${search}%`;
      bindings.push(searchValue, searchValue, searchValue);
    }

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await env.DB.prepare(`
      SELECT
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
      FROM staff_feedback
      ${whereClause}
      ORDER BY
        CASE status
          WHEN 'new' THEN 0
          WHEN 'under_review' THEN 1
          WHEN 'addressed' THEN 2
          WHEN 'archived' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, limit, offset)
      .all<FeedbackInboxRecord>();

    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM staff_feedback
      ${whereClause}
    `)
      .bind(...bindings)
      .first<{ total: number }>();

    return json({
      feedback: result.results ?? [],
      pagination: {
        limit,
        offset,
        total: count?.total ?? 0,
      },
    });
  } catch (error) {
    console.error("[staff-feedback-inbox]", error);
    return json({ error: "Unable to load the feedback inbox." }, 500);
  }
}