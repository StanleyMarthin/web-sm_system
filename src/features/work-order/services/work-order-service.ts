// ============================================================
// Work Order Service — dummy data for MVP
// ============================================================

import { WORK_ORDERS } from "@/lib/dummy-data";
import type { WorkOrder, WoStatus, WoType } from "@/types";

interface GetWorkOrdersParams {
  status?: WoStatus;
  woType?: WoType;
  division?: string;
}

export async function getWorkOrders(
  params?: GetWorkOrdersParams
): Promise<WorkOrder[]> {
  await new Promise((r) => setTimeout(r, 300));

  let filtered = [...WORK_ORDERS];
  if (params?.status) filtered = filtered.filter((w) => w.status === params.status);
  if (params?.woType) filtered = filtered.filter((w) => w.woType === params.woType);
  if (params?.division) filtered = filtered.filter((w) => w.fromDivision === params.division);

  return filtered;
}

export async function submitWorkOrder(woId: string): Promise<WorkOrder> {
  await new Promise((r) => setTimeout(r, 300));
  const wo = WORK_ORDERS.find((w) => w.id === woId);
  if (!wo) throw new Error("Work order not found");
  return { ...wo, status: "PENDING_ADVISOR" };
}

export async function approveWorkOrderAdvisor(
  woId: string,
  note: string
): Promise<WorkOrder> {
  await new Promise((r) => setTimeout(r, 300));
  const wo = WORK_ORDERS.find((w) => w.id === woId);
  if (!wo) throw new Error("Work order not found");
  return {
    ...wo,
    status: "PENDING_PM",
    advisorApprovedAt: new Date().toISOString(),
    advisorApprovedBy: "Kandi Gunawan",
    notes: note,
  };
}

export async function approveWorkOrderPM(
  woId: string,
  note: string
): Promise<WorkOrder> {
  await new Promise((r) => setTimeout(r, 300));
  const wo = WORK_ORDERS.find((w) => w.id === woId);
  if (!wo) throw new Error("Work order not found");
  return {
    ...wo,
    status: "APPROVED",
    pmApprovedAt: new Date().toISOString(),
    pmApprovedBy: "Hardian",
    notes: note,
  };
}

export async function rejectWorkOrder(
  woId: string,
  reason: string
): Promise<WorkOrder> {
  await new Promise((r) => setTimeout(r, 300));
  const wo = WORK_ORDERS.find((w) => w.id === woId);
  if (!wo) throw new Error("Work order not found");
  return { ...wo, status: "REJECTED", rejectedReason: reason };
}
