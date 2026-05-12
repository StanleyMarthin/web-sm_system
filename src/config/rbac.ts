// ============================================================
// RBAC — Permissions by role
// ============================================================

import type { UserRole } from "@/types";

export const Permission = {
  // Monitoring
  VIEW_MONITORING: "VIEW_MONITORING",
  EDIT_CHECKPOINTS: "EDIT_CHECKPOINTS",
  ADD_URGENT_JOB: "ADD_URGENT_JOB",
  // Planning
  VIEW_PLANNING: "VIEW_PLANNING",
  MANAGE_PLANNING: "MANAGE_PLANNING",
  // Work Order
  VIEW_WORK_ORDERS: "VIEW_WORK_ORDERS",
  CREATE_WORK_ORDER: "CREATE_WORK_ORDER",
  APPROVE_WO_ADVISOR: "APPROVE_WO_ADVISOR",
  APPROVE_WO_PM: "APPROVE_WO_PM",
  // Task Execution
  VIEW_TASKS: "VIEW_TASKS",
  EXECUTE_TASKS: "EXECUTE_TASKS",
  // KPI & QC
  VIEW_KPI: "VIEW_KPI",
  VIEW_QC: "VIEW_QC",
  MANAGE_QC: "MANAGE_QC",
  // Unit Progress
  VIEW_UNIT_PROGRESS: "VIEW_UNIT_PROGRESS",
  // Projects & Calendar
  VIEW_PROJECTS: "VIEW_PROJECTS",
  MANAGE_PROJECTS: "MANAGE_PROJECTS",
  VIEW_WORKLOAD: "VIEW_WORKLOAD",
  // Core Jobs (WBS)
  VIEW_CORE_JOBS: "VIEW_CORE_JOBS",
  MANAGE_CORE_JOBS: "MANAGE_CORE_JOBS",
  // Countdown Monitor
  VIEW_COUNTDOWN: "VIEW_COUNTDOWN",
  MANAGE_COUNTDOWN: "MANAGE_COUNTDOWN",
  // Operational Hub (Job Plan + Tasks + QC + WO)
  VIEW_OPERATIONAL: "VIEW_OPERATIONAL",
  // Vendor
  VIEW_VENDORS: "VIEW_VENDORS",
  MANAGE_VENDORS: "MANAGE_VENDORS",
  // Approvals
  VIEW_APPROVALS: "VIEW_APPROVALS",
  MANAGE_APPROVALS: "MANAGE_APPROVALS",
  // Reports
  VIEW_REPORTS: "VIEW_REPORTS",
  // Master Data
  VIEW_MASTER_DATA: "VIEW_MASTER_DATA",
  MANAGE_MASTER_DATA: "MANAGE_MASTER_DATA",
  // Warehouse
  VIEW_WAREHOUSE: "VIEW_WAREHOUSE",
  MANAGE_WAREHOUSE: "MANAGE_WAREHOUSE",
  APPROVE_WAREHOUSE_KD: "APPROVE_WAREHOUSE_KD",
  APPROVE_WAREHOUSE_KG: "APPROVE_WAREHOUSE_KG",
  APPROVE_WAREHOUSE_PPIC: "APPROVE_WAREHOUSE_PPIC",
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

// Role alias normalization — mirrors Flutter's rbac.dart getPermissions()
function normalizeRole(role: string): string {
  const r = role.toLowerCase();
  if (["mp", "manager_produksi", "kepala_produksi", "manager_operational", "admin"].includes(r)) return "pm";
  if (["adv", "advisor"].includes(r)) return "adv";
  if (["kd", "ketua_divisi"].includes(r)) return "kd";
  if (["op", "mechanic", "team_lapangan"].includes(r)) return "op";
  if (["kepala_gudang"].includes(r)) return "kepala_gudang";
  if (["warehouse", "gudang", "admin_gudang"].includes(r)) return "warehouse";
  if (["ppic", "ppc", "manager_gudang"].includes(r)) return "ppic";
  if (["mis"].includes(r)) return "mis";
  return r;
}

const rolePermissions: Record<string, PermissionKey[]> = {
  pm: [
    Permission.VIEW_MONITORING,
    Permission.VIEW_PLANNING,
    Permission.VIEW_WORK_ORDERS,
    Permission.APPROVE_WO_PM,
    Permission.VIEW_KPI,
    Permission.VIEW_QC,
    Permission.VIEW_UNIT_PROGRESS,
    Permission.VIEW_PROJECTS,
    Permission.MANAGE_PROJECTS,
    Permission.VIEW_WORKLOAD,
    Permission.VIEW_CORE_JOBS,
    Permission.MANAGE_CORE_JOBS,
    Permission.VIEW_COUNTDOWN,
    Permission.MANAGE_COUNTDOWN,
    Permission.VIEW_OPERATIONAL,
    Permission.VIEW_VENDORS,
    Permission.MANAGE_VENDORS,
    Permission.VIEW_APPROVALS,
    Permission.MANAGE_APPROVALS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_WAREHOUSE,
    Permission.MANAGE_WAREHOUSE,
    Permission.APPROVE_WAREHOUSE_KG,
  ],
  adv: [
    Permission.VIEW_MONITORING,
    Permission.VIEW_PLANNING,
    Permission.VIEW_WORK_ORDERS,
    Permission.APPROVE_WO_ADVISOR,
    Permission.VIEW_KPI,
    Permission.VIEW_QC,
    Permission.VIEW_UNIT_PROGRESS,
    Permission.VIEW_COUNTDOWN,
    Permission.VIEW_OPERATIONAL,
  ],
  kd: [
    Permission.VIEW_MONITORING,
    Permission.EDIT_CHECKPOINTS,
    Permission.ADD_URGENT_JOB,
    Permission.VIEW_PLANNING,
    Permission.MANAGE_PLANNING,
    Permission.VIEW_WORK_ORDERS,
    Permission.CREATE_WORK_ORDER,
    Permission.VIEW_KPI,
    Permission.VIEW_QC,
    Permission.MANAGE_QC,
    Permission.VIEW_UNIT_PROGRESS,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_CORE_JOBS,
    Permission.MANAGE_CORE_JOBS,
    Permission.VIEW_COUNTDOWN,
    Permission.MANAGE_COUNTDOWN,
    Permission.VIEW_OPERATIONAL,
    Permission.VIEW_VENDORS,
    Permission.MANAGE_VENDORS,
    Permission.VIEW_WAREHOUSE,
    Permission.APPROVE_WAREHOUSE_KD,
  ],
  op: [
    Permission.VIEW_TASKS,
    Permission.EXECUTE_TASKS,
    Permission.VIEW_WORK_ORDERS,
    Permission.VIEW_PLANNING,
  ],
  direksi: [
    Permission.VIEW_MONITORING,
    Permission.VIEW_KPI,
    Permission.VIEW_UNIT_PROGRESS,
    Permission.VIEW_APPROVALS,
    Permission.MANAGE_APPROVALS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_WAREHOUSE,
  ],
  kepala_gudang: [
    Permission.VIEW_WAREHOUSE,
    Permission.APPROVE_WAREHOUSE_KG,
  ],
  warehouse: [
    Permission.VIEW_WAREHOUSE,
    Permission.MANAGE_WAREHOUSE,
  ],
  ppic: [
    Permission.VIEW_WAREHOUSE,
    Permission.APPROVE_WAREHOUSE_PPIC,
  ],
  mis: [
    Permission.VIEW_MASTER_DATA,
    Permission.MANAGE_MASTER_DATA,
    Permission.VIEW_WAREHOUSE,
    Permission.MANAGE_WAREHOUSE,
    Permission.APPROVE_WAREHOUSE_KG,
    Permission.APPROVE_WAREHOUSE_PPIC,
  ],
};

export function hasPermission(
  role: UserRole,
  permission: PermissionKey
): boolean {
  return rolePermissions[normalizeRole(role)]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): PermissionKey[] {
  return rolePermissions[normalizeRole(role)] ?? [];
}
