import { getDiscordSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getDiscordSession(request);

    if (!user) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 }
      );
    }

    return Response.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Failed to retrieve Discord session:", error);

    return Response.json(
      {
        authenticated: false,
        error: "Unable to retrieve session.",
      },
      { status: 500 }
    );
  }
}