import {
  clearSessionCookie,
  type DiscordSessionUser,
} from "./auth";
import { getFreshDiscordSession } from "./discord-auth";
import {
  hasPermission,
  hasPortalAccess,
  type PortalAccess,
  type PortalPermission,
} from "./portal-access";

export type PortalAuthorizationResult =
  | { user: DiscordSessionUser; response?: never }
  | { user?: never; response: Response };

function unauthorized(): Response {
  return Response.json(
    { error: "unauthenticated" },
    {
      status: 401,
      headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" },
    },
  );
}

function forbidden(): Response {
  return Response.json(
    { error: "forbidden" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

async function authorizeRequest(
  request: Request,
  allowed: (user: DiscordSessionUser) => boolean,
): Promise<PortalAuthorizationResult> {
  try {
    const user = await getFreshDiscordSession(request);
    if (!user) return { response: unauthorized() };
    if (!allowed(user)) return { response: forbidden() };
    return { user };
  } catch (error) {
    console.error("Portal API authorization failed:", error);
    return {
      response: Response.json(
        { error: "role_verification_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
}

export function authorizePortalRequest(
  request: Request,
  requiredAccess: PortalAccess,
): Promise<PortalAuthorizationResult> {
  return authorizeRequest(request, (user) => hasPortalAccess(user.stakRole, requiredAccess));
}

export function authorizePortalPermissionRequest(
  request: Request,
  requiredPermission: PortalPermission,
): Promise<PortalAuthorizationResult> {
  return authorizeRequest(request, (user) => hasPermission(user.stakRole, requiredPermission));
}
