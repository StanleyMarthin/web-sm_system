"use client";

// ============================================================
// Planning Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getPlanJobs } from "@/features/planning/services/planning-service";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Loader2, Calendar } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { PlanJob } from "@/types";

const COLUMNS: DataTableColumn<PlanJob>[] = [
  {
    key: "unit", label: "Unit", sortable: true,
    sortValue: (r) => r.unitName,
    render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span>,
  },
  {
    key: "panel", label: "Panel", sortable: true,
    sortValue: (r) => r.panelName,
    render: (r) => <span className="text-white/50 text-sm">{r.panelName}</span>,
  },
  {
    key: "job", label: "Job",
    render: (r) => <span className="text-white/50 text-sm max-w-[180px] truncate block">{r.jobName}</span>,
  },
  {
    key: "mechanic", label: "Mechanic", sortable: true,
    sortValue: (r) => r.mechanicName,
    render: (r) => <span className="text-white/50 text-sm">{r.mechanicName}</span>,
  },
  {
    key: "shift", label: "Shift", sortable: true,
    sortValue: (r) => r.shiftType,
    render: (r) => (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40">
        {r.shiftType}
      </span>
    ),
  },
  {
    key: "target", label: "Target (h)", align: "right", sortable: true,
    sortValue: (r) => r.dailyTargetHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.dailyTargetHours}</span>,
  },
  {
    key: "sisa", label: "Sisa (h)", align: "right", sortable: true,
    sortValue: (r) => r.remainingHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.remainingHours}</span>,
  },
  {
    key: "priority", label: "Priority", sortable: true,
    sortValue: (r) => r.priority,
    render: (r) => (
      <Badge className={`text-[10px] px-1.5 py-0 border-0 ${r.priority === "HIGH" ? "bg-red-500/10 text-red-400" : "bg-white/[0.06] text-white/40"}`}>
        {r.priority}
      </Badge>
    ),
  },
  {
    key: "panelStatus", label: "Panel", sortable: true,
    sortValue: (r) => r.isPanelFree ? 0 : 1,
    render: (r) => !r.isPanelFree
      ? <Badge className="text-[10px] bg-red-500/10 text-red-400 border-0">Terkunci</Badge>
      : <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-0">Bebas</Badge>,
  },
  {
    key: "ket", label: "Keterangan",
    render: (r) => <span className="text-white/40 text-xs">{r.fromCountdown ? "Lanjutan" : ""}</span>,
  },
];

export function PlanningPageClient() {
  const user = useAuthStore((s) => s.user);
  const division = user?.divisionName ?? "Mechanic";
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: jobs, isLoading, error } = useSWR(
    ["plan-jobs", division, today],
    () => getPlanJobs(division, today),
    { revalidateOnFocus: false }
  );

  const summary = useMemo(() => ({
    total: jobs?.length ?? 0,
    normal: jobs?.filter((j) => j.shiftType === "NORMAL").length ?? 0,
    lembur: jobs?.filter((j) => j.shiftType === "LEMBUR").length ?? 0,
  }), [jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500/40" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400/70 py-20">Gagal memuat data planning.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
            Planning
          </h2>
          <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {division} · {today}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: summary.total, label: "Total Jobs" },
          { value: summary.normal, label: "Normal" },
          { value: summary.lembur, label: "Lembur" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={jobs ?? []}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        selectable
        searchable
        searchPlaceholder="Cari unit, panel, mechanic..."
        searchFn={(r, q) =>
          r.unitName.toLowerCase().includes(q) ||
          r.panelName.toLowerCase().includes(q) ||
          r.mechanicName.toLowerCase().includes(q) ||
          r.jobName.toLowerCase().includes(q)
        }
        emptyMessage="Belum ada planning untuk hari ini."
      />
    </div>
  );
}
