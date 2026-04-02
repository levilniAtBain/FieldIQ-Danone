import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { summarizeVoiceNote } from "@/lib/ai/claude";

const schema = z.object({
  transcript: z.string().min(1),
  pharmacyName: z.string(),
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

  // Verify visit belongs to this rep
  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: { id: true, repId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await summarizeVoiceNote(parsed.data.transcript, {
      name: parsed.data.pharmacyName,
      repName: session.name,
    });

    // Persist to visit
    await db
      .update(visits)
      .set({
        audioTranscript: parsed.data.transcript,
        audioSummary: result.summary,
      })
      .where(eq(visits.id, id));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "Summarization failed. Please try again." },
      { status: 500 }
    );
  }
}
