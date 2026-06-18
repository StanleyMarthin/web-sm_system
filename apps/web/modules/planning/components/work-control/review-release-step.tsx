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
        border: "border-success/25",
        bg: "bg-success/[0.04]",
        badge: "border-success/30 text-success dark:text-success",
        icon: "✅",
      };
    case "SPK_WITH_SPL":
      return {
        border: "border-primary/25",
        bg: "bg-primary/[0.04]",
        badge: "border-primary/30 text-app-accent-ink dark:text-app-accent-ink",
        icon: "⚠️",
      };
    case "HOLD":
      return {
        border: "border-destructive/25",
        bg: "bg-destructive/[0.04]",
        badge: "border-destructive/30 text-destructive dark:text-destructive",
        icon: "🚫",
      };
    case "REVISE_TARGET":
      return {
        border: "border-border",
        bg: "bg-muted dark:bg-muted",
        badge: "border-border text-muted-foreground dark:border-border dark:text-muted-foreground",
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
          <p className="text-[15px] font-semibold text-foreground dark:text-foreground">
            {unit.unitName}
          </p>
          <p className="mt-0.5 font-mono text-[14px] text-muted-foreground dark:text-muted-foreground">
            {unit.divisionName} · {unit.customerName ?? "Customer belum diisi"} · {priorityLabel}
          </p>
        </div>
        <span className={`border px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.1em] ${style.badge}`}>
          {style.icon} {statusLabel}
        </span>
      </div>

      <div className="px-4 pb-3 text-[14px] text-foreground dark:text-foreground">
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
            className="border border-border bg-card px-3 py-2 dark:border-border dark:bg-card"
          >
            <p className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground dark:text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-0.5 font-mono text-[14px] font-medium text-foreground dark:text-foreground">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* SPL warning */}
      {overtimeNeed > 0 && recommendation === "SPK_WITH_SPL" && (
        <div className="mx-4 mb-3 border border-primary/25 px-3 py-2 text-[15px] text-app-accent-ink dark:text-app-accent-ink">
          Butuh lembur sekitar{" "}
          <span className="font-semibold">{overtimeNeed.toFixed(0)} jam</span>. Target ini perlu
          ditindaklanjuti ke proses SPL setelah SPK dirilis.
        </div>
      )}

      {isTargetTooTight && (
        <div className="mx-4 mb-3 border border-destructive/25 px-3 py-2 text-[15px] text-destructive dark:text-destructive">
          Target terlalu mepet. Permintaan selesai {requestedFinishLabel}, sedangkan prediksi aman
          {` ${safeFinish?.safeFinishDate ?? "-"}`}.
        </div>
      )}

      <div className="mx-4 mb-3 grid gap-2 text-[15px] sm:grid-cols-2">
        <div className="border border-border bg-card px-3 py-2 dark:border-border dark:bg-card">
          <p className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground dark:text-muted-foreground">
            Target selesai diminta
          </p>
          <p className="mt-0.5 font-mono text-[14px] text-foreground dark:text-foreground">
            {requestedFinishLabel}
          </p>
        </div>
        <div className="border border-border bg-card px-3 py-2 dark:border-border dark:bg-card">
          <p className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground dark:text-muted-foreground">
            Risiko delivery
          </p>
          <p className="mt-0.5 font-mono text-[14px] text-foreground dark:text-foreground">
            {formatRiskLabel(entry.riskLevel)}
          </p>
        </div>
      </div>

      {entry.targetOutput && (
        <div className="mx-4 mb-3 text-[15px] text-muted-foreground dark:text-muted-foreground">
          <span className="font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground dark:text-muted-foreground">
            Output minggu ini:
          </span>{" "}
          {entry.targetOutput}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 dark:border-border">
        <button
          type="button"
          onClick={onRevise}
          className="inline-flex h-7 items-center gap-1.5 border border-border px-3 font-mono text-[14px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-muted dark:border-border dark:text-muted-foreground"
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
      <div className="border border-border bg-card px-4 py-4 dark:border-border dark:bg-card">
        <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
          Langkah 5
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-foreground dark:text-foreground">
          Review & Rilis
        </h2>
        <p className="mt-1 text-[14px] text-muted-foreground dark:text-muted-foreground">
          Cek keputusan akhir per unit. Kalau sudah pas, rilis SPK. Kalau masih mepet, kembali ubah
          target dulu.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="border border-border bg-card px-4 py-3 dark:border-border dark:bg-card">
          <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
            Unit Direview
          </p>
          <p className="mt-2 font-mono text-[18px] font-semibold text-foreground dark:text-foreground">
            {units.length}
          </p>
        </div>
        <div className="border border-border bg-card px-4 py-3 dark:border-border dark:bg-card">
          <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
            Butuh SPL
          </p>
          <p className="mt-2 font-mono text-[18px] font-semibold text-app-accent-ink dark:text-app-accent-ink">
            {overloadDivisions.length}
          </p>
        </div>
        <div className="border border-border bg-card px-4 py-3 dark:border-border dark:bg-card">
          <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
            Status Aksi
          </p>
          <p className="mt-2 text-[15px] font-medium text-foreground dark:text-foreground">
            {allHold ? "Semua unit ditunda" : canManage ? "Siap dirilis" : "Baca saja"}
          </p>
        </div>
      </div>

      {/* Summary warnings */}
      {anyOverload && (
        <div className="border border-primary/25 bg-primary/[0.04] px-4 py-3 text-[14px] text-app-accent-ink dark:text-app-accent-ink">
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
        <div className="flex flex-col gap-2 border border-success/25 bg-success/[0.05] px-4 py-2.5 text-[14px] text-success dark:text-success">
          <span>{message}</span>
          {lastAction === "release" ? (
            <Link
              href={`/spk?date=${units[0]?.startDate || ""}`}
              className="inline-flex max-w-fit items-center gap-1 font-semibold text-success underline hover:text-success dark:text-success dark:hover:text-success"
            >
              Lihat SPK yang Dibuat ↗
            </Link>
          ) : null}
          <Link
            href={`/planning/evaluation?date=${units[0]?.startDate || ""}`}
            className="inline-flex max-w-fit items-center gap-1 font-semibold text-success underline hover:text-success dark:text-success dark:hover:text-success"
          >
            Buka Review Plan ↗
          </Link>
        </div>
      )}
      {errorMessage && (
        <div className="border border-destructive/25 bg-destructive/[0.05] px-4 py-2.5 text-[14px] text-destructive dark:text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-4 dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-2 border border-border px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted dark:border-border dark:text-muted-foreground"
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
            className="inline-flex h-10 items-center gap-2 border border-border px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:text-muted-foreground"
          >
            {isSaving ? "Menyimpan..." : "Simpan Draft"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {confirmCancel ? (
            <>
              <span className="text-[15px] text-destructive dark:text-destructive">
                Yakin batalkan planning?
              </span>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center gap-2 border border-destructive/30 px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/10 dark:text-destructive"
              >
                Ya, Batalkan
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="inline-flex h-10 items-center border border-border px-3 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:border-border dark:text-muted-foreground"
              >
                Tidak
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex h-10 items-center border border-destructive/20 px-3 font-mono text-[14px] uppercase tracking-[0.12em] text-destructive/70 transition-colors hover:border-destructive/40 hover:text-destructive dark:text-destructive/60"
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
            className="inline-flex h-10 items-center gap-2 border border-primary/40 bg-primary/[0.08] px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/[0.16] disabled:cursor-not-allowed disabled:opacity-40 dark:text-app-accent-ink"
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
