// Static PICOS checklist definition — single source of truth (Danone pharmacy channel)
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
  main_shelf: "Rayon principal",
  interruption: "Points d'interruption",
  overall_store: "Magasin global",
};

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // ── Rayon principal ─────────────────────────────────────────────────────────
  {
    id: "item_1",
    num: 1,
    label: "SKUs prioritaires disponibles, en stock et présentés en rayon",
    maxPoints: 20,
    section: "main_shelf",
    subItems: [
      { id: "item_1_fortimel_prot", label: "Fortimel Protein 200ml (≥4 unités)" },
      { id: "item_1_fortimel_energy", label: "Fortimel Energy 200ml (≥4 unités)" },
      { id: "item_1_gallia_calisma", label: "Gallia Calisma 1er âge (≥2 boîtes)" },
      { id: "item_1_aptamil_1",     label: "Aptamil Pronutra 1 (≥2 boîtes)" },
    ],
  },
  {
    id: "item_2",
    num: 2,
    label: "Rayon nutrition médicale organisé selon le planogramme",
    maxPoints: 15,
    section: "main_shelf",
    subItems: [
      { id: "item_2_share60",    label: "≥60% de part de rayon Danone" },
      { id: "item_2_eyelevel",   label: "Fortimel à hauteur des yeux (1,2–1,5m)" },
      { id: "item_2_blocking",   label: "Bloquage horizontal par marque" },
      { id: "item_2_tn",         label: "TN / tête de gondole Danone" },
      // Rayon laits infantiles
      { id: "item_2_b_larger",   label: "Rayon laits : plus grand que concurrent" },
      { id: "item_2_b_atpar",    label: "Rayon laits : à parité avec concurrent" },
      { id: "item_2_b_smaller",  label: "Rayon laits : plus petit que concurrent" },
      { id: "item_2_b_noshelf",  label: "Rayon laits : absent" },
      // Rayon petits pots / Blédina
      { id: "item_2_s_share60",  label: "Rayon petits pots : ≥60% Danone" },
      { id: "item_2_s_eyelevel", label: "Rayon petits pots : Blédina à hauteur des yeux" },
      { id: "item_2_s_blocking", label: "Rayon petits pots : bloquage horizontal" },
      { id: "item_2_s_tn",       label: "Rayon petits pots : TN Danone" },
      // Rayon eaux
      { id: "item_2_d_share60",  label: "Rayon eaux : Evian/Volvic ≥60%" },
      { id: "item_2_d_eyelevel", label: "Rayon eaux : Evian bébé à hauteur des yeux" },
      { id: "item_2_d_blocking", label: "Rayon eaux : bloquage horizontal" },
      { id: "item_2_d_tn",       label: "Rayon eaux : TN Danone" },
    ],
  },

  // ── Points d'interruption ────────────────────────────────────────────────────
  {
    id: "item_3",
    num: 3,
    label: "Display 1 positionné selon les standards PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_3_topseller",     label: "Top seller sur le display additionnel" },
      { id: "item_3_crosscat",      label: "Cross-catégorie sur le display" },
      { id: "item_3_nocompetition", label: "Pas de produits concurrents sur le display" },
    ],
  },
  {
    id: "item_4",
    num: 4,
    label: "Display 2 positionné selon les standards PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_4_topseller",     label: "Top seller sur le display additionnel" },
      { id: "item_4_crosscat",      label: "Cross-catégorie sur le display" },
      { id: "item_4_nocompetition", label: "Pas de produits concurrents sur le display" },
    ],
  },
  {
    id: "item_5",
    num: 5,
    label: "Display 3 positionné selon les standards PICOS",
    maxPoints: 10,
    section: "interruption",
    subItems: [
      { id: "item_5_topseller",     label: "Top seller sur le display additionnel" },
      { id: "item_5_crosscat",      label: "Cross-catégorie sur le display" },
      { id: "item_5_nocompetition", label: "Pas de produits concurrents sur le display" },
    ],
  },

  // ── Magasin global ───────────────────────────────────────────────────────────
  {
    id: "item_6",
    num: 6,
    label: "Marque visible en vitrine",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_6_larger",    label: "Plus visible que le concurrent" },
      { id: "item_6_atpar",     label: "À parité avec le concurrent" },
      { id: "item_6_smaller",   label: "Moins visible que le concurrent" },
      { id: "item_6_nopresence", label: "Pas de présence en vitrine" },
    ],
  },
  {
    id: "item_7",
    num: 7,
    label: "Rayon nutrition médicale positionné selon PICOS",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_7_2m",       label: "Dans les 2m du comptoir / espace conseil" },
      { id: "item_7_signaled", label: "Balisage Danone visible depuis le couloir" },
    ],
  },
  {
    id: "item_8",
    num: 8,
    label: "Communication affichée selon les directives",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_8_pos2",  label: "≥2 supports PLV avec call-to-action aligné aux SKUs recommandés" },
      { id: "item_8_price", label: "Toutes les étiquettes prix présentes et lisibles" },
    ],
  },
  {
    id: "item_9",
    num: 9,
    label: "Personnel POS formé selon le calendrier",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_9_elearning",  label: "Personnel POS à jour sur les modules e-learning" },
      { id: "item_9_evenings",   label: "Participation ≥80% aux sessions du soir" },
      { id: "item_9_detailing",  label: "Matériel de détailing Danone visible en réserve" },
    ],
  },
  {
    id: "item_10",
    num: 10,
    label: "NPS du personnel POS sur la marque au-dessus du seuil",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_10_nps30", label: "NPS >30%" },
    ],
  },
  {
    id: "item_11",
    num: 11,
    label: "Promos mises en place conformément aux directives",
    maxPoints: 10,
    section: "overall_store",
    subItems: [
      { id: "item_11_noiffo",  label: "Pas de promotions sur IF/FO (nutrition médicale)" },
      { id: "item_11_posters", label: "Affiches promo Fortimel / Gallia visibles" },
    ],
  },
];

// ── Piliers PICOS ────────────────────────────────────────────────────────────

export type PillarId = "availability" | "visibility" | "brand_experience" | "advocacy";

export const PICOS_PILLARS: Array<{
  id: PillarId;
  label: string;
  itemIds: string[];
  barColor: string;
}> = [
  {
    id: "availability",
    label: "Disponibilité",
    itemIds: ["item_1"],
    barColor: "bg-green-500",
  },
  {
    id: "visibility",
    label: "Visibilité",
    itemIds: ["item_2", "item_3", "item_4", "item_5", "item_6", "item_7"],
    barColor: "bg-blue-500",
  },
  {
    id: "brand_experience",
    label: "Expérience marque",
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
    picosScore >= 80 ? "forte conformité PICOS"
    : picosScore >= 60 ? "bonne progression mais des améliorations possibles"
    : picosScore >= 40 ? "conformité partielle — plusieurs zones à améliorer"
    : "écarts significatifs sur l'ensemble du point de vente";

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
  parts.push(`Score PICOS ${picosScore}/100 — ${status}.`);

  if (passing.length > 0) {
    parts.push(`\nPoints forts :\n${passing.join("\n")}`);
  }

  if (failing.length > 0) {
    parts.push(`\nAxes d'amélioration :\n${failing.join("\n")}`);
  }

  return parts.join("\n");
}
