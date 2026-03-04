"use client";

// ============================================================
// Monitoring Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  useMonitoringStore,
  selectSummary,
} from "@/features/monitoring/stores/monitoring-store";
import { useMonitoringData } from "@/features/monitoring/hooks/use-monitoring-data";
import { MonitoringSummary } from "./monitoring-summary";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERIF_STYLE } from "@/lib/constants";
import type { MonitoringJob } from "@/types";

function statusBadge(status: MonitoringJob["status"]) {
  switch (status) {
    case "TO_DO":
      return <Badge className="bg-white/[0.06] text-white/40 border-0 text-[10px]">Belum Mulai</Badge>;
    case "IN_PROGRESS":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Dikerjakan</Badge>;
    case "DONE":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Selesai</Badge>;
  }
}

const COLUMNS: DataTableColumn<MonitoringJob>[] = [
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
    render: (r) => <span className="text-white/50 text-sm max-w-[200px] truncate block">{r.jobName}</span>,
  },
  {
    key: "mechanic", label: "Mechanic", sortable: true,
    sortValue: (r) => r.mechanicName,
    render: (r) => <span className="text-white/50 text-sm">{r.mechanicName}</span>,
  },
  {
    key: "status", label: "Status", sortable: true,
    sortValue: (r) => r.status,
    render: (r) => statusBadge(r.status),
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
    key: "actual", label: "Actual / Target", align: "right", sortable: true,
    sortValue: (r) => r.totalActualHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalActualHours}h / {r.targetHoursRevised}h</span>,
  },
  {
    key: "progress", label: "Progress", align: "right", sortable: true,
    sortValue: (r) => r.targetHoursRevised > 0 ? (r.totalActualHours / r.targetHoursRevised) * 100 : 0,
    render: (r) => {
      const pct = r.targetHoursRevised > 0 ? Math.min(100, Math.round((r.totalActualHours / r.targetHoursRevised) * 100)) : 0;
      return <span className="text-amber-500/70 text-sm tabular-nums" style={SERIF_STYLE}>{pct}%</span>;
    },
  },
  {
    key: "urgent", label: "Urgent", align: "center", sortable: true,
    sortValue: (r) => r.isUrgent ? 1 : 0,
    render: (r) => r.isUrgent ? <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" /> : null,
  },
];

export function MonitoringPageClient() {
  const user = useAuthStore((s) => s.user);

  const jobsMap = useMonitoringStore((s) => s.jobsMap);
  const shiftFilter = useMonitoringStore((s) => s.shiftFilter);
  const setFilter = useMonitoringStore((s) => s.setFilter);
  const isLoading = useMonitoringStore((s) => s.isLoading);
  const error = useMonitoringStore((s) => s.error);

  const division = user?.divisionName ?? "Mechanic";
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  useMonitoringData({ division, date: today });

  const jobs = useMemo(() => {
    const all = Object.values(jobsMap);
    if (shiftFilter === "ALL") return all;
    return all.filter((j) => j.shiftType === shiftFilter);
  }, [jobsMap, shiftFilter]);

  const summary = useMemo(() => selectSummary(jobs), [jobs]);

  if (isLoading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500/40" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-red-400/70"><p>{error}</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
            Monitoring
          </h2>
          <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
            {division} · {today}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["ALL", "NORMAL", "LEMBUR"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-all",
                shiftFilter === f
                  ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
                  : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
              )}
            >
              {f === "ALL" ? "Semua" : f}
            </button>
          ))}
        </div>
      </div>

      <MonitoringSummary {...summary} />

      <DataTable
        data={jobs}
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
        emptyMessage="Tidak ada job monitoring."
      />
    </div>
  );
}
