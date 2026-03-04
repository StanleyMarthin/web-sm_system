"use client";

// ============================================================
// TopBar — Stanley Marthin luxury dark header
// ============================================================

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { Bell } from "lucide-react";

/** Map pathname to a human-readable page title */
function getPageTitle(pathname: string): string {
  const segments: Record<string, string> = {
    "/dashboard": "Overview",
    "/dashboard/monitoring": "Monitoring",
    "/dashboard/planning": "Planning",
    "/dashboard/work-orders": "Work Order",
    "/dashboard/tasks": "Tugas Hari Ini",
    "/dashboard/qc": "Quality Check",
    "/dashboard/kpi": "KPI",
    "/dashboard/unit-progress": "Unit Progress",
  };
  return segments[pathname] ?? "Dashboard";
}

export function TopBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const pageTitle = getPageTitle(pathname);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="h-14 px-4 flex items-center gap-3">
        {/* Page title */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm text-white/90 font-medium tracking-wide">{pageTitle}</h1>
          <span className="w-px h-3 bg-white/10" />
          <span className="text-[11px] text-white/30 tracking-wide">{today}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button className="relative h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05] transition-colors">
            <Bell className="w-4 h-4 text-white/30" />
          </button>
          {user && (
            <span className="inline-flex text-[10px] text-amber-500/60 tracking-[0.12em] uppercase px-2 py-1 rounded-md bg-amber-500/[0.06] border border-amber-500/10">
              {user.role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
