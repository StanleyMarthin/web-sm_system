"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

/**
 * Step 5 — Review & Rilis SPK/SPL
 * Ringkasan keputusan akhir per unit, dengan tombol rilis.
 */

import { useState } from "react";
import { EmptyRow } from "@/shared/ui/compact";
import type { PlanningRecommendation } from "@/modules/planning/helpers/planning-calculations";
import {
  calculateOvertimeNeed,
  calculateSafeFinishDate,
  resolvePlanningRecommendation,
  formatPlanningStatusLabel,
  formatRiskLabel,
} from "@/modules/planning/helpers/planning-calculations";
import type { TargetWorkEntry } from "./target-work-step";
import { SpkReleaseDialog } from "./spk-release-dialog";
import { SplRecommendationDialog } from "./spl-recommendation-dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ReviewUnit {
  carId: string;
  unitName: string;
  customerName: string | null;
  entry: TargetWorkEntry;
  divisionName: string;
  availableCapacityHours: number;
  remainingHours: number;
  startDate: string;
  dailyCapacityHours: number;
  qcBufferDays: number;
  workingDayNumbers: number[];
}

interface ReviewReleaseStepProps {
  units: ReviewUnit[];
  onReleaseAll: (entries: TargetWorkEntry[]) => Promise<{ success: boolean; message: string; planningTargetId?: string }>;
  onSaveDraft: () => Promise<void>;
  onCreateOvertimeRecommendation: (inputs: { planningTargetId: string; divisionId: string; shortageHours: number; reason: string }[]) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
  onBack: () => void;
  isSaving?: boolean;
  message?: string | null;
  errorMessage?: string | null;
  setMessage: (msg: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
  canManage: boolean;
}

function recommendationStyle(rec: PlanningRecommendation) {
  switch (rec) {
    case "SPK":
      return {
        border: "border-emerald-500/25",
        bg: "bg-emerald-500/[0.04]",
        badge: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
        icon: "✅",
      };
    case "SPK_WITH_SPL":
      return {
        border: "border-amber-500/25",
        bg: "bg-amber-500/[0.04]",
        badge: "border-amber-500/30 text-amber-700 dark:text-amber-300",
        icon: "⚠️",
      };
    case "HOLD":
      return {
        border: "border-red-500/25",
        bg: "bg-red-500/[0.04]",
        badge: "border-red-500/30 text-red-700 dark:text-red-300",
        icon: "🚫",
      };
    case "REVISE_TARGET":
      return {
        border: "border-gray-200",
        bg: "bg-gray-50 dark:bg-white/[0.02]",
        badge: "border-gray-300 text-gray-600 dark:border-white/[0.1] dark:text-white/50",
        icon: "↩️",
      };
  }
}

function ReviewUnitCard({ unit, onRevise }: { unit: ReviewUnit; onRevise: () => void }) {
  const { entry } = unit;
  const overtimeNeed = calculateOvertimeNeed(entry.targetHours, unit.availableCapacityHours);
  const recommendation = resolvePlanningRecommendation(
    entry.targetHours,
    unit.availableCapacityHours,
    entry.isHold,
  );
  const statusLabel = formatPlanningStatusLabel(recommendation);
  const style = recommendationStyle(recommendation);

  const safeFinish = unit.workingDayNumbers.length > 0
    ? calculateSafeFinishDate({
        correctedHours: unit.remainingHours,
        dailyCapacityHours: Math.max(1, unit.dailyCapacityHours),
        qcBufferDays: unit.qcBufferDays,
        startDate: unit.startDate,
        workingDayNumbers: unit.workingDayNumbers,
      })
    : null;

  const priorityLabel = {
    NORMAL: "Normal",
    IMPORTANT: "Penting",
    URGENT: "Urgent",
  }[entry.priority];
  const isTargetTooTight =
    !entry.isHold &&
    entry.targetFinishDate.trim().length > 0 &&
    safeFinish !== null &&
    safeFinish.safeFinishDate > entry.targetFinishDate;
  const requestedFinishLabel = entry.targetFinishDate || "Belum diisi";
  const decisionSummary =
    recommendation === "HOLD"
      ? "Unit ini ditunda dulu untuk minggu ini."
      : recommendation === "SPK_WITH_SPL"
        ? `Perlu tambahan lembur sekitar ${overtimeNeed.toFixed(0)} jam.`
        : "Aman dikerjakan dengan jam normal.";

  return (
    <div className={`border ${style.border} ${style.bg}`}>
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
            {unit.unitName}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-white/30">
            {unit.divisionName} · {unit.customerName ?? "Customer belum diisi"} · {priorityLabel}
          </p>
        </div>
        <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${style.badge}`}>
          {style.icon} {statusLabel}
        </span>
      </div>

      <div className="px-4 pb-3 text-[12px] text-gray-700 dark:text-white/65">
        {decisionSummary}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3">
        {[
          {
            label: "Target jam",
            value: entry.isHold ? "Ditunda" : `${entry.targetHours.toFixed(0)} jam`,
          },
          {
            label: "Kapasitas tersedia",
            value: `${unit.availableCapacityHours.toFixed(0)} jam`,
          },
          {
            label: "Perkiraan aman",
            value: !safeFinish
              ? "Kalender belum siap"
              : safeFinish.safeFinishDayName
              ? `${safeFinish.safeFinishDayName} (${safeFinish.safeDays} hari)`
              : `${safeFinish.safeDays} hari kerja`,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="border border-white/60 bg-white px-3 py-2 dark:border-white/[0.05] dark:bg-[#111114]"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
              {m.label}
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-medium text-gray-800 dark:text-white/80">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* SPL warning */}
      {overtimeNeed > 0 && recommendation === "SPK_WITH_SPL" && (
        <div className="mx-4 mb-3 border border-amber-500/25 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          Butuh lembur sekitar{" "}
          <span className="font-semibold">{overtimeNeed.toFixed(0)} jam</span>. Target ini perlu
          ditindaklanjuti ke proses SPL setelah SPK dirilis.
        </div>
      )}

      {isTargetTooTight && (
        <div className="mx-4 mb-3 border border-red-500/25 px-3 py-2 text-[11px] text-red-600 dark:text-red-300">
          Target terlalu mepet. Permintaan selesai {requestedFinishLabel}, sedangkan prediksi aman
          {` ${safeFinish?.safeFinishDate ?? "-"}`}.
        </div>
      )}

      <div className="mx-4 mb-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="border border-white/60 bg-white px-3 py-2 dark:border-white/[0.05] dark:bg-[#111114]">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
            Target selesai diminta
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-gray-800 dark:text-white/80">
            {requestedFinishLabel}
          </p>
        </div>
        <div className="border border-white/60 bg-white px-3 py-2 dark:border-white/[0.05] dark:bg-[#111114]">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
            Risiko delivery
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-gray-800 dark:text-white/80">
            {formatRiskLabel(entry.riskLevel)}
          </p>
        </div>
      </div>

      {entry.targetOutput && (
        <div className="mx-4 mb-3 text-[11px] text-gray-600 dark:text-white/50">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 dark:text-white/25">
            Output minggu ini:
          </span>{" "}
          {entry.targetOutput}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={onRevise}
          className="inline-flex h-7 items-center gap-1.5 border border-gray-300 px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50"
        >
          Ubah Target
        </button>
      </div>
    </div>
  );
}

export function ReviewReleaseStep({
  units,
  onReleaseAll,
  onSaveDraft,
  onCreateOvertimeRecommendation,
  onCancel,
  onBack,
  isSaving,
  message,
  errorMessage,
  setMessage,
  setErrorMessage,
  canManage,
}: ReviewReleaseStepProps) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showSpkDialog, setShowSpkDialog] = useState(false);
  const [showSplDialog, setShowSplDialog] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"draft" | "release" | null>(null);

  const hasAnyUnit = units.length > 0;
  const allHold = units.every(
    (u) => u.entry.isHold,
  );
  const anyOverload = units.some(
    (u) =>
      !u.entry.isHold &&
      u.entry.targetHours > u.availableCapacityHours,
  );

  const overloadDivisions = Array.from(
    units
      .filter((u) => !u.entry.isHold && u.entry.targetHours > u.availableCapacityHours)
      .reduce<
        Map<number, { divisionId: number; divisionName: string; shortageHours: number }>
      >((map, unit) => {
        const shortageHours = unit.entry.targetHours - unit.availableCapacityHours;
        const current = map.get(unit.entry.divisionId);
        if (current) {
          current.shortageHours += shortageHours;
          return map;
        }

        map.set(unit.entry.divisionId, {
          divisionId: unit.entry.divisionId,
          divisionName: unit.divisionName,
          shortageHours,
        });
        return map;
      }, new Map())
      .values(),
  ).map((item) => ({
    ...item,
    shortageHours: Number(item.shortageHours.toFixed(2)),
  }));

  async function handleConfirmRelease() {
    setIsReleasing(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const targetEntries = units.map((u) => u.entry);
      const result = await onReleaseAll(targetEntries);
      if (result.success) {
        setShowSpkDialog(false);
        setLastAction("release");
        setMessage(result.message);
        router.refresh();
        if (anyOverload && result.planningTargetId) {
          setActiveTargetId(result.planningTargetId);
          setShowSplDialog(true);
        }
      } else {
        setShowSpkDialog(false);
        setErrorMessage(result.message);
      }
    } finally {
      setIsReleasing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
          Langkah 5
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
          Review & Rilis
        </h2>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-white/40">
          Cek keputusan akhir per unit. Kalau sudah pas, rilis SPK. Kalau masih mepet, kembali ubah
          target dulu.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-[#111114]">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
            Unit Direview
          </p>
          <p className="mt-2 font-mono text-[18px] font-semibold text-gray-900 dark:text-white">
            {units.length}
          </p>
        </div>
        <div className="border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-[#111114]">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
            Butuh SPL
          </p>
          <p className="mt-2 font-mono text-[18px] font-semibold text-amber-700 dark:text-amber-300">
            {overloadDivisions.length}
          </p>
        </div>
        <div className="border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-[#111114]">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
            Status Aksi
          </p>
          <p className="mt-2 text-[13px] font-medium text-gray-700 dark:text-white/70">
            {allHold ? "Semua unit ditunda" : canManage ? "Siap dirilis" : "Baca saja"}
          </p>
        </div>
      </div>

      {/* Summary warnings */}
      {anyOverload && (
        <div className="border border-amber-500/25 bg-amber-500/[0.04] px-4 py-3 text-[12px] text-amber-700 dark:text-amber-300">
          ⚠️ Ada target yang butuh lembur. SPK tetap bisa dirilis, lalu lanjutkan ke proses SPL.
        </div>
      )}

      {/* Unit review cards */}
      {!hasAnyUnit ? (
        <EmptyRow message="Belum ada target yang diisi. Kembali ke langkah sebelumnya." />
      ) : (
        <div className="space-y-3">
          {units.map((unit) => (
            <ReviewUnitCard
              key={unit.entry.id}
              unit={unit}
              onRevise={onBack}
            />
          ))}
        </div>
      )}

      {/* Feedback messages */}
      {message && (
        <div className="flex flex-col gap-2 border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-2.5 text-[12px] text-emerald-700 dark:text-emerald-300">
          <span>{message}</span>
          {lastAction === "release" ? (
            <Link
              href={`/spk?date=${units[0]?.startDate || ""}`}
              className="inline-flex max-w-fit items-center gap-1 font-semibold text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Lihat SPK yang Dibuat ↗
            </Link>
          ) : null}
          <Link
            href={`/planning/evaluation?date=${units[0]?.startDate || ""}`}
            className="inline-flex max-w-fit items-center gap-1 font-semibold text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Buka Review Plan ↗
          </Link>
        </div>
      )}
      {errorMessage && (
        <div className="border border-red-500/25 bg-red-500/[0.05] px-4 py-2.5 text-[12px] text-red-600 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-2 border border-gray-300 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/55"
          >
            ← Ubah Target
          </button>

          <button
            type="button"
            onClick={async () => {
              setLastAction("draft");
              await onSaveDraft();
            }}
            disabled={isSaving || !hasAnyUnit}
            className="inline-flex h-10 items-center gap-2 border border-gray-300 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:text-white/55"
          >
            {isSaving ? "Menyimpan..." : "Simpan Draft"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {confirmCancel ? (
            <>
              <span className="text-[11px] text-red-500 dark:text-red-400">
                Yakin batalkan planning?
              </span>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center gap-2 border border-red-500/30 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                Ya, Batalkan
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="inline-flex h-10 items-center border border-gray-300 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:border-white/[0.08] dark:text-white/55"
              >
                Tidak
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex h-10 items-center border border-red-500/20 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-red-500/70 transition-colors hover:border-red-500/40 hover:text-red-600 dark:text-red-400/60"
            >
              Batalkan Planning
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!canManage) {
                setErrorMessage("Anda tidak memiliki izin untuk merilis SPK.");
                return;
              }
              setShowSpkDialog(true);
            }}
            disabled={!hasAnyUnit || allHold}
            className="inline-flex h-10 items-center gap-2 border border-amber-500/40 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.16] disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
          >
            🚀 Rilis Semua SPK
          </button>
        </div>
      </div>

      <SpkReleaseDialog
        isOpen={showSpkDialog}
        onClose={() => setShowSpkDialog(false)}
        onConfirm={handleConfirmRelease}
        isReleasing={isReleasing}
        unitCount={units.filter(u => !u.entry.isHold).length}
        anyOverload={anyOverload}
      />

      {activeTargetId && (
        <SplRecommendationDialog
          isOpen={showSplDialog}
          onClose={() => setShowSplDialog(false)}
          planningTargetId={activeTargetId}
          overloadDivisions={overloadDivisions}
          onSubmit={async (inputs) => {
            const res = await onCreateOvertimeRecommendation(inputs);
            if (res.success) {
              setMessage("Rekomendasi SPL berhasil disimpan.");
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
