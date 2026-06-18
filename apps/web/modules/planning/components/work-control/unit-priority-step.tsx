"use client";

/**
 * Step 1 — Pilih Unit Prioritas
 * User memilih satu atau beberapa unit yang mau dikejar minggu ini.
 */

import { Search, AlertTriangle, CheckSquare, Square } from "lucide-react";
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
  remainingHours: number;
  targetDeliveryDate: string | null;
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
      return "border-success/30 text-success";
    case "MEDIUM":
      return "border-primary/30 text-app-accent-ink";
    case "HIGH":
      return "border-destructive/30 text-destructive";
    case "CRITICAL":
      return "border-destructive/50 bg-destructive/10 text-destructive";
  }
}

function progressBarColor(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-primary";
  return "bg-destructive";
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
      <div className="border border-border bg-card px-4 py-4">
        <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
          Langkah 1
        </p>
        <h2 className="mt-1 text-[15px] font-mono text-foreground">
          Pilih Unit yang Mau Dikejar
        </h2>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari unit atau customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full border border-border bg-background pl-8 pr-3 font-mono text-[15px] text-foreground outline-none focus:border-primary/40 placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex h-8 items-center gap-1.5 border border-border px-3 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
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
        <div className="border border-border bg-card px-4 py-10 text-center text-[14px] text-muted-foreground">
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
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Unit</th>
                <th className="px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Progress</th>
                <th className="px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Risiko</th>
                <th className="px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Target</th>
                <th className="px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground text-right">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => {
                const selected = selectedIds.includes(unit.carId);
                return (
                  <tr
                    key={unit.carId}
                    onClick={() => toggleUnit(unit.carId)}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      selected ? "bg-primary/[0.08]" : "hover:bg-muted"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className={`flex h-4 w-4 items-center justify-center border ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}>
                        {selected && (
                          <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-[15px] font-mono text-foreground">{unit.unitName}</p>
                      <p className="mt-0.5 text-[14px] font-mono text-muted-foreground">{unit.customerName ?? "-"}</p>
                    </td>
                    <td className="px-3 py-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-muted">
                          <div
                            className={`h-full transition-all ${progressBarColor(unit.progressPercent)}`}
                            style={{ width: `${unit.progressPercent}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[14px] text-muted-foreground">{unit.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`border px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.1em] ${riskBadgeStyle(unit.riskLevel)}`}>
                        {formatRiskLabel(unit.riskLevel)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[14px] text-muted-foreground">
                      {unit.targetDeliveryDate ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[15px] text-foreground">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-app-accent-ink" />
            <span>
              <span className="font-semibold text-foreground">
                {selectedIds.length} unit
              </span>{" "}
              dipilih
            </span>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-8 items-center gap-2 border border-primary/40 bg-primary/[0.04] px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
          >
            Lanjut ke Progress →
          </button>
        </div>
      )}
    </div>
  );
}
