import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits, pharmacies, visitFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analyzeShelfPhoto } from "@/lib/ai/claude";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const schema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: { id: true, repId: true, pharmacyId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, visit.pharmacyId),
    columns: { name: true, tier: true, segment: true },
  });

  // ── Save image to disk ───────────────────────────────────────────────────────
  const ext = EXT[parsed.data.mimeType] ?? "jpg";
  const fileId = randomUUID();
  const fileName = `${fileId}.${ext}`;
  const dir = join("/app/uploads/visits", id);
  const filePath = join(dir, fileName);
  const storagePath = `visits/${id}/${fileName}`;

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, Buffer.from(parsed.data.imageBase64, "base64"));

  // ── Run AI analysis ──────────────────────────────────────────────────────────
  try {
    const result = await analyzeShelfPhoto(
      parsed.data.imageBase64,
      parsed.data.mimeType,
      {
        name: pharmacy?.name ?? "Unknown",
        tier: pharmacy?.tier ?? "silver",
        segment: pharmacy?.segment ?? null,
      }
    );

    // Persist file record with analysis
    const [fileRecord] = await db
      .insert(visitFiles)
      .values({
        id: fileId,
        visitId: id,
        type: "shelf_photo",
        storagePath,
        mimeType: parsed.data.mimeType,
        aiAnalysisJson: result,
      })
      .returning({ id: visitFiles.id });

    // Also keep shelfAnalysisJson on visit pointing to latest analysis (used by report)
    await db
      .update(visits)
      .set({ shelfAnalysisJson: result })
      .where(eq(visits.id, id));

    return NextResponse.json({ fileId: fileRecord.id, analysis: result });
  } catch (err) {
    console.error("Shelf analysis error:", err);
    // Still save the file record (without analysis) so the image is accessible
    await db.insert(visitFiles).values({
      id: fileId,
      visitId: id,
      type: "shelf_photo",
      storagePath,
      mimeType: parsed.data.mimeType,
    });
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
