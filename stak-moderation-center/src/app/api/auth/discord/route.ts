import { env } from "cloudflare:workers";

const bindings = env as typeof env & {
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;
  DISCORD_BOT_TOKEN?: string;
};

const REQUIRED_BINDINGS = [
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "DISCORD_BOT_TOKEN",
] as const;

function redirectToHome(request: Request, error: string, extra?: Record<string, string>) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("discord_error", error);
  for (const [key, value] of Object.entries(extra ?? {})) {
    destination.searchParams.set(key, value);
  }
  return Response.redirect(destination, 302);
}

export async function GET(request: Request) {
  const missing = REQUIRED_BINDINGS.filter((key) => !bindings[key]);
  if (missing.length) {
    return redirectToHome(request, "configuration_error", { missing: missing.join(",") });
  }

  const callbackUri = new URL("/api/auth/discord/callback", request.url).toString();
  let configuredRedirect: string;
  try {
    configuredRedirect = new URL(bindings.DISCORD_REDIRECT_URI!).toString();
  } catch {
    return redirectToHome(request, "redirect_uri_mismatch");
  }
  if (configuredRedirect !== callbackUri) {
    return redirectToHome(request, "redirect_uri_mismatch");
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const discordUrl = new URL("https://discord.com/oauth2/authorize");
  discordUrl.searchParams.set("client_id", bindings.DISCORD_CLIENT_ID!);
  discordUrl.searchParams.set("redirect_uri", configuredRedirect);
  discordUrl.searchParams.set("response_type", "code");
  discordUrl.searchParams.set("scope", "identify");
  discordUrl.searchParams.set("state", state);

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: discordUrl.toString(),
      "Set-Cookie": `discord_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}`,
      "Cache-Control": "no-store",
    },
  });
}
