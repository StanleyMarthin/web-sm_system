import type { UserRole, WhtApprovalStatus } from "@/types";

function rawRole(role: UserRole | string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

export function isWarehouseSystemAdmin(role: UserRole | string | null | undefined): boolean {
  const r = rawRole(role);
  return r === "mis" || r === "admin";
}

export function isWarehouseStaff(role: UserRole | string | null | undefined): boolean {
  const r = rawRole(role);
  return isWarehouseSystemAdmin(r) || r === "warehouse" || r === "gudang" || r === "admin_gudang";
}

export function isWarehouseApproverOnly(role: UserRole | string | null | undefined): boolean {
  const r = rawRole(role);
  return !isWarehouseSystemAdmin(r) && (
    r === "kd" ||
    r === "ketua_divisi" ||
    r === "kepala_gudang" ||
    r === "ppic" ||
    r === "ppc" ||
    r === "manager_gudang"
  );
}

export function canApproveWarehouseStage(
  role: UserRole | string | null | undefined,
  approvalStatus: WhtApprovalStatus | string | null | undefined,
): boolean {
  const r = rawRole(role);
  const stage = String(approvalStatus ?? "").trim().toUpperCase();

  if (!stage.startsWith("PENDING_")) {
    return false;
  }
  if (isWarehouseSystemAdmin(r)) {
    return true;
  }
  if (stage === "PENDING_KD") {
    return r === "kd" || r === "ketua_divisi";
  }
  if (stage === "PENDING_KEPALA_GUDANG") {
    return r === "kepala_gudang";
  }
  if (stage === "PENDING_PPIC") {
    return r === "ppic" || r === "ppc" || r === "manager_gudang";
  }
  return false;
}

export function canOperateWarehouse(role: UserRole | string | null | undefined): boolean {
  return isWarehouseStaff(role);
}

export function canViewWarehouseReports(role: UserRole | string | null | undefined): boolean {
  return isWarehouseSystemAdmin(role);
}

export function canManageWarehouseReference(role: UserRole | string | null | undefined): boolean {
  return isWarehouseStaff(role);
}
