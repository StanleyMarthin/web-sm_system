// ============================================================
// Planning Service — dummy data for MVP
// ============================================================

import { PLAN_JOBS, MECHANIC_OPTIONS, AVAILABLE_CORE_JOBS } from "@/lib/dummy-data";
import type { PlanJob, MechanicOption, AvailableCoreJob } from "@/types";

export async function getPlanJobs(
  division: string,
  date: string
): Promise<PlanJob[]> {
  await new Promise((r) => setTimeout(r, 300));
  return PLAN_JOBS.filter(
    (j) => j.divisionName === division && j.planDate === date
  );
}

export async function getMechanicOptions(
  division: string
): Promise<MechanicOption[]> {
  await new Promise((r) => setTimeout(r, 200));
  // Filter by division in real API
  void division;
  return MECHANIC_OPTIONS;
}

export async function getAvailableCoreJobs(
  division: string
): Promise<AvailableCoreJob[]> {
  await new Promise((r) => setTimeout(r, 200));
  return AVAILABLE_CORE_JOBS.filter((j) => j.divisionName === division);
}

export async function createPlanJob(
  data: Partial<PlanJob>
): Promise<PlanJob> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    id: `plan-${Date.now()}`,
    coreId: data.coreId ?? "",
    carId: data.carId ?? "",
    unitName: data.unitName ?? "",
    ownerName: data.ownerName ?? "",
    panelName: data.panelName ?? "",
    jobName: data.jobName ?? "",
    detailPOK: data.detailPOK ?? "",
    divisionName: data.divisionName ?? "Mechanic",
    mechanicId: data.mechanicId ?? "",
    mechanicName: data.mechanicName ?? "",
    planDate: data.planDate ?? new Date().toISOString().split("T")[0],
    shiftType: data.shiftType ?? "NORMAL",
    dailyTargetHours: data.dailyTargetHours ?? 8,
    remainingHours: data.remainingHours ?? 0,
    isPanelFree: data.isPanelFree ?? true,
    priority: data.priority ?? "NORMAL",
    fromCountdown: data.fromCountdown ?? false,
  };
}

export async function deletePlanJob(jobId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  void jobId;
}
