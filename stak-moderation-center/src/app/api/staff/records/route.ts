/// <reference path="../../../../../.cloudflare/types/index.d.ts" />

import { env } from "cloudflare:workers";
import { getFreshDiscordSession } from "../../../../lib/discord-auth";
import { hasPortalAccess } from "../../../../lib/portal-access";

const STAFF_STATUSES = ["active", "on_leave", "inactive"] as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorize(request: Request) {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return {
      user: null,
      response: json({ error: "Authentication required." }, 401),
    };
  }

  if (!hasPortalAccess(user.stakRole, "staffManager")) {
    return {
      user: null,
      response: json({ error: "Access denied." }, 403),
    };
  }

  return { user, response: null };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "all";
    const search = (url.searchParams.get("search") ?? "").trim();

    if (
      status !== "all" &&
      !STAFF_STATUSES.includes(status as typeof STAFF_STATUSES[number])
    ) {
      return json({ error: "Invalid staff status." }, 400);
    }

    const conditions: string[] = [];
    const values: string[] = [];

    if (status !== "all") {
      conditions.push("staff_status = ?");
      values.push(status);
    }

    if (search) {
      conditions.push(`
        (
          username LIKE ?
          OR global_name LIKE ?
          OR discord_user_id LIKE ?
        )
      `);

      const term = `%${search}%`;
      values.push(term, term, term);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await env.DB.prepare(`
      SELECT
        discord_user_id AS discordUserId,
        username,
        global_name AS globalName,
        staff_status AS staffStatus,
        joined_at AS joinedAt,
        internal_notes AS internalNotes,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM staff_profiles
      ${where}
      ORDER BY username COLLATE NOCASE ASC
      LIMIT 200
    `)
      .bind(...values)
      .all();

    return json({
      staff: result.results ?? [],
    });
  } catch (error) {
    console.error("[staff-records-get]", error);

    return json({
      error: "Unable to load staff records.",
    }, 500);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const auth = await authorize(request);

    if (!auth.user) {
      return auth.response!;
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

    const discordUserId =
      typeof body.discordUserId === "string"
        ? body.discordUserId.trim()
        : "";

    if (!/^\d{17,20}$/.test(discordUserId)) {
      return json({ error: "Invalid Discord user ID." }, 400);
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];
    const changes: Record<string, unknown> = {};

    if ("staffStatus" in body) {
      const staffStatus =
        typeof body.staffStatus === "string"
          ? body.staffStatus
          : "";

      if (
        !STAFF_STATUSES.includes(
          staffStatus as typeof STAFF_STATUSES[number],
        )
      ) {
        return json({ error: "Invalid staff status." }, 400);
      }

      updates.push("staff_status = ?");
      values.push(staffStatus);
      changes.staffStatus = staffStatus;
    }

    if ("joinedAt" in body) {
      const joinedAt =
        typeof body.joinedAt === "string"
          ? body.joinedAt.trim()
          : "";

      if (
        joinedAt &&
        !/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)
      ) {
        return json({ error: "Invalid joining date." }, 400);
      }

      updates.push("joined_at = ?");
      values.push(joinedAt || null);
      changes.joinedAt = joinedAt || null;
    }

    if ("internalNotes" in body) {
      const internalNotes =
        typeof body.internalNotes === "string"
          ? body.internalNotes.trim()
          : "";

      if (internalNotes.length > 5000) {
        return json({ error: "Internal notes are too long." }, 400);
      }

      updates.push("internal_notes = ?");
      values.push(internalNotes || null);
      changes.internalNotes = internalNotes || null;
    }

    if (updates.length === 0) {
      return json({ error: "No valid changes provided." }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT
        discord_user_id,
        staff_status,
        joined_at,
        internal_notes
      FROM staff_profiles
      WHERE discord_user_id = ?
    `)
      .bind(discordUserId)
      .first<{
        discord_user_id: string;
        staff_status: string;
        joined_at: string | null;
        internal_notes: string | null;
      }>();

    if (!existing) {
      return json({ error: "Staff record not found." }, 404);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(discordUserId);

    const updateStatement = env.DB.prepare(`
      UPDATE staff_profiles
      SET ${updates.join(", ")}
      WHERE discord_user_id = ?
    `).bind(...values);

    const auditStatement = env.DB.prepare(`
      INSERT INTO audit_logs (
        id,
        actor_discord_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
      )
      VALUES (?, ?, 'staff_profile', ?, 'updated', ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.user.discordUserId,
      discordUserId,
      JSON.stringify({
        staffStatus: existing.staff_status,
        joinedAt: existing.joined_at,
        internalNotes: existing.internal_notes,
      }),
      JSON.stringify(changes),
    );

    await env.DB.batch([
      updateStatement,
      auditStatement,
    ]);

    return json({
      message: "Staff record updated.",
      discordUserId,
      changes,
    });
  } catch (error) {
    console.error("[staff-records-update]", error);

    return json({
      error: "Unable to update staff record.",
    }, 500);
  }
}