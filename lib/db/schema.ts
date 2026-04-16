import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  decimal,
  boolean,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["rep", "manager"]);

// pharmacy_tier enum kept in DB for legacy; segments now use text values a/b/c/d

export const visitStatusEnum = pgEnum("visit_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "submitted",
  "confirmed",
  "delivered",
  "cancelled",
]);

export const specialistStatusEnum = pgEnum("specialist_status", [
  "pending",
  "contacted",
  "confirmed",
]);

export const coVisitRoleEnum = pgEnum("co_visit_role", ["mv", "merchandiser"]);

export const actionTypeEnum = pgEnum("action_type", [
  "promo",
  "bundle",
  "animation",
  "specialist_visit",
  "product_intro",
  "training",
]);

export const brandEnum = pgEnum("brand", [
  "vichy",
  "cerave",
  "la_roche_posay",
  "skinceuticals",
  "skinbetter",
  "mixa",
  "nyx",
  "biotherm",
  "medik8",
  "other",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const specialists = pgTable("specialists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: coVisitRoleEnum("role").notNull(),
  territory: text("territory"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("rep"),
    regionId: uuid("region_id").references(() => regions.id),
    managerId: uuid("manager_id"), // self-reference — rep's manager
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("users_region_idx").on(t.regionId)]
);

export const pharmacies = pgTable(
  "pharmacies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    pharmacistName: text("pharmacist_name"),
    pharmacistPhone: text("pharmacist_phone"),
    tier: text("tier").notNull().default("c"), // "a" | "b" | "c" | "d"
    // Which rep owns this pharmacy
    repId: uuid("rep_id")
      .notNull()
      .references(() => users.id),
    // Customer segment for recommendations
    segment: text("segment"), // e.g. "dermo-cosmetic", "beauty", "mixed"
    sfAccountId: text("sf_account_id"), // Salesforce account ID
    notes: text("notes"),
    aiBriefingCache: text("ai_briefing_cache"),
    aiBriefingCachedAt: timestamp("ai_briefing_cached_at"),
    isActive: boolean("is_active").notNull().default(true),
    // Segmentation axes (Perfect Store)
    segmentPotential: text("segment_potential"), // "high" | "medium" | "low"
    segmentProfile: jsonb("segment_profile").$type<string[]>(), // e.g. ["expert_led", "chain_grouped"]
    segmentShopper: jsonb("segment_shopper").$type<string[]>(), // e.g. ["urban_affluent", "families"]
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("pharmacies_rep_idx").on(t.repId),
    index("pharmacies_location_idx").on(t.latitude, t.longitude),
  ]
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    repId: uuid("rep_id")
      .notNull()
      .references(() => users.id),
    status: visitStatusEnum("status").notNull().default("planned"),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    // Pre-visit
    objectivesJson: jsonb("objectives_json"), // string[]
    aiBriefing: text("ai_briefing"), // generated pre-visit summary
    // During visit
    notes: text("notes"),
    audioTranscript: text("audio_transcript"),
    audioSummary: text("audio_summary"),
    shelfAnalysisJson: jsonb("shelf_analysis_json"), // structured AI output
    // Post-visit
    aiReportDraft: text("ai_report_draft"),
    reportFinal: text("report_final"),
    sfActivityId: text("sf_activity_id"), // Salesforce activity ID after export
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("visits_pharmacy_idx").on(t.pharmacyId),
    index("visits_rep_idx").on(t.repId),
    index("visits_scheduled_idx").on(t.scheduledAt),
  ]
);

export const visitFiles = pgTable("visit_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "shelf_photo" | "order_scan" | "audio"
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  aiAnalysisJson: jsonb("ai_analysis_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    brand: brandEnum("brand").notNull(),
    category: text("category").notNull(), // e.g. "sunscreen", "moisturizer"
    description: text("description"),
    imageUrl: text("image_url"),
    productUrl: text("product_url"),
    videoUrl: text("video_url"),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("products_brand_idx").on(t.brand)]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    repId: uuid("rep_id")
      .notNull()
      .references(() => users.id),
    visitId: uuid("visit_id").references(() => visits.id),
    status: orderStatusEnum("status").notNull().default("draft"),
    // How the order was created
    sourceType: text("source_type"), // "manual" | "scan" | "voice" | "reorder"
    scanFilePath: text("scan_file_path"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    sfOrderId: text("sf_order_id"),
    submittedAt: timestamp("submitted_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("orders_pharmacy_idx").on(t.pharmacyId),
    index("orders_rep_idx").on(t.repId),
  ]
);

export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }),
});

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    repId: uuid("rep_id")
      .notNull()
      .references(() => users.id),
    visitId: uuid("visit_id").references(() => visits.id),
    type: actionTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    accepted: boolean("accepted"), // null = pending, true = accepted, false = dismissed
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Specialist coordination (for specialist_visit type)
    assignedSpecialistId: uuid("assigned_specialist_id").references(() => specialists.id),
    scheduledVisitDate: timestamp("scheduled_visit_date"),
    specialistStatus: specialistStatusEnum("specialist_status").default("pending"),
    specialistNotes: text("specialist_notes"),
  },
  (t) => [index("actions_pharmacy_idx").on(t.pharmacyId)]
);

// ─── Master Plan ─────────────────────────────────────────────────────────────

export const masterPlanStatusEnum = pgEnum("master_plan_status", [
  "draft",
  "confirmed",
  "completed",
]);

export const visitTypeEnum = pgEnum("visit_type", [
  "follow_up",
  "specialist_mv",
  "specialist_merchandising",
  "presentation",
]);

export const masterPlanEntries = pgTable(
  "master_plan_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repId: uuid("rep_id").notNull().references(() => users.id),
    pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmacies.id),
    plannedDate: timestamp("planned_date").notNull(),
    status: masterPlanStatusEnum("status").notNull().default("draft"),
    visitType: visitTypeEnum("visit_type").default("follow_up"),
    // Pre-visit shared content
    objectives: text("objectives"),
    keyAttentionPoints: text("key_attention_points"),
    // Post-visit takeaways
    repTakeaways: text("rep_takeaways"),
    mvTakeaways: text("mv_takeaways"),
    merchandiserTakeaways: text("merchandiser_takeaways"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("master_plan_rep_idx").on(t.repId),
    index("master_plan_pharmacy_idx").on(t.pharmacyId),
  ]
);

export const masterPlanCoVisitors = pgTable("master_plan_co_visitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  masterPlanId: uuid("master_plan_id")
    .notNull()
    .references(() => masterPlanEntries.id, { onDelete: "cascade" }),
  role: coVisitRoleEnum("role").notNull(),
  name: text("name").notNull(),
  confirmed: boolean("confirmed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sales data (imported / synced from Salesforce or ERP) ───────────────────

export const salesData = pgTable(
  "sales_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    period: text("period").notNull(), // "2024-Q1", "2024-11", etc.
    quantity: integer("quantity").notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).notNull(),
    target: decimal("target", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("sales_pharmacy_period_idx").on(t.pharmacyId, t.period),
    index("sales_product_idx").on(t.productId),
  ]
);

// ─── Visit sell-out & stock (imported from pharmacy system) ──────────────────

export const visitSelloutLines = pgTable("visit_sellout_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id, { onDelete: "cascade" }),
  pharmacyId: uuid("pharmacy_id")
    .notNull()
    .references(() => pharmacies.id),
  productId: uuid("product_id").references(() => products.id), // null if unmatched
  rawProductName: text("raw_product_name").notNull(),
  rawSku: text("raw_sku"),
  qtySold: integer("qty_sold").notNull(),
  periodLabel: text("period_label"), // e.g. "01/03/2026–31/03/2026"
  matchConfidence: text("match_confidence"), // "exact" | "fuzzy" | "ai" | null
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const visitStockLines = pgTable("visit_stock_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id, { onDelete: "cascade" }),
  pharmacyId: uuid("pharmacy_id")
    .notNull()
    .references(() => pharmacies.id),
  productId: uuid("product_id").references(() => products.id),
  rawProductName: text("raw_product_name").notNull(),
  rawSku: text("raw_sku"),
  qtyInStock: integer("qty_in_stock").notNull(),
  matchConfidence: text("match_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Perfect Store ────────────────────────────────────────────────────────────

export const perfectStoreVisits = pgTable(
  "perfect_store_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmacies.id, { onDelete: "cascade" }),
    repId: uuid("rep_id").notNull().references(() => users.id),
    visitDate: timestamp("visit_date").defaultNow().notNull(),
    checklistJson: jsonb("checklist_json").$type<Record<string, string[]>>(),
    kpisJson: jsonb("kpis_json").$type<Record<string, {
      shareOfShelf: number | null;
      extraDisplay: number | null;
      coreOnShelfAvailability: number | null;
      numberOfFacings: number | null;
      qualityOfPositioning: number | null;
      shareOfAssortment: number | null;
    } | null>>(),
    picosScore: integer("picos_score"),
    aiSummary: text("ai_summary"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("ps_visits_pharmacy_idx").on(t.pharmacyId),
    index("ps_visits_rep_idx").on(t.repId),
  ]
);

export const perfectStoreFiles = pgTable("perfect_store_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  psVisitId: uuid("ps_visit_id").notNull().references(() => perfectStoreVisits.id, { onDelete: "cascade" }),
  pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmacies.id),
  shelfSection: text("shelf_section").notNull(), // "main" | "brand" | "solar" | "deodorant"
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  aiAnalysisJson: jsonb("ai_analysis_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  region: one(regions, { fields: [users.regionId], references: [regions.id] }),
  pharmacies: many(pharmacies),
  visits: many(visits),
  orders: many(orders),
}));

export const pharmaciesRelations = relations(pharmacies, ({ one, many }) => ({
  rep: one(users, { fields: [pharmacies.repId], references: [users.id] }),
  visits: many(visits),
  orders: many(orders),
  actions: many(actions),
  salesData: many(salesData),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  pharmacy: one(pharmacies, {
    fields: [visits.pharmacyId],
    references: [pharmacies.id],
  }),
  rep: one(users, { fields: [visits.repId], references: [users.id] }),
  files: many(visitFiles),
  order: one(orders, { fields: [visits.id], references: [orders.visitId] }),
  selloutLines: many(visitSelloutLines),
  stockLines: many(visitStockLines),
}));

export const visitFilesRelations = relations(visitFiles, ({ one }) => ({
  visit: one(visits, { fields: [visitFiles.visitId], references: [visits.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  pharmacy: one(pharmacies, {
    fields: [orders.pharmacyId],
    references: [pharmacies.id],
  }),
  rep: one(users, { fields: [orders.repId], references: [users.id] }),
  lines: many(orderLines),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, {
    fields: [orderLines.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderLines.productId],
    references: [products.id],
  }),
}));

export const specialistsRelations = relations(specialists, ({ many }) => ({
  actions: many(actions),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  pharmacy: one(pharmacies, {
    fields: [actions.pharmacyId],
    references: [pharmacies.id],
  }),
  rep: one(users, { fields: [actions.repId], references: [users.id] }),
  specialist: one(specialists, {
    fields: [actions.assignedSpecialistId],
    references: [specialists.id],
  }),
}));

export const masterPlanEntriesRelations = relations(masterPlanEntries, ({ one, many }) => ({
  rep: one(users, { fields: [masterPlanEntries.repId], references: [users.id] }),
  pharmacy: one(pharmacies, { fields: [masterPlanEntries.pharmacyId], references: [pharmacies.id] }),
  coVisitors: many(masterPlanCoVisitors),
}));

export const masterPlanCoVisitorsRelations = relations(masterPlanCoVisitors, ({ one }) => ({
  masterPlan: one(masterPlanEntries, {
    fields: [masterPlanCoVisitors.masterPlanId],
    references: [masterPlanEntries.id],
  }),
}));

export const visitSelloutLinesRelations = relations(visitSelloutLines, ({ one }) => ({
  visit: one(visits, { fields: [visitSelloutLines.visitId], references: [visits.id] }),
  pharmacy: one(pharmacies, { fields: [visitSelloutLines.pharmacyId], references: [pharmacies.id] }),
  product: one(products, { fields: [visitSelloutLines.productId], references: [products.id] }),
}));

export const visitStockLinesRelations = relations(visitStockLines, ({ one }) => ({
  visit: one(visits, { fields: [visitStockLines.visitId], references: [visits.id] }),
  pharmacy: one(pharmacies, { fields: [visitStockLines.pharmacyId], references: [pharmacies.id] }),
  product: one(products, { fields: [visitStockLines.productId], references: [products.id] }),
}));

export const perfectStoreVisitsRelations = relations(perfectStoreVisits, ({ one, many }) => ({
  pharmacy: one(pharmacies, { fields: [perfectStoreVisits.pharmacyId], references: [pharmacies.id] }),
  rep: one(users, { fields: [perfectStoreVisits.repId], references: [users.id] }),
  files: many(perfectStoreFiles),
}));

export const perfectStoreFilesRelations = relations(perfectStoreFiles, ({ one }) => ({
  psVisit: one(perfectStoreVisits, { fields: [perfectStoreFiles.psVisitId], references: [perfectStoreVisits.id] }),
  pharmacy: one(pharmacies, { fields: [perfectStoreFiles.pharmacyId], references: [pharmacies.id] }),
}));
