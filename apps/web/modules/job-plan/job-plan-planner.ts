import type {
  CreateJobPlanV2Request,
  JobPlanV2ApprovalState,
  JobPlanV2ExecutionState,
  JobPlanV2LedgerState,
  JobPlanV2ReadItem,
  ManualExecutionJobPlanV2Request,
  MutateJobPlanV2ApprovalRequest,
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
  divisionId: number | null;
  carId: string;
  panelId: number | null;
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

export interface JobPlanV2ManualExecutionDraft {
  clientId: string;
  planId: string;
  expectedVersion: number;
  actualStart: string;
  actualFinish: string;
  actualMinutesText: string;
  result: string;
  note: string;
  attachmentRef: string;
  error: string | null;
}

export interface JobPlanV2DisplayRow {
  clientId: string;
  isNew: boolean;
  planId: string | null;
  coreId: string;
  divisionId: number | null;
  carId: string;
  panelId: number | null;
  kpId: string | null;
  kpName: string | null;
  qaIds: string[];
  qaNames: string[];
  unitName: string;
  panelName: string;
  jobDescription: string;
  instructionText: string;
  employeeId: string;
  employeeName: string;
  divisionName: string;
  taskDate: string;
  startTime: string;
  finishTime: string;
  durationText: string;
  targetTotalText: string;
  remainingText: string;
  approval: string;
  approvalState: JobPlanV2ApprovalState;
  execution: string;
  executionState: JobPlanV2ExecutionState;
  ledger: string;
  ledgerState: JobPlanV2LedgerState;
  sync: string;
  version: number | null;
  accumulatedWorkMinutes: number;
  persistedWorkMinutes: number;
  unverifiedWorkMinutes: number;
  note: string;
  isPriority: boolean;
  error: string | null;
  editPlanId?: string;
  editVersion?: number;
}

const approvalLabels: Record<JobPlanV2ApprovalState, string> = {
  DRAFT: "Draft",
  DIVISION_REVIEW: "Review Divisi",
  UNIT_REVIEW: "Review Unit",
  MANAGEMENT_REVIEW: "Review Manajemen",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const executionLabels: Record<JobPlanV2ExecutionState, string> = {
  NOT_STARTED: "Belum Mulai",
  RUNNING: "Berjalan",
  HOLD: "Hold",
  FINISHED_PENDING_VALIDATION: "Menunggu Validasi",
  VALIDATED: "Validated",
};

const ledgerLabels: Record<JobPlanV2LedgerState, string> = {
  UNMATERIALIZED: "Belum Diproses",
  MATERIALIZED: "Sudah Diproses",
  FINALIZED: "Ditetapkan",
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

export function toLocalDateValue(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    divisionId: context?.divisionId ?? null,
    carId: context?.carId ?? "",
    panelId: context?.panelId ?? null,
    employeeId: "",
    taskDate: toLocalDateValue(),
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
      divisionId: countdown?.divisionId ?? (typeof item.division_id === "number" ? item.division_id : null),
      carId: countdown?.carId ?? item.car_id ?? "",
      panelId: countdown?.panelId ?? null,
      kpId: countdown?.kpId ?? null,
      kpName: countdown?.kpName ?? null,
      qaIds: countdown?.qaIds ?? [],
      qaNames: countdown?.qaNames ?? [],
      unitName: countdown?.unitName ?? item.car_id ?? "-",
      panelName: countdown?.panelName ?? "-",
      jobDescription: item.jobdescription ?? countdown?.jobName ?? countdown?.label ?? "-",
      instructionText: item.note ?? "",
      employeeId: item.employee_id ?? "",
      employeeName: employee?.label ?? item.employee_id ?? "-",
      divisionName: countdown?.divisionName ?? String(item.division_id ?? "-"),
      taskDate: item.task_date,
      startTime: minutesToTime(item.planned_start_minute),
      finishTime: minutesToTime(item.planned_finish_minute),
      durationText: minutesToDuration(item.planned_work_minutes),
      targetTotalText: minutesToDuration(Math.round((countdown?.targetTotalHours ?? item.planned_work_minutes / 60) * 60)),
      remainingText: minutesToDuration(Math.round((countdown?.remainingHours ?? 0) * 60)),
      approval: formatJobPlanV2Approval(item.approval_state),
      approvalState: item.approval_state,
      execution: formatJobPlanV2Execution(item.execution_state),
      executionState: item.execution_state,
      ledger: formatJobPlanV2Ledger(item.ledger_state),
      ledgerState: item.ledger_state,
      sync: resolveJobPlanV2Sync(item),
      version: item.version ?? null,
      accumulatedWorkMinutes: item.accumulated_work_minutes,
      persistedWorkMinutes: item.persisted_work_minutes,
      unverifiedWorkMinutes: item.unverified_work_minutes,
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

export function buildEditDraftJobPlanV2Payload(
  row: JobPlanV2PlannerDraft,
  userId: string,
  commandId: string,
  expectedVersion: number,
): MutateJobPlanV2ApprovalRequest {
  const createPayload = buildCreateJobPlanV2Payload(row, userId, commandId);
  return {
    action: "edit_draft",
    userId,
    commandId,
    expectedVersion,
    employeeId: createPayload.employeeId,
    taskDate: createPayload.taskDate,
    plannedStartMinute: createPayload.plannedStartMinute,
    plannedWorkMinutes: createPayload.plannedWorkMinutes,
    jobDescription: createPayload.jobDescription,
    note: createPayload.note,
  };
}

export function createManualExecutionDraft(plan: JobPlanV2DisplayRow): JobPlanV2ManualExecutionDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    clientId: `manual-${plan.planId}`,
    planId: String(plan.planId),
    expectedVersion: Number(plan.version ?? 0),
    actualStart: `${today}T08:00`,
    actualFinish: `${today}T${plan.finishTime || "09:00"}`,
    actualMinutesText: plan.durationText,
    result: "",
    note: "",
    attachmentRef: "",
    error: null,
  };
}

export function validateManualExecutionDraft(row: JobPlanV2ManualExecutionDraft) {
  if (!row.planId) return "Plan wajib dipilih.";
  if (!row.expectedVersion) return "Version plan tidak tersedia.";
  if (!row.actualStart.trim()) return "Waktu mulai aktual wajib diisi.";
  if (!row.actualFinish.trim()) return "Waktu selesai aktual wajib diisi.";
  const minutes = parseSmsDurationMinutes(row.actualMinutesText, "Durasi aktual");
  if (minutes.error || minutes.value == null) return minutes.error ?? "Durasi aktual wajib diisi.";
  return null;
}

export function buildManualExecutionJobPlanV2Payload(
  row: JobPlanV2ManualExecutionDraft,
  userId: string,
  commandId: string,
): ManualExecutionJobPlanV2Request {
  const minutes = parseSmsDurationMinutes(row.actualMinutesText, "Durasi aktual").value;
  if (minutes == null) {
    throw new Error(validateManualExecutionDraft(row) ?? "Hasil pekerjaan tidak valid.");
  }
  return {
    userId,
    commandId,
    expectedVersion: row.expectedVersion,
    actualStart: row.actualStart,
    actualFinish: row.actualFinish,
    actualMinutes: minutes,
    result: row.result.trim() || null,
    note: row.note.trim() || null,
    attachmentRef: row.attachmentRef.trim() || null,
  };
}
