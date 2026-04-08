import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  imageUrl: z.string().url().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  if (parsed.data.imageUrl !== undefined) fields.imageUrl = parsed.data.imageUrl;
  if (parsed.data.videoUrl !== undefined) fields.videoUrl = parsed.data.videoUrl;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const updated = await db
    .update(products)
    .set(fields)
    .where(eq(products.id, id))
    .returning({ id: products.id });

  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
