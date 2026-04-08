export const VISIT_TYPE_OPTIONS = [
  { value: "follow_up",               label: "Visite de suivi / commerciale",      icon: "🔄", color: "bg-gray-100 text-gray-700",   specialistRole: null },
  { value: "specialist_mv",           label: "Visite Spécialiste MV",              icon: "⭐", color: "bg-red-50 text-red-700",       specialistRole: "mv" as const },
  { value: "specialist_merchandising",label: "Visite Spécialiste Merchandising",   icon: "🏪", color: "bg-purple-50 text-purple-700", specialistRole: "merchandiser" as const },
  { value: "presentation",            label: "Présentation / Lancement",           icon: "🚀", color: "bg-brand-50 text-brand-700",   specialistRole: null },
] as const;

export type VisitType = (typeof VISIT_TYPE_OPTIONS)[number]["value"];

export function getVisitTypeOption(type: string | null | undefined) {
  return VISIT_TYPE_OPTIONS.find((o) => o.value === type) ?? VISIT_TYPE_OPTIONS[0];
}

/** Action types that require a physical visit (not just a promo/bundle) */
export const VISIT_ACTION_TYPES = new Set(["specialist_visit", "animation", "product_intro", "training"]);
