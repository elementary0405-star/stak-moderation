import { env } from "cloudflare:workers";
import { authorizePortalPermissionRequest } from "@/lib/portal-api-auth";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";

function containsUnfilledPlaceholder(value: string): boolean {
  return /\[[^\]]{2,}\]/.test(value);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const authorization = await authorizePortalPermissionRequest(request, "applications.publish");
  if ("response" in authorization) return authorization.response;

  try {
    const draft = await env.DB.prepare(`
      SELECT id, title, introduction, policy_content AS policyContent,
             privacy_notice AS privacyNotice, version
      FROM policy_versions WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1
    `).first<Record<string, unknown>>();
    if (!draft) return Response.json({ error: "There is no saved draft to publish." }, { status: 404, headers: noStoreHeaders() });

    const content = String(draft.policyContent ?? "");
    const privacyNotice = String(draft.privacyNotice ?? "");
    if (content.length < 100 || privacyNotice.length < 100 || containsUnfilledPlaceholder(content) || containsUnfilledPlaceholder(privacyNotice) || /not ready for publication|draft;/i.test(privacyNotice)) {
      return Response.json({ error: "The policy or privacy notice still contains unfinished placeholders or draft language. Complete and verify every required legal/privacy detail before publication." }, { status: 400, headers: noStoreHeaders() });
    }
    const requirements = await env.DB.prepare(`
      SELECT acknowledgement_key AS key, is_required AS isRequired, acknowledgement_type AS type
      FROM policy_acknowledgements WHERE policy_version_id = ?
    `).bind(String(draft.id)).all<{ key: string; isRequired: number; type: string }>();
    if (!(requirements.results ?? []).some((item) => Number(item.isRequired) === 1 && item.type === "policy") || !(requirements.results ?? []).some((item) => Number(item.isRequired) === 1 && item.type === "privacy_notice")) {
      return Response.json({ error: "The draft must include a required policy acknowledgement and a separate required privacy-notice acknowledgement." }, { status: 400, headers: noStoreHeaders() });
    }

    const publishedAt = new Date().toISOString();
    const publishedVersion = String(draft.version).replace(/-draft$/i, "");
    await env.DB.batch([
      env.DB.prepare(`UPDATE policy_versions SET status = 'archived' WHERE status = 'published'`),
      env.DB.prepare(`UPDATE policy_versions SET version = ?, status = 'published', published_at = ?, updated_at = CURRENT_TIMESTAMP, created_by_discord_id = ? WHERE id = ? AND status = 'draft'`)
        .bind(publishedVersion, publishedAt, authorization.user.discordUserId, String(draft.id)),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_discord_id, entity_type, entity_id, action, new_values) VALUES (?, ?, 'policy_version', ?, 'published', ?)`)
        .bind(crypto.randomUUID(), authorization.user.discordUserId, String(draft.id), JSON.stringify({ version: draft.version })),
    ]);
    return Response.json({ published: true, version: publishedVersion, publishedAt }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[admin-policy-publish]", error);
    return Response.json({ error: "Unable to publish the policy version." }, { status: 500, headers: noStoreHeaders() });
  }
}
