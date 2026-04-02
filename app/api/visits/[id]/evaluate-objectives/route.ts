import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { evaluateVisitObjectives } from "@/lib/ai/claude";

const schema = z.object({
  objectives: z.array(z.string()),
  notes: z.string().nullable().optional(),
  voiceSummary: z
    .object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      actions: z.array(z.string()),
      sentiment: z.enum(["positive", "neutral", "negative"]),
    })
    .nullable()
    .optional(),
  shelfAnalysis: z
    .object({
      overallScore: z.number(),
      summary: z.string(),
      stockouts: z.array(z.string()),
      lowStock: z.array(z.string()),
      competitorPresence: z.array(z.string()),
      planogramIssues: z.array(z.string()),
      recommendations: z.array(z.string()),
    })
    .nullable()
    .optional(),
  orderPlaced: z.boolean(),
  orderTotal: z.number().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: { repId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await evaluateVisitObjectives({
      objectives: parsed.data.objectives,
      notes: parsed.data.notes ?? null,
      voiceSummary: parsed.data.voiceSummary ?? null,
      shelfAnalysis: parsed.data.shelfAnalysis ?? null,
      orderPlaced: parsed.data.orderPlaced,
      orderTotal: parsed.data.orderTotal ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Objectives evaluation error:", err);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
