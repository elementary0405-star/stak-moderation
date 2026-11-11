import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

export async function GET(request: Request) {
  const authorization = await authorizePortalRequest(request, "staffManager");
  if ("response" in authorization) return authorization.response;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "all";
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (status !== "all") {
      conditions.push("a.status = ?");
      values.push(status);
    }
    if (search) {
      conditions.push("(a.reference_code LIKE ? OR a.applicant_name LIKE ? OR a.discord_username LIKE ? OR a.discord_user_id LIKE ?)");
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await env.DB.prepare(`
      SELECT a.id, a.reference_code AS referenceCode, a.applicant_name AS applicantName,
             a.discord_username AS discordUsername, a.discord_user_id AS discordUserId,
             a.primary_device AS primaryDevice, a.status, a.submitted_at AS submittedAt,
             a.assigned_to_discord_id AS assignedToDiscordId,
             a.reviewed_at AS reviewedAt
      FROM applications a
      ${where}
      ORDER BY a.submitted_at DESC
      LIMIT 200
    `).bind(...values).all();

    const counts = await env.DB.prepare(`
      SELECT status, COUNT(*) AS count FROM applications GROUP BY status
    `).all<{ status: string; count: number }>();

    return Response.json({ applications: result.results ?? [], counts: counts.results ?? [] }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-applications-list]", error);
    return Response.json({ error: "Unable to load applications." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  return Response.json({ error: "Use the individual application endpoint to update a review." }, { status: 405, headers: noStoreHeaders() });
}
