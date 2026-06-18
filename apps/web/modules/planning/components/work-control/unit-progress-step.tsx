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
    return "border-success/30 text-success";
  }
  if (s === "in_progress" || s === "on_progress") {
    return "border-primary/30 text-app-accent-ink";
  }
  return "border-border text-muted-foreground";
}

function UnitProgressCard({ unit }: { unit: UnitProgressData }) {
  const [showDetail, setShowDetail] = useState(false);

  const doneJobs = unit.jobs.filter(
    (j) => j.status.toLowerCase() === "done" || j.status.toLowerCase() === "selesai",
  ).length;

  return (
    <div className="border border-border bg-card">
      {/* Card header */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[14px] font-mono text-foreground">
              {unit.unitName}
            </p>
            <p className="mt-0.5 font-mono text-[14px] text-muted-foreground">
              {unit.customerName ?? "Customer belum diisi"}
              {unit.targetDeliveryDate
                ? ` · Target: ${unit.targetDeliveryDate}`
                : ""}
            </p>
          </div>
          <span
            className={[
              "border px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.1em]",
              unit.riskLevel === "LOW"
                ? "border-success/30 text-success"
                : unit.riskLevel === "MEDIUM"
                  ? "border-primary/30 text-app-accent-ink"
                  : "border-destructive/30 text-destructive",
            ].join(" ")}
          >
            Risiko {formatRiskLabel(unit.riskLevel)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[15px]">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono font-medium text-foreground">
              {unit.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted">
            <div
              className={[
                "h-full transition-all",
                unit.progressPercent >= 80
                  ? "bg-success"
                  : unit.progressPercent >= 50
                    ? "bg-primary"
                    : "bg-destructive",
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
              className="border border-border bg-background px-3 py-2"
            >
              <p className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-0.5 font-mono text-[14px] text-foreground">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Divisi terlibat */}
        {unit.involvedDivisions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 font-mono text-[14px] uppercase tracking-[0.1em] text-muted-foreground">
              Divisi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unit.involvedDivisions.map((d) => (
                <span
                  key={d.divisionId}
                  className="border border-border px-2 py-0.5 font-mono text-[14px] text-muted-foreground"
                >
                  {d.divisionName}
                  <span className="ml-1 font-mono text-muted-foreground">
                    {d.remainingHours.toFixed(0)}j
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kendala */}
        {unit.mainConstraint && (
          <div className="mt-3 border border-primary/20 bg-primary/[0.05] px-3 py-2 text-[15px] text-app-accent-ink dark:text-app-accent-ink">
            {unit.mainConstraint}
          </div>
        )}
      </div>

      {/* Toggle detail */}
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex w-full items-center justify-between border-t border-border px-4 py-2 font-mono text-[14px] text-muted-foreground transition-colors hover:bg-muted"
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
        <div className="border-t border-border">
          <div className="max-h-[280px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-[15px]">
              <thead className="sticky top-0 border-b border-border bg-background">
                <tr className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground">
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
                    className="border-b border-border transition-colors hover:bg-card/[0.015]"
                  >
                    <td className="px-4 py-1.5 text-foreground">
                      {job.jobName}
                    </td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {job.panel ?? "-"}
                    </td>
                    <td className="px-4 py-1.5">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[15px] uppercase ${statusBadge(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                      {job.estimatedHours.toFixed(1)}j
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
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
      <div className="border border-border bg-card px-4 py-4">
        <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
          Langkah 2
        </p>
        <h2 className="mt-1 text-[15px] font-mono text-foreground">
          Lihat Sisa Pekerjaan
        </h2>
      </div>

      {isLoading ? (
        <div className="border border-border bg-card px-4 py-10 text-center text-[14px] text-muted-foreground">
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
          className="inline-flex h-8 items-center gap-2 border border-border px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={units.length === 0}
          className="inline-flex h-8 items-center gap-2 border border-primary/30 bg-primary/[0.04] px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjut ke Kapasitas →
        </button>
      </div>
    </div>
  );
}
