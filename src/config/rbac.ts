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
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

const rolePermissions: Record<UserRole, PermissionKey[]> = {
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
    Permission.VIEW_VENDORS,
    Permission.MANAGE_VENDORS,
    Permission.VIEW_APPROVALS,
    Permission.MANAGE_APPROVALS,
    Permission.VIEW_REPORTS,
  ],
  advisor: [
    Permission.VIEW_MONITORING,
    Permission.VIEW_PLANNING,
    Permission.VIEW_WORK_ORDERS,
    Permission.APPROVE_WO_ADVISOR,
    Permission.VIEW_KPI,
    Permission.VIEW_QC,
    Permission.VIEW_UNIT_PROGRESS,
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
    Permission.VIEW_VENDORS,
    Permission.MANAGE_VENDORS,
  ],
  mechanic: [
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
  ],
  mis: [
    Permission.VIEW_MASTER_DATA,
    Permission.MANAGE_MASTER_DATA,
  ],
};

export function hasPermission(
  role: UserRole,
  permission: PermissionKey
): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): PermissionKey[] {
  return rolePermissions[role] ?? [];
}
