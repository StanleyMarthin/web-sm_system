"use client";

// ============================================================
// Unit Progress Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import { CARS, MONITORING_JOBS } from "@/lib/dummy-data";
import { Car, CheckCircle, Clock, Play } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";

interface CarProgress {
  id: string;
  unitName: string;
  customerName: string;
  restorationType: string;
  totalJobs: number;
  completed: number;
  inProgress: number;
  toDo: number;
  totalStdHours: number;
  totalActualHours: number;
  progressPct: number;
}

const COLUMNS: DataTableColumn<CarProgress>[] = [
  {
    key: "unit", label: "Unit", sortable: true,
    sortValue: (r) => r.unitName,
    render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span>,
  },
  {
    key: "customer", label: "Customer", sortable: true,
    sortValue: (r) => r.customerName,
    render: (r) => <span className="text-white/50 text-sm">{r.customerName}</span>,
  },
  {
    key: "type", label: "Type", sortable: true,
    sortValue: (r) => r.restorationType,
    render: (r) => <span className="text-white/50 text-sm">{r.restorationType}</span>,
  },
  {
    key: "total", label: "Total Jobs", align: "right", sortable: true,
    sortValue: (r) => r.totalJobs,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalJobs}</span>,
  },
  {
    key: "done", label: "Done", align: "right", sortable: true,
    sortValue: (r) => r.completed,
    render: (r) => <span className="text-emerald-400/70 text-sm tabular-nums">{r.completed}</span>,
  },
  {
    key: "inProg", label: "In Progress", align: "right", sortable: true,
    sortValue: (r) => r.inProgress,
    render: (r) => <span className="text-amber-400/70 text-sm tabular-nums">{r.inProgress}</span>,
  },
  {
    key: "toDo", label: "To Do", align: "right", sortable: true,
    sortValue: (r) => r.toDo,
    render: (r) => <span className="text-white/40 text-sm tabular-nums">{r.toDo}</span>,
  },
  {
    key: "hours", label: "Actual / Std (h)", align: "right", sortable: true,
    sortValue: (r) => r.totalActualHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalActualHours}h / {r.totalStdHours}h</span>,
  },
  {
    key: "progress", label: "Progress", align: "right", sortable: true,
    sortValue: (r) => r.progressPct,
    render: (r) => <span className="text-amber-500/70 text-sm tabular-nums" style={SERIF_STYLE}>{r.progressPct}%</span>,
  },
];

export function UnitProgressPageClient() {
  const carProgress = useMemo<CarProgress[]>(() => CARS.map((car) => {
    const jobs = MONITORING_JOBS.filter((j) => j.carId === car.id);
    const totalJobs = jobs.length;
    const completed = jobs.filter((j) => j.status === "DONE").length;
    const inProgress = jobs.filter((j) => j.status === "IN_PROGRESS").length;
    const totalStdHours = jobs.reduce((s, j) => s + j.targetHoursRevised, 0);
    const totalActualHours = jobs.reduce((s, j) => s + j.totalActualHours, 0);
    const pct = totalStdHours > 0 ? Math.round((totalActualHours / totalStdHours) * 100) : 0;

    return {
      id: car.id,
      unitName: car.unitName,
      customerName: car.customerName,
      restorationType: car.restorationType,
      totalJobs,
      completed,
      inProgress,
      toDo: totalJobs - completed - inProgress,
      totalStdHours,
      totalActualHours,
      progressPct: Math.min(100, pct),
    };
  }).filter((c) => c.totalJobs > 0), []);

  const totals = useMemo(() => ({
    units: carProgress.length,
    done: carProgress.reduce((s, c) => s + c.completed, 0),
    inProg: carProgress.reduce((s, c) => s + c.inProgress, 0),
    hours: carProgress.reduce((s, c) => s + c.totalActualHours, 0),
  }), [carProgress]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Unit Progress
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {carProgress.length} unit aktif
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Car, value: totals.units, label: "Total Unit", accent: true },
          { icon: CheckCircle, value: totals.done, label: "Jobs Selesai" },
          { icon: Play, value: totals.inProg, label: "In Progress" },
          { icon: Clock, value: `${totals.hours}h`, label: "Actual Hours" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${item.accent ? "bg-amber-500/10 text-amber-500" : "bg-white/[0.04] text-white/30"}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
            </div>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={carProgress}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        selectable
        searchable
        searchPlaceholder="Cari unit, customer..."
        searchFn={(r, q) =>
          r.unitName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada unit aktif."
      />
    </div>
  );
}
