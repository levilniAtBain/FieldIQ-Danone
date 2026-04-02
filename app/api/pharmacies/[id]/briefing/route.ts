import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPharmacyById, canAccessPharmacy } from "@/lib/db/queries/pharmacies";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { streamPreVisitBriefing, type BriefingContext } from "@/lib/ai/claude";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [pharmacy, hasAccess] = await Promise.all([
    getPharmacyById(id),
    canAccessPharmacy(session.userId, session.role, id),
  ]);

  if (!pharmacy || !hasAccess) {
    return new Response("Not found", { status: 404 });
  }

  const rep = await db.query.users.findFirst({
    where: eq(users.id, pharmacy.repId),
    columns: { name: true },
  });

  const lastVisit = pharmacy.visits?.[0] ?? null;
  const pendingActions: string[] = [];

  const context: BriefingContext = {
    pharmacyName: pharmacy.name,
    pharmacistName: pharmacy.pharmacistName ?? null,
    city: pharmacy.city,
    tier: pharmacy.tier,
    segment: pharmacy.segment ?? null,
    notes: pharmacy.notes ?? null,
    repName: rep?.name ?? "Unknown rep",
    lastVisitDate: lastVisit?.completedAt
      ? new Date(lastVisit.completedAt).toLocaleDateString("en-GB")
      : null,
    lastVisitNotes: lastVisit?.notes ?? null,
    visitCount: pharmacy.visits?.length ?? 0,
    pendingActions,
  };

  // Return a streaming response
  const encoder = new TextEncoder();
  let controllerClosed = false;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamPreVisitBriefing(
          context,
          (chunk) => {
            if (!controllerClosed) {
              try {
                controller.enqueue(encoder.encode(chunk));
              } catch {
                controllerClosed = true;
              }
            }
          },
          () => {
            if (!controllerClosed) {
              controllerClosed = true;
              controller.close();
            }
          }
        );
      } catch (err) {
        console.error("Briefing stream error:", err);
        if (!controllerClosed) {
          controllerClosed = true;
          controller.error(err);
        }
      }
    },
    cancel() {
      controllerClosed = true;
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
