import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { masterPlanEntries, pharmacies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MasterPlanListView } from "@/components/master-plan/master-plan-list-view";

export default async function MasterPlanPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "rep") redirect("/dashboard");

  const [entries, repPharmacies] = await Promise.all([
    db.query.masterPlanEntries.findMany({
      where: eq(masterPlanEntries.repId, session.userId),
      orderBy: [desc(masterPlanEntries.plannedDate)],
      with: {
        pharmacy: { columns: { id: true, name: true, city: true } },
        coVisitors: true,
      },
      columns: { id: true, plannedDate: true, status: true, visitType: true, objectives: true },
    }),
    db.query.pharmacies.findMany({
      where: eq(pharmacies.repId, session.userId),
      columns: { id: true, name: true, city: true },
      orderBy: [pharmacies.name],
    }),
  ]);

  return <MasterPlanListView entries={entries} pharmacies={repPharmacies} />;
}
