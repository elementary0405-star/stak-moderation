import { env } from "cloudflare:workers";
import StaffTrainingClient from "./staff-training-client";

export const dynamic = "force-dynamic";

const bindings = env as typeof env & { MOODLE_COURSE_URL?: string };

export default function StaffTrainingPage() {
  const candidate = bindings.MOODLE_COURSE_URL?.trim() ?? "";
  let courseUrl = "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") courseUrl = parsed.toString();
  } catch {
    courseUrl = "";
  }
  return <StaffTrainingClient courseUrl={courseUrl} />;
}
