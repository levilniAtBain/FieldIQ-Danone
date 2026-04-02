import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session || session.role !== "rep") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, id),
    columns: { id: true, repId: true, status: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allow reopening completed or cancelled visits
  if (visit.status === "in_progress") {
    return NextResponse.json({ ok: true }); // already open
  }

  await db
    .update(visits)
    .set({ status: "in_progress", completedAt: null })
    .where(eq(visits.id, id));

  return NextResponse.json({ ok: true });
}
