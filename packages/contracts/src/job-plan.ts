import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

export const jobPlanStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "PENDING_ADV",
  "PENDING_KP",
  "PENDING_MP",
  "PLAN",
  "ONPROGRESS",
  "READY_QC",
  "DONE",
  "REJECTED",
  "CANCEL",
]);

export const jobPlanWindowSchema = z.enum(["daily", "weekly"]);

export const jobPlanModeSchema = z.enum(["all", "normal", "overtime"]);
export const jobPlanExportFormatSchema = z.enum(["csv", "xlsx", "pdf", "image"]);
export const jobPlanCreateModeSchema = z.enum(["normal", "overtime"]);
export const jobPlanWorkspaceSourceSchema = z.enum(["countdown", "wo", "additional"]);

export const jobPlanReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const jobPlanEmployeeOptionSchema = jobPlanReferenceOptionSchema.extend({
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable().optional(),
});

export const jobPlanCountdownOptionSchema = jobPlanReferenceOptionSchema.extend({
  unitName: z.string(),
  carId: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  panelName: z.string().nullable().optional(),
  panelSectionName: z.string().nullable().optional(),
  jobName: z.string().nullable().optional(),
  remainingHours: z.number(),
  availablePlanHours: z.number().nullable().optional(),
  progressPercent: z.number().nullable().optional(),
});

export const jobPlanUnitOptionSchema = jobPlanReferenceOptionSchema.extend({
  unitName: z.string(),
});

export const jobPlanWorkOrderOptionSchema = jobPlanReferenceOptionSchema.extend({
  carId: z.string(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable().optional(),
  panelName: z.string().nullable().optional(),
  estimatedHours: z.number(),
});

export const jobPlanPanelOptionSchema = jobPlanReferenceOptionSchema.extend({
  carId: z.string().nullable().optional(),
  panelName: z.string(),
});

export const jobPlanJobTypeOptionSchema = jobPlanReferenceOptionSchema.extend({
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable().optional(),
  jobName: z.string(),
});

export const jobPlanRecordSchema = z.object({
  planId: z.string(),
  coreId: z.string(),
  taskDate: z.string(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  panelName: z.string().nullable().optional(),
  panelSectionName: z.string().nullable().optional(),
  jobName: z.string().nullable().optional(),
  assignedUserId: z.string(),
  assignedUserName: z.string(),
  targetHours: z.number(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  isOvertime: z.boolean(),
  isPriority: z.boolean(),
  status: jobPlanStatusSchema,
  jobDescription: z.string(),
  note: z.string().nullable(),
  draftSourceType: z.string().trim().max(32).nullable().optional(),
  draftCarId: z.string().trim().max(100).nullable().optional(),
  draftPanelId: z.number().int().positive().nullable().optional(),
  draftJobTypeId: z.string().trim().max(100).nullable().optional(),
  draftDeadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional(),
  draftIsRework: z.boolean().nullable().optional(),
  availablePlanHours: z.number().nullable().optional(),
  remainingHours: z.number().nullable(),
  progressPercent: z.number().nullable(),
});

export const jobPlanSummarySchema = z.object({
  totalHours: z.number(),
  pendingCount: z.number().int().min(0),
  approvedCount: z.number().int().min(0),
  overtimeCount: z.number().int().min(0),
});

export const jobPlanGridReferenceSchema = z.object({
  employees: z.array(jobPlanEmployeeOptionSchema),
  divisions: z.array(jobPlanReferenceOptionSchema),
  units: z.array(jobPlanUnitOptionSchema),
  countdowns: z.array(jobPlanCountdownOptionSchema),
  workOrders: z.array(jobPlanWorkOrderOptionSchema),
  panels: z.array(jobPlanPanelOptionSchema),
  jobTypes: z.array(jobPlanJobTypeOptionSchema),
  statuses: z.array(jobPlanReferenceOptionSchema),
});

export const jobPlanGridQuerySchema = gridQueryStateSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).default("2026-01-01"),
  window: jobPlanWindowSchema.default("daily"),
  mode: jobPlanModeSchema.default("normal"),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).default("2026-01-01"),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).default("2026-01-01"),
});

export const jobPlanGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(jobPlanRecordSchema),
  meta: gridMetaSchema,
  references: jobPlanGridReferenceSchema,
  query: jobPlanGridQuerySchema,
  summary: jobPlanSummarySchema,
});

export const jobPlanPicLoadSchema = z.object({
  normal: z.object({
    used: z.number(),
    max: z.number(),
    remaining: z.number(),
  }),
  overtime: z.object({
    used: z.number(),
    max: z.number(),
    remaining: z.number(),
  }),
});

export const jobPlanPicLoadEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    employeeId: z.string(),
    taskDate: z.string(),
    capacity: jobPlanPicLoadSchema,
  }),
});

export const jobPlanMutationResultSchema = z.object({
  createdIds: z.array(z.string()).default([]),
  updatedPlanId: z.string().nullable().default(null),
  deletedPlanId: z.string().nullable().default(null),
  status: jobPlanStatusSchema.nullable().default(null),
});

export const jobPlanMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: jobPlanMutationResultSchema,
});

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/u)
  .nullable()
  .optional();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const durationHoursSchema = z.string().trim().regex(/^\d{1,3}:\d{2}$/u);
const nullableTextSchema = z.string().trim().max(255).nullable().optional().default(null);

export const jobPlanDraftItemSchema = z.object({
  coreId: z.string().trim().min(1).max(64),
  assignedUserId: z.string().trim().min(1).max(50),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  targetHours: z.number().positive().max(12),
  startTime: timeSchema.default(null),
  finishTime: timeSchema.default(null),
  jobDescription: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).nullable().optional().default(null),
  isOvertime: z.boolean().default(false),
  isPriority: z.boolean().default(false),
});

export const createJobPlanRequestSchema = jobPlanDraftItemSchema;

export const bulkCreateJobPlanRequestSchema = z.object({
  plans: z.array(jobPlanDraftItemSchema).min(1).max(100),
});

export const jobPlanWorkspaceDraftRowSchema = z.object({
  source: jobPlanWorkspaceSourceSchema,
  referenceId: z.string().trim().max(100).nullable().optional().default(null),
  carId: z.string().trim().max(100).nullable().optional().default(null),
  panelId: z.number().int().positive().nullable().optional().default(null),
  jobTypeId: z.string().trim().max(100).nullable().optional().default(null),
  assignedUserId: z.string().trim().min(1).max(50),
  targetHours: z.number().positive().max(12),
  startTime: timeSchema.default(null),
  finishTime: timeSchema.default(null),
  jobDescription: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).nullable().optional().default(null),
  isPriority: z.boolean().default(false),
});

export const createJobPlanWorkspaceRequestSchema = z.object({
  mode: jobPlanCreateModeSchema,
  taskDate: isoDateSchema,
  deadlineDate: isoDateSchema,
  projectTargetHours: durationHoursSchema,
  isRework: z.boolean().default(false),
  rows: z.array(jobPlanWorkspaceDraftRowSchema).min(1).max(100),
});

export const updateJobPlanRequestSchema = jobPlanDraftItemSchema.omit({
  coreId: true,
}).partial().extend({
  assignedUserId: z.string().trim().min(1).max(50).optional(),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  targetHours: z.number().positive().max(12).optional(),
  jobDescription: z.string().trim().min(1).max(500).optional(),
});

export const updateJobPlanStatusRequestSchema = z.object({
  status: jobPlanStatusSchema,
  note: z.string().trim().max(500).nullable().optional().default(null),
});

export const jobPlanDraftRecordSchema = z.object({
  draftItemId: z.string().trim().min(1).max(120),
  sourceType: z.string().trim().min(1).max(32).default("COUNTDOWN"),
  coreId: z.string().trim().max(64).nullable().optional().default(null),
  carId: z.string().trim().max(100).nullable().optional().default(null),
  unitName: nullableTextSchema,
  divisionId: z.number().int().nullable().optional().default(null),
  divisionName: nullableTextSchema,
  panelId: z.number().int().positive().nullable().optional().default(null),
  panelName: nullableTextSchema,
  jobTypeId: z.string().trim().max(100).nullable().optional().default(null),
  jobName: nullableTextSchema,
  assignedUserId: z.string().trim().min(1).max(50),
  assignedUserName: nullableTextSchema,
  taskDate: isoDateSchema,
  targetHours: z.number().positive().max(12),
  startTime: timeSchema.default(null),
  finishTime: timeSchema.default(null),
  jobDescription: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).nullable().optional().default(null),
  isOvertime: z.boolean().default(false),
  isPriority: z.boolean().default(false),
  deadlineDate: isoDateSchema.nullable().optional().default(null),
  isRework: z.boolean().default(false),
});

export const saveJobPlanDraftRequestSchema = z.object({
  replaceItems: z.boolean().default(false),
  items: z.array(jobPlanDraftRecordSchema).min(1).max(200),
});

export const submitJobPlanDraftRequestSchema = z.object({
  draftItemIds: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
});

export const deleteJobPlanDraftRequestSchema = z.object({
  draftItemIds: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
});

export type JobPlanStatus = z.infer<typeof jobPlanStatusSchema>;
export type JobPlanMode = z.infer<typeof jobPlanModeSchema>;
export type JobPlanExportFormat = z.infer<typeof jobPlanExportFormatSchema>;
export type JobPlanCreateMode = z.infer<typeof jobPlanCreateModeSchema>;
export type JobPlanWindow = z.infer<typeof jobPlanWindowSchema>;
export type JobPlanWorkspaceSource = z.infer<typeof jobPlanWorkspaceSourceSchema>;
export type JobPlanRecord = z.infer<typeof jobPlanRecordSchema>;
export type JobPlanSummary = z.infer<typeof jobPlanSummarySchema>;
export type JobPlanGridQuery = z.infer<typeof jobPlanGridQuerySchema>;
export type JobPlanGridReference = z.infer<typeof jobPlanGridReferenceSchema>;
export type JobPlanPicLoad = z.infer<typeof jobPlanPicLoadSchema>;
export type JobPlanDraftItem = z.infer<typeof jobPlanDraftItemSchema>;
export type CreateJobPlanRequest = z.infer<typeof createJobPlanRequestSchema>;
export type BulkCreateJobPlanRequest = z.infer<typeof bulkCreateJobPlanRequestSchema>;
export type JobPlanWorkspaceDraftRow = z.infer<typeof jobPlanWorkspaceDraftRowSchema>;
export type CreateJobPlanWorkspaceRequest = z.infer<typeof createJobPlanWorkspaceRequestSchema>;
export type UpdateJobPlanRequest = z.infer<typeof updateJobPlanRequestSchema>;
export type UpdateJobPlanStatusRequest = z.infer<typeof updateJobPlanStatusRequestSchema>;
export type JobPlanDraftRecord = z.infer<typeof jobPlanDraftRecordSchema>;
export type SaveJobPlanDraftRequest = z.infer<typeof saveJobPlanDraftRequestSchema>;
export type SubmitJobPlanDraftRequest = z.infer<typeof submitJobPlanDraftRequestSchema>;
export type DeleteJobPlanDraftRequest = z.infer<typeof deleteJobPlanDraftRequestSchema>;
