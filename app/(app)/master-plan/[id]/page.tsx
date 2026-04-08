import { getSession } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { masterPlanEntries, masterPlanCoVisitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { MasterPlanDetailView } from "@/components/master-plan/master-plan-detail-view";

export default async function MasterPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
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
