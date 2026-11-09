import {
  deleteDiscordSession,
  clearSessionCookie,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await deleteDiscordSession(request);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully logged out.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      }
    );
  } catch (error) {
    console.error("Logout failed:", error);

    return Response.json(
      {
        success: false,
        message: "Logout failed.",
      },
      { status: 500 }
    );
  }
}