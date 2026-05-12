import { env } from "@/config/env";

const BASE = env.qcUrl;

export interface QcDivision {
  divisionId: string;
  divisionName: string;
  totalItem: number;
}

export interface QcItem {
  JobType: "CORE" | "WOV";
  coreId: string;
  refId: string | null;
  unitId: string;
  unitName: string;
  divisionId: string;
  divisionName: string;
  panelId: number | null;
  panelName: string | null;
  taskCategory: string;
  jobName: string | null;
  status: string;
  qcLastStatus: string | null;
  qcLevel: string | null;
  remainingHours: number | null;
  targetHours: number | null;
  deadlineDate: string | null;
  woNumber: string | null;
  vendorName: string | null;
  itemName: string | null;
}

export interface QcSubmitPayload {
  userId: string;
  coreId: string;
  action: "lolos" | "tidak_lolos";
  notes?: string;
  inspectionDurationMinutes?: number;
  photoBeforeUrl?: string;
  evidencePhotoUrl?: string;
  reworkDate?: string;
  reworkAssignedUser?: string;
  reworkDailyHours?: string;
  reworkStartTime?: string;
  reworkFinishTime?: string;
  reworkDescription?: string;
  reworkIsOvertime?: boolean;
  reworkIsPriority?: boolean;
}

export interface QcSubmitResult {
  qcId: string;
  qcLevel?: string;
  planId?: string;
  usedFromCore?: number;
  needUnitBudget?: boolean;
  unitBudgetId?: string;
  unitBudgetKdHours?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

async function readPayload<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = asRecord(json);
    throw new Error(String(payload.message || payload.error || `Request failed (${response.status})`));
  }
  const payload = asRecord(json);
  return ("data" in payload ? payload.data : json) as T;
}

export async function getQcDivisions(userId: string): Promise<{
  role: string;
  divisions: QcDivision[];
}> {
  const response = await fetch(`${BASE}/sm/qc/monitoring?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
  });
  const data = await readPayload<{ role?: string; divisions?: QcDivision[] }>(response);
  return {
    role: data.role || "",
    divisions: data.divisions || [],
  };
}

export async function getQcItems(params: {
  userId: string;
  divisionId: string;
  unitId?: string;
  panelId?: string;
  taskCat?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: QcItem[]; total: number; hasMore: boolean }> {
  const qs = new URLSearchParams({
    userId: params.userId,
    divisionId: params.divisionId,
  });
  if (params.unitId) qs.set("unitId", params.unitId);
  if (params.panelId) qs.set("panelId", params.panelId);
  if (params.taskCat) qs.set("taskCat", params.taskCat);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  const response = await fetch(`${BASE}/sm/qc/monitoring?${qs.toString()}`, {
    cache: "no-store",
  });
  const data = await readPayload<{ items?: QcItem[]; total?: number; hasMore?: boolean }>(response);

  return {
    items: data.items || [],
    total: data.total || 0,
    hasMore: data.hasMore || false,
  };
}

export async function submitQc(payload: QcSubmitPayload): Promise<QcSubmitResult> {
  const response = await fetch(`${BASE}/sm/qc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readPayload<QcSubmitResult>(response);
}
