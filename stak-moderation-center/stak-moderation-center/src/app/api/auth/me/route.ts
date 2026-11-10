import { getDiscordSession, roleLabel } from "@/lib/auth";
import { json } from "@/lib/db";
export async function GET(request: Request) {
  const user = await getDiscordSession(request);
  if (!user) return json({ authenticated: false, user: null });
  return json({ authenticated: true, user: { ...user, roleLabel: roleLabel(user.stakRole) } });
}
