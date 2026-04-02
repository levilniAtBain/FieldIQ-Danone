import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { streamVisitReport, type VisitReportContext } from "@/lib/ai/claude";

const schema = z.object({
  notes: z.string().optional(),
  objectives: z.array(z.string()).optional().default([]),
  pharmacyName: z.string(),
  orderPlaced: z.boolean().optional().default(false),
  orderTotal: z.number().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: {
      id: true,
      repId: true,
      notes: true,
      audioSummary: true,
      shelfAnalysisJson: true,
    },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark visit complete
  await db
    .update(visits)
    .set({
      status: "completed",
      completedAt: new Date(),
      notes: parsed.data.notes ?? visit.notes,
    })
    .where(eq(visits.id, id));

  // Stream AI report
  const context: VisitReportContext = {
    pharmacyName: parsed.data.pharmacyName,
    repName: session.name,
    visitDate: new Date().toLocaleDateString("en-GB"),
    objectives: parsed.data.objectives,
    notes: parsed.data.notes ?? visit.notes ?? null,
    voiceSummary: visit.audioSummary
      ? {
          summary: visit.audioSummary,
          keyPoints: [],
          actions: [],
          sentiment: "neutral",
        }
      : null,
    shelfAnalysis: visit.shelfAnalysisJson as import("@/lib/ai/claude").ShelfAnalysisResult | null,
    orderPlaced: parsed.data.orderPlaced,
    orderTotal: parsed.data.orderTotal ?? null,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullReport = "";
      try {
        await streamVisitReport(
          context,
          (chunk) => {
            fullReport += chunk;
            controller.enqueue(encoder.encode(chunk));
          },
          async () => {
            // Persist report draft
            await db
              .update(visits)
              .set({ aiReportDraft: fullReport })
              .where(eq(visits.id, id));
            controller.close();
          }
        );
      } catch (err) {
        console.error("Report stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
