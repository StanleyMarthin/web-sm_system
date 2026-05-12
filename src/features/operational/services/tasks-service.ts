// ============================================================
// Tasks Service — sm_tasks :8086
// GET /sm/tasks?userId=&date=&divisionID=&unitID=&status=
// ============================================================

import { env } from "@/config/env";

const BASE = env.tasksUrl;

export interface TaskRecord {
  planDailyId: string;
  division: { divisionId: string; divisionName: string };
  unit:     { unitId: string; unitName: string };
  employee: { employeeId: string; employeeName: string };
  task: {
    namaPanel: string | null;
    jobName: string | null;
    jobDescription: string | null;
    startTime: string | null;
    targetFinishTime: string | null;
    is_rework: boolean;
    is_overtime: boolean;
    is_priority: boolean;
  };
  status: string;
  checkpointHistory: unknown[];
  photos: { before: string[]; process: string[]; after: string[] };
}

export async function getTasks(params: {
  userId: string;
  date: string;
  divisionID?: string;
  unitID?: string;
  status?: string;
}): Promise<{ count: number; data: TaskRecord[] }> {
  const qs = new URLSearchParams({ userId: params.userId, date: params.date });
  if (params.divisionID) qs.set("divisionID", params.divisionID);
  if (params.unitID) qs.set("unitID", params.unitID);
  if (params.status) qs.set("status", params.status);

  try {
    const res = await fetch(`${BASE}/sm/tasks?${qs}`);
    if (res.ok) {
      const json = await res.json();
      const data = json.data ?? {};
      return { count: data.count ?? 0, data: data.data ?? [] };
    }
  } catch (e) {
    console.warn("[tasks-service] fetch failed:", e);
  }
  return { count: 0, data: [] };
}
