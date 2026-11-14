import { env } from "cloudflare:workers";
import { isPlainObject, isSameOriginRequest, noStoreHeaders } from "@/lib/application-public";
import { getFreshDiscordSession, StakAccessRoleMissingError } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import type { DiscordSessionUser } from "@/lib/auth";

const ONBOARDING_VERSIONS = { community: "community-1", staff: "staff-1" } as const;
type OnboardingArea = keyof typeof ONBOARDING_VERSIONS;

function validArea(value: string | null): value is OnboardingArea {
  return value === "community" || value === "staff";
}

async function getUser(request: Request): Promise<DiscordSessionUser | Response> {
  try {
    const user = await getFreshDiscordSession(request);
    if (user) return user;
    return Response.json({ error: "Connect your Discord account to continue." }, { status: 401, headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof StakAccessRoleMissingError) {
      return Response.json({ error: "Your STAK access role has not been assigned yet.", access: "missing_role" }, { status: 403, headers: noStoreHeaders() });
    }
    return Response.json({ error: "Discord access verification is temporarily unavailable." }, { status: 503, headers: noStoreHeaders() });
  }
}

function canUseArea(user: DiscordSessionUser, area: OnboardingArea) {
  return hasPortalAccess(user.stakRole, area);
}

export async function GET(request: Request) {
  const area = new URL(request.url).searchParams.get("area");
  if (!validArea(area)) return Response.json({ error: "Unknown onboarding area." }, { status: 400, headers: noStoreHeaders() });
  const user = await getUser(request);
  if (user instanceof Response) return user;
  if (!canUseArea(user, area)) return Response.json({ error: "This onboarding is not available to your role." }, { status: 403, headers: noStoreHeaders() });

  try {
    const version = ONBOARDING_VERSIONS[area];
    const progress = await env.DB.prepare(`
      SELECT status, completed_at AS completedAt, skipped_at AS skippedAt
      FROM user_onboarding_progress
      WHERE discord_user_id = ? AND area = ? AND version = ? LIMIT 1
    `).bind(user.discordUserId, area, version).first<{ status: "completed" | "skipped"; completedAt: string | null; skippedAt: string | null }>();
    return Response.json({
      area,
      version,
      status: progress?.status ?? null,
      completedAt: progress?.completedAt ?? null,
      skippedAt: progress?.skippedAt ?? null,
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[onboarding-read]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Introduction progress could not be loaded." }, { status: 503, headers: noStoreHeaders() });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers: noStoreHeaders() });
  const user = await getUser(request);
  if (user instanceof Response) return user;

  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body) || !validArea(typeof body.area === "string" ? body.area : null)
      || (body.status !== "completed" && body.status !== "skipped")) {
      return Response.json({ error: "Invalid introduction progress." }, { status: 400, headers: noStoreHeaders() });
    }
    const area = body.area as OnboardingArea;
    if (!canUseArea(user, area)) return Response.json({ error: "This onboarding is not available to your role." }, { status: 403, headers: noStoreHeaders() });

    const now = new Date().toISOString();
    const status = body.status;
    const completedAt = status === "completed" ? now : null;
    const skippedAt = status === "skipped" ? now : null;
    await env.DB.prepare(`
      INSERT INTO user_onboarding_progress (
        discord_user_id, area, version, status, completed_at, skipped_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_user_id, area, version) DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at,
        skipped_at = excluded.skipped_at,
        updated_at = excluded.updated_at
    `).bind(user.discordUserId, area, ONBOARDING_VERSIONS[area], status, completedAt, skippedAt, now).run();
    return Response.json({ saved: true, area, version: ONBOARDING_VERSIONS[area], status, updatedAt: now }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[onboarding-save]", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Introduction progress could not be saved." }, { status: 500, headers: noStoreHeaders() });
  }
}
