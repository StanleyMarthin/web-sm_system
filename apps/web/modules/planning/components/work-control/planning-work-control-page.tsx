"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PlanningWorkspacePayload } from "@/shared/api/planning";
import {
  createWorkControlTarget,
  fetchDivisionCapacity,
  fetchUnitProgress,
  fetchWorkControlUnitsClient,
  releaseSpk,
  createOvertimeRecommendation,
  type WorkControlUnit,
} from "@/shared/api/work-control";
import { PlanningWorkControlShell } from "./planning-work-control-shell";
import type { UnitPriorityItem } from "./unit-priority-step";
import type { UnitProgressData } from "./unit-progress-step";
import type { DivisionCapacityData } from "./division-capacity-step";
import type { TargetWorkEntry } from "./target-work-step";
import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";

interface PlanningWorkControlPageProps {
  weekStartDate: string;
  workspaceData: PlanningWorkspacePayload;
  canManage: boolean;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  const next = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  next.setUTCDate(next.getUTCDate() + amount);
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function mapToUnitPriorityItems(units: WorkControlUnit[]): UnitPriorityItem[] {
  return units.map((unit) => ({
    carId: unit.carId,
    unitName: unit.unitName,
    customerName: unit.customerName ?? null,
    progressPercent: unit.progressPercent,
    riskLevel: unit.riskLevel,
    remainingJobCount: unit.remainingJobCount,
    remainingHours: unit.remainingHours,
    targetDeliveryDate: unit.targetDeliveryDate,
    status: unit.status ?? "ACTIVE",
  }));
}

function mapPriorityForApi(priority: TargetWorkEntry["priority"]): number {
  if (priority === "URGENT") return 1;
  if (priority === "IMPORTANT") return 2;
  return 3;
}

export function PlanningWorkControlPage({
  weekStartDate,
  workspaceData: _workspaceData,
  canManage,
}: PlanningWorkControlPageProps) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitPriorityItem[]>([]);
  const [divisionCapacity, setDivisionCapacity] = useState<DivisionCapacityData[]>([]);
  const [unitProgressData, setUnitProgressData] = useState<UnitProgressData[]>([]);
  const [planningTargetId, setPlanningTargetId] = useState<string | null>(null);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [isSnapshoting, setIsSnapshoting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const periodEnd = addDays(weekStartDate, 6);

  const loadCapacity = useCallback(async (divisionIds?: number[]) => {
    const capacity = await fetchDivisionCapacity({
      periodStart: weekStartDate,
      periodEnd,
      divisionIds:
        divisionIds && divisionIds.length > 0
          ? divisionIds.map((divisionId) => String(divisionId))
          : undefined,
    });
    setDivisionCapacity(
      capacity.data
        .filter((cap) => cap.totalMembers > 0)
        .map((cap) => ({
        divisionId: Number(cap.divisionId),
        divisionName: cap.divisionName,
        totalMembers: cap.totalMembers,
        activeMembers: cap.activeMembers,
        absentMembers: cap.absentMembers,
        normalCapacityHours: cap.normalCapacityHours,
        absenceHours: cap.absenceHours,
        scheduledHours: Math.max(
          0,
          cap.normalCapacityHours - cap.absenceHours - cap.availableCapacityHours,
        ),
        availableCapacityHours: cap.availableCapacityHours,
        absentMemberDetails: cap.absentMemberDetails.map((member) => ({
          name: member.memberName,
          reason: `${member.absenceType} ${member.startDate} s/d ${member.endDate}`,
        })),
      })),
    );
  }, [periodEnd, weekStartDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setIsLoadingUnits(true);
      setLoadError(null);
      try {
        const unitResult = await fetchWorkControlUnitsClient();
        if (!cancelled) {
          setUnits(mapToUnitPriorityItems(unitResult.data));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Data Work Control belum bisa dimuat.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUnits(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [loadCapacity]);

  const handleFetchProgress = useCallback(async (unitIds: string[]) => {
    setIsLoadingProgress(true);
    setLoadError(null);
    try {
      const responses = await Promise.all(unitIds.map((unitId) => fetchUnitProgress(unitId)));
      const unitMap = new Map(units.map((unit) => [unit.carId, unit]));
      const progressData: UnitProgressData[] = responses.map((response) => {
        const unit = unitMap.get(response.data.unitId);
        return {
          carId: response.data.unitId,
          unitName: unit?.unitName ?? response.data.unitId,
          customerName: unit?.customerName ?? null,
          progressPercent: response.data.progressPercent,
          remainingHours: response.data.remainingHours,
          totalEstimatedHours: response.data.totalEstimatedHours,
          actualHours: response.data.actualHours,
          riskLevel: unit?.riskLevel ?? ("MEDIUM" as RiskLevel),
          targetDeliveryDate: unit?.targetDeliveryDate ?? null,
          involvedDivisions: response.data.involvedDivisions.map((division) => ({
            divisionId: Number(division.divisionId),
            divisionName: division.divisionName,
            remainingHours: division.pendingHours,
          })),
          mainConstraint: response.data.mainConstraint,
          roughEstimateDays: response.data.roughEstimateDays,
          jobs: response.data.jobs.map((job) => ({
            jobId: job.jobId,
            jobName: job.jobName,
            panel: "-",
            status: job.status,
            estimatedHours: job.estimatedHours,
            actualHours: job.actualHours,
          })),
        };
      });

      const relevantDivisionIds = Array.from(
        new Set(
          progressData.flatMap((unit) =>
            unit.involvedDivisions.map((division) => division.divisionId),
          ),
        ),
      );

      await loadCapacity(relevantDivisionIds);
      setUnitProgressData(progressData);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Progress unit belum bisa dimuat.",
      );
      setDivisionCapacity([]);
      setUnitProgressData([]);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [loadCapacity, units]);

  const handleSnapshotAbsence = useCallback(async () => {
    setIsSnapshoting(true);
    setLoadError(null);
    try {
      await loadCapacity();
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Data absensi terbaru belum bisa dimuat.",
      );
    } finally {
      setIsSnapshoting(false);
    }
  }, [loadCapacity, unitProgressData]);

  const saveDraft = useCallback(async (entries: TargetWorkEntry[]) => {
    if (entries.length === 0) {
      return { success: false, message: "Belum ada target yang diisi." };
    }

    const response = await createWorkControlTarget({
      planningTargetId: planningTargetId ?? undefined,
      weekStartDate,
      units: entries.map((entry) => ({
        carId: entry.carId,
        divisionId: String(entry.divisionId),
        targetHours: entry.targetHours,
        targetOutput: entry.targetOutput,
        targetFinishDate: entry.targetFinishDate,
        priority: mapPriorityForApi(entry.priority),
        riskLevel: entry.riskLevel,
        notes: entry.notes || undefined,
      })),
    });
    setPlanningTargetId(response.data.planningTargetId);
    return {
      success: true,
      message: `${response.data.status === "DRAFT" ? "Belum dirilis" : response.data.status}. Draft target berhasil disimpan.`,
      planningTargetId: response.data.planningTargetId,
    };
  }, [planningTargetId, weekStartDate]);

  const handleSaveDraft = useCallback(async (entries: TargetWorkEntry[]) => {
    try {
      const result = await saveDraft(entries);
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Draft target belum bisa disimpan.",
      };
    }
  }, [saveDraft]);

  const handleReleaseSpk = useCallback(async (entries: TargetWorkEntry[]) => {
    if (entries.length === 0) {
      return { success: false, message: "Belum ada target yang diisi." };
    }

    try {
      const savedDraft = await saveDraft(entries);
      const activeTargetId = savedDraft.planningTargetId;
      if (!activeTargetId) {
        return { success: false, message: "Draft target belum siap untuk dirilis." };
      }

      const response = await releaseSpk(activeTargetId);
      router.refresh();
      return {
        success: true,
        message: response.data.message,
        planningTargetId: activeTargetId,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "SPK belum bisa dirilis.",
      };
    }
  }, [router, saveDraft]);

  const handleCreateOvertimeRecommendation = useCallback(async (inputs: { planningTargetId: string; divisionId: string; shortageHours: number; reason: string }[]) => {
    try {
      await Promise.all(inputs.map((input) => createOvertimeRecommendation(input)));
      return {
        success: true,
        message: "Rekomendasi lembur berhasil dibuat.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Rekomendasi lembur belum bisa dibuat.",
      };
    }
  }, []);

  return (
    <div className="space-y-3">
      {loadError && (
        <div className="border border-red-500/25 bg-red-500/[0.04] px-4 py-2.5 text-[12px] text-red-600 dark:text-red-300">
          {loadError}
        </div>
      )}
      <PlanningWorkControlShell
        weekStartDate={weekStartDate}
        units={units}
        unitProgressData={unitProgressData}
        divisionCapacity={divisionCapacity}
        onFetchProgress={handleFetchProgress}
        onSnapshotAbsence={handleSnapshotAbsence}
        onReleaseSpk={handleReleaseSpk}
        onSaveDraft={handleSaveDraft}
        onCreateOvertimeRecommendation={handleCreateOvertimeRecommendation}
        onResetDraft={() => {
          setPlanningTargetId(null);
          setUnitProgressData([]);
          setDivisionCapacity([]);
        }}
        canManage={canManage}
        isLoadingUnits={isLoadingUnits}
        isLoadingProgress={isLoadingProgress}
        isSnapshoting={isSnapshoting}
      />
    </div>
  );
}
