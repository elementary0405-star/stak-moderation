import { clearSessionCookie } from "@/lib/auth";
import { getFreshDiscordSession, StakAccessRoleMissingError } from "@/lib/discord-auth";

export async function GET(request: Request) {
  try {
    const user = await getFreshDiscordSession(request);

    if (!user) {
      return Response.json(
        { authenticated: false, user: null },
        { status: 401, headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { authenticated: true, user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StakAccessRoleMissingError) {
      return Response.json(
        { authenticated: false, access: "missing_role" },
        { status: 403, headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } },
      );
    }
    console.error(
      "Failed to retrieve or verify Discord session:",
      error instanceof Error ? error.name : "unknown error",
    );
    return Response.json(
      { authenticated: false, error: "role_verification_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
