import { getSession } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { masterPlanEntries, masterPlanCoVisitors, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { MasterPlanDetailView } from "@/components/master-plan/master-plan-detail-view";

export default async function MasterPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  if (session.role === "manager") {
    // Fetch the entry without repId restriction
    const entry = await db.query.masterPlanEntries.findFirst({
      where: eq(masterPlanEntries.id, id),
      with: {
        pharmacy: { columns: { id: true, name: true, city: true, tier: true } },
        coVisitors: { orderBy: [masterPlanCoVisitors.createdAt] },
      },
    });
    if (!entry) notFound();

    // Verify entry's rep belongs to manager's region
    const manager = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { regionId: true },
    });
    if (!manager?.regionId) notFound();

    const regionReps = await db.query.users.findMany({
      where: and(eq(users.regionId, manager.regionId), eq(users.role, "rep")),
      columns: { id: true },
    });
    if (!regionReps.some((r) => r.id === entry.repId)) notFound();

    return <MasterPlanDetailView entry={entry} readOnly />;
  }

  if (session.role !== "rep") redirect("/dashboard");

  const entry = await db.query.masterPlanEntries.findFirst({
    where: and(
      eq(masterPlanEntries.id, id),
      eq(masterPlanEntries.repId, session.userId)
    ),
    with: {
      pharmacy: { columns: { id: true, name: true, city: true, tier: true } },
      coVisitors: { orderBy: [masterPlanCoVisitors.createdAt] },
    },
  });

  if (!entry) notFound();

  return <MasterPlanDetailView entry={entry} />;
}
