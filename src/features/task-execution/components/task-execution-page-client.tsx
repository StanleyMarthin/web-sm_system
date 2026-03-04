"use client";

// ============================================================
// Task Execution Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import useSWR from "swr";
import { TASKS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Loader2, Play } from "lucide-react";
import type { Task } from "@/types";
import { SERIF_STYLE } from "@/lib/constants";

async function getTodayTasks(): Promise<Task[]> {
  await new Promise((r) => setTimeout(r, 300));
  return TASKS;
}

function taskStatusBadge(task: Task) {
  if (task.status === "DONE")
    return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Selesai</Badge>;
  if (task.isPanelLocked && task.startedAt)
    return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Dikerjakan</Badge>;
  if (task.isPanelLocked)
    return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Panel Terkunci</Badge>;
  return <Badge className="bg-white/[0.06] text-white/50 border-0 text-[10px]">Siap</Badge>;
}

const COLUMNS: DataTableColumn<Task>[] = [
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
    key: "status", label: "Status", sortable: true,
    sortValue: (r) => r.status,
    render: (r) => taskStatusBadge(r),
  },
  {
    key: "target", label: "Target (h)", align: "right", sortable: true,
    sortValue: (r) => r.dailyTargetHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.dailyTargetHours}</span>,
  },
  {
    key: "actual", label: "Actual / Total", align: "right", sortable: true,
    sortValue: (r) => r.totalActualHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalActualHours}h / {r.targetHoursRevised}h</span>,
  },
  {
    key: "sisa", label: "Sisa (h)", align: "right", sortable: true,
    sortValue: (r) => r.remainingHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.remainingHours}</span>,
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
    key: "locked", label: "Locked By",
    render: (r) => <span className="text-white/40 text-sm">{r.lockedByName ?? "—"}</span>,
  },
  {
    key: "aksi", label: "Aksi",
    render: (r) => {
      const canStart = r.status === "PROSES" && !r.isPanelLocked && !r.startedAt;
      return canStart ? (
        <button className="px-2 py-1 rounded text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center gap-1">
          <Play className="w-3 h-3" /> Mulai
        </button>
      ) : null;
    },
  },
];

export function TaskExecutionPageClient() {
  const { data: tasks, isLoading, error } = useSWR(
    "mechanic-tasks-today",
    getTodayTasks,
    { revalidateOnFocus: false }
  );

  const completed = useMemo(() => tasks?.filter((t) => t.status === "DONE") ?? [], [tasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500/40" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400/70 py-20">Gagal memuat tugas.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Tugas Hari Ini
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {tasks?.length ?? 0} tugas · {completed.length} selesai
        </p>
      </div>

      <DataTable
        data={tasks ?? []}
        columns={COLUMNS}
        rowKey={(r) => r.plandailyId}
        selectable
        searchable
        searchPlaceholder="Cari unit, panel, job..."
        searchFn={(r, q) =>
          r.unitName.toLowerCase().includes(q) ||
          r.panelName.toLowerCase().includes(q) ||
          r.jobName.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada tugas hari ini."
      />
    </div>
  );
}
