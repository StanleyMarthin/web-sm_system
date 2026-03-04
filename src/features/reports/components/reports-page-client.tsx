"use client";

// ============================================================
// Reports Page Client — DataTable view (API #13)
// ============================================================

import { useMemo } from "react";
import { EFFICIENCY_REPORTS } from "@/lib/dummy-data";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { EfficiencyReport } from "@/types";

const COLUMNS: DataTableColumn<EfficiencyReport>[] = [
  { key: "unit", label: "Unit", sortable: true, sortValue: (r) => r.unitName, render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span> },
  { key: "target", label: "Total Target (h)", align: "right" as const, sortable: true, sortValue: (r) => r.totalTarget, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalTarget}</span> },
  { key: "actual", label: "Total Actual (h)", align: "right" as const, sortable: true, sortValue: (r) => r.totalActual, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.totalActual}</span> },
  {
    key: "efficiency", label: "Efficiency Rate", align: "right" as const, sortable: true,
    sortValue: (r) => r.efficiencyRate,
    render: (r) => <span className={`text-sm tabular-nums ${r.efficiencyRate >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{r.efficiencyRate.toFixed(1)}%</span>,
  },
  {
    key: "status", label: "Status", sortable: true,
    sortValue: (r) => r.efficiencyRate,
    render: (r) => <span className={`text-xs ${r.efficiencyRate >= 100 ? "text-emerald-400/60" : "text-amber-400/60"}`}>{r.efficiencyRate >= 100 ? "Efficient" : "Over Budget"}</span>,
  },
];

export function ReportsPageClient() {
  const reports = EFFICIENCY_REPORTS;

  const totals = useMemo(() => {
    const totalTarget = reports.reduce((s, r) => s + r.totalTarget, 0);
    const totalActual = reports.reduce((s, r) => s + r.totalActual, 0);
    const avgEfficiency = totalTarget > 0 ? (totalTarget / totalActual) * 100 : 0;
    return { totalTarget, totalActual, avgEfficiency };
  }, [reports]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Efficiency Reports
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {reports.length} unit · GET /api/v1/web/reports/efficiency
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: `${totals.totalTarget}h`, label: "Total Target" },
          { value: `${totals.totalActual}h`, label: "Total Actual" },
          { value: `${totals.avgEfficiency.toFixed(1)}%`, label: "Avg Efficiency" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90 tabular-nums" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={reports}
        columns={COLUMNS}
        rowKey={(r) => r.carId}
        selectable
        searchable
        searchPlaceholder="Cari unit..."
        searchFn={(r, q) => r.unitName.toLowerCase().includes(q)}
        emptyMessage="Tidak ada data laporan."
      />
    </div>
  );
}
