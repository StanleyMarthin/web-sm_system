import type {
  CreateJobPlanRuntimeRequest,
  JobPlanRuntimeApprovalState,
  JobPlanRuntimeExecutionState,
  JobPlanRuntimeLedgerState,
  JobPlanRuntimeReadItem,
  ManualExecutionJobPlanRuntimeRequest,
  MutateJobPlanRuntimeApprovalRequest,
} from "@smsystem/contracts/job-plan-runtime";
import { jobPlanCountdownOptionSchema, jobPlanEmployeeOptionSchema, jobPlanJobTypeOptionSchema, jobPlanPanelOptionSchema, type JobPlanDraftRecord, type JobPlanRecord } from "@smsystem/contracts/job-plan";
import { breakMinutesForJobPlanDate, breakStartMinutesForJobPlanDate, buildJobPlanScheduleSegments } from "@smsystem/contracts/job-plan-schedule";
import type { z } from "zod";
import { parseSmsDate, parseSmsDurationMinutes, parseSmsTime } from "@/shared/datagrid/parsers";

export type JobPlanCountdownOption = z.infer<typeof jobPlanCountdownOptionSchema>;
export type JobPlanEmployeeOption = z.infer<typeof jobPlanEmployeeOptionSchema>;
export type JobPlanJobTypeOption = z.infer<typeof jobPlanJobTypeOptionSchema>;
export type JobPlanPanelOption = z.infer<typeof jobPlanPanelOptionSchema>;

export function jobActualQcLabel(actual?: JobPlanRecord): string | null {
  if (actual?.actualQcLevel === "QC_KD") return "QC_KD · Menunggu QA";
  if (["QC_QA", "QC_ADVISOR"].includes(actual?.actualQcLevel ?? "")) {
    return actual?.actualQcResult === "LOLOS" ? "Lolos QC" : "Tidak lolos QC";
  }
  return null;
}

export interface JobPlanRuntimePlannerDraft {
  clientId: string;
  isNew: true;
  sourceType: "countdown" | "additional";
  workMode: "normal" | "overtime";
  coreId: string;
  divisionId: number | null;
  carId: string;
  panelId: number | null;
  panelName?: string | null;
  jobTypeId: string;
  jobTypeName: string;
  employeeId: string;
  taskDate: string;
  deadlineDate?: string | null;
  startTime: string;
  durationText: string;
  targetTotalText?: string;
  jobDescription: string;
  initialFinding: string;
  note: string;
  isOvertime: boolean;
  isRework: boolean;
  isPriority: boolean;
  error: string | null;
}

export interface JobPlanRuntimeManualExecutionDraft {
  clientId: string;
  planId: string;
  expectedVersion: number;
  actualStart: string;
  actualFinish: string;
  breakMinutesText: string;
  status: "pending" | "on_progress" | "done";
  progressText: string;
  error: string | null;
}

export interface JobPlanRuntimeDisplayRow {
  clientId: string;
  isNew: boolean;
  workMode: "normal" | "overtime";
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
  initialFinding: string;
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
  approvalState: JobPlanRuntimeApprovalState;
  execution: string;
  executionState: JobPlanRuntimeExecutionState;
  ledger: string;
  ledgerState: JobPlanRuntimeLedgerState;
  sync: string;
  createdBy: string | null;
  version: number | null;
  accumulatedWorkMinutes: number;
  persistedWorkMinutes: number;
  unverifiedWorkMinutes: number;
  monitoringHistory: Array<{
    sequence: number;
    time: string | null;
    progress: number | null;
    note: string | null;
  }>;
  actualStartAt: string | null;
  actualFinishAt: string | null;
  activeSegmentStartedAt: string | null;
  note: string;
  isPriority: boolean;
  error: string | null;
  editPlanId?: string;
  editVersion?: number;
  isLiveProjected?: boolean;
}

export function resolveJobPlanDivisionName(
  divisionId: number | null,
  divisions: Array<{ value: string; label: string }>,
  employees: JobPlanEmployeeOption[],
  countdowns: JobPlanCountdownOption[],
  preferredName?: string | null,
) {
  const candidates = [
    preferredName,
    divisions.find((item) => item.value === String(divisionId ?? ""))?.label,
    employees.find((item) => item.divisionId === divisionId)?.divisionName,
    countdowns.find((item) => item.divisionId === divisionId)?.divisionName,
  ];

  return candidates.find((value) => {
    const normalized = value?.trim();
    return Boolean(normalized && normalized !== "-");
  })?.trim() ?? "-";
}

export function isJobPlanCountdownPlannable(item: JobPlanCountdownOption) {
  const status = String(item.status ?? "PLAN").trim().toUpperCase();
  const availableHours = item.availablePlanHours ?? item.remainingHours ?? 0;
  return availableHours > 0 && !["DONE", "CANCEL", "READY_QC", "QC_READY", "REJECTED"].includes(status);
}

export function buildCountdownPanelOptions(
  countdowns: JobPlanCountdownOption[],
  filters: { divisionId: number | null; carId: string },
) {
  const seen = new Set<string>();
  return countdowns
    .filter((item) =>
      isJobPlanCountdownPlannable(item)
      && item.panelId !== null
      && item.panelId !== undefined
      && (filters.divisionId === null || item.divisionId === filters.divisionId)
      && (!filters.carId || item.carId === filters.carId)
    )
    .map((item) => ({
      value: String(item.panelId),
      label: item.panelName?.trim() || "-",
    }))
    .filter((item) => {
      if (!item.value || seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildJobPlanDraftRecord(
  draft: JobPlanRuntimePlannerDraft,
  references: {
    countdowns: JobPlanCountdownOption[];
    employees: JobPlanEmployeeOption[];
    divisions: Array<{ value: string; label: string }>;
    panels: JobPlanPanelOption[];
    jobTypes: JobPlanJobTypeOption[];
  },
): JobPlanDraftRecord {
  const countdown = references.countdowns.find((item) => item.value === draft.coreId)
    ?? references.countdowns.find((item) =>
      item.divisionId === draft.divisionId
      && item.carId === draft.carId
      && item.panelId === draft.panelId,
    );
  const employee = references.employees.find((item) => item.value === draft.employeeId);
  const panel = references.panels.find((item) => item.value === String(draft.panelId ?? "") && (!item.carId || item.carId === draft.carId));
  const jobType = references.jobTypes.find((item) => item.value === draft.jobTypeId);
  const divisionName = resolveJobPlanDivisionName(
    draft.divisionId,
    references.divisions,
    references.employees,
    references.countdowns,
    countdown?.divisionName,
  );
  const durationMinutes = parseSmsDurationMinutes(draft.durationText, "Durasi").value ?? 0;
  const targetMinutes = parseSmsDurationMinutes(draft.targetTotalText?.trim() || draft.durationText, "Target awal").value ?? durationMinutes;
  const startMinutes = parseTimeToMinutes(draft.startTime).value ?? 0;

  return {
    draftItemId: draft.clientId,
    sourceType: "COUNTDOWN",
    coreId: draft.coreId,
    carId: draft.carId,
    unitName: countdown?.unitName ?? draft.carId,
    divisionId: draft.divisionId,
    divisionName,
    panelId: draft.panelId,
    panelName: countdown?.panelName ?? draft.panelName ?? panel?.panelName ?? null,
    jobTypeId: draft.jobTypeId || null,
    jobName: countdown?.jobName ?? jobType?.jobName ?? draft.jobDescription,
    assignedUserId: draft.employeeId,
    assignedUserName: employee?.label ?? draft.employeeId,
    taskDate: draft.taskDate,
    targetHours: targetMinutes / 60,
    startTime: draft.startTime,
    finishTime: minutesToTime(startMinutes + durationMinutes),
    jobDescription: draft.jobDescription.trim(),
    note: draft.note.trim() || null,
    isOvertime: draft.isOvertime,
    isPriority: draft.isPriority,
    deadlineDate: draft.deadlineDate?.trim() || calculateJobPlanDeadlineDate(draft.taskDate, targetMinutes),
    isRework: draft.isRework,
    isNonTechnicalJob: false,
    picPlan: draft.employeeId,
    requiredGrade: null,
  };
}

const approvalLabels: Record<JobPlanRuntimeApprovalState, string> = {
  DRAFT: "Draft",
  DIVISION_REVIEW: "Review QA",
  UNIT_REVIEW: "Review KP",
  MANAGEMENT_REVIEW: "Review PM",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const executionLabels: Record<JobPlanRuntimeExecutionState, string> = {
  NOT_STARTED: "Belum Mulai",
  RUNNING: "Berjalan",
  HOLD: "Hold",
  FINISHED_PENDING_VALIDATION: "Menunggu Validasi",
  VALIDATED: "Validated",
};

const ledgerLabels: Record<JobPlanRuntimeLedgerState, string> = {
  UNMATERIALIZED: "Belum Diproses",
  MATERIALIZED: "Sudah Diproses",
  FINALIZED: "Ditetapkan",
};

export function formatJobPlanRuntimeApproval(value: JobPlanRuntimeApprovalState) {
  return approvalLabels[value] ?? value;
}

export function formatJobPlanRuntimeExecution(value: JobPlanRuntimeExecutionState) {
  return executionLabels[value] ?? value;
}

export function formatJobPlanRuntimeLedger(value: JobPlanRuntimeLedgerState) {
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

export function calculateJobPlanDeadlineDate(startDate: string, targetMinutes: number) {
  const parsedStart = parseSmsDate(startDate, "Tanggal").value;
  if (!parsedStart || !Number.isFinite(targetMinutes) || targetMinutes <= 0) return startDate;

  const currentDate = new Date(`${parsedStart}T00:00:00.000Z`);
  let remainingMinutes = Math.ceil(targetMinutes);

  for (let guard = 0; guard < 730; guard += 1) {
    const day = currentDate.getUTCDay();
    const dailyCapacity = day === 0 ? 0 : day === 6 ? 5 * 60 : 8 * 60;
    if (dailyCapacity > 0) {
      remainingMinutes -= dailyCapacity;
      if (remainingMinutes <= 0) return currentDate.toISOString().slice(0, 10);
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return parsedStart;
}

export function parseTimeToMinutes(value: string) {
  const parsed = parseSmsTime(value, "Mulai");
  if (parsed.error || !parsed.value) return { value: null, error: parsed.error ?? "Jam mulai wajib diisi." };
  const [hour, minute] = parsed.value.split(":").map(Number);
  return { value: (hour * 60) + minute };
}

export function resolveJobPlanRuntimeSync(row: JobPlanRuntimeReadItem) {
  if (row.read_only || row.live_state_available === false) return "Temporarily unavailable";
  if (row.projection_ready === false) return "Syncing";
  return "Synced";
}

export const JOB_PLAN_PARTLESS_PART_NAME = "Tanpa part";

export function jobPlanPartName(partName: string | null | undefined) {
  return partName?.trim() || JOB_PLAN_PARTLESS_PART_NAME;
}

function sortedUniqueText(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "id"));
}

export function jobPlanComponentNames(panels: JobPlanPanelOption[]) {
  return sortedUniqueText(panels.map((panel) => panel.componentName ?? ""));
}

export function jobPlanPanelNames(panels: JobPlanPanelOption[], componentName?: string | null) {
  const component = componentName?.trim();
  return sortedUniqueText(
    panels
      .filter((panel) => !component || (panel.componentName ?? "").trim() === component)
      .map((panel) => panel.panelName),
  );
}

export function jobPlanPartNames(panels: JobPlanPanelOption[], panelName: string) {
  const panel = panelName.trim();
  if (!panel) return [];
  return sortedUniqueText(
    panels
      .filter((row) => row.panelName.trim() === panel)
      .map((row) => jobPlanPartName(row.partName)),
  );
}

export function findJobPlanPanelValue(panels: JobPlanPanelOption[], panelName: string, partName: string) {
  const panel = panelName.trim();
  const part = jobPlanPartName(partName);
  const match = panels.find((row) => row.panelName.trim() === panel && jobPlanPartName(row.partName) === part);
  return match?.value ?? null;
}

export function parseClockMinutes(value: string) {
  const parsed = parseSmsTime(value, "Jam");
  if (parsed.error || !parsed.value) return null;
  const [hour, minute] = parsed.value.split(":").map(Number);
  return (hour * 60) + minute;
}

export function jobPlanElapsedMinutesFrom(startedAt: string | null | undefined, now = new Date()) {
  if (!startedAt) return 0;
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - started.getTime()) / 60000));
}

export function liveJobPlanActualMinutes(row: JobPlanRuntimeDisplayRow, now = new Date()) {
  if (row.isLiveProjected) return row.accumulatedWorkMinutes;
  if (row.executionState !== "RUNNING") return row.accumulatedWorkMinutes;
  return row.accumulatedWorkMinutes + jobPlanElapsedMinutesFrom(row.activeSegmentStartedAt, now);
}

export function liveJobPlanUnverifiedMinutes(row: JobPlanRuntimeDisplayRow, now = new Date()) {
  return Math.max(0, liveJobPlanActualMinutes(row, now) - row.persistedWorkMinutes);
}

export function jobPlanWindowMinutes(startTime: string, finishTime: string) {
  const start = parseClockMinutes(startTime);
  const finish = parseClockMinutes(finishTime);
  if (start === null || finish === null || finish <= start) return null;
  return finish - start;
}

export function jobPlanBreakMinutesForWindow(taskDate: string, startTime: string, finishTime: string) {
  const start = parseClockMinutes(startTime);
  const windowMinutes = jobPlanWindowMinutes(startTime, finishTime);
  if (start === null || windowMinutes === null) return 0;

  const breakStart = breakStartMinutesForJobPlanDate(taskDate);
  const breakMinutes = breakMinutesForJobPlanDate(taskDate);
  return start < breakStart + breakMinutes && start + windowMinutes > breakStart ? breakMinutes : 0;
}

export function resolveAdditionalJobTargetMinutes(targetText: string | null | undefined, dailyMinutes: number) {
  const rawTarget = targetText?.trim() ?? "";
  if (!rawTarget) return { value: dailyMinutes };

  const target = parseSmsDurationMinutes(rawTarget, "Target awal");
  if (target.error || !target.value) return { value: null, error: target.error ?? "Target awal tidak valid." };
  if (target.value < dailyMinutes) return { value: null, error: "Target awal tidak boleh lebih kecil dari total target hari ini." };

  return { value: target.value };
}

export function splitJobPlanRuntimeDraftForSchedule(row: JobPlanRuntimePlannerDraft): JobPlanRuntimePlannerDraft[] {
  const durationMinutes = parseSmsDurationMinutes(row.durationText, "Durasi").value;
  if (durationMinutes == null || durationMinutes <= 0) return [row];

  const segments = buildJobPlanScheduleSegments({
    taskDate: row.taskDate,
    requestedMode: row.isOvertime ? "overtime" : "normal",
    targetHours: durationMinutes / 60,
    startTime: row.startTime,
  });
  if (segments.length <= 1) return [row];

  return segments.map((segment, index) => ({
    ...row,
    clientId: index === 0 ? row.clientId : `${row.clientId}-${segment.mode}-${index}`,
    workMode: segment.mode,
    isOvertime: segment.mode === "overtime",
    startTime: segment.startTime,
    durationText: minutesToDuration(Math.round(segment.targetHours * 60)),
  }));
}

export function createJobPlanRuntimeDraft(context: JobPlanCountdownOption | null): JobPlanRuntimePlannerDraft {
  return {
    clientId: `draft-${crypto.randomUUID()}`,
    isNew: true,
    sourceType: "countdown",
    workMode: "normal",
    coreId: context?.value ?? "",
    divisionId: context?.divisionId ?? null,
    carId: context?.carId ?? "",
    panelId: context?.panelId ?? null,
    jobTypeId: "",
    jobTypeName: "",
    employeeId: "",
    taskDate: toLocalDateValue(),
    startTime: "08:00",
    durationText: context?.availablePlanHours
      ? minutesToDuration(Math.round(context.availablePlanHours * 60))
      : "01:00",
    targetTotalText: "",
    jobDescription: context?.jobName ?? context?.label ?? "",
    initialFinding: "",
    note: "",
    isOvertime: false,
    isRework: false,
    isPriority: false,
    error: null,
  };
}

export function toJobPlanRuntimeDisplayRows(
  items: JobPlanRuntimeReadItem[],
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
): JobPlanRuntimeDisplayRow[] {
  const countdownByCore = new Map(countdowns.map((item) => [item.value, item]));
  const employeeById = new Map(employees.map((item) => [item.value, item]));

  return items.filter((item) => item.approval_state !== "CANCELLED").map((item) => {
    const countdown = countdownByCore.get(item.core_id);
    const employee = item.employee_id ? employeeById.get(item.employee_id) : null;
    const divisionName = countdown?.divisionName ?? item.division_name ?? employee?.divisionName ?? "-";
    const unitName = countdown?.unitName ?? item.unit_name ?? item.car_id ?? "-";
    const panelName = countdown?.panelName ?? item.panel_name ?? "-";
    const employeeName = employee?.label ?? item.employee_name ?? item.employee_id ?? "-";
    return {
      clientId: `plan-${item.plan_id}`,
      isNew: false,
      planId: item.plan_id,
      workMode: item.is_overtime ? "overtime" : "normal",
      coreId: item.core_id,
      divisionId: countdown?.divisionId ?? (typeof item.division_id === "number" ? item.division_id : null),
      carId: countdown?.carId ?? item.car_id ?? "",
      panelId: countdown?.panelId ?? null,
      kpId: countdown?.kpId ?? null,
      kpName: countdown?.kpName ?? null,
      qaIds: countdown?.qaIds ?? [],
      qaNames: countdown?.qaNames ?? [],
      unitName,
      panelName,
      jobDescription: item.jobdescription ?? countdown?.jobName ?? countdown?.label ?? "-",
      initialFinding: "",
      instructionText: item.note ?? "",
      employeeId: item.employee_id ?? "",
      employeeName,
      divisionName,
      taskDate: item.task_date,
      startTime: minutesToTime(item.planned_start_minute),
      finishTime: minutesToTime(item.planned_finish_minute),
      durationText: minutesToDuration(item.planned_work_minutes),
      targetTotalText: minutesToDuration(Math.round((countdown?.targetTotalHours ?? item.planned_work_minutes / 60) * 60)),
      remainingText: minutesToDuration(Math.round((countdown?.remainingHours ?? 0) * 60)),
      approval: formatJobPlanRuntimeApproval(item.approval_state),
      approvalState: item.approval_state,
      execution: formatJobPlanRuntimeExecution(item.execution_state),
      executionState: item.execution_state,
      ledger: formatJobPlanRuntimeLedger(item.ledger_state),
      ledgerState: item.ledger_state,
      sync: resolveJobPlanRuntimeSync(item),
      createdBy: item.created_by ?? null,
      version: item.version ?? null,
      accumulatedWorkMinutes: item.accumulated_work_minutes,
      persistedWorkMinutes: item.persisted_work_minutes,
      unverifiedWorkMinutes: item.unverified_work_minutes,
      monitoringHistory: (item.monitoring_history ?? []).map((entry) => ({
        sequence: entry.sequence,
        time: entry.time ?? null,
        progress: entry.progress ?? null,
        note: entry.note ?? null,
      })),
      actualStartAt: item.actual_start ?? null,
      actualFinishAt: item.actual_finish ?? null,
      activeSegmentStartedAt: item.active_segment_started_at ?? null,
      note: item.note ?? "",
      isPriority: item.is_priority,
      error: null,
    };
  });
}

export function toJobPlanDraftDisplayRows(
  drafts: JobPlanRecord[],
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
): JobPlanRuntimeDisplayRow[] {
  const countdownByCore = new Map(countdowns.map((item) => [item.value, item]));
  const employeeById = new Map(employees.map((item) => [item.value, item]));

  return drafts.filter((draft) => draft.status === "DRAFT").map((draft) => {
    const countdown = countdownByCore.get(draft.coreId);
    const employee = employeeById.get(draft.assignedUserId);
    const targetMinutes = Math.round(draft.targetHours * 60);
    const remainingHours = draft.remainingHours ?? countdown?.remainingHours ?? draft.availablePlanHours ?? draft.targetHours;
    return {
      clientId: `legacy-draft-${draft.planId}`,
      isNew: false,
      planId: draft.planId,
      workMode: draft.isOvertime ? "overtime" : "normal",
      coreId: draft.coreId,
      divisionId: countdown?.divisionId ?? draft.divisionId ?? null,
      carId: countdown?.carId ?? draft.draftCarId ?? "",
      panelId: countdown?.panelId ?? draft.draftPanelId ?? null,
      kpId: countdown?.kpId ?? null,
      kpName: countdown?.kpName ?? null,
      qaIds: countdown?.qaIds ?? [],
      qaNames: countdown?.qaNames ?? [],
      unitName: countdown?.unitName ?? draft.unitName,
      panelName: countdown?.panelName ?? draft.panelName ?? "-",
      jobDescription: draft.jobDescription || countdown?.jobName || countdown?.label || "-",
      initialFinding: "",
      instructionText: draft.instructionText || draft.note || "",
      employeeId: draft.assignedUserId,
      employeeName: employee?.label ?? draft.assignedUserName,
      divisionName: countdown?.divisionName ?? draft.divisionName,
      taskDate: draft.taskDate,
      startTime: draft.startTime ?? "-",
      finishTime: draft.finishTime ?? "-",
      durationText: minutesToDuration(targetMinutes),
      targetTotalText: minutesToDuration(Math.round((draft.targetTotalHours ?? draft.targetHours) * 60)),
      remainingText: minutesToDuration(Math.round(remainingHours * 60)),
      approval: formatJobPlanRuntimeApproval("DRAFT"),
      approvalState: "DRAFT",
      execution: formatJobPlanRuntimeExecution("NOT_STARTED"),
      executionState: "NOT_STARTED",
      ledger: formatJobPlanRuntimeLedger("UNMATERIALIZED"),
      ledgerState: "UNMATERIALIZED",
      sync: "Draft Redis",
      createdBy: null,
      version: 1,
      accumulatedWorkMinutes: 0,
      persistedWorkMinutes: 0,
      unverifiedWorkMinutes: 0,
      monitoringHistory: [],
      actualStartAt: null,
      actualFinishAt: null,
      activeSegmentStartedAt: null,
      note: draft.note ?? "",
      isPriority: draft.isPriority,
      error: null,
    };
  });
}

export function createEditDraftFromRow(row: JobPlanRuntimeDisplayRow): JobPlanRuntimePlannerDraft & { editPlanId: string; editVersion: number } {
  return {
    clientId: `edit-${row.planId}`,
    isNew: true,
    sourceType: "countdown",
    coreId: row.coreId,
    divisionId: row.divisionId,
    carId: row.carId,
    panelId: row.panelId,
    jobTypeId: "",
    jobTypeName: "",
    employeeId: row.employeeId,
    taskDate: row.taskDate,
    startTime: row.startTime,
    durationText: row.durationText,
    jobDescription: row.jobDescription,
    initialFinding: "",
    note: row.note,
    isOvertime: row.workMode !== "normal",
    isRework: false,
    isPriority: row.isPriority,
    error: null,
    editPlanId: row.planId ?? "",
    editVersion: row.version ?? 0,
    workMode: row.workMode,
  };
}

export function validateJobPlanRuntimeDraft(row: JobPlanRuntimePlannerDraft) {
  if (row.sourceType === "additional") {
    if (!row.divisionId) return "Team wajib dipilih.";
    if (!row.carId) return "Unit wajib dipilih.";
    if (!row.panelId) return "Panel wajib dipilih.";
    if (!row.jobTypeId && !row.jobTypeName.trim()) return "Jobdesc tambahan wajib diisi.";
  } else if (!row.coreId) {
    return "Countdown wajib dipilih.";
  }
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

export function buildCreateJobPlanRuntimePayload(
  row: JobPlanRuntimePlannerDraft,
  userId: string,
  commandId: string,
): CreateJobPlanRuntimeRequest {
  const date = parseSmsDate(row.taskDate, "Tanggal").value;
  const start = parseTimeToMinutes(row.startTime).value;
  const duration = parseSmsDurationMinutes(row.durationText, "Durasi").value;

  if (!date || start == null || duration == null) {
    throw new Error(validateJobPlanRuntimeDraft(row) ?? "Draft Job Plan tidak valid.");
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

export function buildEditDraftJobPlanRuntimePayload(
  row: JobPlanRuntimePlannerDraft,
  userId: string,
  commandId: string,
  expectedVersion: number,
): MutateJobPlanRuntimeApprovalRequest {
  const createPayload = buildCreateJobPlanRuntimePayload(row, userId, commandId);
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

export function createManualExecutionDraft(plan: JobPlanRuntimeDisplayRow): JobPlanRuntimeManualExecutionDraft {
  return {
    clientId: `manual-${plan.planId}`,
    planId: String(plan.planId),
    expectedVersion: Number(plan.version ?? 0),
    actualStart: `${plan.taskDate}T${plan.startTime || "08:00"}`,
    actualFinish: `${plan.taskDate}T${plan.finishTime || "09:00"}`,
    breakMinutesText: "00:00",
    status: "done",
    progressText: "100",
    error: null,
  };
}

function parseManualExecutionDateTime(value: string, label: string) {
  const raw = value.trim();
  if (!raw) return { value: null, error: `${label} wajib diisi.` };
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return { value: null, error: `${label} tidak valid.` };
  return { value: Math.floor(parsed / 60000), error: null };
}

export function manualExecutionDraftActualMinutes(row: JobPlanRuntimeManualExecutionDraft) {
  const start = parseManualExecutionDateTime(row.actualStart, "Jam mulai aktual");
  if (start.error || start.value == null) return { value: null, error: start.error };
  const finish = parseManualExecutionDateTime(row.actualFinish, "Jam selesai aktual");
  if (finish.error || finish.value == null) return { value: null, error: finish.error };
  if (finish.value <= start.value) return { value: null, error: "Jam selesai harus lebih besar dari jam mulai." };

  const breakText = row.breakMinutesText.trim();
  const breakMinutes = breakText
    ? parseSmsDurationMinutes(breakText, "Jam istirahat")
    : { value: 0, error: null };
  if (breakMinutes.error || breakMinutes.value == null) return { value: null, error: breakMinutes.error ?? "Jam istirahat tidak valid." };

  const elapsed = finish.value - start.value;
  if (breakMinutes.value >= elapsed) return { value: null, error: "Jam istirahat harus lebih kecil dari durasi kerja." };
  return { value: elapsed - breakMinutes.value, error: null };
}

export function validateManualExecutionDraft(row: JobPlanRuntimeManualExecutionDraft) {
  if (!row.planId) return "Plan wajib dipilih.";
  if (!row.expectedVersion) return "Version plan tidak tersedia.";
  const minutes = manualExecutionDraftActualMinutes(row);
  if (minutes.error || minutes.value == null) return minutes.error ?? "Durasi aktual wajib diisi.";
  const progress = Number(row.progressText);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return "Persentase harus 0 sampai 100.";
  if (row.status === "done" && progress !== 100) return "Status selesai harus 100%.";
  return null;
}

export function buildManualExecutionJobPlanRuntimePayload(
  row: JobPlanRuntimeManualExecutionDraft,
  userId: string,
  commandId: string,
): ManualExecutionJobPlanRuntimeRequest {
  const minutes = manualExecutionDraftActualMinutes(row).value;
  if (minutes == null) {
    throw new Error(validateManualExecutionDraft(row) ?? "Hasil pekerjaan tidak valid.");
  }
  const progress = Number(row.progressText);
  const statusLabels = {
    pending: "Pending",
    on_progress: "On Progress",
    done: "Selesai",
  } satisfies Record<JobPlanRuntimeManualExecutionDraft["status"], string>;
  return {
    userId,
    commandId,
    expectedVersion: row.expectedVersion,
    actualStart: row.actualStart,
    actualFinish: row.actualFinish,
    actualMinutes: minutes,
    result: statusLabels[row.status],
    note: `Status: ${statusLabels[row.status]} · Progress: ${progress}% · Istirahat: ${row.breakMinutesText.trim() || "00:00"}`,
    attachmentRef: null,
  };
}
