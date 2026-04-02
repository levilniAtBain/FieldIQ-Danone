import { db } from "@/lib/db";
import { visits, orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getVisitWithContent(visitId: string) {
  return db.query.visits.findFirst({
    where: eq(visits.id, visitId),
    columns: {
      id: true,
      pharmacyId: true,
      repId: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      objectivesJson: true,
      notes: true,
      audioTranscript: true,
      audioSummary: true,
      shelfAnalysisJson: true,
      aiReportDraft: true,
      reportFinal: true,
    },
    with: {
      pharmacy: {
        columns: {
          id: true,
          name: true,
          city: true,
          pharmacistName: true,
          tier: true,
          segment: true,
        },
      },
    },
  });
}

export async function getOrderForVisit(visitId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.visitId, visitId),
    orderBy: [desc(orders.createdAt)],
    with: {
      lines: {
        with: {
          product: {
            columns: {
              id: true,
              sku: true,
              name: true,
              brand: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });
}
