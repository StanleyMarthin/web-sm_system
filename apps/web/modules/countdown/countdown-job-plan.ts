import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";

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
