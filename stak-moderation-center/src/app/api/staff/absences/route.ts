import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type AbsenceRecord = {
  id: string;
  discord_user_id: string;
  username: string;
  global_name: string | null;
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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getDateDifference(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  const endTime = Date.parse(`${end}T00:00:00.000Z`);

  return Math.round((endTime - startTime) / 86400000);
}

async function getAuthorizedUser(request: Request) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json(
        { success: false, error: "Authentication required." },
        401,
      ),
    };
  }

  if (!hasPortalAccess(user.stakRole, "staff")) {
    return {
      user: null,
      response: json(
        { success: false, error: "Staff access required." },
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
 * GET /api/staff/absences
 *
 * Returns personal absence records.
 *
 * Management can use:
 * GET /api/staff/absences?scope=team
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const authorization = await getAuthorizedUser(request);

    if (!authorization.user) {
      return authorization.response!;
    }

    const user = authorization.user;
    const url = new URL(request.url);

    const requestedScope = url.searchParams.get("scope");
    const teamScope = requestedScope === "team";

    if (
      teamScope &&
      !hasPortalAccess(user.stakRole, "staffManager")
    ) {
      return json(
        {
          success: false,
          error: "Management permission required.",
        },
        403,
      );
    }

    const result = teamScope
      ? await env.DB.prepare(`
          SELECT
            a.id,
            a.discord_user_id,
            p.username,
            p.global_name,
            a.start_date,
            a.expected_return_date,
            a.reason,
            a.status,
            a.management_note,
            a.reviewed_by_discord_id,
            a.reviewed_at,
            a.created_at,
            a.updated_at
          FROM staff_absences a
          INNER JOIN staff_profiles p
            ON p.discord_user_id = a.discord_user_id
          ORDER BY
            CASE a.status
              WHEN 'submitted' THEN 0
              WHEN 'reviewed' THEN 1
              ELSE 2
            END,
            a.created_at DESC
          LIMIT 200
        `).all<AbsenceRecord>()
      : await env.DB.prepare(`
          SELECT
            a.id,
            a.discord_user_id,
            p.username,
            p.global_name,
            a.start_date,
            a.expected_return_date,
            a.reason,
            a.status,
            a.management_note,
            a.reviewed_by_discord_id,
            a.reviewed_at,
            a.created_at,
            a.updated_at
          FROM staff_absences a
          INNER JOIN staff_profiles p
            ON p.discord_user_id = a.discord_user_id
          WHERE a.discord_user_id = ?
          ORDER BY a.created_at DESC
          LIMIT 100
        `)
          .bind(user.discordUserId)
          .all<AbsenceRecord>();

    return json({
      success: true,
      scope: teamScope ? "team" : "personal",
      absences: result.results ?? [],
      total: result.results?.length ?? 0,
    });
  } catch (error) {
    console.error("GET /api/staff/absences failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve absence records.",
      },
      500,
    );
  }
}

/**
 * POST /api/staff/absences
 *
 * Submits a new personal absence notification.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = await getAuthorizedUser(request);

    if (!authorization.user) {
      return authorization.response!;
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

    if (!isRecord(body)) {
      return json(
        { success: false, error: "Invalid request data." },
        400,
      );
    }

    const startDate =
      typeof body.startDate === "string"
        ? body.startDate.trim()
        : "";

    const expectedReturnDate =
      typeof body.expectedReturnDate === "string"
        ? body.expectedReturnDate.trim() || null
        : null;

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (!isValidDate(startDate)) {
      return json(
        { success: false, error: "A valid start date is required." },
        400,
      );
    }

    if (
      expectedReturnDate !== null &&
      !isValidDate(expectedReturnDate)
    ) {
      return json(
        { success: false, error: "Invalid expected return date." },
        400,
      );
    }

    if (
      expectedReturnDate &&
      expectedReturnDate < startDate
    ) {
      return json(
        {
          success: false,
          error: "The return date cannot be before the absence start date.",
        },
        400,
      );
    }

    if (reason.length < 10 || reason.length > 3000) {
      return json(
        {
          success: false,
          error: "Please provide a meaningful reason between 10 and 3000 characters.",
        },
        400,
      );
    }

    const user = authorization.user;
    const now = new Date().toISOString();
    const absenceId = crypto.randomUUID();

    // Ensure the employee has a staff profile.
    await env.DB.prepare(`
      INSERT INTO staff_profiles (
        discord_user_id,
        username,
        global_name,
        staff_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'active', ?, ?)
      ON CONFLICT(discord_user_id)
      DO UPDATE SET
        username = excluded.username,
        global_name = excluded.global_name
    `)
      .bind(
        user.discordUserId,
        user.username,
        user.globalName,
        now,
        now,
      )
      .run();

    // A duplicate active notification for the same period
    // should not be created accidentally.
    const existing = await env.DB.prepare(`
      SELECT id
      FROM staff_absences
      WHERE discord_user_id = ?
        AND status IN ('submitted', 'reviewed')
        AND start_date = ?
      LIMIT 1
    `)
      .bind(user.discordUserId, startDate)
      .first<{ id: string }>();

    if (existing) {
      return json(
        {
          success: false,
          error: "An absence notification for this start date already exists.",
        },
        409,
      );
    }

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO staff_absences (
          id,
          discord_user_id,
          start_date,
          expected_return_date,
          reason,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?)
      `).bind(
        absenceId,
        user.discordUserId,
        startDate,
        expectedReturnDate,
        reason,
        now,
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
        VALUES (?, ?, 'staff_absence', ?, 'absence_submitted', ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.discordUserId,
        absenceId,
        JSON.stringify({
          startDate,
          expectedReturnDate,
          reason,
          status: "submitted",
        }),
        now,
      ),
    ]);

    return json(
      {
        success: true,
        message: "Absence notification submitted successfully.",
        absence: {
          id: absenceId,
          discordUserId: user.discordUserId,
          username: user.username,
          globalName: user.globalName,
          startDate,
          expectedReturnDate,
          reason,
          status: "submitted",
          createdAt: now,
        },
      },
      201,
    );
  } catch (error) {
    console.error("POST /api/staff/absences failed:", error);

    return json(
      {
        success: false,
        error: "Unable to submit absence notification.",
      },
      500,
    );
  }
}