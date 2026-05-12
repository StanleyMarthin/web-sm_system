import { env } from "@/config/env";

const BASE = env.woUrl;

export interface WorkOrderStageDone {
  role?: string;
  user_id?: string;
  name?: string;
  action_at?: string;
  notes?: string;
  estimated_hours?: number;
}

export interface WorkOrder {
  reqId: string;
  woNumber: string;
  carId: string;
  unitName: string;
  ownerName: string;
  toDivId: string;
  toDivName: string;
  fromDivId: string;
  fromDivName: string;
  panelName: string | null;
  jobDetail: string;
  estimatedHours: number | null;
  status: string;
  requestDate: string;
  notes: string | null;
  approvalDate: string | null;
  currentStage?: string;
  needsAdvisor?: boolean;
  stagesDone?: WorkOrderStageDone[];
  coreId?: string | null;
}

export interface CreateWorkOrderPayload {
  userId: string;
  carId: string;
  targetDivId: string;
  jobDetail: string;
  targetDate: string;
  panelName?: string;
  sectionName?: string;
  panelCategory?: string;
  addPanelToMaster?: boolean;
  targetHours?: number | string;
}

export interface ApproveWorkOrderPayload {
  userId: string;
  reqId: string;
  notes?: string;
  estimatedHours?: number;
}

export interface RejectWorkOrderPayload {
  userId: string;
  reqId: string;
  rejectReason: string;
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

export async function getWorkOrders(params: {
  userId: string;
  view?: "ACTIVE" | "DONE";
  page?: number;
  limit?: number;
}): Promise<WorkOrder[]> {
  const qs = new URLSearchParams({ userId: params.userId });
  if (params.view) qs.set("view", params.view);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const response = await fetch(`${BASE}/sm/wo?${qs.toString()}`, {
    cache: "no-store",
  });
  return readPayload<WorkOrder[]>(response);
}

export async function getWorkOrderDetail(userId: string, woId: string): Promise<WorkOrder> {
  const qs = new URLSearchParams({ userId });
  const response = await fetch(`${BASE}/sm/wo/${encodeURIComponent(woId)}?${qs.toString()}`, {
    cache: "no-store",
  });
  return readPayload<WorkOrder>(response);
}

export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<{ reqId: string; woNumber: string; currentStage?: string }> {
  const response = await fetch(`${BASE}/sm/wo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      ...payload,
    }),
  });
  return readPayload<{ reqId: string; woNumber: string; currentStage?: string }>(response);
}

export async function approveWorkOrder(payload: ApproveWorkOrderPayload): Promise<{ reqId: string; newStage?: string; newStatus?: string; estimatedHours?: number }> {
  const response = await fetch(`${BASE}/sm/wo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "approve",
      ...payload,
    }),
  });
  return readPayload<{ reqId: string; newStage?: string; newStatus?: string; estimatedHours?: number }>(response);
}

export async function rejectWorkOrder(payload: RejectWorkOrderPayload): Promise<{ reqId: string; newStatus?: string }> {
  const response = await fetch(`${BASE}/sm/wo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reject",
      userId: payload.userId,
      reqId: payload.reqId,
      rejectReason: payload.rejectReason,
    }),
  });
  return readPayload<{ reqId: string; newStatus?: string }>(response);
}
