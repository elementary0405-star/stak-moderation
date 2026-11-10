import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "@/lib/discord-auth";

const ALLOWED_ROLES = [
  "staff-manager",
  "management",
  "co-owner",
  "owner",
];

type DirectoryRecord = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  role: string;
  staffStatus: string;
  joinedAt: string | null;
  absenceId: string | null;
  absenceStart: string | null;
  absenceReturn: string | null;
  absenceStatus: string | null;
  warningCount: number;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return json({ error: "Authentication required." }, 401);
    }

    if (!ALLOWED_ROLES.includes(user.stakRole)) {
      return json({ error: "Access denied." }, 403);
    }

    const result = await env.DB.prepare(`
      WITH active_sessions AS (
        SELECT
          discord_user_id,
          username,
          global_name,
          stak_role,
          ROW_NUMBER() OVER (
            PARTITION BY discord_user_id
            ORDER BY created_at DESC
          ) AS session_rank
        FROM discord_sessions
        WHERE datetime(expires_at) > datetime('now')
          AND stak_role IN (
            'staff-manager',
            'management',
            'co-owner',
            'owner',
            'moderator',
            'trail-moderator'
          )
      ),

      current_absences AS (
        SELECT
          id,
          discord_user_id,
          start_date,
          expected_return_date,
          status,
          ROW_NUMBER() OVER (
            PARTITION BY discord_user_id
            ORDER BY start_date DESC, created_at DESC
          ) AS absence_rank
        FROM staff_absences
        WHERE status IN ('submitted', 'reviewed')
          AND (
            expected_return_date IS NULL
            OR expected_return_date >= date('now')
          )
      ),

      warning_counts AS (
        SELECT
          discord_user_id,
          COUNT(*) AS warning_count
        FROM staff_warnings
        WHERE status = 'active'
        GROUP BY discord_user_id
      )

      SELECT
        sessions.discord_user_id AS discordUserId,
        COALESCE(profiles.username, sessions.username) AS username,
        COALESCE(profiles.global_name, sessions.global_name) AS globalName,
        sessions.stak_role AS role,
        COALESCE(profiles.staff_status, 'active') AS staffStatus,
        profiles.joined_at AS joinedAt,

        absences.id AS absenceId,
        absences.start_date AS absenceStart,
        absences.expected_return_date AS absenceReturn,
        absences.status AS absenceStatus,

        COALESCE(warnings.warning_count, 0) AS warningCount

      FROM active_sessions AS sessions

      LEFT JOIN staff_profiles AS profiles
        ON profiles.discord_user_id = sessions.discord_user_id

      LEFT JOIN current_absences AS absences
        ON absences.discord_user_id = sessions.discord_user_id
        AND absences.absence_rank = 1

      LEFT JOIN warning_counts AS warnings
        ON warnings.discord_user_id = sessions.discord_user_id

      WHERE sessions.session_rank = 1

      ORDER BY
        CASE sessions.stak_role
          WHEN 'owner' THEN 1
          WHEN 'co-owner' THEN 2
          WHEN 'management' THEN 3
          WHEN 'staff-manager' THEN 4
          WHEN 'moderator' THEN 5
          WHEN 'trail-moderator' THEN 6
          ELSE 7
        END,
        COALESCE(profiles.global_name, sessions.global_name, sessions.username)
          COLLATE NOCASE ASC
    `).all<DirectoryRecord>();

    const members = result.results ?? [];

    return json({
      members,
      total: members.length,
      active: members.filter(
        (member) =>
          member.staffStatus === "active" && !member.absenceId,
      ).length,
      absent: members.filter(
        (member) => Boolean(member.absenceId),
      ).length,
      inactive: members.filter(
        (member) => member.staffStatus === "inactive",
      ).length,
    });
  } catch (error) {
    console.error("[staff-directory]", error);

    return json(
      { error: "Unable to load the staff directory." },
      500,
    );
  }
}