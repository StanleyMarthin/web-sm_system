import type {
  CreateJobPlanV2Request,
  JobPlanV2ApprovalState,
  JobPlanV2ExecutionState,
  JobPlanV2LedgerState,
  JobPlanV2ReadItem,
} from "@smsystem/contracts/job-plan-v2";
import { jobPlanCountdownOptionSchema, jobPlanEmployeeOptionSchema } from "@smsystem/contracts/job-plan";
import type { z } from "zod";
import { parseSmsDate, parseSmsDurationMinutes, parseSmsTime } from "@/shared/datagrid/parsers";

export type JobPlanCountdownOption = z.infer<typeof jobPlanCountdownOptionSchema>;
export type JobPlanEmployeeOption = z.infer<typeof jobPlanEmployeeOptionSchema>;

export interface JobPlanV2PlannerDraft {
  clientId: string;
  isNew: true;
  coreId: string;
  employeeId: string;
  taskDate: string;
  startTime: string;
  durationText: string;
  jobDescription: string;
  note: string;
  isOvertime: boolean;
  isRework: boolean;
  isPriority: boolean;
  error: string | null;
}

export interface JobPlanV2DisplayRow {
  clientId: string;
  isNew: boolean;
  planId: string | null;
  coreId: string;
  unitName: string;
  panelName: string;
  jobDescription: string;
  employeeId: string;
  employeeName: string;
  divisionName: string;
  taskDate: string;
  startTime: string;
  finishTime: string;
  durationText: string;
  approval: string;
  execution: string;
  ledger: string;
  sync: string;
  version: number | null;
  note: string;
  isPriority: boolean;
  error: string | null;
}

const approvalLabels: Record<JobPlanV2ApprovalState, string> = {
  DRAFT: "Draft",
  DIVISION_REVIEW: "Review Divisi",
  UNIT_REVIEW: "Review Unit",
  MANAGEMENT_REVIEW: "Review Management",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const executionLabels: Record<JobPlanV2ExecutionState, string> = {
  NOT_STARTED: "Belum Mulai",
  RUNNING: "Berjalan",
  HOLD: "Hold",
  FINISHED_PENDING_VALIDATION: "Menunggu Validasi",
  VALIDATED: "Validated",
};

const ledgerLabels: Record<JobPlanV2LedgerState, string> = {
  UNMATERIALIZED: "Belum Materialized",
  MATERIALIZED: "Materialized",
  FINALIZED: "Finalized",
};

export function formatJobPlanV2Approval(value: JobPlanV2ApprovalState) {
  return approvalLabels[value] ?? value;
}

export function formatJobPlanV2Execution(value: JobPlanV2ExecutionState) {
  return executionLabels[value] ?? value;
}

export function formatJobPlanV2Ledger(value: JobPlanV2LedgerState) {
  return ledgerLabels[value] ?? value;
}

export function minutesToTime(value: number) {
  const safeValue = Math.max(0, value);
  const hour = Math.floor(safeValue / 60) % 24;
  const minute = safeValue % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minutesToDuration(value: number) {
  const safeValue = Math.max(0, value);
  const hour = Math.floor(safeValue / 60);
  const minute = safeValue % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string) {
  const parsed = parseSmsTime(value, "Mulai");
  if (parsed.error || !parsed.value) return { value: null, error: parsed.error ?? "Jam mulai wajib diisi." };
  const [hour, minute] = parsed.value.split(":").map(Number);
  return { value: (hour * 60) + minute };
}

export function resolveJobPlanV2Sync(row: JobPlanV2ReadItem) {
  if (row.read_only || row.live_state_available === false) return "Temporarily unavailable";
  if (row.projection_ready === false) return "Syncing";
  return "Synced";
}

export function createJobPlanV2Draft(context: JobPlanCountdownOption | null): JobPlanV2PlannerDraft {
  return {
    clientId: `draft-${crypto.randomUUID()}`,
    isNew: true,
    coreId: context?.value ?? "",
    employeeId: "",
    taskDate: new Date().toISOString().slice(0, 10),
    startTime: "08:00",
    durationText: context?.availablePlanHours
      ? minutesToDuration(Math.round(context.availablePlanHours * 60))
      : "01:00",
    jobDescription: context?.jobName ?? context?.label ?? "",
    note: "",
    isOvertime: false,
    isRework: false,
    isPriority: false,
    error: null,
  };
}

export function toJobPlanV2DisplayRows(
  items: JobPlanV2ReadItem[],
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
): JobPlanV2DisplayRow[] {
  const countdownByCore = new Map(countdowns.map((item) => [item.value, item]));
  const employeeById = new Map(employees.map((item) => [item.value, item]));

  return items.map((item) => {
    const countdown = countdownByCore.get(item.core_id);
    const employee = item.employee_id ? employeeById.get(item.employee_id) : null;
    return {
      clientId: `plan-${item.plan_id}`,
      isNew: false,
      planId: item.plan_id,
      coreId: item.core_id,
      unitName: countdown?.unitName ?? item.car_id ?? "-",
      panelName: countdown?.panelName ?? "-",
      jobDescription: item.jobdescription ?? countdown?.jobName ?? countdown?.label ?? "-",
      employeeId: item.employee_id ?? "",
      employeeName: employee?.label ?? item.employee_id ?? "-",
      divisionName: countdown?.divisionName ?? String(item.division_id ?? "-"),
      taskDate: item.task_date,
      startTime: minutesToTime(item.planned_start_minute),
      finishTime: minutesToTime(item.planned_finish_minute),
      durationText: minutesToDuration(item.planned_work_minutes),
      approval: formatJobPlanV2Approval(item.approval_state),
      execution: formatJobPlanV2Execution(item.execution_state),
      ledger: formatJobPlanV2Ledger(item.ledger_state),
      sync: resolveJobPlanV2Sync(item),
      version: item.version ?? null,
      note: item.note ?? "",
      isPriority: item.is_priority,
      error: null,
    };
  });
}

export function validateJobPlanV2Draft(row: JobPlanV2PlannerDraft) {
  if (!row.coreId) return "Countdown wajib dipilih.";
  if (!row.employeeId) return "PIC wajib dipilih.";
  const date = parseSmsDate(row.taskDate, "Tanggal");
  if (date.error || !date.value) return date.error ?? "Tanggal wajib diisi.";
  const start = parseTimeToMinutes(row.startTime);
  if (start.error || start.value == null) return start.error ?? "Jam mulai wajib diisi.";
  const duration = parseSmsDurationMinutes(row.durationText, "Durasi");
  if (duration.error || duration.value == null) return duration.error ?? "Durasi wajib diisi.";
  if (!row.jobDescription.trim()) return "Jobdesc wajib diisi.";
  return null;
}

export function buildCreateJobPlanV2Payload(
  row: JobPlanV2PlannerDraft,
  userId: string,
  commandId: string,
): CreateJobPlanV2Request {
  const date = parseSmsDate(row.taskDate, "Tanggal").value;
  const start = parseTimeToMinutes(row.startTime).value;
  const duration = parseSmsDurationMinutes(row.durationText, "Durasi").value;

  if (!date || start == null || duration == null) {
    throw new Error(validateJobPlanV2Draft(row) ?? "Draft Job Plan tidak valid.");
  }

  return {
    userId,
    coreId: row.coreId,
    employeeId: row.employeeId,
    taskDate: date,
    plannedStartMinute: start,
    plannedWorkMinutes: duration,
    jobDescription: row.jobDescription.trim(),
    commandId,
    note: row.note.trim() || null,
    isOvertime: row.isOvertime,
    isRework: row.isRework,
    isPriority: row.isPriority,
  };
}
