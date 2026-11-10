import { env } from "cloudflare:workers";
import { json } from "@/lib/db";

export async function GET() {
  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) return json({ error: "Discord OAuth is not configured. Set DISCORD_CLIENT_ID and DISCORD_REDIRECT_URI." }, 503);
  const state = crypto.randomUUID();
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds.members.read");
  url.searchParams.set("state", state);
  const secure = redirectUri.startsWith("https://") ? "; Secure" : "";
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": `stak_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}` } });
}
