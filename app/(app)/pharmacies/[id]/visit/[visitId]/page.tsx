import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { getVisitWithContent, getOrderForVisit } from "@/lib/db/queries/visits";
import { VisitPage } from "@/components/visit/visit-page";
import type { ShelfAnalysisResult, VoiceSummaryResult } from "@/lib/ai/claude";

export default async function ExistingVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id: pharmacyId, visitId } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "rep") redirect(`/pharmacies/${pharmacyId}`);

  const [visit, hasAccess] = await Promise.all([
    getVisitWithContent(visitId),
    canAccessPharmacy(session.userId, session.role, pharmacyId),
  ]);

  if (!visit || !hasAccess || visit.pharmacyId !== pharmacyId) notFound();
  if (visit.repId !== session.userId) redirect(`/pharmacies/${pharmacyId}`);

  const existingOrder = await getOrderForVisit(visitId);

  const pharmacy = visit.pharmacy;

  return (
    <VisitPage
      pharmacy={{
        id: pharmacy.id,
        name: pharmacy.name,
        city: pharmacy.city,
        pharmacistName: pharmacy.pharmacistName ?? null,
        tier: pharmacy.tier,
        segment: pharmacy.segment ?? null,
      }}
      session={session}
      existingVisit={{
        visitId,
        status: visit.status,
        notes: visit.notes ?? "",
        objectives: (visit.objectivesJson as string[]) ?? [],
        shelfAnalysis: (visit.shelfAnalysisJson as ShelfAnalysisResult) ?? null,
        voiceSummary: visit.audioSummary
          ? ({
              summary: visit.audioSummary,
              keyPoints: [],
              actions: [],
              sentiment: "neutral",
            } as VoiceSummaryResult)
          : null,
        audioTranscript: visit.audioTranscript ?? null,
        orderId: existingOrder?.id ?? null,
        orderTotal: existingOrder?.totalAmount
          ? parseFloat(existingOrder.totalAmount)
          : null,
        aiReportDraft: visit.aiReportDraft ?? null,
      }}
    />
  );
}
