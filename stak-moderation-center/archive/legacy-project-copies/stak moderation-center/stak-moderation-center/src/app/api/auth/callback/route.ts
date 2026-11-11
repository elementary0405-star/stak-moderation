import { env } from "cloudflare:workers";
import { makeSessionCookie, roleFromDiscordRoles } from "@/lib/auth";
import { db, newId } from "@/lib/db";

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) { const [k, ...v] = part.trim().split("="); if (k === name) return v.join("="); }
  return null;
}
function go(request: Request, path: string, cookie?: string) {
  const url = new URL(path, request.url);
  const headers = new Headers({ Location: url.toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `stak_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== cookieValue(request.headers.get("cookie"), "stak_oauth_state")) return go(request, "/?auth=invalid_state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_REDIRECT_URI || !env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) return go(request, "/?auth=not_configured");
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: env.DISCORD_REDIRECT_URI }),
    });
    if (!tokenResponse.ok) return go(request, "/?auth=oauth_failed");
    const token = await tokenResponse.json() as { access_token: string };
    const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!userResponse.ok) return go(request, "/?auth=profile_failed");
    const profile = await userResponse.json() as { id: string; username: string; global_name?: string | null; avatar?: string | null };
    const memberResponse = await fetch(`https://discord.com/api/guilds/${env.DISCORD_GUILD_ID}/members/${profile.id}`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } });
    if (memberResponse.status === 404) return go(request, "/?auth=not_a_server_member");
    if (!memberResponse.ok) return go(request, "/?auth=guild_check_failed");
    const member = await memberResponse.json() as { roles: string[] };
    const role = roleFromDiscordRoles(member.roles ?? []);
    const user = { discordUserId: profile.id, username: profile.username, globalName: profile.global_name ?? null, avatar: profile.avatar ?? null, stakRole: role };
    if (role !== "community-member") {
      const id = newId();
      await db().prepare(`INSERT INTO staff_users (id, discord_user_id, username, global_name, avatar, stak_role) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_user_id) DO UPDATE SET username=excluded.username, global_name=excluded.global_name, avatar=excluded.avatar, stak_role=excluded.stak_role, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, profile.id, profile.username, profile.global_name ?? null, profile.avatar ?? null, role).run();
      await db().prepare(`INSERT INTO staff_profiles (discord_user_id, username, global_name) VALUES (?, ?, ?)
        ON CONFLICT(discord_user_id) DO UPDATE SET username=excluded.username, global_name=excluded.global_name, updated_at=CURRENT_TIMESTAMP`)
        .bind(profile.id, profile.username, profile.global_name ?? null).run();
    }
    return go(request, "/", await makeSessionCookie(user));
  } catch (error) {
    console.error("Discord OAuth callback failed", error);
    return go(request, "/?auth=callback_error");
  }
}
