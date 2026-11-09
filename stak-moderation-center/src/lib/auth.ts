import { env } from "cloudflare:workers";
import type { StakRole } from "./discord-roles";

const SESSION_COOKIE_NAME = "stak_session";
const SESSION_DURATION_DAYS = 30;

export type DiscordSessionUser = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  stakRole: StakRole;
};

type DiscordSessionRow = {
  id: string;
  discord_user_id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  stak_role: StakRole;
  expires_at: string;
};

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex).trim();
    const cookieValue = cookie.slice(separatorIndex + 1).trim();

    if (cookieName === name) {
      return cookieValue;
    }
  }

  return null;
}

export async function createDiscordSession(
  user: DiscordSessionUser
): Promise<{ token: string; expiresAt: string }> {
  const token = generateToken();
  const tokenHash = await hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const sessionId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO discord_sessions (
      id,
      discord_user_id,
      username,
      global_name,
      avatar,
      stak_role,
      token_hash,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      sessionId,
      user.discordUserId,
      user.username,
      user.globalName,
      user.avatar,
      user.stakRole,
      tokenHash,
      expiresAt
    )
    .run();

  return {
    token,
    expiresAt,
  };
}

export async function getDiscordSession(
  request: Request
): Promise<DiscordSessionUser | null> {
  const token = getCookie(request, SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  const tokenHash = await hashToken(token);

  const session = await env.DB.prepare(`
    SELECT
      discord_user_id,
      username,
      global_name,
      avatar,
      stak_role,
      expires_at
    FROM discord_sessions
    WHERE token_hash = ?
      AND expires_at > ?
    LIMIT 1
  `)
    .bind(tokenHash, new Date().toISOString())
    .first<DiscordSessionRow>();

  if (!session) {
    return null;
  }

  return {
    discordUserId: session.discord_user_id,
    username: session.username,
    globalName: session.global_name,
    avatar: session.avatar,
    stakRole: session.stak_role,
  };
}

export async function deleteDiscordSession(
  request: Request
): Promise<void> {
  const token = getCookie(request, SESSION_COOKIE_NAME);

  if (!token) {
    return;
  }

  const tokenHash = await hashToken(token);

  await env.DB.prepare(`
    DELETE FROM discord_sessions
    WHERE token_hash = ?
  `)
    .bind(tokenHash)
    .run();
}

export function createSessionCookie(token: string): string {
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}