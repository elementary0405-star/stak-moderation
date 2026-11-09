import { env } from "cloudflare:workers";

const bindings = env as typeof env & {
  DISCORD_CLIENT_ID?: string;
  DISCORD_REDIRECT_URI?: string;
};

export async function GET() {
  const clientId = bindings.DISCORD_CLIENT_ID;
  const redirectUri = bindings.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response(
      "Discord authentication is not configured yet.",
      { status: 500 }
    );
  }

  // Generate a random state value to protect the login process.
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));

  const state = Array.from(stateBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // Build the Discord authorization URL.
  const discordUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  discordUrl.searchParams.set("client_id", clientId);
  discordUrl.searchParams.set("redirect_uri", redirectUri);
  discordUrl.searchParams.set("response_type", "code");
  discordUrl.searchParams.set("scope", "identify");
  discordUrl.searchParams.set("state", state);

  // Redirect the user to Discord.
  const response = Response.redirect(discordUrl.toString(), 302);

  // Store the state temporarily in a secure cookie.
  response.headers.append(
    "Set-Cookie",
    `discord_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );

  return response;
}