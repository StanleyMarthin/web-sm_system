"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · tone: utilitarian · designed-as-app */

import { useState, useEffect } from "react";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import { AdaptiveAssessmentTab } from "./adaptive-assessment-tab";
import { AdaptiveDashboardTab } from "./adaptive-dashboard-tab";
import { BomPlanningPanel } from "./bom-planning-panel";
import { CriticalPathPanel } from "./critical-path-panel";
import { DivisionCapacityStep } from "./division-capacity-step";
import { LabourControlPanel } from "./labour-control-panel";
import { PlanningStepHeader } from "./planning-step-header";
import { ReviewReleaseStep } from "./review-release-step";
import { ServiceIntakePage } from "./service-intake-page";
import { buildAutoPlanEntries, isTargetEntryComplete, TargetWorkStep } from "./target-work-step";
import { UnitPriorityStep } from "./unit-priority-step";
import { UnitProgressStep } from "./unit-progress-step";
import { applyWarrantyImpact, buildAssessmentCase, buildDeliveryPrediction, buildRecalculationLog, buildSpkSplDecision, computeReadyBlockedHours, type AssessmentOverrideState, type ReadyBlockedHours } from "@/modules/planning/helpers/adaptive-planner";
import { buildBomPlanningSnapshots, buildLabourSummary, calculateCriticalPath, summarizeLabourByDivision, type CriticalPathJobInput } from "@/modules/planning/helpers/operational-planning";
import type { AssessmentItemKey, CriticalPathResult, DeliveryPrediction, RecalculationLog } from "@/modules/planning/types/planning.types";
import { saveCriticalPathSnapshot, saveLabourOverride } from "@/shared/api/work-control";
import type { DivisionCapacityData } from "./division-capacity-step";
import type { ReviewUnit } from "./review-release-step";
import type { TargetWorkEntry } from "./target-work-step";
import type { UnitPriorityItem } from "./unit-priority-step";
import type { UnitProgressData } from "./unit-progress-step";

type WizardStep = 1 | 2 | 3 | 4 | 5;
type AdaptiveView = "dashboard" | "assessment" | "planner" | "service";

interface PlanningWorkControlShellProps {
  weekStartDate: string;
  units: UnitPriorityItem[];
  unitProgressData: UnitProgressData[];
  divisionCapacity: DivisionCapacityData[];
  onFetchProgress: (unitIds: string[]) => Promise<void>;
  onSnapshotAbsence: () => Promise<void>;
  onReleaseSpk: (entries: TargetWorkEntry[]) => Promise<{ success: boolean; message: string; planningTargetId?: string }>;
  onSaveDraft: (entries: TargetWorkEntry[]) => Promise<{ success: boolean; message: string }>;
  onCreateOvertimeRecommendation: (inputs: { planningTargetId: string; divisionId: string; shortageHours: number; reason: string }[]) => Promise<{ success: boolean; message: string }>;
  onResetDraft: () => void;
  unitBomById: Record<string, UnitBomWorkspace | null>;
  canManage: boolean;
  qcBufferDays: number;
  workingDayNumbers: number[];
  isLoadingUnits?: boolean;
  isLoadingProgress?: boolean;
  isSnapshoting?: boolean;
}

function emptyReadyBlocked(): ReadyBlockedHours {
  return {
    readyHours: 0,
    blockedHours: 0,
    waitingMaterialHours: 0,
    waitingVendorHours: 0,
    waitingOtherDivisionHours: 0,
  };
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
  unitBomById,
  canManage,
  qcBufferDays,
  workingDayNumbers,
  isLoadingUnits,
  isLoadingProgress,
  isSnapshoting,
}: PlanningWorkControlShellProps) {
  const [adaptiveView, setAdaptiveView] = useState<AdaptiveView>("planner");
  const [step, setStep] = useState<WizardStep>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<WizardStep>(1);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedAssessmentUnitId, setSelectedAssessmentUnitId] = useState<string | null>(null);
  const [targetEntries, setTargetEntries] = useState<TargetWorkEntry[]>([]);
  const [assessmentOverrides, setAssessmentOverrides] = useState<Record<string, AssessmentOverrideState>>({});
  const [warrantyInputByDivision, setWarrantyInputByDivision] = useState<Record<string, number>>({});
  const [labourOverrideByUnit, setLabourOverrideByUnit] = useState<Record<string, {
    billableHours: number;
    warrantyHours: number;
  }>>({});
  const [recalculationLogs, setRecalculationLogs] = useState<RecalculationLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);

  useEffect(() => {
    const selectedIds = new Set(selectedUnitIds);
    setTargetEntries((current) => current.filter((entry) => selectedIds.has(entry.carId)));
    setSelectedAssessmentUnitId((current) => (current && selectedIds.has(current) ? current : selectedUnitIds[0] ?? null));
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
      setAssessmentOverrides({});
      setWarrantyInputByDivision({});
      setLabourOverrideByUnit({});
      setRecalculationLogs([]);
      if (step > 1) {
        setMaxReachedStep(1);
        setStep(1);
      }
      setMessage(null);
      setErrorMessage(null);
    }
    setSelectedUnitIds(nextIds);
  }

  async function handleNext() {
    if (step === 1) {
      if (selectedUnitIds.length === 0) return;
      setIsPreparingPlan(true);
      await onFetchProgress(selectedUnitIds);
      goToStep(2);
    } else if (step === 2) {
      goToStep(3);
    } else if (step === 3) {
      goToStep(4);
    } else if (step === 4) {
      goToStep(5);
    }
  }

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

  const selectedProgressUnits = unitProgressData.filter((unit) => selectedUnitIds.includes(unit.carId));
  const readyBlockedByUnit = selectedProgressUnits.reduce<Record<string, ReadyBlockedHours>>((accumulator, unit) => {
    accumulator[unit.carId] = computeReadyBlockedHours(unitBomById[unit.carId] ?? null);
    return accumulator;
  }, {});

  const readyBlockedByDivision = selectedProgressUnits.reduce<Record<number, ReadyBlockedHours>>((accumulator, unit) => {
    const unitReadyBlocked = readyBlockedByUnit[unit.carId] ?? emptyReadyBlocked();
    for (const division of unit.involvedDivisions) {
      const current = accumulator[division.divisionId] ?? emptyReadyBlocked();
      const ratio = unit.remainingHours > 0 ? division.remainingHours / unit.remainingHours : 0;
      accumulator[division.divisionId] = {
        readyHours: Number((current.readyHours + (unitReadyBlocked.readyHours * ratio)).toFixed(2)),
        blockedHours: Number((current.blockedHours + (unitReadyBlocked.blockedHours * ratio)).toFixed(2)),
        waitingMaterialHours: Number((current.waitingMaterialHours + (unitReadyBlocked.waitingMaterialHours * ratio)).toFixed(2)),
        waitingVendorHours: Number((current.waitingVendorHours + (unitReadyBlocked.waitingVendorHours * ratio)).toFixed(2)),
        waitingOtherDivisionHours: Number((current.waitingOtherDivisionHours + (unitReadyBlocked.waitingOtherDivisionHours * ratio)).toFixed(2)),
      };
    }
    return accumulator;
  }, {});

  const bomPlanningSnapshots = selectedProgressUnits.flatMap((unit) =>
    buildBomPlanningSnapshots(unitBomById[unit.carId] ?? null),
  );

  const assessmentCases = selectedProgressUnits.map((unit) =>
    buildAssessmentCase(
      {
        carId: unit.carId,
        unitName: unit.unitName,
        customerName: unit.customerName,
        remainingHours: unit.remainingHours,
        riskLevel: unit.riskLevel,
      },
      unitBomById[unit.carId] ?? null,
      assessmentOverrides[unit.carId],
    ),
  );

  const periodLabel = `Minggu mulai ${weekStartDate}`;
  const periodEnd = new Date(new Date(weekStartDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { snapshots: adaptiveCapacitySnapshots, impacts: warrantyImpacts } = applyWarrantyImpact(
    divisionCapacity,
    readyBlockedByDivision,
    Object.entries(warrantyInputByDivision).map(([divisionId, hours]) => ({
      divisionId: Number(divisionId),
      hours,
    })),
    weekStartDate,
    periodEnd,
  );

  const criticalPathByUnit = selectedProgressUnits.reduce<Record<string, CriticalPathResult | null>>((accumulator, unit) => {
    const planningStartDate = new Date(`${weekStartDate}T00:00:00.000Z`);
    const jobs: CriticalPathJobInput[] = unit.jobs
      .filter((job) => job.status !== "DONE" && (job.divisionId ?? unit.involvedDivisions[0]?.divisionId))
      .map((job) => {
        const divisionId = job.divisionId ?? String(unit.involvedDivisions[0]?.divisionId);
        const snapshot = adaptiveCapacitySnapshots.find((entry) => entry.divisionId === divisionId);
        const blockedBy = [
          ...(job.qcLastStatus === "TIDAK_LOLOS" ? ["QC_REJECT" as const] : []),
          ...(job.dependsOn.length > 0 ? ["WAITING_DIVISION" as const] : []),
        ];
        return {
          jobId: job.jobId,
          divisionId,
          correctedHours: Math.max(1, job.remainingHours || job.estimatedHours),
          allocatedDailyCapacity: Math.max(4, (snapshot?.availableHours ?? 40) / 5),
          planningStartDate: job.startDate ? new Date(`${job.startDate}T00:00:00.000Z`) : planningStartDate,
          // TODO: replace with real material/vendor available dates when BOM/PR/WOV exposes them.
          materialReadyDate: null,
          vendorReturnDate: null,
          dependsOn: job.dependsOn,
          riskLevel: unit.riskLevel,
          blockedBy,
        };
      });

    try {
      accumulator[unit.carId] = jobs.length > 0 ? calculateCriticalPath(jobs) : null;
    } catch {
      accumulator[unit.carId] = null;
    }
    return accumulator;
  }, {});

  const predictions: Array<{
    unitId: string;
    unitName: string;
    prediction: DeliveryPrediction;
    decision: ReturnType<typeof buildSpkSplDecision>;
  }> = selectedProgressUnits.map((unit) => {
    const targetEntry = targetEntries.find((entry) => entry.carId === unit.carId);
    const firstDivision = unit.involvedDivisions[0];
    const snapshot = adaptiveCapacitySnapshots.find((entry) => entry.divisionId === String(firstDivision?.divisionId ?? ""));
    const assessment = assessmentCases.find((entry) => entry.unitId === unit.carId);
    const readyBlocked = readyBlockedByUnit[unit.carId] ?? emptyReadyBlocked();
    const criticalPath = criticalPathByUnit[unit.carId];
    const fallbackPrediction = buildDeliveryPrediction({
      startDate: weekStartDate,
      remainingHours: targetEntry?.targetHours ?? unit.remainingHours,
      readyHours: readyBlocked.readyHours,
      blockedHours: readyBlocked.blockedHours,
      dailyCapacityHours: Math.max(4, (snapshot?.availableHours ?? 40) / 5),
      riskLevel: unit.riskLevel,
    });
    const prediction = criticalPath
      ? {
          p50: criticalPath.p50Date,
          p80: criticalPath.p80Date,
          p95: criticalPath.p95Date,
          riskLevel: unit.riskLevel,
        }
      : fallbackPrediction;
    return {
      unitId: unit.carId,
      unitName: unit.unitName,
      prediction,
      decision: buildSpkSplDecision({
        targetHours: targetEntry?.targetHours ?? unit.remainingHours,
        availableHours: snapshot?.availableHours ?? 0,
        blockedHours: readyBlocked.blockedHours,
        canCalculate: assessment?.canCalculate ?? false,
      }),
    };
  });

  const totalReadyHours = Object.values(readyBlockedByUnit).reduce((sum, item) => sum + item.readyHours, 0);
  const totalBlockedHours = Object.values(readyBlockedByUnit).reduce((sum, item) => sum + item.blockedHours, 0);
  const totalTargetByDivision = targetEntries.reduce<Record<number, number>>((accumulator, entry) => {
    accumulator[entry.divisionId] = (accumulator[entry.divisionId] ?? 0) + entry.targetHours;
    return accumulator;
  }, {});
  const labourSummaries = selectedProgressUnits.map((unit) =>
    {
      const override = labourOverrideByUnit[unit.carId];
      return buildLabourSummary({
        unitId: unit.carId,
        targetHours: unit.totalEstimatedHours,
        actualHours: unit.actualHours,
        billableHours: override?.billableHours ?? unit.actualHours,
        warrantyHours: override?.warrantyHours ?? 0,
      });
    },
  );
  const labourDivisionRows = summarizeLabourByDivision(
    selectedProgressUnits.flatMap((unit) => unit.involvedDivisions),
  );
  const unitNameById = Object.fromEntries(selectedProgressUnits.map((unit) => [unit.carId, unit.unitName]));
  const selectedCriticalPath = selectedAssessmentUnitId
    ? criticalPathByUnit[selectedAssessmentUnitId] ?? null
    : criticalPathByUnit[selectedProgressUnits[0]?.carId ?? ""] ?? null;
  const criticalPathSnapshotSignature = JSON.stringify(
    Object.entries(criticalPathByUnit)
      .filter(([, result]) => Boolean(result))
      .map(([unitId, result]) => ({
        unitId,
        p50: result?.p50Date.toISOString(),
        p80: result?.p80Date.toISOString(),
        p95: result?.p95Date.toISOString(),
        nodes: result?.nodes.map((node) => ({
          jobId: node.jobId,
          finishDate: node.finishDate.toISOString(),
          isCritical: node.isCritical,
          blockedBy: node.blockedBy,
        })),
      })),
  );
  const jobNamesById = Object.fromEntries(selectedProgressUnits.flatMap((unit) => unit.jobs.map((job) => [job.jobId, job.jobName])));
  const divisionNamesById = Object.fromEntries(
    [
      ...adaptiveCapacitySnapshots.map((division) => [division.divisionId, division.divisionName] as const),
      ...selectedProgressUnits.flatMap((unit) => unit.involvedDivisions.map((division) => [String(division.divisionId), division.divisionName] as const)),
    ],
  );

  const divisionOptions = adaptiveCapacitySnapshots.map((division) => ({
    divisionId: Number(division.divisionId),
    divisionName: division.divisionName,
    availableCapacityHours: division.availableHours,
  }));
  const activeViewCopy = {
    dashboard: {
      title: "Papan Kondisi Minggu Ini",
      help: "Lihat unit yang sedang dikejar, jam yang siap jalan, dan hambatan utama.",
    },
    planner: {
      title: "Pilih Unit dan Atur Target",
      help: "Mulai dari pilih unit, cek kapasitas divisi, isi target jam, lalu review untuk release.",
    },
    assessment: {
      title: "Cek Siap Kerja",
      help: "Pastikan BOM, material, vendor, estimasi jam, dan review KD sudah beres sebelum target dikunci.",
    },
    service: {
      title: "Service Masuk",
      help: "Catat keluhan service, pilih pekerjaan, cek slot divisi, lalu siapkan SPK service.",
    },
  } satisfies Record<AdaptiveView, { title: string; help: string }>;

  const targetWorkUnits = unitProgressData.map((unit) => ({
    carId: unit.carId,
    unitName: unit.unitName,
    customerName: unit.customerName,
    involvedDivisions: unit.involvedDivisions.map((division) => ({
      divisionId: division.divisionId,
      pendingHours: division.remainingHours,
    })),
    riskLevel: unit.riskLevel,
    suggestedFinishDate: unit.targetDeliveryDate,
    jobs: unit.jobs.map((job) => ({
      jobId: job.jobId,
      divisionId: job.divisionId,
      divisionName: job.divisionName,
      jobName: job.jobName,
      panel: job.panel,
      status: job.status,
      remainingHours: job.remainingHours,
      estimatedHours: job.estimatedHours,
      deadlineDate: job.deadlineDate,
      dependsOn: job.dependsOn,
      qcLastStatus: job.qcLastStatus,
    })),
  }));

  useEffect(() => {
    if (!isPreparingPlan || isLoadingProgress) return;

    const selectedTargetUnits = targetWorkUnits.filter((unit) => selectedUnitIds.includes(unit.carId));
    if (selectedTargetUnits.length !== selectedUnitIds.length) {
      setIsPreparingPlan(false);
      return;
    }

    const defaultFinishDate = new Date(
      new Date(weekStartDate).getTime() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString().split("T")[0];
    const autoEntries = selectedTargetUnits.flatMap((unit) => buildAutoPlanEntries(unit, defaultFinishDate));
    const nextStep = autoEntries.every(isTargetEntryComplete) ? 5 : 4;
    setTargetEntries(autoEntries);
    setMaxReachedStep(nextStep);
    setStep(nextStep);
    setIsPreparingPlan(false);
  // targetWorkUnits is derived from the fetched progress payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingProgress, isPreparingPlan, selectedUnitIds, unitProgressData, weekStartDate]);

  const reviewUnits: ReviewUnit[] = targetEntries
    .map((entry) => {
      const progressUnit = unitProgressData.find((unit) => unit.carId === entry.carId);
      const capacityUnit = adaptiveCapacitySnapshots.find((unit) => unit.divisionId === String(entry.divisionId));
      if (!progressUnit || !capacityUnit) {
        return null;
      }
      return {
        carId: entry.carId,
        unitName: progressUnit.unitName,
        customerName: progressUnit.customerName,
        entry,
        divisionName: capacityUnit.divisionName,
        availableCapacityHours: capacityUnit.availableHours,
        remainingHours: progressUnit.remainingHours,
        startDate: weekStartDate,
        dailyCapacityHours: Math.max(4, capacityUnit.availableHours / 5),
        qcBufferDays,
        workingDayNumbers,
      } satisfies ReviewUnit;
    })
    .filter((item): item is ReviewUnit => item !== null);

  function appendRecalculation(
    unitId: string,
    triggerType: string,
    previous: DeliveryPrediction | null,
    next: DeliveryPrediction,
    reason: string,
  ) {
    setRecalculationLogs((current) => [
      buildRecalculationLog(unitId, triggerType, previous, next, reason),
      ...current,
    ]);
  }

  useEffect(() => {
    if (!canManage || criticalPathSnapshotSignature === "[]") return;
    const snapshots = JSON.parse(criticalPathSnapshotSignature) as Array<{
      unitId: string;
      p50: string;
      p80: string;
      p95: string;
      nodes: unknown[];
    }>;
    for (const snapshot of snapshots) {
      void saveCriticalPathSnapshot({
        unitId: snapshot.unitId,
        summary: snapshot,
      }).catch(() => null);
    }
  }, [canManage, criticalPathSnapshotSignature]);

  function handleAssessmentToggle(unitId: string, key: AssessmentItemKey, value: boolean) {
    const progressUnit = selectedProgressUnits.find((item) => item.carId === unitId);
    if (!progressUnit) return;
    const previousPrediction = predictions.find((item) => item.unitId === unitId)?.prediction ?? null;
    const nextOverrides: AssessmentOverrideState = {
      ...assessmentOverrides[unitId],
      itemOverrides: {
        ...(assessmentOverrides[unitId]?.itemOverrides ?? {}),
        [key]: value,
      },
    };
    setAssessmentOverrides((current) => ({
      ...current,
      [unitId]: nextOverrides,
    }));
    const nextPrediction = buildDeliveryPrediction({
      startDate: weekStartDate,
      remainingHours: progressUnit.remainingHours,
      readyHours: readyBlockedByUnit[unitId]?.readyHours ?? 0,
      blockedHours: readyBlockedByUnit[unitId]?.blockedHours ?? 0,
      dailyCapacityHours: 8,
      riskLevel: progressUnit.riskLevel,
    });
    appendRecalculation(unitId, "ASSESSMENT_UPDATE", previousPrediction, nextPrediction, `Checklist ${key} ${value ? "ditandai lengkap" : "dibuka kembali"}.`);
  }

  function handleMarkReviewed(unitId: string) {
    setAssessmentOverrides((current) => ({
      ...current,
      [unitId]: {
        ...current[unitId],
        kdReviewed: true,
        itemOverrides: {
          ...(current[unitId]?.itemOverrides ?? {}),
          kdReview: true,
        },
      },
    }));
  }

  function handleLockAssessmentTarget(unitId: string) {
    setAssessmentOverrides((current) => ({
      ...current,
      [unitId]: {
        ...current[unitId],
        locked: true,
      },
    }));
    const currentPrediction = predictions.find((item) => item.unitId === unitId)?.prediction;
    if (currentPrediction) {
      appendRecalculation(unitId, "TARGET_LOCKED", currentPrediction, currentPrediction, "Target resmi dikunci sebagai baseline.");
    }
  }

  function handleWarrantyChange(divisionId: string, hours: number) {
    setWarrantyInputByDivision((current) => ({
      ...current,
      [divisionId]: Number.isFinite(hours) ? Math.max(0, hours) : 0,
    }));
    const affectedUnit = selectedProgressUnits.find((unit) =>
      unit.involvedDivisions.some((division) => String(division.divisionId) === divisionId),
    );
    if (!affectedUnit) return;
    const previousPrediction = predictions.find((item) => item.unitId === affectedUnit.carId)?.prediction ?? null;
    const nextPrediction = buildDeliveryPrediction({
      startDate: weekStartDate,
      remainingHours: affectedUnit.remainingHours,
      readyHours: readyBlockedByUnit[affectedUnit.carId]?.readyHours ?? 0,
      blockedHours: readyBlockedByUnit[affectedUnit.carId]?.blockedHours ?? 0,
      dailyCapacityHours: Math.max(4, ((divisionCapacity.find((item) => String(item.divisionId) === divisionId)?.availableCapacityHours ?? 40) - hours) / 5),
      riskLevel: affectedUnit.riskLevel,
    });
    appendRecalculation(affectedUnit.carId, "WARRANTY_IMPACT", previousPrediction, nextPrediction, `Cadangan garansi divisi ${divisionId} diubah menjadi ${Math.max(0, hours)} jam.`);
  }

  async function handleSaveLabourOverride(input: {
    unitId: string;
    billableHours: number;
    nonBillableHours: number;
    warrantyHours: number;
  }) {
    await saveLabourOverride(input);
    setLabourOverrideByUnit((current) => ({
      ...current,
      [input.unitId]: {
        billableHours: input.billableHours,
        warrantyHours: input.warrantyHours,
      },
    }));
  }

  return (
    <div className="space-y-4">
      <section className="border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-mono text-foreground">{activeViewCopy[adaptiveView].title}</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">{activeViewCopy[adaptiveView].help}</p>
            <p className="mt-2 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "planner", label: "Mulai Planning" },
              { id: "dashboard", label: "Ringkasan" },
              { id: "assessment", label: "Cek Siap Kerja" },
              { id: "service", label: "Service Masuk" },
            ].map((tab) => {
              const isActive = adaptiveView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdaptiveView(tab.id as AdaptiveView)}
                  className={[
                    "inline-flex h-9 items-center border px-3 font-mono text-[14px] uppercase tracking-[0.12em] transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/[0.08] text-app-accent-ink"
                      : "border-border text-muted-foreground hover:border-border hover:bg-border hover:text-foreground",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        {!canManage && (
          <p className="mt-3 border border-primary/30 bg-primary/[0.08] px-3 py-2 font-mono text-[14px] uppercase tracking-[0.12em] text-app-accent-ink">
            Mode baca saja
          </p>
        )}
      </section>

      {adaptiveView === "dashboard" && (
        <div className="space-y-4">
          <AdaptiveDashboardTab
            selectedUnitCount={selectedUnitIds.length}
            readyHours={totalReadyHours}
            blockedHours={totalBlockedHours}
            predictions={predictions}
            capacitySnapshots={adaptiveCapacitySnapshots}
            warrantyImpacts={warrantyImpacts}
            recalculationLogs={recalculationLogs}
            warrantyInputs={warrantyInputByDivision}
            onWarrantyChange={handleWarrantyChange}
            onStartPlanning={() => setAdaptiveView("planner")}
          />
          {selectedUnitIds.length > 0 && (
            <details className="border border-border bg-card px-5 py-4">
              <summary className="cursor-pointer font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Analisis lanjutan</summary>
              <div className="mt-4 space-y-4">
                <CriticalPathPanel result={selectedCriticalPath} jobNames={jobNamesById} divisionNames={divisionNamesById} />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <BomPlanningPanel snapshots={bomPlanningSnapshots} />
                  <LabourControlPanel summaries={labourSummaries} divisionRows={labourDivisionRows} unitNames={unitNameById} onSaveOverride={handleSaveLabourOverride} />
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {adaptiveView === "assessment" && (
        <AdaptiveAssessmentTab
          assessments={assessmentCases}
          selectedUnitId={selectedAssessmentUnitId}
          onSelectUnit={setSelectedAssessmentUnitId}
          onToggleItem={handleAssessmentToggle}
          onMarkKdReview={handleMarkReviewed}
          onLockTarget={handleLockAssessmentTarget}
        />
      )}

      {adaptiveView === "planner" && (
        <>
          {maxReachedStep > 1 && !isPreparingPlan && (
            <PlanningStepHeader
              currentStep={step}
              maxReachedStep={maxReachedStep}
              onStepClick={(nextStep) => {
                if (nextStep <= maxReachedStep) goToStep(nextStep);
              }}
            />
          )}

          {isPreparingPlan && (
            <div className="border border-primary/25 bg-primary/[0.06] px-4 py-4 text-[15px] text-foreground" role="status">
              Menyiapkan target dari progress, countdown, dan kapasitas terbaru…
            </div>
          )}

          {step === 1 && (
            <UnitPriorityStep
              units={units}
              selectedIds={selectedUnitIds}
              onSelectionChange={handleSelectionChange}
              onNext={() => void handleNext()}
              isLoading={isLoadingUnits}
            />
          )}

          {step === 2 && !isPreparingPlan && (
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
              targetHoursPerDivision={totalTargetByDivision}
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
                setAssessmentOverrides({});
                setWarrantyInputByDivision({});
                setLabourOverrideByUnit({});
                setRecalculationLogs([]);
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
        </>
      )}

      {adaptiveView === "service" && (
        <ServiceIntakePage
          units={units}
          divisions={divisionCapacity}
          weekStartDate={weekStartDate}
        />
      )}
    </div>
  );
}
