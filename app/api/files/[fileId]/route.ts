import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visitFiles, visits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const file = await db.query.visitFiles.findFirst({
    where: eq(visitFiles.id, fileId),
  });

  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Verify the file belongs to a visit owned by this user
  const visit = await db.query.visits.findFirst({
    where: eq(visits.id, file.visitId),
    columns: { repId: true },
  });

  if (!visit || visit.repId !== session.userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = join("/app/uploads", file.storagePath);

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": file.mimeType ?? "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
