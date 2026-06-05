"use client";

/**
 * Step 1 — Pilih Unit Prioritas
 * User memilih satu atau beberapa unit yang mau dikejar minggu ini.
 */

import { Search, AlertTriangle, Clock, CheckSquare, Square } from "lucide-react";
import { useState } from "react";
import { EmptyRow } from "@/shared/ui/compact";
import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";
import { formatRiskLabel } from "@/modules/planning/helpers/planning-calculations";

export interface UnitPriorityItem {
  carId: string;
  unitName: string;
  customerName: string | null;
  progressPercent: number;
  riskLevel: RiskLevel;
  remainingJobCount: number;
  remainingHours: number;
  targetDeliveryDate: string | null;
  status: string;
}

interface UnitPriorityStepProps {
  units: UnitPriorityItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onNext: () => void;
  isLoading?: boolean;
}

function riskBadgeStyle(risk: RiskLevel): string {
  switch (risk) {
    case "LOW":
      return "border-emerald-500/30 text-emerald-600 dark:text-emerald-300";
    case "MEDIUM":
      return "border-amber-500/30 text-amber-600 dark:text-amber-300";
    case "HIGH":
      return "border-red-500/30 text-red-600 dark:text-red-300";
    case "CRITICAL":
      return "border-red-700/50 bg-red-500/10 text-red-700 dark:text-red-200";
  }
}

function progressBarColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-red-400";
}

export function UnitPriorityStep({
  units,
  selectedIds,
  onSelectionChange,
  onNext,
  isLoading,
}: UnitPriorityStepProps) {
  const [search, setSearch] = useState("");

  const filtered = units.filter(
    (u) =>
      u.unitName.toLowerCase().includes(search.toLowerCase()) ||
      (u.customerName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function toggleUnit(carId: string) {
    if (selectedIds.includes(carId)) {
      onSelectionChange(selectedIds.filter((id) => id !== carId));
    } else {
      onSelectionChange([...selectedIds, carId]);
    }
  }

  function toggleAll() {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filtered.map((u) => u.carId));
    }
  }

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
          Langkah 1
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-gray-950 dark:text-white">
          Pilih Unit yang Mau Dikejar
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-white/40">
          Mulai dari unit yang memang perlu dorongan minggu ini. Tidak harus banyak, yang penting
          arah kerjanya jelas dan realistis untuk diturunkan jadi target.
        </p>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-white/25" />
          <input
            type="text"
            placeholder="Cari unit atau customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full border border-gray-200 bg-white pl-8 pr-3 font-mono text-[11px] text-gray-900 outline-none focus:border-amber-500/40 placeholder:text-gray-400 dark:border-white/[0.08] dark:bg-[#0a0a0c] dark:text-white/70 dark:placeholder:text-white/20"
          />
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex h-10 items-center gap-1.5 border border-gray-200 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Pilih Semua
        </button>
      </div>

      {/* Unit cards / Table */}
      {isLoading ? (
        <div className="border border-gray-200 bg-white px-4 py-10 text-center text-[12px] text-gray-400 dark:border-white/[0.06] dark:bg-[#111114] dark:text-white/25">
          Memuat data unit...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyRow
          message={
            units.length === 0
              ? "Belum ada unit aktif yang bisa dipilih. Pastikan data unit sudah diisi."
              : "Tidak ada unit yang sesuai pencarian."
          }
        />
      ) : (
        <div className="overflow-x-auto border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#111114]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.06] dark:bg-[#0a0a0c]">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">Unit</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">Progress</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">Risiko</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">Target</th>
                <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/25 text-right">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => {
                const selected = selectedIds.includes(unit.carId);
                return (
                  <tr
                    key={unit.carId}
                    onClick={() => toggleUnit(unit.carId)}
                    className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                      selected ? "bg-amber-500/[0.08]" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className={`flex h-4 w-4 items-center justify-center border ${
                        selected ? "border-amber-500 bg-amber-500" : "border-white/20"
                      }`}>
                        {selected && (
                          <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-[11px] font-mono text-gray-900 dark:text-white/80">{unit.unitName}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-gray-400 dark:text-white/30">{unit.customerName ?? "-"}</p>
                    </td>
                    <td className="px-3 py-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-gray-100 dark:bg-white/[0.06]">
                          <div
                            className={`h-full transition-all ${progressBarColor(unit.progressPercent)}`}
                            style={{ width: `${unit.progressPercent}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-gray-400 dark:text-white/40">{unit.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${riskBadgeStyle(unit.riskLevel)}`}>
                        {formatRiskLabel(unit.riskLevel)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-400 dark:text-white/40">
                      {unit.targetDeliveryDate ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-gray-700 dark:text-white/60">
                      {unit.remainingHours.toFixed(0)}j
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer action */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-[#111114]">
          <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-white/50">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>
              <span className="font-semibold text-gray-950 dark:text-white">
                {selectedIds.length} unit
              </span>{" "}
              dipilih
            </span>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-10 items-center gap-2 border border-amber-500/40 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.14] dark:text-amber-300"
          >
            Lanjut ke Progress →
          </button>
        </div>
      )}
    </div>
  );
}
