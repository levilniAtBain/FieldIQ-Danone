import { db } from "@/lib/db";
import { pharmacies, users, visits } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export type PharmacyWithMeta = Awaited<
  ReturnType<typeof getPharmaciesForUser>
>[number];

export async function getPharmaciesForUser(
  userId: string,
  role: string,
  filterRepId?: string
) {
  if (role === "manager") {
    // Manager sees all pharmacies for reps in their region,
    // optionally filtered to a specific rep.
    const manager = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { regionId: true },
    });
    if (!manager?.regionId) return [];

    return db.query.pharmacies.findMany({
      where: and(
        eq(pharmacies.isActive, true),
        filterRepId ? eq(pharmacies.repId, filterRepId) : undefined
      ),
      with: {
        rep: { columns: { id: true, name: true } },
        visits: {
          where: eq(visits.status, "completed"),
          orderBy: [desc(visits.completedAt)],
          limit: 1,
          columns: { completedAt: true, status: true },
        },
      },
      orderBy: [pharmacies.name],
    });
  }

  // Rep sees their own pharmacies
  return db.query.pharmacies.findMany({
    where: and(eq(pharmacies.repId, userId), eq(pharmacies.isActive, true)),
    with: {
      visits: {
        where: eq(visits.status, "completed"),
        orderBy: [desc(visits.completedAt)],
        limit: 1,
        columns: { completedAt: true, status: true },
      },
    },
    orderBy: [pharmacies.name],
  });
}

export async function getPharmacyById(id: string) {
  return db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, id),
    with: {
      rep: { columns: { id: true, name: true, email: true } },
      visits: {
        orderBy: [desc(visits.completedAt)],
        limit: 10,
      },
    },
  });
}

export async function canAccessPharmacy(
  userId: string,
  role: string,
  pharmacyId: string
): Promise<boolean> {
  const pharmacy = await db.query.pharmacies.findFirst({
    where: eq(pharmacies.id, pharmacyId),
    columns: { repId: true },
    with: {
      rep: { columns: { regionId: true } },
    },
  });

  if (!pharmacy) return false;
  if (role === "rep") return pharmacy.repId === userId;

  // Manager: check same region
  if (role === "manager") {
    const manager = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { regionId: true },
    });
    return manager?.regionId === pharmacy.rep?.regionId;
  }

  return false;
}
