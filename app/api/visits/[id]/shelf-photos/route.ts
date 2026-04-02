import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits, visitFiles } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: { id: true, repId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await db
    .select({
      id: visitFiles.id,
      mimeType: visitFiles.mimeType,
      aiAnalysisJson: visitFiles.aiAnalysisJson,
      createdAt: visitFiles.createdAt,
    })
    .from(visitFiles)
    .where(
      and(eq(visitFiles.visitId, id), eq(visitFiles.type, "shelf_photo"))
    )
    .orderBy(asc(visitFiles.createdAt));

  return NextResponse.json(photos);
}
