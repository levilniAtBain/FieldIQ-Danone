import { PlanogramSvg } from "@/components/pharmacies/planogram-svg";

const RULES = [
  {
    color: "bg-amber-50 border-amber-200",
    title: "60% Share of Shelf",
    body: "Les produits Danone doivent occuper ≥ 60% de l'espace rayon dans la catégorie.",
  },
  {
    color: "bg-yellow-50 border-yellow-200",
    title: "Eye Level = Buy Level",
    body: "Priority SKUs at 1.2–1.5m height. Shelves 2 and 3 from top are the golden zone.",
  },
  {
    color: "bg-blue-50 border-blue-200",
    title: "Horizontal Blocking",
    body: "Regrouper tous les produits Danone en bande horizontale continue — jamais divisés verticalement.",
  },
  {
    color: "bg-orange-50 border-orange-200",
    title: "TN Breakout",
    body: "Tête de gondole 100% dédiée aux best-sellers Danone. Aucun produit concurrent.",
  },
];

const SHELF_DETAILS = [
  {
    label: "Integrated shelf",
    items: [
      "60% de part de rayon — Danone doit occuper la majorité",
      "Face-out (FO) à hauteur des yeux (1,2–1,5m)",
      "Bloquage horizontal — section Danone continue",
      "TN breakout — tête de gondole 100% Danone",
    ],
  },
  {
    label: "Brand / Solar / Deodorant shelf",
    items: [
      "Section Danone ≥ section concurrente",
      "Apply the same FO and eye-level rules",
      "No competitor products on TN display",
    ],
  },
];

export default function PlanogramPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Perfect Planogram</h1>
        <p className="text-sm text-gray-500 mt-1">PICOS shelf standards — visual reference guide</p>
      </div>

      {/* SVG diagram */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <PlanogramSvg />
      </div>

      {/* Key rules grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Key Standards</h2>
        <div className="grid grid-cols-2 gap-3">
          {RULES.map((rule) => (
            <div key={rule.title} className={`rounded-xl border p-3 ${rule.color}`}>
              <p className="text-xs font-semibold text-gray-800 mb-1">{rule.title}</p>
              <p className="text-xs text-gray-600 leading-snug">{rule.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shelf-by-shelf details */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Shelf-by-shelf requirements</h2>
        <div className="space-y-4">
          {SHELF_DETAILS.map((section) => (
            <div key={section.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-800 mb-2">{section.label}</p>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Priority SKUs */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Priority SKUs</h2>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              "Fortimel Protein 200ml (≥4 unités)",
              "Fortimel Energy 200ml (≥4 unités)",
              "Gallia Calisma 1er âge (≥2 boîtes)",
              "Aptamil Pronutra 1 (≥2 boîtes)",
              "Blédina Compotes 4x90g",
              "Evian Bébé 6x50cl",
            ].map((sku) => (
              <div key={sku} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded bg-amber-400 flex-shrink-0" />
                {sku}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
