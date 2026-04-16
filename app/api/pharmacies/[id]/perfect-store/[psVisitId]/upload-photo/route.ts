import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { perfectStoreVisits, perfectStoreFiles, pharmacies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { analyzePerfectStoreShelf, type PerfectStoreKpis } from "@/lib/ai/claude";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const schema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  shelfSection: z.enum(["main", "brand", "solar", "deodorant"]),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; psVisitId: string }> }
) {
  const { id, psVisitId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const psVisit = await db.query.perfectStoreVisits.findFirst({
    where: and(
      eq(perfectStoreVisits.id, psVisitId),
      eq(perfectStoreVisits.pharmacyId, id)
    ),
    columns: { id: true },
  });
  if (!psVisit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, id),
    columns: { name: true, tier: true, segment: true },
  });

  // Save image to disk
  const ext = EXT[parsed.data.mimeType] ?? "jpg";
  const fileId = randomUUID();
  const fileName = `${fileId}.${ext}`;
  const dir = join("/app/uploads/perfect-store", psVisitId);
  const filePath = join(dir, fileName);
  const storagePath = `perfect-store/${psVisitId}/${fileName}`;

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, Buffer.from(parsed.data.imageBase64, "base64"));

  try {
    const analysis = await analyzePerfectStoreShelf(
      parsed.data.imageBase64,
      parsed.data.mimeType,
      parsed.data.shelfSection,
      {
        name: pharmacy?.name ?? "Unknown",
        tier: pharmacy?.tier ?? "c",
        segment: pharmacy?.segment ?? null,
      }
    );

    // Persist file record with analysis
    const [fileRecord] = await db
      .insert(perfectStoreFiles)
      .values({
        id: fileId,
        psVisitId,
        pharmacyId: id,
        shelfSection: parsed.data.shelfSection,
        storagePath,
        mimeType: parsed.data.mimeType,
        sizeBytes: Math.round((parsed.data.imageBase64.length * 3) / 4),
        aiAnalysisJson: analysis,
      })
      .returning({ id: perfectStoreFiles.id });

    // Merge KPIs into the visit's kpisJson
    const currentVisit = await db.query.perfectStoreVisits.findFirst({
      where: eq(perfectStoreVisits.id, psVisitId),
      columns: { kpisJson: true },
    });
    type KpisRecord = Record<string, PerfectStoreKpis | null>;
    const currentKpis = (currentVisit?.kpisJson ?? {}) as KpisRecord;
    const updatedKpis: KpisRecord = { ...currentKpis, [parsed.data.shelfSection]: analysis.kpis };

    await db
      .update(perfectStoreVisits)
      .set({ kpisJson: updatedKpis, updatedAt: new Date() })
      .where(eq(perfectStoreVisits.id, psVisitId));

    return NextResponse.json({
      fileId: fileRecord.id,
      analysis,
      kpis: analysis.kpis,
      checklistSuggestions: analysis.checklistSuggestions,
    });
  } catch (err) {
    console.error("Perfect Store shelf analysis error:", err);
    // Save file without analysis
    await db.insert(perfectStoreFiles).values({
      id: fileId,
      psVisitId,
      pharmacyId: id,
      shelfSection: parsed.data.shelfSection,
      storagePath,
      mimeType: parsed.data.mimeType,
      sizeBytes: Math.round((parsed.data.imageBase64.length * 3) / 4),
    });
    return NextResponse.json(
      { error: "AI analysis failed. Photo saved." },
      { status: 500 }
    );
  }
}
