// ============================================================
// Monitoring Service — fetches monitoring data (dummy for MVP)
// ============================================================

import { MONITORING_JOBS } from "@/lib/dummy-data";
import type { MonitoringJob } from "@/types";

interface GetMonitoringJobsParams {
  division: string;
  date: string;
}

export async function getMonitoringJobs(
  params: GetMonitoringJobsParams
): Promise<MonitoringJob[]> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 300));

  // Shift filtering is done client-side in the store selector
  return MONITORING_JOBS.filter(
    (j) => j.divisionName === params.division && j.taskDate === params.date
  );
}

export async function updateJobCheckpoints(
  jobId: string,
  data: { detailPOK?: string; checkpoints?: MonitoringJob["checkpoints"] }
): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 300));
  // In real app: PUT /kd/monitoring/jobs/{jobId}/checkpoints
  console.log("Update checkpoints:", jobId, data);
  return { success: true };
}

export async function addUrgentJob(
  data: Partial<MonitoringJob>
): Promise<MonitoringJob> {
  await new Promise((r) => setTimeout(r, 300));
  // In real app: POST /kd/monitoring/jobs/urgent
  return {
    id: `mon-urgent-${Date.now()}`,
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
    status: "TO_DO",
    shiftType: data.shiftType ?? "NORMAL",
    dailyTargetHours: data.dailyTargetHours ?? 0,
    totalActualHours: 0,
    targetHoursRevised: data.targetHoursRevised ?? 0,
    remainingHours: data.targetHoursRevised ?? 0,
    taskDate: new Date().toISOString().split("T")[0],
    startedAt: null,
    isUrgent: true,
    taskCategory: "ADDITIONAL",
    checkpoints: [],
  };
}
