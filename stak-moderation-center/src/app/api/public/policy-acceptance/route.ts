import { env } from "cloudflare:workers";
import { getPublicPolicyAcknowledgements } from "@/lib/application-policy";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";
import { getFreshDiscordSession, StakAccessRoleMissingError } from "@/lib/discord-auth";
import type { DiscordSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  }

  let user: DiscordSessionUser | null;
  try {
    user = await getFreshDiscordSession(request);
  } catch (error) {
    if (error instanceof StakAccessRoleMissingError) {
      return Response.json({ error: "Your STAK access role has not been assigned yet." }, { status: 403, headers: noStoreHeaders() });
    }
    return Response.json({ error: "Discord access verification is temporarily unavailable." }, { status: 503, headers: noStoreHeaders() });
  }
  if (!user) return Response.json({ error: "Connect your Discord account before acknowledging Staff Guidelines." }, { status: 401, headers: noStoreHeaders() });

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || typeof body.policyVersionId !== "string" || !Array.isArray(body.acceptedKeys)) {
      return Response.json({ error: "Invalid Staff Guidelines acknowledgement." }, { status: 400, headers: noStoreHeaders() });
    }
    const acceptedKeys = [...new Set(body.acceptedKeys.filter((key): key is string => typeof key === "string"))];
    if (acceptedKeys.length > 30) {
      return Response.json({ error: "Too many acknowledgement values were submitted." }, { status: 400, headers: noStoreHeaders() });
    }

    const policy = await env.DB.prepare(`
      SELECT id FROM policy_versions WHERE id = ? AND status = 'published' LIMIT 1
    `).bind(body.policyVersionId).first<{ id: string }>();
    if (!policy) {
      return Response.json({ error: "The published guidelines have changed. Reload the page and review the current version." }, { status: 409, headers: noStoreHeaders() });
    }

    const result = await env.DB.prepare(`
      SELECT acknowledgement_key AS key, label, explanation,
             is_required AS isRequired, acknowledgement_type AS type,
             sort_order AS sortOrder
      FROM policy_acknowledgements WHERE policy_version_id = ?
    `).bind(policy.id).all<{ key: string; label: string; explanation: string; isRequired: number; type: string; sortOrder: number }>();
    const publicRows = getPublicPolicyAcknowledgements((result.results ?? []).map((row) => ({
      ...row,
      isRequired: Number(row.isRequired) === 1,
      sortOrder: Number(row.sortOrder),
    })));
    const validKeys = new Set(publicRows.map((row) => row.key));
    const requiredKeys = publicRows.filter((row) => row.isRequired).map((row) => row.key);
    const invalidKeys = acceptedKeys.filter((key) => !validKeys.has(key));
    const missingKeys = requiredKeys.filter((key) => !acceptedKeys.includes(key));
    if (requiredKeys.length === 0 || invalidKeys.length > 0 || missingKeys.length > 0) {
      return Response.json({ error: "Please confirm every required Staff Guidelines statement and reload the current version if it has changed." }, { status: 400, headers: noStoreHeaders() });
    }

    const acceptedAt = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO staff_guideline_acceptances (discord_user_id, policy_version_id, accepted_keys_json, accepted_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(discord_user_id, policy_version_id)
      DO UPDATE SET accepted_keys_json = excluded.accepted_keys_json, accepted_at = excluded.accepted_at
    `).bind(user.discordUserId, policy.id, JSON.stringify(acceptedKeys), acceptedAt).run();

    return Response.json({ accepted: true, acceptedAt, policyVersionId: policy.id }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[policy-acceptance]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Your acknowledgement could not be saved. Please try again." }, { status: 500, headers: noStoreHeaders() });
  }
}
