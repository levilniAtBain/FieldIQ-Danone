"use client";

import type { Session } from "@/lib/auth/session";
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

export function AnalyticsView({
  session,
  topProducts,
  visitChartData,
  pharmacyCount,
}: {
  session: Session;
  topProducts: { name: string; brand: string; qty: number }[];
  visitChartData: { month: string; visits: number }[];
  pharmacyCount: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {session.role === "manager" ? "Region overview" : "Your territory · last 6 months"}
        </p>
      </div>

      {/* Visit trend */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Visits per month
        </h2>
        {visitChartData.every((d) => d.visits === 0) ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No visit data yet — complete visits to see trends
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={visitChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#a21caf"
                strokeWidth={2}
                dot={{ fill: "#a21caf", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top products */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Top products by volume ordered
        </h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No orders yet — submit orders to see best sellers
          </p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4 text-right">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900">{p.name}</span>
                    <span className="text-sm font-semibold text-gray-700">
                      {p.qty} units
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(
                          (p.qty / (topProducts[0]?.qty || 1)) * 100
                        )}%`,
                        background:
                          BRAND_COLORS[p.brand] ?? BRAND_COLORS.other,
                      }}
                    />
                  </div>
                  <p
                    className="text-xs mt-0.5 capitalize"
                    style={{ color: BRAND_COLORS[p.brand] ?? "#9ca3af" }}
                  >
                    {p.brand.replace("_", " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Summary</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Pharmacies</p>
            <p className="text-xl font-bold text-gray-900">{pharmacyCount}</p>
          </div>
          <div>
            <p className="text-gray-500">Total visits (6m)</p>
            <p className="text-xl font-bold text-gray-900">
              {visitChartData.reduce((s, d) => s + d.visits, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
