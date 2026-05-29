import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const monitoringTaskRecordSchema = z.object({
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
  jobDescription: z.string(),
  planStatus: z.string(),
  actualStatus: z.string().nullable(),
  countdownStatus: z.string().nullable(),
  progressPercent: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  latestStartTime: z.string().nullable(),
  latestFinishTime: z.string().nullable(),
  isOvertime: z.boolean(),
  isStarted: z.boolean(),
  isSubmitted: z.boolean(),
  hasDelayRisk: z.boolean(),
});

export const monitoringDivisionLoadRecordSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  totalTasks: z.number().int().nonnegative(),
  startedTasks: z.number().int().nonnegative(),
  pendingSubmitTasks: z.number().int().nonnegative(),
  doneTasks: z.number().int().nonnegative(),
  totalActualHours: z.number().nonnegative(),
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
});

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
  totalRemainingHours: z.number().nonnegative(),
  averageProgressPercent: z.number().nonnegative(),
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

export const monitoringQuerySchema = gridQueryStateSchema.extend({
  date: z.string().trim().min(1),
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
export type MonitoringSummary = z.infer<typeof monitoringSummarySchema>;
export type MonitoringQuery = z.infer<typeof monitoringQuerySchema>;
export type MonitoringReferences = z.infer<typeof monitoringReferencesSchema>;
