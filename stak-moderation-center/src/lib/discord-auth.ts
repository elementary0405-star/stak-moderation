import { env } from "cloudflare:workers";
import {
  deleteDiscordSessionByHash,
  getDiscordSessionRecord,
  updateDiscordSessionRole,
  type DiscordSessionUser,
} from "./auth";
import { STAK_DISCORD, getHighestStakRole } from "./discord-roles";

const ROLE_REFRESH_INTERVAL_MS = 60_000;

const bindings = env as typeof env & {
  DISCORD_BOT_TOKEN?: string;
};

/**
 * Revalidates the session's STAK membership and highest role against Discord.
 * A short cache avoids a Discord API call on every page/API request while
 * keeping role removals and server departures from remaining valid for long.
 * Discord failures are deliberately fail-closed: no cached role is returned
 * as freshly verified when Discord cannot be reached.
 */
export async function getFreshDiscordSession(
  request: Request,
): Promise<DiscordSessionUser | null> {
  const record = await getDiscordSessionRecord(request);
  if (!record) return null;

  const checkedAt = record.roleCheckedAt
    ? Date.parse(record.roleCheckedAt)
    : Number.NaN;

  if (
    Number.isFinite(checkedAt) &&
    Date.now() - checkedAt >= 0 &&
    Date.now() - checkedAt < ROLE_REFRESH_INTERVAL_MS
  ) {
    return record.user;
  }

  const botToken = bindings.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("Discord role verification is not configured.");
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${STAK_DISCORD.guildId}/members/${record.user.discordUserId}`,
    {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    await deleteDiscordSessionByHash(record.tokenHash);
    return null;
  }

  if (!response.ok) {
    throw new Error(`Discord role verification failed (${response.status}).`);
  }

  const member = (await response.json()) as {
    user?: { bot?: boolean };
    roles?: string[];
  };

  if (member.user?.bot === true) {
    await deleteDiscordSessionByHash(record.tokenHash);
    return null;
  }

  const role = getHighestStakRole(member.roles ?? [], false);
  if (!role) {
    await deleteDiscordSessionByHash(record.tokenHash);
    return null;
  }

  await updateDiscordSessionRole(record.tokenHash, role);
  return { ...record.user, stakRole: role };
}
