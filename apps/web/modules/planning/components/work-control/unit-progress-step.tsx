"use client";

/**
 * Step 2 — Lihat Progress & Sisa Kerja
 * Tampilkan ringkasan per unit yang dipilih.
 * Detail hanya muncul jika user klik "Lihat Detail".
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EmptyRow } from "@/shared/ui/compact";
import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";
import { formatRiskLabel } from "@/modules/planning/helpers/planning-calculations";

export interface UnitProgressDivision {
  divisionId: number;
  divisionName: string;
  remainingHours: number;
  targetHours?: number;
  actualHours?: number;
}

export interface UnitProgressJob {
  jobId: string;
  divisionId: string | null;
  divisionName: string | null;
  jobName: string;
  panel: string | null;
  status: string;
  estimatedHours: number;
  actualHours: number | null;
  remainingHours: number;
  dependsOn: string[];
  startDate: string | null;
  deadlineDate: string | null;
  qcLastStatus: string | null;
}

export interface UnitProgressData {
  carId: string;
  unitName: string;
  customerName: string | null;
  progressPercent: number;
  remainingHours: number;
  totalEstimatedHours: number;
  actualHours: number;
  riskLevel: RiskLevel;
  targetDeliveryDate: string | null;
  involvedDivisions: UnitProgressDivision[];
  mainConstraint: string | null;
  /** Estimasi kasar hari selesai berdasarkan sisa jam (sebelum kapasitas diisi) */
  roughEstimateDays: number | null;
  jobs: UnitProgressJob[];
}

interface UnitProgressStepProps {
  units: UnitProgressData[];
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "done" || s === "selesai") {
    return "border-emerald-500/30 text-emerald-300";
  }
  if (s === "in_progress" || s === "on_progress") {
    return "border-amber-500/30 text-amber-400";
  }
  return "border-white/10 text-white/40";
}

function UnitProgressCard({ unit }: { unit: UnitProgressData }) {
  const [showDetail, setShowDetail] = useState(false);

  const doneJobs = unit.jobs.filter(
    (j) => j.status.toLowerCase() === "done" || j.status.toLowerCase() === "selesai",
  ).length;

  return (
    <div className="border border-white/5 bg-[#111114]">
      {/* Card header */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-mono text-white/80">
              {unit.unitName}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-white/30">
              {unit.customerName ?? "Customer belum diisi"}
              {unit.targetDeliveryDate
                ? ` · Target: ${unit.targetDeliveryDate}`
                : ""}
            </p>
          </div>
          <span
            className={[
              "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
              unit.riskLevel === "LOW"
                ? "border-emerald-500/30 text-emerald-300"
                : unit.riskLevel === "MEDIUM"
                  ? "border-amber-500/30 text-amber-400"
                  : "border-red-500/30 text-red-300",
            ].join(" ")}
          >
            Risiko {formatRiskLabel(unit.riskLevel)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-white/40">Progress</span>
            <span className="font-mono font-medium text-white/70">
              {unit.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.06]">
            <div
              className={[
                "h-full transition-all",
                unit.progressPercent >= 80
                  ? "bg-emerald-500"
                  : unit.progressPercent >= 50
                    ? "bg-amber-500"
                    : "bg-red-400",
              ].join(" ")}
              style={{ width: `${unit.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            {
              label: "Sisa",
              value: `${unit.remainingHours.toFixed(0)} jam`,
            },
            {
              label: "Selesai",
              value: `${doneJobs} / ${unit.jobs.length}`,
            },
            {
              label: "ETA",
              value:
                unit.roughEstimateDays != null
                  ? `~${unit.roughEstimateDays}h kerja`
                  : "-",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="border border-white/5 bg-[#0a0a0c] px-3 py-2"
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                {m.label}
              </p>
              <p className="mt-0.5 font-mono text-[12px] text-white/70">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Divisi terlibat */}
        {unit.involvedDivisions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/25">
              Divisi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unit.involvedDivisions.map((d) => (
                <span
                  key={d.divisionId}
                  className="border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/40"
                >
                  {d.divisionName}
                  <span className="ml-1 font-mono text-white/25">
                    {d.remainingHours.toFixed(0)}j
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kendala */}
        {unit.mainConstraint && (
          <div className="mt-3 border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            {unit.mainConstraint}
          </div>
        )}
      </div>

      {/* Toggle detail */}
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex w-full items-center justify-between border-t border-white/5 px-4 py-2 font-mono text-[10px] text-white/30 transition-colors hover:bg-white/[0.02]"
      >
        <span>
          {showDetail ? "Sembunyikan detail" : `Lihat Detail (${unit.jobs.length} pekerjaan)`}
        </span>
        {showDetail ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Job detail list */}
      {showDetail && (
        <div className="border-t border-white/5">
          <div className="max-h-[280px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="sticky top-0 border-b border-white/5 bg-[#0a0a0c]">
                <tr className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                  <th className="px-4 py-2 text-left">Pekerjaan</th>
                  <th className="px-4 py-2 text-left">Panel</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Estimasi</th>
                  <th className="px-4 py-2 text-right">Aktual</th>
                </tr>
              </thead>
              <tbody>
                {unit.jobs.map((job) => (
                  <tr
                    key={job.jobId}
                    className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.015]"
                  >
                    <td className="px-4 py-1.5 text-white/60">
                      {job.jobName}
                    </td>
                    <td className="px-4 py-1.5 text-white/30">
                      {job.panel ?? "-"}
                    </td>
                    <td className="px-4 py-1.5">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${statusBadge(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-white/50">
                      {job.estimatedHours.toFixed(1)}j
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-white/50">
                      {job.actualHours === null ? "-" : `${job.actualHours.toFixed(1)}j`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function UnitProgressStep({
  units,
  onNext,
  onBack,
  isLoading,
}: UnitProgressStepProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-white/5 bg-[#111114] px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
          Langkah 2
        </p>
        <h2 className="mt-1 text-[13px] font-mono text-white/80">
          Lihat Sisa Pekerjaan
        </h2>
      </div>

      {isLoading ? (
        <div className="border border-white/5 bg-[#111114] px-4 py-10 text-center text-[12px] text-white/25">
          Memuat data progress...
        </div>
      ) : units.length === 0 ? (
        <EmptyRow message="Belum ada unit yang dipilih. Kembali ke langkah sebelumnya untuk memilih unit." />
      ) : (
        <div className="space-y-3">
          {units.map((unit) => (
            <UnitProgressCard key={unit.carId} unit={unit} />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 items-center gap-2 border border-white/10 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={units.length === 0}
          className="inline-flex h-8 items-center gap-2 border border-amber-500/30 bg-amber-500/[0.04] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjut ke Kapasitas →
        </button>
      </div>
    </div>
  );
}
