// Static PICOS checklist definition — single source of truth
// Total max points = 125, normalized to 100 for display: score = Math.round(achieved / 125 * 100)

export const PICOS_MAX_POINTS = 125;

export type ChecklistSubItem = {
  id: string;
  label: string;
};

export type ChecklistSection = "main_shelf" | "interruption" | "overall_store";

export type ChecklistItem = {
  id: string;
  num: number;
  label: string;
  maxPoints: number;
  section: ChecklistSection;
  subItems: ChecklistSubItem[];
};

export const SECTION_LABELS: Record<ChecklistSection, string> = {
  main_shelf: "Main Shelf",
  interruption: "Interruption Points",
  overall_store: "Overall Store",
};

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // ── Main Shelf ──────────────────────────────────────────────────────────────
  {
    id: "item_1",
    num: 1,
    label: "Recommended SKUs are available, stocked and displayed on shelf",
    maxPoints: 20,
    section: "main_shelf",
    subItems: [
      { id: "item_1_lipikar",  label: "Lipikar AP+M (10 pcs)" },
      { id: "item_1_effaclar", label: "Effaclar duo+M (10 pcs)" },
      { id: "item_1_cerave",   label: "CeraVe Lait hydratant (10 pcs)" },
      { id: "item_1_vichy",    label: "Vichy Lifactiv (10 pcs)" },
    ],
  },
  {
    id: "item_2",
    num: 2,
    label: "Main shelf is organised according to planogram",
    maxPoints: 15,
    section: "main_shelf",
    subItems: [
      // Integrated shelf
      { id: "item_2_share60",    label: "60% share of shelf" },
      { id: "item_2_eyelevel",   label: "FO at eye level" },
      { id: "item_2_blocking",   label: "Horizontal brand blocking" },
      { id: "item_2_tn",         label: "TN breakout" },
      // Brand shelf
      { id: "item_2_b_larger",   label: "Brand shelf: Larger than competitor" },
      { id: "item_2_b_atpar",    label: "Brand shelf: At par with competitor" },
      { id: "item_2_b_smaller",  label: "Brand shelf: Smaller than competitor" },
      { id: "item_2_b_noshelf",  label: "Brand shelf: No shelf" },
      // Solar shelf
      { id: "item_2_s_share60",  label: "Solar shelf: 60% share of shelf" },
      { id: "item_2_s_eyelevel", label: "Solar shelf: FO at eye level" },
      { id: "item_2_s_blocking", label: "Solar shelf: Horizontal brand blocking" },
      { id: "item_2_s_tn",       label: "Solar shelf: TN breakout" },
      // Deodorant shelf
      { id: "item_2_d_share60",  label: "Deodorant shelf: 60% share of shelf" },
      { id: "item_2_d_eyelevel", label: "Deodorant shelf: FO at eye level" },
      { id: "item_2_d_blocking", label: "Deodorant shelf: Horizontal brand blocking" },
      { id: "item_2_d_tn",       label: "Deodorant shelf: TN breakout" },
    ],
  },

  // ── Interruption Points ─────────────────────────────────────────────────────
  {
    id: "item_3",
    num: 3,
    label: "Display 1 is positioned according to PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_3_topseller",   label: "Top seller on additional display" },
      { id: "item_3_crosscat",    label: "Cross category on display" },
      { id: "item_3_nocompetition", label: "No competition products on display" },
    ],
  },
  {
    id: "item_4",
    num: 4,
    label: "Display 2 is positioned according to PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_4_topseller",   label: "Top seller on additional display" },
      { id: "item_4_crosscat",    label: "Cross category on display" },
      { id: "item_4_nocompetition", label: "No competition products on display" },
    ],
  },
  {
    id: "item_5",
    num: 5,
    label: "Display 3 is positioned according to PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_5_topseller",   label: "Top seller on additional display" },
      { id: "item_5_crosscat",    label: "Cross category on display" },
      { id: "item_5_nocompetition", label: "No competition products on display" },
    ],
  },

  // ── Overall Store ───────────────────────────────────────────────────────────
  {
    id: "item_6",
    num: 6,
    label: "Brand is visible in front window",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_6_larger",  label: "Larger than competitor" },
      { id: "item_6_atpar",   label: "At par with competitor" },
      { id: "item_6_smaller", label: "Smaller than competitor" },
      { id: "item_6_nopresence", label: "No presence" },
    ],
  },
  {
    id: "item_7",
    num: 7,
    label: "Shelf is positioned according to PICOS",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_7_2m", label: "Within 2m from counter" },
    ],
  },
  {
    id: "item_8",
    num: 8,
    label: "Communication is displayed as per guidelines",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_8_pos2",   label: "At least 2 POS materials with call-to-action aligned to suggested SKUs" },
      { id: "item_8_price",  label: "All price tags present, readable and positioned near related SKU" },
    ],
  },
  {
    id: "item_9",
    num: 9,
    label: "POS staff have been trained as per calendar",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_9_elearning",  label: "POS staff is on track with e-learning modules" },
      { id: "item_9_evenings",   label: "POS staff attended 80% of evening sessions" },
      { id: "item_9_detailing",  label: "Detailing material is clearly visible in store" },
    ],
  },
  {
    id: "item_10",
    num: 10,
    label: "POS staff NPS on brand above threshold",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_10_nps30", label: "NPS >30%" },
    ],
  },
  {
    id: "item_11",
    num: 11,
    label: "Promos are implemented in line with guidelines",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_11_noiffo",  label: "No promotions on IF/FO" },
      { id: "item_11_posters", label: "SKU X promo posters visible" },
    ],
  },
];

// ── PICOS Pillars ─────────────────────────────────────────────────────────────

export type PillarId = "availability" | "visibility" | "brand_experience" | "advocacy";

export const PICOS_PILLARS: Array<{
  id: PillarId;
  label: string;
  itemIds: string[];
  barColor: string;
}> = [
  {
    id: "availability",
    label: "Availability",
    itemIds: ["item_1"],
    barColor: "bg-green-500",
  },
  {
    id: "visibility",
    label: "Visibility",
    itemIds: ["item_2", "item_3", "item_4", "item_5", "item_6", "item_7"],
    barColor: "bg-blue-500",
  },
  {
    id: "brand_experience",
    label: "Brand experience",
    itemIds: ["item_8", "item_9"],
    barColor: "bg-violet-500",
  },
  {
    id: "advocacy",
    label: "Advocacy",
    itemIds: ["item_10", "item_11"],
    barColor: "bg-orange-500",
  },
];

/**
 * Compute per-pillar compliance (0-100) from a checklist state.
 */
export function computePillarScores(
  checklistState: Record<string, string[]>
): Record<PillarId, number> {
  const scores = {} as Record<PillarId, number>;
  for (const pillar of PICOS_PILLARS) {
    let achieved = 0;
    let maxPts = 0;
    for (const itemId of pillar.itemIds) {
      const item = CHECKLIST_ITEMS.find((i) => i.id === itemId);
      if (!item) continue;
      const checked = checklistState[itemId] ?? [];
      const total = item.subItems.length;
      if (total === 0) continue;
      achieved += (checked.length / total) * item.maxPoints;
      maxPts += item.maxPoints;
    }
    scores[pillar.id] = maxPts > 0 ? Math.round((achieved / maxPts) * 100) : 0;
  }
  return scores;
}

// All sub-item IDs (for validation)
export const ALL_SUB_ITEM_IDS = new Set(
  CHECKLIST_ITEMS.flatMap((item) => item.subItems.map((s) => s.id))
);

/**
 * Compute PICOS score (0–100) from a checklist state.
 * checklistState: Record<itemId, checkedSubItemIds[]>
 */
export function computePicosScore(checklistState: Record<string, string[]>): number {
  let achieved = 0;
  for (const item of CHECKLIST_ITEMS) {
    const checked = checklistState[item.id] ?? [];
    const total = item.subItems.length;
    if (total === 0) continue;
    const ratio = checked.length / total;
    achieved += ratio * item.maxPoints;
  }
  return Math.round((achieved / PICOS_MAX_POINTS) * 100);
}

/**
 * Generate a concise human-readable audit summary from checklist state.
 */
export function generateAuditSummary(
  checklistState: Record<string, string[]>,
  picosScore: number
): string {
  const status =
    picosScore >= 80 ? "strong compliance"
    : picosScore >= 60 ? "good progress but room for improvement"
    : picosScore >= 40 ? "partial compliance — several areas need attention"
    : "significant gaps across the store";

  const passing: string[] = [];
  const failing: string[] = [];

  for (const item of CHECKLIST_ITEMS) {
    const checked = checklistState[item.id] ?? [];
    const total = item.subItems.length;
    if (total === 0) continue;
    const ratio = checked.length / total;
    if (ratio >= 0.5) {
      passing.push(`• ${item.label}`);
    } else {
      failing.push(`• ${item.label}`);
    }
  }

  const parts: string[] = [];
  parts.push(`PICOS score ${picosScore}/100 — ${status}.`);

  if (passing.length > 0) {
    parts.push(`\nWhat's working:\n${passing.join("\n")}`);
  }

  if (failing.length > 0) {
    parts.push(`\nNeeds improvement:\n${failing.join("\n")}`);
  }

  return parts.join("\n");
}
