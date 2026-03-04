"use client";

// ============================================================
// KPI Page Client — SM luxury dark vibe
// ============================================================

import { memo } from "react";
import { KPI_SUMMARY, MECHANIC_KPIS } from "@/lib/dummy-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, CheckCircle, Clock, RotateCcw } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";

const GaugeCard = memo(function GaugeCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <DarkCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-2xl font-bold text-amber-500" style={SERIF_STYLE}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-[11px] text-white/35 tracking-wider uppercase">{label}</p>
    </DarkCard>
  );
});

export function KpiPageClient() {
  const kpi = KPI_SUMMARY;
  const mechanics = MECHANIC_KPIS;

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-xl font-light text-white/90 tracking-wide"
          style={SERIF_STYLE}
        >
          KPI Dashboard
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {kpi.division} · Februari 2026
        </p>
      </div>

      {/* Summary Cards */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          Ringkasan
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { value: kpi.totalJobs, label: "Total Jobs" },
            { value: kpi.completedJobs, label: "Completed", accent: true },
            { value: `${kpi.standardHours}h`, label: "Std Hours" },
            { value: `${kpi.actualHours}h`, label: "Actual Hours" },
          ].map((item) => (
            <DarkCard
              key={item.label}
              className="p-4 text-center"
            >
              <p
                className={`text-2xl font-bold ${
                  "accent" in item && item.accent ? "text-emerald-400" : "text-white/90"
                }`}
                style={SERIF_STYLE}
              >
                {item.value}
              </p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
            </DarkCard>
          ))}
        </div>
      </div>

      {/* Gauge Cards */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          Performance
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GaugeCard label="Efficiency" value={kpi.efficiency} icon={TrendingUp} />
          <GaugeCard label="QC Pass Rate" value={kpi.qcPassRate} icon={CheckCircle} />
          <GaugeCard label="On-Time Rate" value={kpi.onTimeRate} icon={Clock} />
        </div>
      </div>

      {/* Rework count */}
      <DarkCard className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
          <RotateCcw className="w-4 h-4" />
        </div>
        <div>
          <p className="text-lg font-bold text-white/90" style={SERIF_STYLE}>
            {kpi.reworkCount}
          </p>
          <p className="text-[11px] text-white/35 tracking-wider uppercase">Rework Count</p>
        </div>
      </DarkCard>

      {/* Per-Mechanic Table */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          KPI Per Mechanic
        </p>
        <DarkCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-white/35 text-[11px] tracking-wider uppercase">Nama</TableHead>
                <TableHead className="text-right text-white/35 text-[11px] tracking-wider uppercase">Jobs</TableHead>
                <TableHead className="text-right text-white/35 text-[11px] tracking-wider uppercase">Std (h)</TableHead>
                <TableHead className="text-right text-white/35 text-[11px] tracking-wider uppercase">Actual (h)</TableHead>
                <TableHead className="text-right text-white/35 text-[11px] tracking-wider uppercase">Efficiency</TableHead>
                <TableHead className="text-right text-white/35 text-[11px] tracking-wider uppercase">QC Pass</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mechanics.map((m) => (
                <TableRow key={m.employeeId} className="border-white/[0.04] hover:bg-white/[0.03]">
                  <TableCell className="font-medium text-sm text-white/70">{m.fullName}</TableCell>
                  <TableCell className="text-right text-white/50">{m.jobsCompleted}</TableCell>
                  <TableCell className="text-right text-white/50">{m.standardHours}</TableCell>
                  <TableCell className="text-right text-white/50">{m.actualHours}</TableCell>
                  <TableCell className="text-right text-amber-500/70">{m.efficiency}%</TableCell>
                  <TableCell className="text-right text-amber-500/70">{m.qcPassRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DarkCard>
      </div>
    </div>
  );
}
