import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { masterPlanEntries, pharmacies, users, actions } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { MasterPlanListView } from "@/components/master-plan/master-plan-list-view";
import { MasterPlanManagerView } from "@/components/master-plan/master-plan-manager-view";

export default async function MasterPlanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "manager") {
    const manager = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { regionId: true },
    });

    const regionReps = manager?.regionId
      ? await db.query.users.findMany({
          where: and(eq(users.regionId, manager.regionId), eq(users.role, "rep")),
          columns: { id: true, name: true },
          orderBy: [users.name],
        })
      : [];

    const repIds = regionReps.map((r) => r.id);

    const [entries, specialistActions] = repIds.length > 0
      ? await Promise.all([
          db.query.masterPlanEntries.findMany({
            where: inArray(masterPlanEntries.repId, repIds),
            orderBy: [desc(masterPlanEntries.plannedDate)],
            with: {
              pharmacy: { columns: { id: true, name: true, city: true } },
              coVisitors: true,
            },
            columns: { id: true, repId: true, plannedDate: true, status: true, visitType: true, objectives: true },
          }),
          db.query.actions.findMany({
            where: and(
              inArray(actions.repId, repIds),
              eq(actions.type, "specialist_visit"),
              eq(actions.accepted, true),
            ),
            with: {
              pharmacy: { columns: { id: true, name: true, city: true } },
              specialist: { columns: { id: true, name: true, email: true, phone: true, role: true, territory: true, notes: true } },
            },
            columns: {
              id: true, repId: true, title: true, description: true,
              assignedSpecialistId: true, scheduledVisitDate: true,
              specialistStatus: true, specialistNotes: true,
            },
          }),
        ])
      : [[], []];

    return (
      <MasterPlanManagerView
        entries={entries}
        specialistActions={specialistActions}
        reps={regionReps}
      />
    );
  }

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
