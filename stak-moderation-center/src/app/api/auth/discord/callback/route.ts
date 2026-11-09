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

const DEFAULT_SITE_URL =
  "https://stak-moderation-center.elementary0405.workers.dev";

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    const key = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (key === name) return value;
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

function redirectWithError(error: string): Response {
  const target = new URL(
    "/",
    bindings.DISCORD_REDIRECT_URI || DEFAULT_SITE_URL
  );

  target.searchParams.set("discord_error", error);

  const response = Response.redirect(target.toString(), 302);

  response.headers.append("Set-Cookie", clearOAuthCookie());

  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const storedState = getCookie(request, "discord_oauth_state");

    if (!code || !returnedState || !storedState) {
      return redirectWithError("invalid_callback");
    }

    if (returnedState !== storedState) {
      return redirectWithError("invalid_state");
    }

    const clientId = bindings.DISCORD_CLIENT_ID;
    const clientSecret = bindings.DISCORD_CLIENT_SECRET;
    const redirectUri = bindings.DISCORD_REDIRECT_URI;
    const botToken = bindings.DISCORD_BOT_TOKEN;

    if (!clientId || !clientSecret || !redirectUri || !botToken) {
      console.error("Discord authentication secrets are incomplete.");
      return redirectWithError("configuration_error");
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
      console.error(
        "Discord token exchange failed:",
        tokenResponse.status
      );

      return redirectWithError("token_exchange_failed");
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
      return redirectWithError("user_lookup_failed");
    }

    const discordUser = (await userResponse.json()) as {
      id: string;
      username: string;
      global_name: string | null;
      avatar: string | null;
      bot?: boolean;
    };

    if (discordUser.bot === true) {
      return redirectWithError("bots_not_allowed");
    }

    // Verify STAK server membership and retrieve Discord roles.
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
        return redirectWithError("not_a_server_member");
      }

      console.error(
        "Discord member lookup failed:",
        memberResponse.status
      );

      return redirectWithError("member_lookup_failed");
    }

    const member = (await memberResponse.json()) as {
      user?: {
        bot?: boolean;
      };
      roles: string[];
    };

    if (member.user?.bot === true) {
      return redirectWithError("bots_not_allowed");
    }

    // Determine the highest STAK role.
    const stakRole = getHighestStakRole(member.roles, false);

    if (!stakRole) {
      return redirectWithError("no_stak_role");
    }

    // Create a secure server-side session.
    const session = await createDiscordSession({
      discordUserId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      avatar: discordUser.avatar,
      stakRole,
    });

    const response = Response.redirect(
      new URL("/", redirectUri).toString(),
      302
    );

    response.headers.append(
      "Set-Cookie",
      createSessionCookie(session.token)
    );

    response.headers.append(
      "Set-Cookie",
      clearOAuthCookie()
    );

    return response;
  } catch (error) {
    console.error("Discord callback error:", error);

    return redirectWithError("authentication_failed");
  }
}