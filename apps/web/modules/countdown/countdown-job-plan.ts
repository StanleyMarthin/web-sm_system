import type { JobPlanV2ApprovalState, JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { minutesToDuration, type JobPlanV2PlannerDraft } from "@/modules/job-plan/job-plan-planner";

export interface CountdownPlanProgress {
  plannedMinutes: number;
  workedMinutes: number;
  remainingMinutes: number;
  percent: number;
}

/** Progress rencana dibaca dari menit rencana versus menit aktual yang tercatat pada job plan. */
export function resolveCountdownPlanProgress(
  plan: Pick<JobPlanV2ReadItem, "planned_work_minutes" | "accumulated_work_minutes">,
): CountdownPlanProgress {
  const plannedMinutes = Math.max(0, plan.planned_work_minutes);
  const workedMinutes = Math.max(0, plan.accumulated_work_minutes);

  return {
    plannedMinutes,
    workedMinutes,
    remainingMinutes: Math.max(plannedMinutes - workedMinutes, 0),
    percent: plannedMinutes > 0 ? Math.min(100, Math.round((workedMinutes / plannedMinutes) * 100)) : 0,
  };
}

export interface CountdownPlanContext {
  countdownId: string;
  jobDescription: string;
  taskDate: string;
  remainingHours: number;
}

export const countdownPlanApprovalOrder: JobPlanV2ApprovalState[] = [
  "DRAFT",
  "DIVISION_REVIEW",
  "UNIT_REVIEW",
  "MANAGEMENT_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export interface CountdownPlanSummary {
  total: number;
  breakdown: Array<{ state: JobPlanV2ApprovalState; count: number }>;
}

/**
 * Ringkasan semua job plan milik satu countdown. Tidak memakai urutan array:
 * hitungan dikelompokkan per status persetujuan dengan urutan tetap.
 * CANCELLED hanya muncul bila memang ada.
 */
export function summarizeCountdownPlans(plans: JobPlanV2ReadItem[]): CountdownPlanSummary {
  const counts = new Map<JobPlanV2ApprovalState, number>();
  for (const plan of plans) {
    counts.set(plan.approval_state, (counts.get(plan.approval_state) ?? 0) + 1);
  }

  return {
    total: plans.length,
    breakdown: countdownPlanApprovalOrder
      .map((state) => ({ state, count: counts.get(state) ?? 0 }))
      .filter((entry) => entry.count > 0),
  };
}

/**
 * Draft rencana dari halaman countdown. Dibuat sebagai DRAFT biasa: jenis
 * normal/lembur hanya mengubah jam mulai, alur persetujuan tetap di modul Job Plan.
 */
export function createCountdownPlanDraft(
  context: CountdownPlanContext,
  isOvertime: boolean,
): JobPlanV2PlannerDraft {
  return {
    clientId: `countdown-${context.countdownId}`,
    isNew: true,
    coreId: context.countdownId,
    employeeId: "",
    taskDate: context.taskDate,
    startTime: isOvertime ? "17:00" : "08:00",
    durationText: context.remainingHours > 0 ? minutesToDuration(Math.round(context.remainingHours * 60)) : "01:00",
    jobDescription: context.jobDescription,
    note: "",
    isOvertime,
    isRework: false,
    isPriority: false,
    error: null,
  };
}
