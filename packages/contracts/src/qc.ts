import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const qcInspectionLevelSchema = z.enum([
  "QC_KD",
  "QC_ADVISOR",
  "QC_KP",
  "QC_MP",
  "QC_MO",
]);

export const qcResultStatusSchema = z.enum(["LOLOS", "TIDAK_LOLOS"]);

export const qcQueueRecordSchema = z.object({
  coreId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  panelId: z.number().int().nullable(),
  panelName: z.string().nullable(),
  taskCategory: z.string(),
  jobName: z.string(),
  countdownStatus: z.string(),
  qcLastStatus: qcResultStatusSchema.nullable(),
  qcLevel: qcInspectionLevelSchema.nullable(),
  latestQcId: z.string().nullable(),
  refWoId: z.string().nullable(),
  waitingHours: z.number(),
  remainingHours: z.number().nullable(),
  targetHours: z.number().nullable(),
  deadlineDate: z.string().nullable(),
  latestInspectionDate: z.string().nullable(),
  latestInspectionNotes: z.string().nullable(),
  photoBeforeUrl: z.string().nullable(),
  evidencePhotoUrl: z.string().nullable(),
  reworkPlanId: z.string().nullable(),
  reworkTaskDate: z.string().nullable(),
  reworkAssignedUserId: z.string().nullable(),
  reworkAssignedUserName: z.string().nullable(),
  reworkPlanStatus: z.string().nullable(),
  linkedIssueId: z.string().nullable(),
  openIssueCount: z.number().int().nonnegative(),
});

export const qcSummarySchema = z.object({
  readyCount: z.number().int().nonnegative(),
  recheckCount: z.number().int().nonnegative(),
  activeReworkCount: z.number().int().nonnegative(),
  finalReadyUnits: z.number().int().nonnegative(),
});

export const qcReferencesSchema = z.object({
  divisions: z.array(optionSchema),
  units: z.array(optionSchema),
  statuses: z.array(optionSchema),
  qcLevels: z.array(optionSchema),
});

export const qcGridQuerySchema = gridQueryStateSchema;

export const qcGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(qcQueueRecordSchema),
  meta: gridMetaSchema,
  query: qcGridQuerySchema,
  references: qcReferencesSchema,
  summary: qcSummarySchema,
});

export const qcDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    item: qcQueueRecordSchema,
  }),
});

export const qcPassRequestSchema = z.object({
  notes: z.string().trim().max(4_000).nullable().optional().default(null),
  inspectionDurationMinutes: z.number().int().positive().max(1_440).nullable().optional().default(null),
  photoBeforeUrl: z.string().trim().url().nullable().optional().default(null),
  evidencePhotoUrl: z.string().trim().url().nullable().optional().default(null),
});

const optionalTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/u)
  .nullable()
  .optional()
  .default(null);

export const qcRejectRequestSchema = qcPassRequestSchema.extend({
  reworkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  reworkAssignedUser: z.string().trim().min(1).max(50),
  reworkDailyHours: z.string().trim().regex(/^\d{2}:\d{2}$/u),
  reworkStartTime: optionalTimeSchema,
  reworkFinishTime: optionalTimeSchema,
  reworkDescription: z.string().trim().max(4_000).nullable().optional().default(null),
  reworkIsOvertime: z.boolean().optional().default(false),
  reworkIsPriority: z.boolean().optional().default(false),
});

export const qcMutationResultSchema = z.object({
  qcId: z.string(),
  coreId: z.string(),
  resultStatus: qcResultStatusSchema,
  issueId: z.string().nullable().default(null),
  reworkPlanId: z.string().nullable().default(null),
});

export const qcMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: qcMutationResultSchema,
});

export const qcFinalChecklistItemSchema = z.object({
  coreId: z.string(),
  panelName: z.string().nullable(),
  divisionName: z.string().nullable(),
  jobName: z.string(),
  countdownStatus: z.string(),
  qcLastStatus: qcResultStatusSchema.nullable(),
  latestQcId: z.string().nullable(),
  issueId: z.string().nullable(),
  issueStatus: z.string().nullable(),
});

export const qcFinalChecklistSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  totalTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  passedTasks: z.number().int().nonnegative(),
  rejectedTasks: z.number().int().nonnegative(),
  openIssueCount: z.number().int().nonnegative(),
  isReadyForDelivery: z.boolean(),
  approvedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  notes: z.string().nullable(),
});

export const qcFinalChecklistEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    checklist: qcFinalChecklistSchema,
    items: z.array(qcFinalChecklistItemSchema),
  }),
});

export const qcFinalApproveRequestSchema = z.object({
  notes: z.string().trim().max(4_000).nullable().optional().default(null),
});

export const qcFinalApproveEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    carId: z.string(),
    approved: z.literal(true),
    approvedAt: z.string(),
  }),
});

export type QcInspectionLevel = z.infer<typeof qcInspectionLevelSchema>;
export type QcResultStatus = z.infer<typeof qcResultStatusSchema>;
export type QcQueueRecord = z.infer<typeof qcQueueRecordSchema>;
export type QcSummary = z.infer<typeof qcSummarySchema>;
export type QcReferences = z.infer<typeof qcReferencesSchema>;
export type QcGridQuery = z.infer<typeof qcGridQuerySchema>;
export type QcPassRequest = z.infer<typeof qcPassRequestSchema>;
export type QcRejectRequest = z.infer<typeof qcRejectRequestSchema>;
export type QcMutationResult = z.infer<typeof qcMutationResultSchema>;
export type QcFinalChecklist = z.infer<typeof qcFinalChecklistSchema>;
export type QcFinalChecklistItem = z.infer<typeof qcFinalChecklistItemSchema>;
export type QcFinalApproveRequest = z.infer<typeof qcFinalApproveRequestSchema>;
