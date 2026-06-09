"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

/**
 * Step 4 — Tentukan Target Jam Kerja
 * PM/KP mengisi target per unit + divisi.
 * Sistem langsung memberi feedback inline setelah target diisi.
 */

import { useEffect, useMemo, useState } from "react";
import { EmptyRow } from "@/shared/ui/compact";
import type { RiskLevel, PlanningRecommendation } from "@/modules/planning/helpers/planning-calculations";
import {
  calculateOvertimeNeed,
  resolvePlanningRecommendation,
  formatPlanningStatusLabel,
  formatRiskLabel,
} from "@/modules/planning/helpers/planning-calculations";

export interface TargetWorkJob {
  jobId: string;
  divisionId: string | null;
  divisionName: string | null;
  jobName: string;
  panel: string | null;
  status: string;
  remainingHours: number;
  estimatedHours: number;
  deadlineDate: string | null;
  dependsOn: string[];
  qcLastStatus: string | null;
}

export interface TargetWorkUnit {
  carId: string;
  unitName: string;
  customerName: string | null;
  involvedDivisions: { divisionId: number; pendingHours: number }[];
  riskLevel: RiskLevel;
  suggestedFinishDate: string | null;
  jobs: TargetWorkJob[];
}

export interface TargetWorkDivisionOption {
  divisionId: number;
  divisionName: string;
  availableCapacityHours: number;
}

export interface TargetWorkEntry {
  id: string;
  carId: string;
  targetOutput: string;
  divisionId: number;
  targetHours: number;
  targetFinishDate: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  riskLevel: RiskLevel;
  isHold: boolean;
  notes: string;
}

interface TargetWorkStepProps {
  units: TargetWorkUnit[];
  divisionOptions: TargetWorkDivisionOption[];
  entries: TargetWorkEntry[];
  defaultFinishDate?: string;
  onEntriesChange: (entries: TargetWorkEntry[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function recommendationBadgeStyle(rec: PlanningRecommendation): string {
  switch (rec) {
    case "SPK":
      return "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300";
    case "SPK_WITH_SPL":
      return "border-amber-500/30 bg-amber-500/[0.06] text-amber-300";
    case "HOLD":
      return "border-red-500/30 bg-red-500/[0.06] text-red-300";
    case "REVISE_TARGET":
      return "border-white/10 bg-[#0a0a0c] text-white/50";
  }
}

function isOpenJob(job: TargetWorkJob): boolean {
  const status = job.status.toLowerCase();
  return status !== "done" && status !== "selesai";
}

function buildTargetOutputLabel(job: TargetWorkJob): string {
  const panel = job.panel?.trim();
  return panel ? `${job.jobName} — ${panel}` : job.jobName;
}

function buildJobConsideration(job: TargetWorkJob, selectedDivisionId: number): string {
  const parts: string[] = [];
  if (job.divisionId && Number(job.divisionId) === selectedDivisionId) {
    parts.push("divisi terkait");
  } else if (job.divisionName) {
    parts.push(job.divisionName);
  }
  if (job.remainingHours > 0) {
    parts.push(`sisa ${job.remainingHours.toFixed(1)} jam`);
  }
  if (job.deadlineDate) {
    parts.push(`deadline ${job.deadlineDate}`);
  }
  if (job.qcLastStatus === "TIDAK_LOLOS") {
    parts.push("perlu rework QC");
  }
  if (job.dependsOn.length > 0) {
    parts.push(`nunggu ${job.dependsOn.length} pekerjaan`);
  }
  return parts.join(" · ");
}

function TargetEntryRow({
  unit,
  entry,
  divisionOptions,
  onChange,
  onDelete,
}: {
  unit: TargetWorkUnit;
  entry: TargetWorkEntry;
  divisionOptions: TargetWorkDivisionOption[];
  onChange: (updated: TargetWorkEntry) => void;
  onDelete?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  const selectedDivision = divisionOptions.find(
    (d) => d.divisionId === entry.divisionId,
  );
  const availableHours = selectedDivision?.availableCapacityHours ?? 0;
  const overtimeNeed = calculateOvertimeNeed(entry.targetHours, availableHours);
  const recommendation = resolvePlanningRecommendation(
    entry.targetHours,
    availableHours,
    entry.isHold,
  );
  const statusLabel = formatPlanningStatusLabel(recommendation);
  const targetOptions = useMemo(() => {
    const normalizedSearch = targetSearch.trim().toLowerCase();
    return unit.jobs
      .filter(isOpenJob)
      .filter((job) => {
        if (!normalizedSearch) return true;
        return [
          job.jobName,
          job.panel ?? "",
          job.divisionName ?? "",
          job.status,
        ].join(" ").toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aDivisionMatch = a.divisionId && Number(a.divisionId) === entry.divisionId;
        const bDivisionMatch = b.divisionId && Number(b.divisionId) === entry.divisionId;
        if (aDivisionMatch && !bDivisionMatch) return -1;
        if (!aDivisionMatch && bDivisionMatch) return 1;
        if (b.remainingHours !== a.remainingHours) return b.remainingHours - a.remainingHours;
        if (a.deadlineDate && b.deadlineDate) return a.deadlineDate.localeCompare(b.deadlineDate);
        if (a.deadlineDate && !b.deadlineDate) return -1;
        if (!a.deadlineDate && b.deadlineDate) return 1;
        return buildTargetOutputLabel(a).localeCompare(buildTargetOutputLabel(b));
      });
  }, [entry.divisionId, targetSearch, unit.jobs]);
  const shouldShowSearch = unit.jobs.filter(isOpenJob).length > 5;

  const sortedDivisions = [...divisionOptions].sort((a, b) => {
    const aRel = unit.involvedDivisions.some((d) => d.divisionId === a.divisionId);
    const bRel = unit.involvedDivisions.some((d) => d.divisionId === b.divisionId);
    if (aRel && !bRel) return -1;
    if (!aRel && bRel) return 1;
    return a.divisionName.localeCompare(b.divisionName);
  });

  function applyCountdownJob(job: TargetWorkJob) {
    const targetOutput = buildTargetOutputLabel(job);
    onChange({
      ...entry,
      targetOutput,
      divisionId: job.divisionId ? Number(job.divisionId) : entry.divisionId,
      ...(entry.targetHours === 0
        ? { targetHours: Math.max(0, job.remainingHours || job.estimatedHours) }
        : {}),
      ...(!entry.targetFinishDate && job.deadlineDate ? { targetFinishDate: job.deadlineDate } : {}),
    });
  }

  return (
    <div className="border border-white/5 bg-[#111114]">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-mono text-white">
              Target Divisi: {selectedDivision?.divisionName || "Belum Dipilih"}
            </p>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="mt-1 text-[11px] font-mono text-red-400 hover:text-red-300"
              >
                Hapus Target Ini
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">
              Risiko {formatRiskLabel(entry.riskLevel)}
            </span>
            <span
              className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${recommendationBadgeStyle(recommendation)}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="mb-2">
            <label className="font-mono text-[11px] text-white/70">
              Apa yang harus selesai minggu ini? (Target Output)
            </label>
            <p className="mt-1 text-[11px] leading-5 text-white/35">
              Pilih dari pekerjaan countdown unit ini. Urutan mempertimbangkan divisi terkait, sisa jam, deadline, QC, dan dependency.
            </p>
          </div>
          <div className="border border-white/10 bg-[#0a0a0c]">
            {shouldShowSearch && (
              <div className="border-b border-white/5 px-3 py-2">
                <input
                  type="search"
                  value={targetSearch}
                  onChange={(event) => setTargetSearch(event.target.value)}
                  placeholder="Cari pekerjaan, panel, atau divisi..."
                  className="h-8 w-full border border-white/10 bg-[#111114] px-3 font-mono text-[12px] text-white outline-none placeholder:text-white/20 focus:border-amber-500/40"
                />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto">
              {targetOptions.length > 0 ? targetOptions.map((job) => {
                const label = buildTargetOutputLabel(job);
                const selected = entry.targetOutput === label;
                return (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => applyCountdownJob(job)}
                    className={[
                      "block w-full border-b border-white/5 px-3 py-2 text-left transition-colors last:border-b-0",
                      selected ? "bg-amber-500/[0.08]" : "hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <span className="block font-mono text-[12px] text-white/80">{label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-white/35">
                      {buildJobConsideration(job, entry.divisionId) || "Pekerjaan countdown"}
                    </span>
                  </button>
                );
              }) : (
                <div className="px-3 py-4 text-[12px] text-white/35">
                  Tidak ada pekerjaan countdown yang cocok.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-mono text-[11px] text-white/70">
            Divisi pelaksana
          </label>
          <select
            value={entry.divisionId || ""}
            onChange={(e) =>
              onChange({ ...entry, divisionId: Number(e.target.value) })
            }
            className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-2.5 font-mono text-[12px] text-white outline-none"
          >
            <option value="">Pilih divisi...</option>
            {sortedDivisions.map((d) => {
              const isRelevant = unit.involvedDivisions.some((div) => div.divisionId === d.divisionId);
              return (
                <option key={d.divisionId} value={d.divisionId}>
                  {d.divisionName} {isRelevant ? "(Terkait Unit)" : ""} - {d.availableCapacityHours.toFixed(0)} jam tersedia
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="mb-2 block font-mono text-[11px] text-white/70">
            Target jam
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={entry.targetHours || ""}
            onChange={(e) =>
              onChange({ ...entry, targetHours: Number(e.target.value) || 0 })
            }
            placeholder="0"
            className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-3 font-mono text-[12px] text-white outline-none placeholder:text-white/20 focus:border-amber-500/40"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "1 Jam", value: 1 },
              { label: "Setengah Hari (4j)", value: 4 },
              { label: "1 Hari (8j)", value: 8 },
              { label: "2 Hari (16j)", value: 16 },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChange({ ...entry, targetHours: preset.value })}
                className="border border-white/5 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-white/60 hover:bg-white/[0.05]"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-mono text-[11px] text-white/70">
            Deadline
          </label>
          <input
            type="date"
            value={entry.targetFinishDate}
            onChange={(e) => onChange({ ...entry, targetFinishDate: e.target.value })}
            className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-3 font-mono text-[12px] text-white outline-none dark:[color-scheme:dark]"
          />
        </div>

        <div>
          <label className="mb-2 block font-mono text-[11px] text-white/70">
            Prioritas
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Normal", value: "NORMAL" },
              { label: "Penting", value: "IMPORTANT" },
              { label: "Urgent", value: "URGENT" },
            ].map((priority) => (
              <button
                key={priority.value}
                type="button"
                onClick={() =>
                  onChange({ ...entry, priority: priority.value as TargetWorkEntry["priority"] })
                }
                className={[
                  "h-8 border px-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                  entry.priority === priority.value
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-white/10 text-white/50 hover:bg-white/[0.03]",
                ].join(" ")}
              >
                {priority.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => onChange({ ...entry, isHold: !entry.isHold })}
            className={[
              "inline-flex h-8 w-full items-center justify-center border px-4 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              entry.isHold
                ? "border-red-500/35 bg-red-500/10 text-red-400"
                : "border-white/10 text-white/50 hover:bg-white/[0.03]",
            ].join(" ")}
          >
            {entry.isHold ? "Lepas Hold" : "Tandai Hold"}
          </button>
        </div>
      </div>

      {entry.divisionId > 0 && (
        <div
          className={[
            "mx-4 mb-4 border px-4 py-3",
            recommendation === "SPK"
              ? "border-emerald-500/25 bg-emerald-500/[0.04]"
              : recommendation === "HOLD"
                ? "border-red-500/25 bg-red-500/[0.04]"
                : "border-amber-500/25 bg-amber-500/[0.04]",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex items-center gap-4">
                <span className="text-white/40">
                  Sisa Jam Divisi:
                </span>
                <span className="text-white/80">
                  {availableHours.toFixed(0)} jam
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white/40">
                  Waktu Target:
                </span>
                <span className="text-white/80">
                  {entry.isHold ? "Ditunda" : `${entry.targetHours.toFixed(0)} jam`}
                </span>
              </div>
              {entry.targetFinishDate && (
                <div className="flex items-center gap-4">
                  <span className="text-white/40">
                    Deadline:
                  </span>
                  <span className="text-white/80">
                    {entry.targetFinishDate}
                  </span>
                </div>
              )}
              {overtimeNeed > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-amber-400">
                    Kekurangan Jam:
                  </span>
                  <span className="text-amber-300">
                    Akan disarankan {overtimeNeed.toFixed(0)} jam SPL
                  </span>
                </div>
              )}
            </div>
            <span
              className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${recommendationBadgeStyle(recommendation)}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-white/5 px-4 py-3">
        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/40"
        >
          {showDetails ? "Sembunyikan Detail Tambahan" : "Tampilkan Detail Tambahan"}
        </button>
        {showDetails && (
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-white/25">
              Catatan (opsional)
            </label>
            <textarea
              rows={2}
              value={entry.notes}
              onChange={(e) => onChange({ ...entry, notes: e.target.value })}
              placeholder="..."
              className="w-full border border-white/5 bg-[#0a0a0c] px-2.5 py-2 font-mono text-[11px] text-white outline-none placeholder:text-white/20 focus:border-amber-500/45"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function TargetWorkStep({
  units,
  divisionOptions,
  entries,
  defaultFinishDate = "",
  onEntriesChange,
  onNext,
  onBack,
}: TargetWorkStepProps) {
  const [selectedCarId, setSelectedCarId] = useState<string>(units[0]?.carId || "");

  // Initialize selected tab and default entries
  useEffect(() => {
    if (units.length > 0 && !units.find((u) => u.carId === selectedCarId)) {
      setSelectedCarId(units[0].carId);
    }

    const nextEntries = [...entries];
    let changed = false;

    for (const unit of units) {
      const hasEntry = nextEntries.some((e) => e.carId === unit.carId);
      if (!hasEntry) {
        nextEntries.push({
          id: crypto.randomUUID(),
          carId: unit.carId,
          targetOutput: "",
          divisionId: unit.involvedDivisions[0]?.divisionId ?? 0,
          targetHours: 0,
          targetFinishDate: unit.suggestedFinishDate || defaultFinishDate,
          priority: "NORMAL",
          riskLevel: unit.riskLevel,
          isHold: false,
          notes: "",
        });
        changed = true;
      }
    }

    if (changed) {
      onEntriesChange(nextEntries);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  function updateEntry(updated: TargetWorkEntry) {
    onEntriesChange(entries.map((e) => (e.id === updated.id ? updated : e)));
  }

  function deleteEntry(id: string) {
    onEntriesChange(entries.filter((e) => e.id !== id));
  }

  function addEntryForUnit(unit: TargetWorkUnit) {
    onEntriesChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        carId: unit.carId,
        targetOutput: "",
        divisionId: 0,
        targetHours: 0,
        targetFinishDate: unit.suggestedFinishDate || defaultFinishDate,
        priority: "NORMAL",
        riskLevel: unit.riskLevel,
        isHold: false,
        notes: "",
      },
    ]);
  }

  const isValid = entries.every(
    (e) =>
      e.isHold || (
        e.divisionId > 0 &&
        e.targetHours > 0 &&
        e.targetOutput.trim().length > 0 &&
        e.targetFinishDate.trim().length > 0
      ),
  );

  function handleAutoPlan(unit: TargetWorkUnit) {
    if (unit.involvedDivisions.length === 0) return;

    // Bersihkan entry kosong/sebelumnya untuk unit ini
    const otherEntries = entries.filter((e) => e.carId !== unit.carId);
    const autoEntries: TargetWorkEntry[] = unit.involvedDivisions
      .filter((d) => d.pendingHours > 0)
      .map((d) => {
        const countdownJob = unit.jobs
          .filter(isOpenJob)
          .filter((job) => job.divisionId && Number(job.divisionId) === d.divisionId)
          .sort((a, b) => b.remainingHours - a.remainingHours)[0];

        return {
          id: crypto.randomUUID(),
          carId: unit.carId,
          targetOutput: countdownJob ? buildTargetOutputLabel(countdownJob) : "",
          divisionId: d.divisionId,
          targetHours: Math.max(0, countdownJob?.remainingHours ?? d.pendingHours),
          targetFinishDate: countdownJob?.deadlineDate || unit.suggestedFinishDate || defaultFinishDate,
          priority: "NORMAL",
          riskLevel: unit.riskLevel,
          isHold: false,
          notes: countdownJob ? "Auto-plan dari countdown" : "",
        };
      });

    // Jika tidak ada pending hours, setidaknya buat 1 entry kosong
    if (autoEntries.length === 0) {
      autoEntries.push({
        id: crypto.randomUUID(),
        carId: unit.carId,
        targetOutput: "",
        divisionId: unit.involvedDivisions[0]?.divisionId ?? 0,
        targetHours: 0,
        targetFinishDate: unit.suggestedFinishDate || defaultFinishDate,
        priority: "NORMAL",
        riskLevel: unit.riskLevel,
        isHold: false,
        notes: "",
      });
    }

    onEntriesChange([...otherEntries, ...autoEntries]);
  }

  const activeUnit = units.find((u) => u.carId === selectedCarId);
  const activeEntries = entries.filter((e) => e.carId === selectedCarId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-white/5 bg-[#111114] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
              Langkah 4
            </p>
            <h2 className="mt-1 text-[13px] font-mono text-white/80">
              Tentukan Target Kerja
            </h2>
          </div>
          {activeUnit && (
             <button
               type="button"
               onClick={() => handleAutoPlan(activeUnit)}
               className="flex h-8 items-center gap-1.5 border border-emerald-500/25 bg-emerald-500/[0.08] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300 transition-colors hover:bg-emerald-500/[0.14]"
             >
               ✨ Auto-Plan
             </button>
          )}
        </div>
      </div>

      {units.length === 0 ? (
        <EmptyRow message="Belum ada unit yang dipilih. Kembali ke langkah sebelumnya." />
      ) : (
        <>
          {/* Unit Tabs Filter */}
          <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
            {units.map((u) => {
              const isActive = u.carId === selectedCarId;
              const hasIncomplete = entries.filter(e => e.carId === u.carId).some(e => 
                !e.isHold && (e.divisionId === 0 || e.targetHours === 0 || e.targetOutput.length === 0)
              );
              return (
                <button
                  key={u.carId}
                  onClick={() => setSelectedCarId(u.carId)}
                  className={[
                    "flex h-8 items-center gap-2 border px-3 font-mono text-[11px] transition-colors",
                    isActive
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                      : "border-white/10 bg-[#111114] text-white/60 hover:bg-white/[0.02]",
                  ].join(" ")}
                >
                  <span>{u.unitName}</span>
                  {hasIncomplete && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-red-500"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Unit Content */}
          {activeUnit && (
            <div className="space-y-4">
              <div className="border border-white/5 bg-[#111114] px-4 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
                  Unit Aktif
                </p>
                <h3 className="mt-1 font-mono text-[14px] text-white">
                  {activeUnit.unitName}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-white/40">
                  {activeUnit.customerName || "Customer belum diisi"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center border border-white/10 bg-[#0a0a0c] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                    Risiko {formatRiskLabel(activeUnit.riskLevel)}
                  </span>
                  <span className="inline-flex items-center border border-white/10 bg-[#0a0a0c] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                    {activeEntries.length} target divisi
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {activeEntries.map((entry) => (
                  <TargetEntryRow
                    key={entry.id}
                    unit={activeUnit}
                    entry={entry}
                    divisionOptions={divisionOptions}
                    onChange={updateEntry}
                    onDelete={activeEntries.length > 1 ? () => deleteEntry(entry.id) : undefined}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => addEntryForUnit(activeUnit)}
                className="flex w-full items-center justify-center gap-2 border border-dashed border-white/10 bg-white/[0.02] py-3 font-mono text-[11px] text-white/60 hover:bg-white/[0.04]"
              >
                + Tambah Divisi
              </button>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 items-center gap-2 border border-white/10 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid || units.length === 0}
          className="inline-flex h-8 items-center gap-2 border border-amber-500/30 bg-amber-500/[0.06] px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjut ke Review →
        </button>
      </div>
    </div>
  );
}
