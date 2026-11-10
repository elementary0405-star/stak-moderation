import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";

type StaffProfileRow = {
  discord_user_id: string;
  username: string;
  global_name: string | null;
  staff_status: string;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

type StaffWarningRow = {
  id: string;
  warning_type: string;
  reason: string;
  status: string;
  resolved_at: string | null;
  resolution_reason: string | null;
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

/**
 * GET /api/staff/me
 *
 * Returns the authenticated staff member's personal staff record.
 * Internal management notes are deliberately excluded.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return json(
        {
          success: false,
          error: "Authentication required.",
        },
        401,
      );
    }

    if (!hasPortalAccess(user.stakRole, "staff")) {
      return json(
        {
          success: false,
          error: "Staff access required.",
        },
        403,
      );
    }

    const now = new Date().toISOString();

    // Create the staff profile on first access.
    // Existing profile information is preserved.
    await env.DB.prepare(`
      INSERT INTO staff_profiles (
        discord_user_id,
        username,
        global_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(discord_user_id)
      DO UPDATE SET
        username = excluded.username,
        global_name = excluded.global_name,
        updated_at = excluded.updated_at
    `)
      .bind(
        user.discordUserId,
        user.username,
        user.globalName,
        now,
        now,
      )
      .run();

    const [profile, warningResult, warningCount] = await Promise.all([
      env.DB.prepare(`
        SELECT
          discord_user_id,
          username,
          global_name,
          staff_status,
          joined_at,
          created_at,
          updated_at
        FROM staff_profiles
        WHERE discord_user_id = ?
        LIMIT 1
      `)
        .bind(user.discordUserId)
        .first<StaffProfileRow>(),

      env.DB.prepare(`
        SELECT
          id,
          warning_type,
          reason,
          status,
          resolved_at,
          resolution_reason,
          created_at
        FROM staff_warnings
        WHERE discord_user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `)
        .bind(user.discordUserId)
        .all<StaffWarningRow>(),

      env.DB.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(
            CASE WHEN status = 'active' THEN 1 ELSE 0 END
          ) AS active
        FROM staff_warnings
        WHERE discord_user_id = ?
      `)
        .bind(user.discordUserId)
        .first<{
          total: number;
          active: number | null;
        }>(),
    ]);

    if (!profile) {
      throw new Error("Staff profile could not be retrieved.");
    }

    return json({
      success: true,

      staffRecord: {
        discordUserId: profile.discord_user_id,
        username: profile.username,
        globalName: profile.global_name,

        currentRole: user.stakRole,
        status: profile.staff_status,

        joinedAt: profile.joined_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },

      warnings: warningResult.results ?? [],

      summary: {
        totalWarnings: warningCount?.total ?? 0,
        activeWarnings: warningCount?.active ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/staff/me failed:", error);

    return json(
      {
        success: false,
        error: "Unable to retrieve your staff record.",
      },
      500,
    );
  }
}