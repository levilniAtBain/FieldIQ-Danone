import { PlanogramSvg } from "@/components/pharmacies/planogram-svg";

const RULES = [
  {
    color: "bg-amber-50 border-amber-200",
    title: "60% Share of Shelf",
    body: "L'Oréal products must occupy ≥ 60% of the shelf space in the category.",
  },
  {
    color: "bg-yellow-50 border-yellow-200",
    title: "Eye Level = Buy Level",
    body: "Priority SKUs at 1.2–1.5m height. Shelves 2 and 3 from top are the golden zone.",
  },
  {
    color: "bg-blue-50 border-blue-200",
    title: "Horizontal Blocking",
    body: "Group all L'Oréal products in a continuous horizontal band — never split vertically.",
  },
  {
    color: "bg-orange-50 border-orange-200",
    title: "TN Breakout",
    body: "End-cap display 100% dedicated to L'Oréal top sellers. No competitor products.",
  },
];

const SHELF_DETAILS = [
  {
    label: "Integrated shelf",
    items: [
      "60% share of shelf — L'Oréal must occupy the majority",
      "Face-out (FO) at eye level (1.2–1.5m)",
      "Horizontal brand blocking — continuous L'Oréal section",
      "TN breakout — end-cap 100% L'Oréal top sellers",
    ],
  },
  {
    label: "Brand / Solar / Deodorant shelf",
    items: [
      "L'Oréal section must be ≥ competitor section",
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
              "Lipikar AP+M (10 pcs)",
              "Effaclar Duo+M (10 pcs)",
              "CeraVe Lait Hydratant (10 pcs)",
              "Vichy Lifactiv (10 pcs)",
              "Anthelios (La Roche-Posay)",
              "UV Mune",
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
