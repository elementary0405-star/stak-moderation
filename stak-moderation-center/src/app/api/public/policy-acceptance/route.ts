import { env } from "cloudflare:workers";
import { getOrCreateApplicationVisitor, isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || typeof body.policyVersionId !== "string" || !Array.isArray(body.acceptedKeys)) {
      return Response.json({ error: "Invalid acknowledgement submission." }, { status: 400, headers: noStoreHeaders() });
    }

    const acceptedKeys = [...new Set(body.acceptedKeys.filter((key): key is string => typeof key === "string"))];
    const visitor = await getOrCreateApplicationVisitor(request);
    const policy = await env.DB.prepare(`
      SELECT id FROM policy_versions WHERE id = ? AND status = 'published' LIMIT 1
    `).bind(body.policyVersionId).first<{ id: string }>();

    if (!policy) {
      return Response.json({ error: "The policy version is no longer active. Reload the page and review the current version." }, {
        status: 409,
        headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
      });
    }

    const rows = await env.DB.prepare(`
      SELECT acknowledgement_key AS key, is_required AS isRequired
      FROM policy_acknowledgements WHERE policy_version_id = ?
    `).bind(policy.id).all<{ key: string; isRequired: number }>();
    const validKeys = new Set((rows.results ?? []).map((row) => row.key));
    const missingRequired = (rows.results ?? [])
      .filter((row) => Number(row.isRequired) === 1 && !acceptedKeys.includes(row.key))
      .map((row) => row.key);
    const invalidKeys = acceptedKeys.filter((key) => !validKeys.has(key));

    if (missingRequired.length || invalidKeys.length) {
      return Response.json({ error: "Please complete every required acknowledgement and reload the current policy before continuing.", missingRequired }, {
        status: 400,
        headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
      });
    }

    const acceptedAt = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO policy_acceptances (visitor_key_hash, policy_version_id, accepted_items_json, accepted_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(visitor_key_hash, policy_version_id)
      DO UPDATE SET accepted_items_json = excluded.accepted_items_json, accepted_at = excluded.accepted_at
    `).bind(visitor.visitorKeyHash, policy.id, JSON.stringify(acceptedKeys), acceptedAt).run();

    return Response.json({ accepted: true, acceptedAt }, {
      headers: noStoreHeaders(visitor.setCookie ? { "Set-Cookie": visitor.setCookie } : undefined),
    });
  } catch (error) {
    console.error("[public-policy-acceptance]", error);
    return Response.json({ error: "Your acknowledgement could not be saved. Please try again." }, { status: 500, headers: noStoreHeaders() });
  }
}
