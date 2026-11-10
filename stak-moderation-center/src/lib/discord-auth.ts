import { getDiscordSession, type DiscordSessionUser } from "./auth";

/**
 * Uses the Discord role stored in the authenticated session.
 *
 * The Discord role is retrieved during login and remains unchanged
 * for the duration of the session.
 *
 * No additional Discord API request is performed during authentication.
 */
export async function getFreshDiscordSession(
  request: Request,
): Promise<DiscordSessionUser | null> {
  return getDiscordSession(request);
}