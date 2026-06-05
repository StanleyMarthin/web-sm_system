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
}

export interface UnitProgressJob {
  jobId: string;
  jobName: string;
  panel: string;
  status: string;
  estimatedHours: number;
  actualHours: number | null;
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
    return "border-emerald-500/30 text-emerald-600 dark:text-emerald-300";
  }
  if (s === "in_progress" || s === "on_progress") {
    return "border-amber-500/30 text-amber-600 dark:text-amber-300";
  }
  return "border-gray-300 text-gray-500 dark:border-white/[0.1] dark:text-white/40";
}

function UnitProgressCard({ unit }: { unit: UnitProgressData }) {
  const [showDetail, setShowDetail] = useState(false);

  const doneJobs = unit.jobs.filter(
    (j) => j.status.toLowerCase() === "done" || j.status.toLowerCase() === "selesai",
  ).length;

  return (
    <div className="border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#111114]">
      {/* Card header */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-mono text-gray-900 dark:text-white/80">
              {unit.unitName}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-white/30">
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
                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                : unit.riskLevel === "MEDIUM"
                  ? "border-amber-500/30 text-amber-600 dark:text-amber-300"
                  : "border-red-500/30 text-red-600 dark:text-red-300",
            ].join(" ")}
          >
            Risiko {formatRiskLabel(unit.riskLevel)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-white/40">Progress keseluruhan</span>
            <span className="font-mono font-medium text-gray-700 dark:text-white/70">
              {unit.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 dark:bg-white/[0.06]">
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
              label: "Sisa estimasi",
              value: `${unit.remainingHours.toFixed(0)} jam`,
            },
            {
              label: "Pekerjaan selesai",
              value: `${doneJobs} / ${unit.jobs.length}`,
            },
            {
              label: "Estimasi selesai",
              value:
                unit.roughEstimateDays != null
                  ? `~${unit.roughEstimateDays} hari kerja`
                  : "Belum bisa dihitung",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/[0.06] dark:bg-[#0a0a0c]"
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
                {m.label}
              </p>
              <p className="mt-0.5 font-mono text-[12px] text-gray-700 dark:text-white/70">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Divisi terlibat */}
        {unit.involvedDivisions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
              Divisi terlibat
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unit.involvedDivisions.map((d) => (
                <span
                  key={d.divisionId}
                  className="border border-gray-200 px-2 py-0.5 font-mono text-[10px] text-gray-500 dark:border-white/[0.08] dark:text-white/40"
                >
                  {d.divisionName}
                  <span className="ml-1 font-mono text-gray-400 dark:text-white/25">
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
        className="flex w-full items-center justify-between border-t border-gray-200 px-4 py-2 font-mono text-[10px] text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/[0.06] dark:text-white/30 dark:hover:bg-white/[0.02]"
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
        <div className="border-t border-gray-200 dark:border-white/[0.06]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.06] dark:bg-[#0a0a0c]">
                <tr className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
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
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-white/[0.03] dark:hover:bg-white/[0.015]"
                  >
                    <td className="px-4 py-1.5 text-gray-700 dark:text-white/60">
                      {job.jobName}
                    </td>
                    <td className="px-4 py-1.5 text-gray-400 dark:text-white/30">
                      {job.panel}
                    </td>
                    <td className="px-4 py-1.5">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${statusBadge(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-gray-600 dark:text-white/50">
                      {job.estimatedHours.toFixed(1)}j
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-gray-600 dark:text-white/50">
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
      <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
          Langkah 2
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-gray-950 dark:text-white">
          Lihat Sisa Pekerjaan
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-white/40">
          Baca sisa kerja per unit sebelum bicara kapasitas. Tujuannya supaya yang dipilih di
          langkah awal benar-benar layak dikejar, bukan sekadar terasa mendesak.
        </p>
      </div>

      {isLoading ? (
        <div className="border border-gray-200 bg-white px-4 py-10 text-center text-[12px] text-gray-400 dark:border-white/[0.06] dark:bg-[#111114] dark:text-white/25">
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
          className="inline-flex h-10 items-center gap-2 border border-gray-200 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={units.length === 0}
          className="inline-flex h-10 items-center gap-2 border border-amber-500/40 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
        >
          Lanjut ke Kapasitas →
        </button>
      </div>
    </div>
  );
}
