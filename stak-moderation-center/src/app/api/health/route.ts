import { env } from "cloudflare:workers";

export async function GET() {
  try {
    const result = await env.DB
      .prepare("SELECT 1 AS connected")
      .first<{ connected: number }>();

    return Response.json({
      success: true,
      database: result?.connected === 1,
      message: "Database connection successful.",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    return Response.json(
      {
        success: false,
        database: false,
        message: "Database connection failed.",
      },
      { status: 500 }
    );
  }
}