import {
  clearSessionCookie,
  type DiscordSessionUser,
} from "./auth";
import { getFreshDiscordSession } from "./discord-auth";
import {
  hasPortalAccess,
  type PortalAccess,
} from "./portal-access";

export type PortalAuthorizationResult =
  | { user: DiscordSessionUser; response?: never }
  | { user?: never; response: Response };

/**
 * Gemeinsame serverseitige Zugriffskontrolle für alle späteren Daten-APIs.
 * Jede API mit vertraulichen Daten oder Schreibaktionen muss diese Funktion
 * aufrufen, bevor sie Daten liest oder verändert.
 */
export async function authorizePortalRequest(
  request: Request,
  requiredAccess: PortalAccess
): Promise<PortalAuthorizationResult> {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return {
        response: Response.json(
          { error: "unauthenticated" },
          {
            status: 401,
            headers: { "Set-Cookie": clearSessionCookie() },
          }
        ),
      };
    }

    if (!hasPortalAccess(user.stakRole, requiredAccess)) {
      return {
        response: Response.json(
          { error: "forbidden" },
          { status: 403 }
        ),
      };
    }

    return { user };
  } catch (error) {
    console.error("Portal API authorization failed:", error);
    return {
      response: Response.json(
        { error: "role_verification_unavailable" },
        { status: 503 }
      ),
    };
  }
}
