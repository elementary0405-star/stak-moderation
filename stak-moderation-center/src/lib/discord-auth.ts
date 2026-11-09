import { env } from "cloudflare:workers";
import {
  deleteDiscordSession,
  getDiscordSession,
  updateDiscordSessionRole,
  type DiscordSessionUser,
} from "./auth";
import { getHighestStakRole, STAK_DISCORD } from "./discord-roles";

const bindings = env as typeof env & {
  DISCORD_BOT_TOKEN?: string;
};

/**
 * Liest den aktuellen Discord-Serverrang bei jeder Auth-Prüfung neu ein.
 * Bei fehlender Mitgliedschaft oder fehlender STAK-Rolle wird die Session
 * widerrufen. Bei Discord-/Netzwerkfehlern wird ein Fehler ausgelöst, damit
 * geschützte Seiten nicht stillschweigend auf einen alten Rang vertrauen.
 */
export async function getFreshDiscordSession(
  request: Request
): Promise<DiscordSessionUser | null> {
  const currentUser = await getDiscordSession(request);
  if (!currentUser) return null;

  const botToken = bindings.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }

  const memberResponse = await fetch(
    `https://discord.com/api/v10/guilds/${STAK_DISCORD.guildId}/members/${currentUser.discordUserId}`,
    {
      headers: { Authorization: `Bot ${botToken}` },
    }
  );

  if (memberResponse.status === 404) {
    await deleteDiscordSession(request);
    return null;
  }

  if (!memberResponse.ok) {
    throw new Error(`Discord role refresh failed (${memberResponse.status}).`);
  }

  const member = (await memberResponse.json()) as {
    roles?: string[];
    user?: { bot?: boolean };
  };

  if (member.user?.bot) {
    await deleteDiscordSession(request);
    return null;
  }

  const currentRole = getHighestStakRole(member.roles ?? [], false);
  if (!currentRole) {
    await deleteDiscordSession(request);
    return null;
  }

  await updateDiscordSessionRole(request, currentRole);

  return { ...currentUser, stakRole: currentRole };
}
