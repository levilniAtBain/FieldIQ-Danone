"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  BarChart2,
  Users,
  LogOut,
  Package,
  CalendarRange,
  Star,
  GaugeCircle,
  BookOpen,
  BrainCircuit,
  LayoutTemplate,
} from "lucide-react";

const repNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/pharmacies", label: "Pharmacies", icon: Building2 },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/master-plan", label: "Plan", icon: CalendarRange },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

const managerNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/team", label: "My Team", icon: Users },
  { href: "/pharmacies", label: "Pharmacies", icon: Building2 },
  { href: "/master-plan", label: "Plan", icon: CalendarRange },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

const perfectStoreNav = [
  { href: "/perfect-store/kpis", label: "KPIs", icon: GaugeCircle },
  { href: "/perfect-store/planogram", label: "Planogram", icon: LayoutTemplate },
  { href: "/perfect-store/execution-guide", label: "Execution Guide", icon: BookOpen },
  { href: "/perfect-store/recommendation-model", label: "Reco Model", icon: BrainCircuit },
];

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = session.role === "manager" ? managerNav : repNav;


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src="/field_iq_logo_danone.svg" className="h-8 w-auto rounded" alt="FieldIQ" />
          <span className="font-semibold text-gray-900 text-sm hidden sm:block">
            FieldIQ
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">
              {session.name}
            </p>
            <p className="text-xs text-gray-400 capitalize">{session.role}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <Link
            href="/login"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center"
            title="Sign out"
          >
            <LogOut size={16} />
          </Link>
        </div>
      </header>

      {/* Main content — body scrolls, no overflow-auto here (breaks iOS touch events) */}
      <main className="pt-0 pb-20 md:pb-8 md:pl-56">
        <div className="max-w-6xl mx-auto p-4 md:p-6">{children}</div>
        {/* Logo footer — visible on mobile only (desktop has it in the side nav) */}
        <div className="flex justify-center pb-4 md:hidden px-8">
          <img src="/field_iq_logo_danone.svg" className="w-full max-w-xs h-auto rounded-xl" alt="FieldIQ" />
        </div>
      </main>

      {/* Bottom tab bar (mobile/tablet) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex md:hidden z-40">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors",
                active
                  ? "text-brand-600"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Side nav (desktop) */}
      <nav className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 bg-white border-r border-gray-100 flex-col p-3 gap-1 z-30 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        {/* Perfect Store section */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-3 pb-1.5">
            <Star size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Perfect Store</span>
          </div>
          {perfectStoreNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-amber-50 text-amber-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Logo at bottom of side nav */}
        <div className="mt-auto pt-4 pb-2">
          <img src="/field_iq_logo_danone.svg" className="w-full h-auto" alt="FieldIQ" />
        </div>
      </nav>
    </div>
  );
}
