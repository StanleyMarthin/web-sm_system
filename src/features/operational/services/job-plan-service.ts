// ============================================================
// Job Plan Service — sm_job_plan :8083
// GET /sm/job-plans  → action=browse|queue|approval_queue
// ============================================================

import { env } from "@/config/env";

const BASE = env.jobPlanUrl;

export interface JobPlanItem {
  planId:          string;
  coreId:          string;
  taskDate:        string;
  sourceType:      string;
  assignedUserId:  string;
  assignedUserName: string;
  targetHours:     number;
  startTime:       string | null;
  finishTime:      string | null;
  isOvertime:      boolean;
  status:          string;
  note:            string | null;
  jobdescription:  string | null;
  carId:           string;
  panelId:         number | null;
  panelName:       string | null;
  unitName:        string | null;
  divisionId:      string;
  divisionName:    string;
  remainingHours:  number;
}

export async function getJobPlans(params: {
  userId: string;
  action?: "queue" | "browse" | "approval_queue";
  status?: string;
  divisionId?: string;
  unitId?: string;
  taskDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: JobPlanItem[]; count: number }> {
  const qs = new URLSearchParams({ userId: params.userId });
  if (params.action) qs.set("action", params.action);
  if (params.status) qs.set("status", params.status);
  if (params.divisionId) qs.set("divisionId", params.divisionId);
  if (params.unitId) qs.set("unitId", params.unitId);
  if (params.taskDate) qs.set("taskDate", params.taskDate);
  if (params.search) qs.set("search", params.search);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));

  try {
    const res = await fetch(`${BASE}/sm/job-plans?${qs}`);
    if (res.ok) {
      const json = await res.json();
      const data = json.data ?? {};
      return { items: data.items ?? [], count: data.count ?? 0 };
    }
  } catch (e) {
    console.warn("[job-plan-service] fetch failed:", e);
  }
  return { items: [], count: 0 };
}

export async function getJobPlanDropdowns() {
  try {
    const res = await fetch(`${BASE}/sm/job-plans/dropdowns`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("[job-plan-service] fetch dropdowns failed:", e);
  }
  return { cars: [], panels: [], divisions: [], users: [], jobTypes: [] };
}

export async function approveJobPlan(params: {
  userId: string;
  planId: string;
  action: "approve" | "reject";
  rejectNote?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/sm/job-plans`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: params.action,
        userId: params.userId,
        planId: params.planId,
        rejectNote: params.rejectNote,
        items: [],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
