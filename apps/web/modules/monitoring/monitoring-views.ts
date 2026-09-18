import type { JobPlanV2ApprovalState } from "@smsystem/contracts/job-plan-v2";
import type { MonitoringTaskRecord } from "@smsystem/contracts/monitoring";

export type MonitoringBoardView = "operational" | "approval" | "execution";

export const monitoringBoardViewOptions: Array<{ value: MonitoringBoardView; label: string }> = [
  { value: "operational", label: "Operational" },
  { value: "approval", label: "Approval Queue" },
  { value: "execution", label: "Execution Monitoring" },
];

export const approvalStageOptions: Array<{ value: JobPlanV2ApprovalState; label: string }> = [
  { value: "DIVISION_REVIEW", label: "Review Divisi" },
  { value: "UNIT_REVIEW", label: "Review Unit" },
  { value: "MANAGEMENT_REVIEW", label: "Review Manajemen" },
];

export function resolveMonitoringBoardView(value: string | null | undefined): MonitoringBoardView {
  if (value === "approval" || value === "execution") return value;
  return "operational";
}

export function isReviewState(value: string | null | undefined) {
  return value === "DIVISION_REVIEW" || value === "UNIT_REVIEW" || value === "MANAGEMENT_REVIEW";
}

/**
 * Stage approval bawaan per peran. Backend tetap otoritas:
 * hanya stage yang berhak yang lolos saat mutation dijalankan.
 */
export function resolveDefaultApprovalStage(
  roleName: string | null | undefined,
  canViewAllUnits: boolean,
): JobPlanV2ApprovalState | null {
  if (canViewAllUnits) return null;

  const role = (roleName ?? "").toUpperCase();
  if (role.includes("MANAGER") || role.includes("MANAJEMEN") || role.includes("DIREKSI")) {
    return "MANAGEMENT_REVIEW";
  }
  if (role.includes("KD")) return "DIVISION_REVIEW";
  if (role.includes("KP")) return "UNIT_REVIEW";
  return null;
}

export function filterApprovalQueueRows(
  rows: MonitoringTaskRecord[],
  stage: JobPlanV2ApprovalState | null,
): MonitoringTaskRecord[] {
  return rows.filter((row) => isReviewState(row.approvalState) && (!stage || row.approvalState === stage));
}

export function filterExecutionRows(rows: MonitoringTaskRecord[]): MonitoringTaskRecord[] {
  return rows.filter((row) => row.approvalState === "APPROVED");
}

export interface ExecutionSelectionSummary {
  count: number;
  targetHours: number;
  actualHours: number;
  remainingHours: number;
  averageProgressPercent: number;
}

/** Ringkasan baris terpilih di Execution Monitoring; tidak mengubah data apa pun. */
export function summarizeExecutionSelection(rows: MonitoringTaskRecord[]): ExecutionSelectionSummary {
  const round = (value: number) => Math.round(value * 100) / 100;
  const targetHours = rows.reduce((total, row) => total + (row.targetTotalHours ?? row.countdownTargetHours ?? 0), 0);
  const actualHours = rows.reduce((total, row) => total + (row.totalActualHours ?? 0), 0);
  const remainingHours = rows.reduce((total, row) => total + (row.remainingHours ?? row.countdownRemainingHours ?? 0), 0);
  const progressTotal = rows.reduce((total, row) => total + (row.progressPercent ?? 0), 0);

  return {
    count: rows.length,
    targetHours: round(targetHours),
    actualHours: round(actualHours),
    remainingHours: round(remainingHours),
    averageProgressPercent: rows.length > 0 ? Math.round(progressTotal / rows.length) : 0,
  };
}

// API monitoring berbasis rentang tanggal, jadi queue approval default memakai
// jendela lebar supaya approval lama/akan datang tidak tersembunyi di balik "hari ini".
export const APPROVAL_WINDOW_DAYS = 30;

export function addIsoDays(baseIso: string, days: number): string {
  const [year, month, day] = baseIso.split("-").map((value) => Number.parseInt(value, 10));
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function resolveApprovalDateWindow(
  todayIso: string,
  hasExplicitDate: boolean,
): { from: string; to: string } | null {
  if (hasExplicitDate) return null;
  return {
    from: addIsoDays(todayIso, -APPROVAL_WINDOW_DAYS),
    to: addIsoDays(todayIso, APPROVAL_WINDOW_DAYS),
  };
}
