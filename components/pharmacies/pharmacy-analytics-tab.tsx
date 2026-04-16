"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, BarChart2, TrendingUp, Package } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const BRAND_COLORS: Record<string, string> = {
  vichy: "#0057a8",
  cerave: "#00843d",
  la_roche_posay: "#e4002b",
  skinceuticals: "#1a1a1a",
  skinbetter: "#8b5cf6",
  mixa: "#f59e0b",
  nyx: "#000000",
  biotherm: "#0ea5e9",
  medik8: "#d97706",
  other: "#9ca3af",
};

const BRAND_LABEL: Record<string, string> = {
  vichy: "Vichy",
  cerave: "CeraVe",
  la_roche_posay: "La Roche-Posay",
  skinceuticals: "SkinCeuticals",
  skinbetter: "SkinBetter",
  mixa: "Mixa",
  nyx: "NYX",
  biotherm: "Biotherm",
  medik8: "Medik8",
  other: "Autre",
};

type RiskLevel = "critical" | "warning" | "ok";

type AnalyticsData = {
  hasSelloutData: boolean;
  hasStockData: boolean;
  lastImportDate: string | null;
  topSellers: Array<{
    productId: string | null; sku: string; name: string; brand: string; totalQtySold: number; latestPeriod: string | null;
  }>;
  stockRisk: Array<{
    productId: string; sku: string; name: string; brand: string;
    latestStock: number; avgMonthlySales: number; rotationDays: number | null;
    risk: RiskLevel;
  }>;
  selloutByBrand: Array<{ brand: string; totalQtySold: number }>;
  selloutTrend: Array<{ visitDate: string; totalQtySold: number; periodLabel: string | null }>;
};

const RISK_CONFIG: Record<RiskLevel, { label: string; badgeClass: string; rotationClass: string }> = {
  critical: {
    label: "Rupture imminente",
    badgeClass: "bg-red-100 text-red-700",
    rotationClass: "text-red-600 font-semibold",
  },
  warning: {
    label: "À surveiller",
    badgeClass: "bg-amber-100 text-amber-700",
    rotationClass: "text-amber-600 font-semibold",
  },
  ok: {
    label: "OK",
    badgeClass: "bg-green-100 text-green-700",
    rotationClass: "text-green-600",
  },
};

export function PharmacyAnalyticsTab({ pharmacyId }: { pharmacyId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pharmacies/${pharmacyId}/sellout-analytics`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Impossible de charger les données analytics."))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-danger-600 py-8">
        <AlertTriangle size={15} /> {error}
      </div>
    );
  }

  if (!data || (!data.hasSelloutData && !data.hasStockData)) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3">
        <BarChart2 size={32} className="mx-auto text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Aucune donnée sell-out disponible</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          Importez les fichiers CSV sell-out et stock depuis Winpharma ou LGPI lors d'une visite (onglet Commande) pour voir les analyses ici.
        </p>
      </div>
    );
  }

  const totalQtySold = data.topSellers.reduce((s, p) => s + p.totalQtySold, 0);
  const productCount = data.topSellers.length;
  const maxBrandQty = Math.max(...data.selloutByBrand.map((b) => b.totalQtySold), 1);

  // Prepare chart data — truncate name for readability
  const topSellersChart = data.topSellers.map((p) => ({
    name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
    qty: p.totalQtySold,
    fill: BRAND_COLORS[p.brand] ?? "#9ca3af",
  }));

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{productCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Produits suivis</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalQtySold}</p>
          <p className="text-xs text-gray-500 mt-0.5">Ventes totales</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-sm font-bold text-gray-900 leading-tight">
            {data.lastImportDate
              ? new Date(data.lastImportDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
              : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Dernier import</p>
        </div>
      </div>

      {/* Stock risk table */}
      {data.hasStockData && data.hasSelloutData && data.stockRisk.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <Package size={14} className="text-brand-500" />
            <p className="text-sm font-medium text-gray-900">Risque de rupture</p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.stockRisk.map((item) => {
              const cfg = RISK_CONFIG[item.risk];
              return (
                <div key={item.productId} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-gray-900 truncate">{item.name}</p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: (BRAND_COLORS[item.brand] ?? "#9ca3af") + "22", color: BRAND_COLORS[item.brand] ?? "#9ca3af" }}
                      >
                        {BRAND_LABEL[item.brand] ?? item.brand}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Stock: <span className={cn("font-medium", item.latestStock === 0 ? "text-red-600" : "text-gray-700")}>{item.latestStock}</span>
                      {" · "}
                      Ventes/mois: <span className="text-gray-700 font-medium">{item.avgMonthlySales}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className={cn("text-sm", cfg.rotationClass)}>
                      {item.rotationDays !== null ? `${item.rotationDays}j` : "—"}
                    </p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.badgeClass)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top sellers chart */}
      {data.hasSelloutData && topSellersChart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-brand-500" />
            <p className="text-sm font-medium text-gray-900">Top produits — Ventes</p>
          </div>
          <ResponsiveContainer width="100%" height={topSellersChart.length * 36 + 20}>
            <BarChart
              data={topSellersChart}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 11, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [`${value} unités`, "Vendus"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                {topSellersChart.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ventes par marque */}
      {data.selloutByBrand.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Ventes par marque</p>
          <div className="space-y-2.5">
            {data.selloutByBrand.map((b) => (
              <div key={b.brand}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{BRAND_LABEL[b.brand] ?? b.brand}</span>
                  <span className="text-gray-500">{b.totalQtySold} unités</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((b.totalQtySold / maxBrandQty) * 100)}%`,
                      backgroundColor: BRAND_COLORS[b.brand] ?? "#9ca3af",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendance des ventes */}
      {data.selloutTrend.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-4">Tendance des ventes par visite</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.selloutTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="visitDate"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                formatter={(value) => [`${value} unités`, "Vendus"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line
                type="monotone"
                dataKey="totalQtySold"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: "#6366f1", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
