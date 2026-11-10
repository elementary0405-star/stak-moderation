import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import type { DiscordSessionUser } from "@/lib/auth";

const FEEDBACK_CATEGORIES = [
  "general",
  "suggestion",
  "concern",
  "procedure",
  "other",
] as const;

type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

type FeedbackRecord = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type StaffAuth =
  | { user: DiscordSessionUser; response: null }
  | { user: null; response: Response };

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function getStaffUser(request: Request): Promise<StaffAuth> {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json({ error: "Authentication required." }, 401),
    };
  }

  if (!hasPortalAccess(user.stakRole, "staff")) {
    return {
      user: null,
      response: json({ error: "Access denied." }, 403),
    };
  }

  return {
    user,
    response: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * GET /api/staff/feedback
 *
 * Returns only feedback messages submitted by the signed-in user.
 * Internal Owner notes are never included.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await getStaffUser(request);

    if (!auth.user) {
      return auth.response;
    }

    const url = new URL(request.url);

    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const requestedOffset = Number(url.searchParams.get("offset") ?? 0);

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;

    const offset = Number.isFinite(requestedOffset)
      ? Math.max(Math.floor(requestedOffset), 0)
      : 0;

    const result = await env.DB.prepare(`
      SELECT
        id,
        category,
        subject,
        message,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM staff_feedback
      WHERE discord_user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(auth.user.discordUserId, limit, offset)
      .all<FeedbackRecord>();

    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM staff_feedback
      WHERE discord_user_id = ?
    `)
      .bind(auth.user.discordUserId)
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
    console.error("[staff-feedback-get]", error);

    return json(
      { error: "Unable to load your feedback messages." },
      500,
    );
  }
}

/**
 * POST /api/staff/feedback
 *
 * Creates a confidential feedback message for the Owner.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await getStaffUser(request);

    if (!auth.user) {
      return auth.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    if (!isObject(body)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const category =
      typeof body.category === "string" ? body.category : "";

    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "";

    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
      return json(
        { error: "Please select a valid feedback category." },
        400,
      );
    }

    if (subject.length < 3 || subject.length > 120) {
      return json(
        { error: "The subject must contain between 3 and 120 characters." },
        400,
      );
    }

    if (message.length < 10 || message.length > 5000) {
      return json(
        { error: "The message must contain between 10 and 5000 characters." },
        400,
      );
    }

    const result = await env.DB.prepare(`
      INSERT INTO staff_feedback (
        discord_user_id,
        category,
        subject,
        message,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 'new', datetime('now'), datetime('now'))
      RETURNING
        id,
        category,
        subject,
        message,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
    `)
      .bind(
        auth.user.discordUserId,
        category,
        subject,
        message,
      )
      .first<FeedbackRecord>();

    if (!result) {
      return json(
        { error: "The feedback message could not be saved." },
        500,
      );
    }

    return json(
      {
        message: "Your feedback has been sent successfully.",
        feedback: result,
      },
      201,
    );
  } catch (error) {
    console.error("[staff-feedback-create]", error);

    return json(
      { error: "Unable to submit your feedback." },
      500,
    );
  }
}