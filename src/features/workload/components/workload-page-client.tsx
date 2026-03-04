"use client";

// ============================================================
// Workload Page Client — DataTable view (API #4)
// ============================================================

import { useMemo } from "react";
import { WORKLOAD_ENTRIES } from "@/lib/dummy-data";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { WorkloadEntry } from "@/types";

interface WorkloadRow extends WorkloadEntry {
  _idx: number;
  utilization: number;
}

const COLUMNS: DataTableColumn<WorkloadRow>[] = [
  { key: "division", label: "Division", sortable: true, sortValue: (r) => r.divisionName, render: (r) => <span className="font-medium text-sm text-white/70">{r.divisionName}</span> },
  { key: "date", label: "Date", sortable: true, sortValue: (r) => r.date, render: (r) => <span className="text-white/50 text-sm">{r.date}</span> },
  { key: "booked", label: "Booked (h)", align: "right" as const, sortable: true, sortValue: (r) => r.bookedHours, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.bookedHours}</span> },
  { key: "capacity", label: "Capacity (h)", align: "right" as const, sortable: true, sortValue: (r) => r.capacityHours, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.capacityHours}</span> },
  {
    key: "utilization", label: "Utilization", align: "right" as const, sortable: true,
    sortValue: (r) => r.utilization,
    render: (r) => <span className={`text-sm tabular-nums ${r.utilization >= 90 ? "text-red-400" : r.utilization >= 70 ? "text-amber-400" : "text-emerald-400"}`}>{r.utilization.toFixed(0)}%</span>,
  },
  {
    key: "load", label: "Load", sortable: true,
    sortValue: (r) => r.utilization,
    render: (r) => <span className={`text-xs ${r.utilization >= 90 ? "text-red-400/60" : r.utilization >= 70 ? "text-amber-400/60" : "text-emerald-400/60"}`}>{r.utilization >= 90 ? "High" : r.utilization >= 70 ? "Medium" : "Low"}</span>,
  },
];

export function WorkloadPageClient() {
  const rows = useMemo<WorkloadRow[]>(() =>
    WORKLOAD_ENTRIES.map((e, i) => ({
      ...e,
      _idx: i,
      utilization: e.capacityHours > 0 ? (e.bookedHours / e.capacityHours) * 100 : 0,
    })),
  []);

  const summary = useMemo(() => {
    const totalBooked = rows.reduce((s, e) => s + e.bookedHours, 0);
    const totalCap = rows.reduce((s, e) => s + e.capacityHours, 0);
    const utilization = totalCap > 0 ? (totalBooked / totalCap) * 100 : 0;
    return { totalBooked, totalCap, utilization };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Workload Calendar
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {rows.length} entries · GET /api/v1/web/calendar/workload
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: `${summary.totalBooked}h`, label: "Booked" },
          { value: `${summary.totalCap}h`, label: "Capacity" },
          { value: `${summary.utilization.toFixed(1)}%`, label: "Utilization" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90 tabular-nums" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={rows}
        columns={COLUMNS}
        rowKey={(r) => `${r.divisionName}-${r.date}-${r._idx}`}
        selectable
        searchable
        searchPlaceholder="Cari divisi, tanggal..."
        searchFn={(r, q) =>
          r.divisionName.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada data workload."
      />
    </div>
  );
}
