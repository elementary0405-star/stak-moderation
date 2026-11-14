import { env } from "cloudflare:workers";
import { getAcademyCourse } from "@/lib/academy-content";
import { noStoreHeaders } from "@/lib/application-public";

type BotEnv = typeof env & { DISCORD_BOT_TOKEN?: string };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: noStoreHeaders() });
function equalSecret(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

export async function GET(request: Request) {
  const token = (env as BotEnv).DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token) return json({ error: "Bot integration is not configured." }, 503);
  const supplied = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!equalSecret(supplied, token)) return json({ error: "Unauthorized." }, 401);
  const discordUserId = new URL(request.url).searchParams.get("discordUserId")?.trim() ?? "";
  if (!/^\d{17,20}$/.test(discordUserId)) return json({ error: "A valid Discord user ID is required." }, 400);
  try {
    const course = getAcademyCourse("general-staff")!;
    const assignment = await env.DB.prepare(`SELECT status, course_version AS courseVersion, updated_at AS updatedAt FROM academy_assignments WHERE discord_user_id = ? AND course_key = 'general-staff' ORDER BY assigned_at DESC LIMIT 1`)
      .bind(discordUserId).first<{ status: string; courseVersion: string; updatedAt: string }>();
    const eligible = assignment?.status === "approved" && assignment.courseVersion === course.version;
    return json({ discordUserId, ticketHandlingEnabled: eligible, generalStaffTraining: assignment ? { status: assignment.status, courseVersion: assignment.courseVersion, currentCourseVersion: course.version, updatedAt: assignment.updatedAt } : null, reason: eligible ? null : assignment?.status === "approved" ? "course_update_required" : "general_staff_training_not_approved" });
  } catch (error) {
    console.error("[bot-academy-eligibility]", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to check Academy eligibility." }, 500);
  }
}
