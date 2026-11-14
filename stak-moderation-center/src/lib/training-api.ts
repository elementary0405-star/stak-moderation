import { getFreshDiscordSession } from "@/lib/discord-auth";
import { hasPortalAccess } from "@/lib/portal-access";
import type { DiscordSessionUser } from "@/lib/auth";

export type TrainingAuthResult =
  | { ok: true; user: DiscordSessionUser }
  | { ok: false; response: Response };

export function trainingJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function isTrainingObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function trainingText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function authorizeTrainingManager(
  request: Request,
): Promise<TrainingAuthResult> {
  const user = await getFreshDiscordSession(request);

  if (!user) {
    return { ok: false, response: trainingJson({ error: "Authentication required." }, 401) };
  }

  if (!hasPortalAccess(user.stakRole, "staffManager")) {
    return { ok: false, response: trainingJson({ error: "Access denied." }, 403) };
  }

  return { ok: true, user };
}
