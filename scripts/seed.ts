/**
 * Seed script: creates realistic test data for FieldIQ alpha.
 * Run: npm run db:seed
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../lib/db/schema";
import { subDays, addDays } from "date-fns";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Seeding FieldIQ database…");

  // ── Regions ─────────────────────────────────────────────────────────────
  const [region] = await db
    .insert(schema.regions)
    .values({ name: "Île-de-France" })
    .returning();

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  const [manager] = await db
    .insert(schema.users)
    .values({
      email: "marie.dupont@loreal.com",
      name: "Marie Dupont",
      passwordHash,
      role: "manager",
      regionId: region.id,
    })
    .returning();

  const [rep1, rep2] = await db
    .insert(schema.users)
    .values([
      {
        email: "thomas.martin@loreal.com",
        name: "Thomas Martin",
        passwordHash,
        role: "rep",
        regionId: region.id,
        managerId: manager.id,
      },
      {
        email: "sarah.bernard@loreal.com",
        name: "Sarah Bernard",
        passwordHash,
        role: "rep",
        regionId: region.id,
        managerId: manager.id,
      },
    ])
    .returning();

  // ── Products ─────────────────────────────────────────────────────────────
  const products = await db
    .insert(schema.products)
    .values([
      {
        sku: "VIC-001",
        name: "Vichy Minéral 89",
        brand: "vichy",
        category: "serum",
        unitPrice: "18.90",
      },
      {
        sku: "CER-001",
        name: "CeraVe Moisturising Cream",
        brand: "cerave",
        category: "moisturizer",
        unitPrice: "14.50",
      },
      {
        sku: "LRP-001",
        name: "La Roche-Posay Anthelios SPF50+",
        brand: "la_roche_posay",
        category: "sunscreen",
        unitPrice: "22.00",
      },
      {
        sku: "SCS-001",
        name: "SkinCeuticals C E Ferulic",
        brand: "skinceuticals",
        category: "serum",
        unitPrice: "166.00",
      },
      {
        sku: "VIC-002",
        name: "Vichy Liftactiv Collagen Specialist",
        brand: "vichy",
        category: "anti-aging",
        unitPrice: "38.00",
      },
      {
        sku: "CER-002",
        name: "CeraVe Hydrating Cleanser",
        brand: "cerave",
        category: "cleanser",
        unitPrice: "11.00",
      },
      {
        sku: "LRP-002",
        name: "La Roche-Posay Lipikar Baume AP+",
        brand: "la_roche_posay",
        category: "body",
        unitPrice: "16.50",
      },
      {
        sku: "MDK-001",
        name: "Medik8 Crystal Retinal 3",
        brand: "medik8",
        category: "retinol",
        unitPrice: "57.00",
      },
    ])
    .returning();

  // ── Pharmacies ────────────────────────────────────────────────────────────
  const pharmacyData = [
    {
      name: "Pharmacie du Marais",
      address: "12 Rue de Bretagne",
      city: "Paris",
      postalCode: "75003",
      latitude: "48.8610",
      longitude: "2.3590",
      tier: "gold" as const,
      segment: "dermo-cosmetic",
      pharmacistName: "Dr. Élise Moreau",
      repId: rep1.id,
    },
    {
      name: "Pharmacie Centrale Montmartre",
      address: "45 Rue Lepic",
      city: "Paris",
      postalCode: "75018",
      latitude: "48.8846",
      longitude: "2.3333",
      tier: "silver" as const,
      segment: "beauty",
      pharmacistName: "M. Jean-Paul Renard",
      repId: rep1.id,
    },
    {
      name: "Pharmacie de la Bastille",
      address: "8 Place de la Bastille",
      city: "Paris",
      postalCode: "75011",
      latitude: "48.8531",
      longitude: "2.3693",
      tier: "platinum" as const,
      segment: "dermo-cosmetic",
      pharmacistName: "Dr. Claire Fontaine",
      repId: rep1.id,
    },
    {
      name: "Pharmacie Saint-Germain",
      address: "120 Boulevard Saint-Germain",
      city: "Paris",
      postalCode: "75006",
      latitude: "48.8538",
      longitude: "2.3337",
      tier: "gold" as const,
      segment: "mixed",
      pharmacistName: "Mme. Sophie Leroy",
      repId: rep1.id,
    },
    {
      name: "Pharmacie de la Madeleine",
      address: "5 Place de la Madeleine",
      city: "Paris",
      postalCode: "75008",
      latitude: "48.8700",
      longitude: "2.3246",
      tier: "platinum" as const,
      segment: "dermo-cosmetic",
      pharmacistName: "Dr. Antoine Girard",
      repId: rep1.id,
    },
    {
      name: "Pharmacie Boulogne Centre",
      address: "15 Rue du Vieux Pont de Sèvres",
      city: "Boulogne-Billancourt",
      postalCode: "92100",
      latitude: "48.8353",
      longitude: "2.2400",
      tier: "silver" as const,
      segment: "beauty",
      pharmacistName: "M. Lucas Petit",
      repId: rep2.id,
    },
    {
      name: "Pharmacie Vincennes",
      address: "22 Rue de Fontenay",
      city: "Vincennes",
      postalCode: "94300",
      latitude: "48.8476",
      longitude: "2.4393",
      tier: "bronze" as const,
      segment: "mixed",
      pharmacistName: "Mme. Isabelle Blanc",
      repId: rep2.id,
    },
    {
      name: "Pharmacie de Neuilly",
      address: "3 Boulevard du Commandant Charcot",
      city: "Neuilly-sur-Seine",
      postalCode: "92200",
      latitude: "48.8843",
      longitude: "2.2686",
      tier: "gold" as const,
      segment: "dermo-cosmetic",
      pharmacistName: "Dr. Philippe Mercier",
      repId: rep2.id,
    },
  ];

  const insertedPharmacies = await db
    .insert(schema.pharmacies)
    .values(pharmacyData)
    .returning();

  // ── Visits ─────────────────────────────────────────────────────────────────
  type VisitInsert = typeof schema.visits.$inferInsert;

  const visitsData: VisitInsert[] = insertedPharmacies.slice(0, 6).map(
    (p, i) => ({
      pharmacyId: p.id,
      repId: p.repId,
      status: "completed" as const,
      scheduledAt: subDays(new Date(), i * 12 + 5),
      startedAt: subDays(new Date(), i * 12 + 5),
      completedAt: subDays(new Date(), i * 12 + 5),
      notes: `Visit ${i + 1}: Reviewed shelves, discussed new product launches. Pharmacist interested in CeraVe expansion.`,
    })
  );

  // Add a today's planned visit
  visitsData.push({
    pharmacyId: insertedPharmacies[0].id,
    repId: rep1.id,
    status: "planned",
    scheduledAt: new Date(new Date().setHours(14, 0, 0, 0)),
  });

  await db.insert(schema.visits).values(visitsData);

  // ── Orders ─────────────────────────────────────────────────────────────────
  const [order1] = await db
    .insert(schema.orders)
    .values({
      pharmacyId: insertedPharmacies[0].id,
      repId: rep1.id,
      status: "delivered",
      sourceType: "manual",
      totalAmount: "186.00",
      submittedAt: subDays(new Date(), 20),
      deliveredAt: subDays(new Date(), 15),
    })
    .returning();

  await db.insert(schema.orderLines).values([
    {
      orderId: order1.id,
      productId: products[0].id,
      quantity: 5,
      unitPrice: "18.90",
      lineTotal: "94.50",
    },
    {
      orderId: order1.id,
      productId: products[1].id,
      quantity: 4,
      unitPrice: "14.50",
      lineTotal: "58.00",
    },
    {
      orderId: order1.id,
      productId: products[2].id,
      quantity: 3,
      unitPrice: "22.00",
      lineTotal: "66.00",
    },
  ]);

  console.log("✅ Seed complete!");
  console.log("\n📋 Test credentials:");
  console.log("  Manager: marie.dupont@loreal.com / password123");
  console.log("  Rep 1:   thomas.martin@loreal.com / password123");
  console.log("  Rep 2:   sarah.bernard@loreal.com / password123");

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
