import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { pharmacies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analyzeStoreLayout } from "@/lib/ai/claude";

const schema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, id);
  if (!hasAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, id),
    columns: { name: true, tier: true, segment: true },
  });

  try {
    const analysis = await analyzeStoreLayout(
      parsed.data.imageBase64,
      parsed.data.mimeType,
      {
        name: pharmacy?.name ?? "Unknown pharmacy",
        tier: pharmacy?.tier ?? "c",
        segment: pharmacy?.segment ?? null,
      }
    );
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[store-layout] Analysis error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
