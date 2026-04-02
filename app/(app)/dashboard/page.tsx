import { getSession } from "@/lib/auth/session";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { db } from "@/lib/db";
import {
  getTodayVisits,
  getOverduePharma,
  getRepKPIs,
} from "@/lib/db/queries/dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [todayVisits, overduePharma, kpis] = await Promise.all([
    getTodayVisits(session.userId),
    getOverduePharma(session.userId),
    getRepKPIs(session.userId),
  ]);

  return (
    <DashboardView
      user={session}
      todayVisits={todayVisits}
      overduePharma={overduePharma}
      kpis={kpis}
    />
  );
}
