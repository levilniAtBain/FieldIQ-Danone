"use client";

import { useState } from "react";
import Link from "next/link";
import { format, addBusinessDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ShoppingCart, ChevronDown, ChevronUp, Truck, Package, Building2 } from "lucide-react";
import type { OrderRow } from "@/components/pharmacies/pharmacy-detail-view";

type OrderWithPharmacy = OrderRow & {
  pharmacyId: string;
  pharmacy: { id: string; name: string; city: string };
};

function promisedDeliveryDate(from: Date | string): string {
  return format(addBusinessDays(new Date(from), 5), "d MMM yyyy");
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  confirmed: "bg-brand-50 text-brand-700",
  delivered: "bg-success-50 text-success-700",
  cancelled: "bg-danger-50 text-danger-700",
};

export function OrdersView({ orders }: { orders: OrderWithPharmacy[] }) {
  // Group by pharmacy
  const byPharmacy = orders.reduce<Record<string, { pharmacy: { id: string; name: string; city: string }; orders: OrderWithPharmacy[] }>>(
    (acc, o) => {
      if (!acc[o.pharmacyId]) {
        acc[o.pharmacyId] = { pharmacy: o.pharmacy, orders: [] };
      }
      acc[o.pharmacyId].orders.push(o);
      return acc;
    },
    {}
  );

  const groups = Object.values(byPharmacy);

  if (groups.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <ShoppingCart size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No orders yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>

      {groups.map(({ pharmacy, orders: pharmOrders }) => (
        <PharmacyOrderGroup key={pharmacy.id} pharmacy={pharmacy} orders={pharmOrders} />
      ))}
    </div>
  );
}

function PharmacyOrderGroup({
  pharmacy,
  orders,
}: {
  pharmacy: { id: string; name: string; city: string };
  orders: OrderWithPharmacy[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  const draftCount = orders.filter((o) => o.status === "draft").length;
  const activeCount = orders.filter((o) => o.status === "submitted" || o.status === "confirmed").length;

  return (
    <section>
      {/* Pharmacy header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-gray-400" />
          <Link
            href={`/pharmacies/${pharmacy.id}?tab=orders`}
            className="text-sm font-semibold text-gray-800 hover:text-brand-600"
          >
            {pharmacy.name}
          </Link>
          <span className="text-xs text-gray-400">{pharmacy.city}</span>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {draftCount} draft
            </span>
          )}
          {activeCount > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
          <button onClick={() => setCollapsed((v) => !v)}>
            {collapsed
              ? <ChevronDown size={14} className="text-gray-400" />
              : <ChevronUp size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({ order }: { order: OrderWithPharmacy }) {
  const [open, setOpen] = useState(false);

  const isActive = order.status === "submitted" || order.status === "confirmed";
  const isDraft = order.status === "draft";
  const isDelivered = order.status === "delivered";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0", STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600")}>
          {order.status}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium" suppressHydrationWarning>
              {format(new Date(order.createdAt), "d MMM yyyy")}
            </span>
            {order.sourceType && (
              <span className="text-xs text-gray-400 capitalize">{order.sourceType.replace(/_/g, " ")}</span>
            )}
            <span className="text-xs text-gray-400">{order.lines.length} item{order.lines.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="mt-0.5">
            {isDelivered && order.deliveredAt ? (
              <p className="text-xs text-success-600 flex items-center gap-1">
                <Truck size={10} /> Delivered {format(new Date(order.deliveredAt), "d MMM yyyy")}
              </p>
            ) : isActive && order.submittedAt ? (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Truck size={10} /> Est. delivery {promisedDeliveryDate(order.submittedAt)}
              </p>
            ) : isDraft ? (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Package size={10} /> If submitted today: est. {promisedDeliveryDate(new Date())}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {order.totalAmount && (
            <span className="text-sm font-semibold text-gray-800">
              €{parseFloat(order.totalAmount).toFixed(2)}
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          {order.lines.length === 0 ? (
            <p className="text-xs text-gray-400">No items</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-1.5">Product</th>
                  <th className="text-right font-medium pb-1.5 w-10">Qty</th>
                  <th className="text-right font-medium pb-1.5 w-20">Unit</th>
                  <th className="text-right font-medium pb-1.5 w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 pr-2">
                      <p className="text-gray-800 font-medium leading-tight">{line.product.name}</p>
                      <p className="text-gray-400 mt-0.5">{line.product.sku}</p>
                    </td>
                    <td className="text-right text-gray-700 py-1.5">{line.quantity}</td>
                    <td className="text-right text-gray-600 py-1.5">
                      {line.unitPrice ? `€${parseFloat(line.unitPrice).toFixed(2)}` : "—"}
                    </td>
                    <td className="text-right text-gray-800 font-medium py-1.5">
                      {line.lineTotal ? `€${parseFloat(line.lineTotal).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {order.totalAmount && (
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-2 text-gray-500 font-medium">Total</td>
                    <td className="pt-2 text-right text-gray-900 font-semibold">
                      €{parseFloat(order.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  );
}
