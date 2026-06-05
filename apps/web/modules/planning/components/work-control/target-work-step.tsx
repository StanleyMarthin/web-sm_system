"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

/**
 * Step 4 — Tentukan Target Jam Kerja
 * PM/KP mengisi target per unit + divisi.
 * Sistem langsung memberi feedback inline setelah target diisi.
 */

import { useEffect, useCallback, useState } from "react";
import { EmptyRow } from "@/shared/ui/compact";
import type { RiskLevel, PlanningRecommendation } from "@/modules/planning/helpers/planning-calculations";
import {
  calculateOvertimeNeed,
  resolvePlanningRecommendation,
  formatPlanningStatusLabel,
  formatRiskLabel,
} from "@/modules/planning/helpers/planning-calculations";
import {
  getTemplatesForDivision,
  getSavedTemplates,
  saveTemplate,
  deleteSavedTemplate,
} from "@/modules/planning/helpers/target-output-templates";

export interface TargetWorkUnit {
  carId: string;
  unitName: string;
  customerName: string | null;
  involvedDivisions: { divisionId: number; pendingHours: number }[];
  riskLevel: RiskLevel;
  suggestedFinishDate: string | null;
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
      return "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300";
    case "SPK_WITH_SPL":
      return "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300";
    case "HOLD":
      return "border-red-500/30 bg-red-500/[0.06] text-red-700 dark:text-red-300";
    case "REVISE_TARGET":
      return "border-gray-300 bg-gray-50 text-gray-600 dark:border-white/[0.1] dark:text-white/50";
  }
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<string[]>([]);

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

  const sortedDivisions = [...divisionOptions].sort((a, b) => {
    const aRel = unit.involvedDivisions.some((d) => d.divisionId === a.divisionId);
    const bRel = unit.involvedDivisions.some((d) => d.divisionId === b.divisionId);
    if (aRel && !bRel) return -1;
    if (!aRel && bRel) return 1;
    return a.divisionName.localeCompare(b.divisionName);
  });

  // Reload saved templates when division changes
  const loadSaved = useCallback(() => {
    if (entry.divisionId > 0) {
      setSavedTemplates(getSavedTemplates(entry.divisionId));
    } else {
      setSavedTemplates([]);
    }
  }, [entry.divisionId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const builtinTemplates = selectedDivision
    ? getTemplatesForDivision(selectedDivision.divisionName)
    : [];

  function applyTemplate(text: string, defaultHours?: number) {
    onChange({
      ...entry,
      targetOutput: text,
      ...(defaultHours !== undefined && entry.targetHours === 0
        ? { targetHours: defaultHours }
        : {}),
    });
    setShowTemplates(false);
  }

  function handleSaveTemplate() {
    const text = entry.targetOutput.trim();
    if (text.length < 10 || entry.divisionId === 0) return;
    saveTemplate(entry.divisionId, text);
    loadSaved();
  }

  function handleDeleteSaved(text: string) {
    deleteSavedTemplate(entry.divisionId, text);
    loadSaved();
  }

  return (
    <div className="border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-[#111114]">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              Target Divisi: {selectedDivision?.divisionName || "Belum Dipilih"}
            </p>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="mt-1 text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Hapus Target Ini
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-gray-200 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-gray-500 dark:border-white/[0.08] dark:text-white/45">
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
        {/* Target Output with smart template panel */}
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <label className="text-[11px] font-semibold text-gray-900 dark:text-white">
                Apa yang harus selesai minggu ini? (Target Output)
              </label>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
                Tuliskan hasil akhir yang konkrit. Hindari kata-kata samar seperti &quot;lanjut progress&quot;.
              </p>
            </div>
            {entry.divisionId > 0 && (
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="ml-3 flex-shrink-0 rounded border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/[0.12] dark:text-amber-400"
              >
                {showTemplates ? "Tutup" : "💡 Rekomendasi"}
              </button>
            )}
          </div>

          {/* Smart Template Panel */}
          {showTemplates && entry.divisionId > 0 && (
            <div className="mb-3 border border-amber-500/20 bg-amber-500/[0.03] dark:border-amber-500/10">
              {/* Saved templates */}
              {savedTemplates.length > 0 && (
                <div className="border-b border-amber-500/10 px-3 py-2.5">
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
                    📌 Tersimpan — {selectedDivision?.divisionName}
                  </p>
                  <div className="space-y-1.5">
                    {savedTemplates.map((tpl) => (
                      <div key={tpl} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className="flex-1 rounded border border-amber-500/20 bg-white/50 px-2.5 py-1.5 text-left text-[11px] text-gray-800 transition-colors hover:bg-amber-500/10 dark:bg-white/[0.02] dark:text-white/75 dark:hover:bg-amber-500/10"
                        >
                          {tpl}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSaved(tpl)}
                          title="Hapus template ini"
                          className="mt-0.5 text-[14px] text-gray-400 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Built-in templates per division */}
              <div className="px-3 py-2.5">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-gray-500 dark:text-white/35">
                  🔧 Saran untuk {selectedDivision?.divisionName}
                </p>
                <div className="space-y-1.5">
                  {builtinTemplates.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl.label, tpl.defaultHours)}
                      className="flex w-full items-center justify-between rounded border border-gray-200 bg-white/60 px-2.5 py-1.5 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.05] dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-amber-500/20 dark:hover:bg-amber-500/[0.05]"
                    >
                      <span className="text-[11px] text-gray-800 dark:text-white/75">{tpl.label}</span>
                      <span className="ml-3 flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-mono text-gray-500 dark:bg-white/[0.05] dark:text-white/40">
                        ~{tpl.defaultHours}j
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input field + save button */}
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              placeholder="Contoh: Interior depan dan console box terpasang rapi."
              value={entry.targetOutput}
              onChange={(e) => onChange({ ...entry, targetOutput: e.target.value })}
              className="h-9 min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 text-[12px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-600/45 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white dark:placeholder:text-white/20"
            />
            {entry.divisionId > 0 && entry.targetOutput.trim().length >= 10 && (
              <button
                type="button"
                title="Simpan sebagai template untuk divisi ini"
                onClick={handleSaveTemplate}
                className="flex-shrink-0 rounded border border-gray-300 bg-white px-2.5 text-[11px] text-gray-500 transition-colors hover:border-amber-500/40 hover:text-amber-600 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white/40 dark:hover:text-amber-400"
              >
                💾 Simpan
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-900 dark:text-white">
            Siapa yang mengerjakan? (Divisi)
          </label>
          <p className="mb-2 mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
            Pilih divisi yang bertanggung jawab atas target ini.
          </p>
          <select
            value={entry.divisionId || ""}
            onChange={(e) =>
              onChange({ ...entry, divisionId: Number(e.target.value) })
            }
            className="h-9 w-full rounded border border-gray-300 bg-white px-2.5 text-[12px] text-gray-900 outline-none dark:border-white/[0.08] dark:bg-[#111114] dark:text-white"
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
          <label className="text-[11px] font-semibold text-gray-900 dark:text-white">
            Estimasi butuh berapa jam?
          </label>
          <p className="mb-2 mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
            Berapa lama teknisi harus mengerjakan target di atas?
          </p>
          <input
            type="number"
            min={0}
            step={0.5}
            value={entry.targetHours || ""}
            onChange={(e) =>
              onChange({ ...entry, targetHours: Number(e.target.value) || 0 })
            }
            placeholder="0"
            className="h-9 w-full rounded border border-gray-300 bg-white px-3 text-[12px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-600/45 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white dark:placeholder:text-white/20"
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
                className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/60 dark:hover:bg-white/[0.05]"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-900 dark:text-white">
            Deadline (Target Selesai)
          </label>
          <p className="mb-2 mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
            Kapan target ini paling lambat harus selesai di minggu ini?
          </p>
          <input
            type="date"
            value={entry.targetFinishDate}
            onChange={(e) => onChange({ ...entry, targetFinishDate: e.target.value })}
            className="h-9 w-full rounded border border-gray-300 bg-white px-3 text-[12px] text-gray-900 outline-none dark:border-white/[0.08] dark:bg-[#111114] dark:text-white dark:[color-scheme:dark]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-900 dark:text-white">
            Prioritas Kerja
          </label>
          <p className="mb-2 mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
            Pilih urgensi pekerjaan untuk ditampilkan di aplikasi teknisi.
          </p>
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
                  "h-9 rounded border px-2 text-[11px] font-medium transition-colors",
                  entry.priority === priority.value
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.03]",
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
              "inline-flex h-9 items-center rounded border px-4 text-[11px] font-medium transition-colors",
              entry.isHold
                ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.03]",
            ].join(" ")}
          >
            {entry.isHold ? "Tanda Tunda Aktif (Membekukan Target)" : "Tandai Tunda (Hold)"}
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
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-4">
                <span className="text-gray-500 dark:text-white/40">
                  Sisa Jam Divisi:
                </span>
                <span className="font-mono font-medium text-gray-800 dark:text-white/80">
                  {availableHours.toFixed(0)} jam
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500 dark:text-white/40">
                  Estimasi Waktu Target:
                </span>
                <span className="font-mono font-medium text-gray-800 dark:text-white/80">
                  {entry.isHold ? "Ditunda" : `${entry.targetHours.toFixed(0)} jam`}
                </span>
              </div>
              {entry.targetFinishDate && (
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 dark:text-white/40">
                    Deadline:
                  </span>
                  <span className="font-mono font-medium text-gray-800 dark:text-white/80">
                    {entry.targetFinishDate}
                  </span>
                </div>
              )}
              {overtimeNeed > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-amber-600 dark:text-amber-400">
                    Kekurangan Jam:
                  </span>
                  <span className="font-mono font-medium text-amber-700 dark:text-amber-300">
                    Sistem akan menyarankan {overtimeNeed.toFixed(0)} jam lembur (SPL)
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

      <div className="border-t border-gray-100 px-4 py-3 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 dark:text-white/40"
        >
          {showDetails ? "Sembunyikan Detail Tambahan" : "Tampilkan Detail Tambahan"}
        </button>
        {showDetails && (
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
              Catatan PM/KP (opsional)
            </label>
            <textarea
              rows={2}
              value={entry.notes}
              onChange={(e) => onChange({ ...entry, notes: e.target.value })}
              placeholder="Catatan tambahan untuk KD..."
              className="w-full border border-gray-300 bg-white px-2.5 py-2 font-mono text-[11px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-600/45 dark:border-white/[0.05] dark:bg-[#0a0a0c] dark:text-white dark:placeholder:text-white/20"
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
      // Hanya buat target untuk divisi yang punya jam sisa (pending)
      .filter((d) => d.pendingHours > 0)
      .map((d) => {
        // Cari nama divisi untuk mendapatkan template rekomendasi
        const divOpt = divisionOptions.find((opt) => opt.divisionId === d.divisionId);
        let targetOutput = "";
        
        if (divOpt) {
           const templates = getTemplatesForDivision(divOpt.divisionName);
           // Pilih template pertama sebagai default text yang sopan
           if (templates.length > 0) {
             targetOutput = templates[0].label;
           }
        }

        return {
          id: crypto.randomUUID(),
          carId: unit.carId,
          targetOutput: targetOutput || "Melanjutkan progress pekerjaan (Auto-Plan)",
          divisionId: d.divisionId,
          targetHours: d.pendingHours,
          targetFinishDate: unit.suggestedFinishDate || defaultFinishDate,
          priority: "NORMAL",
          riskLevel: unit.riskLevel,
          isHold: false,
          notes: "Generated via Auto-Plan",
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
      <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
              Langkah 4
            </p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
              Tentukan Target Kerja
            </h2>
          </div>
          {activeUnit && (
             <button
               type="button"
               onClick={() => handleAutoPlan(activeUnit)}
               className="flex h-10 items-center gap-1.5 border border-emerald-500/25 bg-emerald-500/[0.08] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition-colors hover:bg-emerald-500/[0.14] dark:text-emerald-300"
             >
               ✨ Auto-Plan Unit Ini
             </button>
          )}
        </div>
        <p className="mt-2 text-[12px] text-gray-500 dark:text-white/40">
          Isi empat hal inti saja: output, divisi, jam kerja, dan target selesai. Anda dapat membuat beberapa target berbeda (misal untuk mekanik dan bodi) pada satu unit yang sama.
        </p>
      </div>

      {units.length === 0 ? (
        <EmptyRow message="Belum ada unit yang dipilih. Kembali ke langkah sebelumnya." />
      ) : (
        <>
          {/* Unit Tabs Filter */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-white/[0.05]">
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
                    "flex items-center gap-2 border px-3 py-2 text-[11px] font-medium transition-colors",
                    isActive
                      ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white/60 dark:hover:bg-white/[0.02]",
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
              <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
                  Unit Aktif
                </p>
                <h3 className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                  {activeUnit.unitName}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-gray-500 dark:text-white/40">
                  {activeUnit.customerName || "Customer belum diisi"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:border-white/[0.08] dark:bg-[#0a0a0c] dark:text-white/35">
                    Risiko {formatRiskLabel(activeUnit.riskLevel)}
                  </span>
                  <span className="inline-flex items-center border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:border-white/[0.08] dark:bg-[#0a0a0c] dark:text-white/35">
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
                className="flex w-full items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50 py-3 text-[11px] font-medium text-gray-600 hover:bg-gray-100 dark:border-white/[0.1] dark:bg-white/[0.02] dark:text-white/60 dark:hover:bg-white/[0.04]"
              >
                ➕ Tambah Target Divisi Lain
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
          className="inline-flex h-10 items-center gap-2 border border-gray-300 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/55"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid || units.length === 0}
          className="inline-flex h-10 items-center gap-2 border border-amber-500/40 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
        >
          Lanjut ke Review →
        </button>
      </div>
    </div>
  );
}
