import { getSession } from "@/lib/auth/session";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  getTodayVisits,
  getOverduePharma,
  getRepKPIs,
  getRepOpenItems,
} from "@/lib/db/queries/dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [todayVisits, overduePharma, kpis, openItems] = await Promise.all([
    getTodayVisits(session.userId),
    getOverduePharma(session.userId),
    getRepKPIs(session.userId),
    getRepOpenItems(session.userId),
  ]);

  return (
    <DashboardView
      user={session}
      todayVisits={todayVisits}
      overduePharma={overduePharma}
      kpis={kpis}
      openItems={openItems}
    />
  );
}
