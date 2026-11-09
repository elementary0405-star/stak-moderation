import { env } from "cloudflare:workers";
import {
  createDiscordSession,
  createSessionCookie,
} from "@/lib/auth";
import {
  STAK_DISCORD,
  getHighestStakRole,
} from "@/lib/discord-roles";

const bindings = env as typeof env & {
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;
  DISCORD_BOT_TOKEN?: string;
};

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }

  return null;
}

function clearOAuthCookie(): string {
  return [
    "discord_oauth_state=",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

function redirectWithError(error: string, origin: string): Response {
  const headers = new Headers();

  headers.set(
    "Location",
    `${origin}/?discord_error=${encodeURIComponent(error)}`
  );

  headers.append("Set-Cookie", clearOAuthCookie());

  return new Response(null, {
    status: 302,
    headers,
  });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const storedState = getCookie(request, "discord_oauth_state");

    if (!code || !returnedState || !storedState) {
      return redirectWithError("invalid_callback", origin);
    }

    if (returnedState !== storedState) {
      return redirectWithError("invalid_state", origin);
    }

    const clientId = bindings.DISCORD_CLIENT_ID;
    const clientSecret = bindings.DISCORD_CLIENT_SECRET;
    const redirectUri = bindings.DISCORD_REDIRECT_URI;
    const botToken = bindings.DISCORD_BOT_TOKEN;

    if (!clientId || !clientSecret || !redirectUri || !botToken) {
      console.error("Discord authentication secrets are incomplete.");
      return redirectWithError("configuration_error", origin);
    }

    // Exchange the OAuth2 code for an access token.
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorDetails = await tokenResponse.text();

      console.error(
        "Discord token exchange failed:",
        tokenResponse.status,
        errorDetails
      );

      return redirectWithError("token_exchange_failed", origin);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
    };

    // Retrieve the authenticated Discord user.
    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!userResponse.ok) {
      console.error("Discord user lookup failed:", userResponse.status);
      return redirectWithError("user_lookup_failed", origin);
    }

    const discordUser = (await userResponse.json()) as {
      id: string;
      username: string;
      global_name: string | null;
      avatar: string | null;
      bot?: boolean;
    };

    if (discordUser.bot === true) {
      return redirectWithError("bots_not_allowed", origin);
    }

    // Verify STAK server membership and retrieve roles.
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${STAK_DISCORD.guildId}/members/${discordUser.id}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!memberResponse.ok) {
      if (memberResponse.status === 404) {
        return redirectWithError("not_a_server_member", origin);
      }

      console.error("Discord member lookup failed:", memberResponse.status);
      return redirectWithError("member_lookup_failed", origin);
    }

    const member = (await memberResponse.json()) as {
      user?: {
        bot?: boolean;
      };
      roles: string[];
    };

    if (member.user?.bot === true) {
      return redirectWithError("bots_not_allowed", origin);
    }

    const stakRole = getHighestStakRole(member.roles, false);

    if (!stakRole) {
      return redirectWithError("no_stak_role", origin);
    }

    // Create the server-side session.
    const session = await createDiscordSession({
      discordUserId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      avatar: discordUser.avatar,
      stakRole,
    });

    const headers = new Headers();

    headers.set("Location", origin);
    headers.append("Set-Cookie", createSessionCookie(session.token));
    headers.append("Set-Cookie", clearOAuthCookie());

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    console.error("Discord callback error:", error);

    return redirectWithError("authentication_failed", origin);
  }
}