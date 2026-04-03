import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/team-view";
import { getManagerTeamStats } from "@/lib/db/queries/dashboard";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "manager") redirect("/dashboard");

  const reps = await getManagerTeamStats(session.userId);

  return <TeamView session={session} reps={reps} />;
}
