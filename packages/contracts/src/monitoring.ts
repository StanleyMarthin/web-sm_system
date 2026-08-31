import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
  code: z.string().nullable().optional(),
  isTeknis: z.boolean().nullable().optional(),
  isTechnical: z.boolean().nullable().optional(),
  divisionId: z.number().int().nullable().optional(),
});

export const monitoringExecutionStatusSchema = z.enum([
  "PLAN",
  "ONPROGRESS",
  "SUBMITTED",
  "READY_QC",
  "DONE",
  "CANCEL",
]);

export const monitoringQcStatusSchema = z.enum([
  "BELUM_QC",
  "LOLOS",
  "TIDAK_LOLOS",
]);

function normalizeExecutionStatus(input: {
  executionStatus?: string | null;
  actualStatus?: string | null;
  countdownStatus?: string | null;
  planStatus?: string | null;
}): z.infer<typeof monitoringExecutionStatusSchema> {
  const explicit = input.executionStatus?.toUpperCase();
  if (monitoringExecutionStatusSchema.safeParse(explicit).success) {
    return explicit as z.infer<typeof monitoringExecutionStatusSchema>;
  }

  const actual = input.actualStatus?.toLowerCase();
  const countdown = input.countdownStatus?.toUpperCase();
  const plan = input.planStatus?.toUpperCase();

  if (actual === "done" || countdown === "DONE") return "DONE";
  if (countdown === "READY_QC" || countdown === "QC_READY" || plan === "READY_QC") return "READY_QC";
  if (actual === "pending") return "SUBMITTED";
  if (actual === "onprogress") return "ONPROGRESS";
  if (actual === "cancel") return "CANCEL";
  return "PLAN";
}

function normalizeQcStatus(input?: string | null): z.infer<typeof monitoringQcStatusSchema> {
  const value = input?.toUpperCase();
  return monitoringQcStatusSchema.safeParse(value).success
    ? value as z.infer<typeof monitoringQcStatusSchema>
    : "BELUM_QC";
}

const monitoringTaskRecordBaseSchema = z.object({
  planId: z.string(),
  coreId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  employeeId: z.string().nullable(),
  employeeName: z.string().nullable(),
  taskDate: z.string(),
  panelName: z.string().nullable(),
  masterJobName: z.string().nullable().catch(null),
  jobDescription: z.string(),
  instructionText: z.string().catch(""),
  targetDailyHours: z.number().nullable().catch(null),
  targetTotalHours: z.number().nullable().catch(null),
  planStatus: z.string(),
  actualStatus: z.string().nullable(),
  executionStatus: z.string().nullable().catch(null),
  countdownStatus: z.string().nullable(),
  progressPercent: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  latestStartTime: z.string().nullable(),
  latestFinishTime: z.string().nullable(),
  latestBreakDurationMinutes: z.number().nullable().optional(),
  actualStartTime: z.string().nullable().catch(null),
  actualBreakMinutes: z.number().nullable().catch(null),
  actualFinishTime: z.string().nullable().catch(null),
  actualDurationHours: z.number().nullable().catch(null),
  actualId: z.string().nullable().catch(null),
  submittedToLedger: z.boolean().default(false),
  planStartTime: z.string().nullable().optional(),
  planFinishTime: z.string().nullable().optional(),
  qcStatus: z.string().nullable().catch(null),
  qcResult: z.string().nullable().catch(null),
  qcNotes: z.string().nullable().catch(null),
  monitoringStatus: z.string().nullable().catch(null),
  monitoringResult: z.string().nullable().catch(null),
  isOvertime: z.boolean(),
  isStarted: z.boolean(),
  isSubmitted: z.boolean(),
  hasDelayRisk: z.boolean(),
});

export const monitoringTaskRecordSchema = monitoringTaskRecordBaseSchema.transform((row) => ({
  ...row,
  masterJobName: row.masterJobName ?? row.jobDescription ?? row.panelName,
  instructionText: row.instructionText || row.jobDescription,
  executionStatus: normalizeExecutionStatus(row),
  actualStartTime: row.actualStartTime ?? row.latestStartTime,
  actualBreakMinutes: row.actualBreakMinutes ?? row.latestBreakDurationMinutes ?? null,
  actualFinishTime: row.actualFinishTime ?? row.latestFinishTime,
  qcStatus: normalizeQcStatus(row.qcStatus ?? row.qcResult),
  qcResult: row.qcResult ?? row.qcStatus,
}));

export const monitoringDivisionUnitRecordSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  totalTasks: z.number().int().nonnegative(),
  startedTasks: z.number().int().nonnegative(),
  pendingSubmitTasks: z.number().int().nonnegative(),
  doneTasks: z.number().int().nonnegative(),
  totalPlannedHours: z.number().nonnegative(),
  totalActualHours: z.number().nonnegative(),
  normalActualHours: z.number().nonnegative().default(0),
  overtimeActualHours: z.number().nonnegative().default(0),
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
});

export const monitoringDivisionLoadRecordSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  totalTasks: z.number().int().nonnegative(),
  startedTasks: z.number().int().nonnegative(),
  pendingSubmitTasks: z.number().int().nonnegative(),
  doneTasks: z.number().int().nonnegative(),
  totalActualHours: z.number().nonnegative(),
  normalActualHours: z.number().nonnegative().default(0),
  overtimeActualHours: z.number().nonnegative().default(0),
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
  units: z.array(monitoringDivisionUnitRecordSchema).default([]),
});

export const monitoringDivisionMemberRecordSchema = z.object({
  employeeId: z.string().nullable(),
  employeeName: z.string().nullable(),
  totalTasks: z.number().int().nonnegative(),
  startedTasks: z.number().int().nonnegative(),
  pendingSubmitTasks: z.number().int().nonnegative(),
  doneTasks: z.number().int().nonnegative(),
  totalPlannedHours: z.number().nonnegative(),
  totalActualHours: z.number().nonnegative(),
  normalActualHours: z.number().nonnegative().default(0),
  overtimeActualHours: z.number().nonnegative().default(0),
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
});

export const monitoringDivisionDetailSummarySchema = z.object({
  totalUnits: z.number().int().nonnegative(),
  totalMembers: z.number().int().nonnegative(),
  totalTasks: z.number().int().nonnegative(),
  totalPlannedHours: z.number().nonnegative(),
  totalActualHours: z.number().nonnegative(),
  totalRemainingHours: z.number().nonnegative(),
});

export const monitoringSummarySchema = z.object({
  activeWork: z.number().int().nonnegative(),
  noStart: z.number().int().nonnegative(),
  noSubmit: z.number().int().nonnegative(),
  delayRisk: z.number().int().nonnegative(),
  overtimeCount: z.number().int().nonnegative(),
});

export const monitoringReferencesSchema = z.object({
  divisions: z.array(optionSchema),
  units: z.array(optionSchema),
  employees: z.array(optionSchema),
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const timeSchema = z.string().trim().regex(/^\d{2}:\d{2}$/u);

export const createMonitoringActualRequestSchema = z.object({
  date: isoDateSchema,
  employeeId: z.string().trim().min(1).max(50),
  divisionId: z.number().int().positive(),
  planId: z.string().trim().max(120).nullable().optional().default(null),
  carId: z.string().trim().max(100).nullable().optional().default(null),
  jobDescription: z.string().trim().min(1).max(500),
  resultNote: z.string().trim().max(500).nullable().optional().default(null),
  startTime: timeSchema,
  finishTime: timeSchema,
  breakMinutes: z.number().int().min(0).max(720).default(0),
  progressPercent: z.number().min(0).max(100).default(0),
  taskStatus: z.enum(["ONPROGRESS", "READY_QC", "DONE", "PENDING", "CANCEL"]),
  location: z.string().trim().max(50).nullable().optional().default(null),
  isOvertime: z.boolean().default(false),
});

export const monitoringActualMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    planId: z.string(),
    actualId: z.string(),
  }),
});

export const monitoringLedgerMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ ledgerId: z.string(), alreadySubmitted: z.boolean() }),
});

export const monitoringQuerySchema = gridQueryStateSchema.extend({
  date: z.string().trim().min(1),
  dateTo: z.string().trim().min(1).optional(),
});

export const monitoringGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(monitoringTaskRecordSchema),
  meta: gridMetaSchema,
  query: monitoringQuerySchema,
  references: monitoringReferencesSchema,
  summary: monitoringSummarySchema,
});

export const monitoringDivisionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(monitoringDivisionLoadRecordSchema),
  date: z.string(),
  dateTo: z.string().optional(),
  mode: z.enum(["all", "normal", "overtime"]).optional(),
  span: z.enum(["daily", "weekly"]).optional(),
});

export const monitoringDivisionDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  divisionId: z.number().int(),
  divisionName: z.string().nullable(),
  date: z.string(),
  dateTo: z.string().optional(),
  mode: z.enum(["all", "normal", "overtime"]).optional(),
  span: z.enum(["daily", "weekly"]).optional(),
  summary: monitoringDivisionDetailSummarySchema,
  units: z.array(monitoringDivisionUnitRecordSchema),
  members: z.array(monitoringDivisionMemberRecordSchema),
});

export const monitoringUnitTimesheetRecordSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  employeeId: z.string().nullable(),
  employeeName: z.string().nullable(),
  divisionName: z.string().nullable().optional(),
  isOvertime: z.boolean(),
  taskDate: z.string(),
  totalActualHours: z.number().nonnegative(),
  totalPlannedHours: z.number().nonnegative(),
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
  totalTasks: z.number().int().nonnegative(),
});

export const monitoringUnitEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(monitoringUnitTimesheetRecordSchema),
  date: z.string(),
  dateTo: z.string().optional(),
  span: z.enum(["daily", "weekly"]).optional(),
});

export const monitoringTaskListEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(monitoringTaskRecordSchema),
  date: z.string(),
});

export type MonitoringTaskRecord = z.infer<typeof monitoringTaskRecordSchema>;
export type MonitoringDivisionLoadRecord = z.infer<
  typeof monitoringDivisionLoadRecordSchema
>;
export type MonitoringDivisionUnitRecord = z.infer<
  typeof monitoringDivisionUnitRecordSchema
>;
export type MonitoringDivisionMemberRecord = z.infer<
  typeof monitoringDivisionMemberRecordSchema
>;
export type MonitoringDivisionDetailSummary = z.infer<
  typeof monitoringDivisionDetailSummarySchema
>;
export type MonitoringUnitTimesheetRecord = z.infer<
  typeof monitoringUnitTimesheetRecordSchema
>;
export type MonitoringSummary = z.infer<typeof monitoringSummarySchema>;
export type MonitoringQuery = z.infer<typeof monitoringQuerySchema>;
export type MonitoringReferences = z.infer<typeof monitoringReferencesSchema>;
export type CreateMonitoringActualRequest = z.infer<typeof createMonitoringActualRequestSchema>;
