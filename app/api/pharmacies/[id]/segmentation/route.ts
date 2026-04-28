import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pharmacies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canAccessPharmacy } from "@/lib/db/queries/pharmacies";

const VALID_POTENTIAL = ["high", "medium", "low"] as const;
const VALID_PROFILE = ["expert_led", "self_service", "standard_independent", "chain_grouped", "other"] as const;
const VALID_SHOPPER = ["urban_affluent", "suburban", "rural_periurban", "elderly", "families", "urban_active"] as const;
const VALID_SPECIALTY = ["medical_nutrition", "enteral_nutrition", "infant_formula", "dysphagia", "metabolic_diseases", "pediatrics", "oncology", "geriatrics", "nephrology", "water_hydration", "home_care", "mixed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pharmacyId } = await params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasAccess = await canAccessPharmacy(session.userId, session.role, pharmacyId);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const update: Partial<{
    segmentPotential: string | null;
    segmentProfile: string[];
    segmentShopper: string[];
    mainSpecialty: string | null;
    secondarySpecialty: string | null;
  }> = {};

  if ("segmentPotential" in body) {
    if (body.segmentPotential !== null && !VALID_POTENTIAL.includes(body.segmentPotential)) {
      return NextResponse.json({ error: "Invalid segmentPotential" }, { status: 400 });
    }
    update.segmentPotential = body.segmentPotential;
  }

  if ("segmentProfile" in body) {
    if (!Array.isArray(body.segmentProfile) || body.segmentProfile.some((v: string) => !VALID_PROFILE.includes(v as never))) {
      return NextResponse.json({ error: "Invalid segmentProfile" }, { status: 400 });
    }
    update.segmentProfile = body.segmentProfile;
  }

  if ("segmentShopper" in body) {
    if (!Array.isArray(body.segmentShopper) || body.segmentShopper.some((v: string) => !VALID_SHOPPER.includes(v as never))) {
      return NextResponse.json({ error: "Invalid segmentShopper" }, { status: 400 });
    }
    update.segmentShopper = body.segmentShopper;
  }

  if ("mainSpecialty" in body) {
    if (body.mainSpecialty !== null && !VALID_SPECIALTY.includes(body.mainSpecialty)) {
      return NextResponse.json({ error: "Invalid mainSpecialty" }, { status: 400 });
    }
    update.mainSpecialty = body.mainSpecialty;
  }

  if ("secondarySpecialty" in body) {
    if (body.secondarySpecialty !== null && !VALID_SPECIALTY.includes(body.secondarySpecialty)) {
      return NextResponse.json({ error: "Invalid secondarySpecialty" }, { status: 400 });
    }
    update.secondarySpecialty = body.secondarySpecialty;
  }

  await db.update(pharmacies).set(update).where(eq(pharmacies.id, pharmacyId));

  return NextResponse.json({ ok: true });
}
