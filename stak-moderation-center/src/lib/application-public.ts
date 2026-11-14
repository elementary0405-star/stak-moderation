import { env } from "cloudflare:workers";

const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ApplicationVisitor = {
  visitorKeyHash: string;
  setCookie?: string;
};

function visitorCookieName(request: Request): string {
  return new URL(request.url).protocol === "https:" ? "__Host-stak_application_visit" : "stak_application_visit";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieHeader(request: Request, token: string): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${visitorCookieName(request)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${VISITOR_MAX_AGE_SECONDS}${secure}`;
}

export async function getOrCreateApplicationVisitor(request: Request): Promise<ApplicationVisitor> {
  const existingToken = readCookie(request, visitorCookieName(request));
  if (existingToken && /^[a-f0-9]{64}$/i.test(existingToken)) {
    const existingHash = await hashToken(existingToken);
    const existing = await env.DB.prepare(`
      SELECT visitor_key_hash FROM application_visitors
      WHERE visitor_key_hash = ? AND expires_at > ? LIMIT 1
    `).bind(existingHash, new Date().toISOString()).first<{ visitor_key_hash: string }>();

    if (existing) {
      await env.DB.prepare(`UPDATE application_visitors SET last_seen_at = ? WHERE visitor_key_hash = ?`)
        .bind(new Date().toISOString(), existingHash).run();
      return { visitorKeyHash: existingHash };
    }
  }

  const token = createToken();
  const visitorKeyHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VISITOR_MAX_AGE_SECONDS * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO application_visitors (visitor_key_hash, expires_at, last_seen_at)
    VALUES (?, ?, ?)
  `).bind(visitorKeyHash, expiresAt, now.toISOString()).run();

  return { visitorKeyHash, setCookie: cookieHeader(request, token) };
}

/**
 * The legacy applications table requires a visitor key for referential
 * integrity. New authenticated submissions receive an unexposed random key;
 * Discord identity and policy acknowledgement are stored in their dedicated
 * server-side fields instead of relying on a browser visitor cookie.
 */
export async function createApplicationSubmissionVisitorKey(): Promise<string> {
  const visitorKeyHash = await hashToken(createToken());
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO application_visitors (visitor_key_hash, expires_at, last_seen_at)
    VALUES (?, ?, ?)
  `).bind(visitorKeyHash, expiresAt, now.toISOString()).run();
  return visitorKeyHash;
}

export function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;
  if (fetchSite === "same-origin") return true;

  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  // Missing origin metadata is not treated as proof of a same-origin request.
  return false;
}

export function noStoreHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Origin, Sec-Fetch-Site");
  return headers;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
