import { env } from "cloudflare:workers";

export type StakRole = "owner" | "co-owner" | "management" | "staff-manager" | "moderator" | "trail-moderator" | "community-member";
export type DiscordSessionUser = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  stakRole: StakRole;
  expiresAt: number;
};

const COOKIE = "stak_session";
const ROLE_ORDER: StakRole[] = ["owner", "co-owner", "management", "staff-manager", "moderator", "trail-moderator", "community-member"];
const ROLE_LABELS: Record<StakRole, string> = {
  owner: "Owner", "co-owner": "Co-Owner", management: "Management", "staff-manager": "Staff Manager",
  moderator: "Moderator", "trail-moderator": "Trail Moderator", "community-member": "Community Member",
};

function secret(): string {
  const value = env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}
function b64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function unb64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return b64url(String.fromCharCode(...new Uint8Array(signature)));
}
async function safeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
export async function makeSessionCookie(user: Omit<DiscordSessionUser, "expiresAt">): Promise<string> {
  const payload: DiscordSessionUser = { ...user, expiresAt: Date.now() + 60 * 60 * 1000 };
  const encoded = b64url(JSON.stringify(payload));
  const value = `${encoded}.${await sign(encoded)}`;
  const secure = env.DISCORD_REDIRECT_URI?.startsWith("https://") ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`;
}
export function clearSessionCookie(): string { const secure = env.DISCORD_REDIRECT_URI?.startsWith("https://") ? "; Secure" : ""; return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`; }
export async function getDiscordSession(request: Request): Promise<DiscordSessionUser | null> {
  const raw = getCookie(request.headers.get("cookie"), COOKIE);
  if (!raw) return null;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  try {
    if (!(await safeEqual(signature, await sign(encoded)))) return null;
    const payload = JSON.parse(unb64url(encoded)) as DiscordSessionUser;
    if (!payload.discordUserId || !payload.stakRole || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch { return null; }
}
export function roleLabel(role: StakRole): string { return ROLE_LABELS[role]; }
export function roleFromDiscordRoles(roles: string[]): StakRole {
  const configured: Array<[string | undefined, StakRole]> = [
    [env.STAK_OWNER_ROLE_ID, "owner"], [env.STAK_CO_OWNER_ROLE_ID, "co-owner"], [env.STAK_MANAGEMENT_ROLE_ID, "management"],
    [env.STAK_STAFF_MANAGER_ROLE_ID, "staff-manager"], [env.STAK_MODERATOR_ROLE_ID, "moderator"], [env.STAK_TRAIL_MODERATOR_ROLE_ID, "trail-moderator"],
  ];
  for (const [id, role] of configured) if (id && roles.includes(id)) return role;
  return "community-member";
}
export function hasAccess(role: StakRole, minimum: "any" | "staff" | "trailModerator" | "staffManager" | "owner"): boolean {
  const rank = ROLE_ORDER.indexOf(role);
  if (minimum === "any") return true;
  if (minimum === "staff") return rank >= 0 && rank < ROLE_ORDER.length - 1;
  const required: Record<Exclude<typeof minimum, "any" | "staff">, StakRole> = {
    trailModerator: "trail-moderator", staffManager: "staff-manager", owner: "owner",
  };
  return rank >= 0 && rank <= ROLE_ORDER.indexOf(required[minimum]);
}
export async function requireUser(request: Request, access: "any" | "staff" | "trailModerator" | "staffManager" | "owner" = "any") {
  const user = await getDiscordSession(request);
  if (!user) return { user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  if (!hasAccess(user.stakRole, access)) return { user: null, response: Response.json({ error: "You do not have permission to access this resource." }, { status: 403 }) };
  return { user, response: null };
}
export function discordAvatar(userId: string, avatar: string | null): string | null {
  return avatar ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128` : null;
}
