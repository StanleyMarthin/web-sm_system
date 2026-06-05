"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

/**
 * Planning Work Control Shell — wizard utama 5 step.
 *
 * Menggantikan WeeklyPlanShell untuk tab "Work Control".
 *
 * Data flow:
 * 1. selectedUnitIds — dipilih PM/KP di Step 1
 * 2. unitProgressData — di-fetch dari API per unit yang dipilih
 * 3. divisionCapacity — dari data existing (snapshotWeeklyPlanAbsence)
 * 4. targetEntries — diisi PM/KP di Step 4
 * 5. Rilis SPK — panggil backend; SPL recommendation dibuat otomatis
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlanningStepHeader } from "./planning-step-header";
import { UnitPriorityStep } from "./unit-priority-step";
import { UnitProgressStep } from "./unit-progress-step";
import { DivisionCapacityStep } from "./division-capacity-step";
import { TargetWorkStep } from "./target-work-step";
import { ReviewReleaseStep } from "./review-release-step";
import type { UnitPriorityItem } from "./unit-priority-step";
import type { UnitProgressData } from "./unit-progress-step";
import type { DivisionCapacityData } from "./division-capacity-step";
import type { TargetWorkEntry } from "./target-work-step";
import type { ReviewUnit } from "./review-release-step";

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface PlanningSummaryCardItem {
  label: string;
  value: string | number;
  tone?: "warn" | "ok" | "danger" | "muted";
}

interface PlanningWorkControlShellProps {
  weekStartDate: string;
  /** List semua unit aktif untuk step 1 */
  units: UnitPriorityItem[];
  /** Progress per unit — sudah difilter sesuai selectedIds (di-fetch client-side) */
  unitProgressData: UnitProgressData[];
  /** Kapasitas divisi — dari data existing */
  divisionCapacity: DivisionCapacityData[];
  /** Callback: fetch progress untuk unit yang dipilih */
  onFetchProgress: (unitIds: string[]) => Promise<void>;
  /** Callback: snapshot absensi (reuse snapshotWeeklyPlanAbsence) */
  onSnapshotAbsence: () => Promise<void>;
  /**
   * Callback: rilis SPK
   * Mengembalikan { success, spkIds, planningTargetId } jika berhasil
   */
  onReleaseSpk: (entries: TargetWorkEntry[]) => Promise<{ success: boolean; message: string; planningTargetId?: string }>;
  /** Callback: simpan draft planning */
  onSaveDraft: (entries: TargetWorkEntry[]) => Promise<{ success: boolean; message: string }>;
  /** Callback: buat rekomendasi lembur */
  onCreateOvertimeRecommendation: (inputs: { planningTargetId: string; divisionId: string; shortageHours: number; reason: string }[]) => Promise<{ success: boolean; message: string }>;
  /** Reset state draft saat user membatalkan atau mengganti planning */
  onResetDraft: () => void;
  canManage: boolean;
  isLoadingUnits?: boolean;
  isLoadingProgress?: boolean;
  isSnapshoting?: boolean;
}

function SummaryCards({ items }: { items: PlanningSummaryCardItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => {
        const textColor =
          item.tone === "ok"
            ? "text-emerald-400"
            : item.tone === "warn"
              ? "text-amber-500"
              : item.tone === "danger"
                ? "text-red-400"
                : item.tone === "muted"
                  ? "text-white/30"
                  : "text-white/80";

        return (
          <div
            key={item.label}
            className="border border-white/5 bg-[#111114] px-4 py-3"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              {item.label}
            </p>
            <p className={`mt-1 font-mono text-[20px] font-semibold tabular-nums ${textColor}`}>
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PlanningWorkControlShell({
  weekStartDate,
  units,
  unitProgressData,
  divisionCapacity,
  onFetchProgress,
  onSnapshotAbsence,
  onReleaseSpk,
  onSaveDraft,
  onCreateOvertimeRecommendation,
  onResetDraft,
  canManage,
  isLoadingUnits,
  isLoadingProgress,
  isSnapshoting,
}: PlanningWorkControlShellProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<WizardStep>(1);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [targetEntries, setTargetEntries] = useState<TargetWorkEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const selectedIds = new Set(selectedUnitIds);
    setTargetEntries((current) => current.filter((entry) => selectedIds.has(entry.carId)));
  }, [selectedUnitIds]);

  function goToStep(nextStep: WizardStep) {
    setStep(nextStep);
    if (nextStep > maxReachedStep) {
      setMaxReachedStep(nextStep);
    }
    setMessage(null);
    setErrorMessage(null);
  }

  function handleSelectionChange(nextIds: string[]) {
    const currentKey = [...selectedUnitIds].sort().join("|");
    const nextKey = [...nextIds].sort().join("|");
    if (currentKey !== nextKey) {
      onResetDraft();
      setTargetEntries([]);
      if (step > 1) {
        setMaxReachedStep(1);
        setStep(1);
      }
      setMessage(null);
      setErrorMessage(null);
    }
    setSelectedUnitIds(nextIds);
  }

  const handleNext = useCallback(async () => {
    if (step === 1) {
      if (selectedUnitIds.length === 0) return;
      await onFetchProgress(selectedUnitIds);
      goToStep(2);
    } else if (step === 2) {
      goToStep(3);
    } else if (step === 3) {
      goToStep(4);
    } else if (step === 4) {
      goToStep(5);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedUnitIds]);

  function handleBack() {
    if (step > 1) {
      goToStep((step - 1) as WizardStep);
    }
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const result = await onSaveDraft(targetEntries);
      if (result.success) {
        setMessage(result.message);
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  // handleReleaseAll is now handled inside ReviewReleaseStep
  // removing it from here.

  // Computed summary card values
  const selectedUnits = units.filter((u) => selectedUnitIds.includes(u.carId));
  const totalTargetHours = targetEntries.reduce((sum, e) => sum + e.targetHours, 0);
  const totalAvailableCapacity = divisionCapacity.reduce(
    (sum, d) => sum + d.availableCapacityHours,
    0,
  );
  const totalTargetByDivision = targetEntries.reduce<Record<number, number>>((accumulator, entry) => {
    accumulator[entry.divisionId] = (accumulator[entry.divisionId] ?? 0) + entry.targetHours;
    return accumulator;
  }, {});
  const totalOvertimeNeed = divisionCapacity.reduce((sum, division) => {
    const targetHours = totalTargetByDivision[division.divisionId] ?? 0;
    return sum + Math.max(0, targetHours - division.availableCapacityHours);
  }, 0);
  const hasHighRisk = selectedUnits.some(
    (u) => u.riskLevel === "HIGH" || u.riskLevel === "CRITICAL",
  );

  const summaryItems: PlanningSummaryCardItem[] = [
    {
      label: "Unit Dipilih",
      value: selectedUnitIds.length,
      tone: selectedUnitIds.length > 0 ? "ok" : "muted",
    },
    {
      label: "Total Target Jam",
      value: totalTargetHours > 0 ? `${totalTargetHours.toFixed(0)} jam` : "—",
      tone: totalTargetHours > 0 ? undefined : "muted",
    },
    {
      label: "Kapasitas Tersedia",
      value:
        totalAvailableCapacity > 0
          ? `${totalAvailableCapacity.toFixed(0)} jam`
          : "—",
      tone: totalAvailableCapacity > 0 ? undefined : "muted",
    },
    {
      label: "Perlu Lembur",
      value: totalOvertimeNeed > 0 ? `${totalOvertimeNeed.toFixed(0)} jam` : "Tidak perlu",
      tone: totalOvertimeNeed > 0 ? "warn" : "ok",
    },
    {
      label: "Risiko Delivery",
      value: hasHighRisk ? "Tinggi" : selectedUnitIds.length > 0 ? "Normal" : "—",
      tone: hasHighRisk ? "danger" : selectedUnitIds.length > 0 ? "ok" : "muted",
    },
  ];

  // Build divisionOptions for TargetWorkStep
  const divisionOptions = divisionCapacity.map((d) => ({
    divisionId: d.divisionId,
    divisionName: d.divisionName,
    availableCapacityHours: d.availableCapacityHours,
  }));

  // Build targetWorkUnits for TargetWorkStep
  const targetWorkUnits = unitProgressData.map((u) => ({
    carId: u.carId,
    unitName: u.unitName,
    customerName: u.customerName,
    involvedDivisions: u.involvedDivisions.map((d) => ({
      divisionId: d.divisionId,
      pendingHours: d.remainingHours,
    })),
    riskLevel: u.riskLevel,
    suggestedFinishDate: u.targetDeliveryDate,
  }));

  // Build reviewUnits for ReviewReleaseStep
  const reviewUnits: ReviewUnit[] = targetEntries
    .map((entry) => {
      const progressUnit = unitProgressData.find((u) => u.carId === entry.carId);
      const divCap = divisionCapacity.find((d) => d.divisionId === entry.divisionId);
      if (!progressUnit || !divCap) return null;
      const dailyCap =
        divCap.availableCapacityHours > 0 ? divCap.availableCapacityHours / 5 : 8;
      return {
        carId: entry.carId,
        unitName: progressUnit.unitName,
        customerName: progressUnit.customerName,
        entry,
        divisionName: divCap.divisionName,
        availableCapacityHours: divCap.availableCapacityHours,
        remainingHours: progressUnit.remainingHours,
        startDate: weekStartDate,
        dailyCapacityHours: dailyCap,
      } satisfies ReviewUnit;
    })
    .filter((u): u is ReviewUnit => u !== null);

  // Target hours per division map (for capacity step status badges)
  const targetHoursPerDivision = totalTargetByDivision;

  const periodLabel = `Minggu mulai ${weekStartDate}`;

  return (
    <div className="space-y-4">
      <section className="border border-white/5 bg-[#111114] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
            Work Control
          </p>
          <h2 className="text-[13px] font-mono text-white/80">
            Susun Prioritas Kerja
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
            {periodLabel}
          </span>
          {!canManage && (
            <span className="border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-500">
              Mode baca saja
            </span>
          )}
        </div>
      </section>

      {/* Summary cards */}
      <SummaryCards items={summaryItems} />

      {/* Step indicator */}
      <PlanningStepHeader
        currentStep={step}
        maxReachedStep={maxReachedStep}
        onStepClick={(s) => {
          if (s <= maxReachedStep) goToStep(s);
        }}
      />

      {/* Step content */}
      {step === 1 && (
        <UnitPriorityStep
          units={units}
          selectedIds={selectedUnitIds}
          onSelectionChange={handleSelectionChange}
          onNext={() => void handleNext()}
          isLoading={isLoadingUnits}
        />
      )}

      {step === 2 && (
        <UnitProgressStep
          units={unitProgressData}
          onNext={() => void handleNext()}
          onBack={handleBack}
          isLoading={isLoadingProgress}
        />
      )}

      {step === 3 && (
        <DivisionCapacityStep
          divisions={divisionCapacity}
          periodLabel={periodLabel}
          onSnapshotAbsence={onSnapshotAbsence}
          onNext={() => void handleNext()}
          onBack={handleBack}
          isSnapshoting={isSnapshoting}
          targetHoursPerDivision={targetHoursPerDivision}
        />
      )}

      {step === 4 && (
        <TargetWorkStep
          units={targetWorkUnits}
          divisionOptions={divisionOptions}
          entries={targetEntries}
          defaultFinishDate={new Date(new Date(weekStartDate).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
          onEntriesChange={setTargetEntries}
          onNext={() => void handleNext()}
          onBack={handleBack}
        />
      )}

      {step === 5 && (
        <ReviewReleaseStep
          units={reviewUnits}
          onReleaseAll={onReleaseSpk}
          onCreateOvertimeRecommendation={onCreateOvertimeRecommendation}
          onSaveDraft={handleSaveDraft}
          onCancel={() => {
            onResetDraft();
            setSelectedUnitIds([]);
            setTargetEntries([]);
            setMaxReachedStep(1);
            goToStep(1);
          }}
          onBack={handleBack}
          isSaving={isSaving}
          message={message}
          errorMessage={errorMessage}
          setMessage={setMessage}
          setErrorMessage={setErrorMessage}
          canManage={canManage}
        />
      )}
    </div>
  );
}
