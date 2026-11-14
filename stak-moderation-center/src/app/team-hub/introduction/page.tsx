import { redirect } from "next/navigation";

export default function IntroductionRedirect() {
  redirect("/team-hub?intro=1");
}
