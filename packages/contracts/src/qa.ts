import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const qaPriorityLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const qaFollowupStatusSchema = z.enum(["OPEN", "CLOSED"]);
export const qaIssueTypeSchema = z.enum([
  "PENGERJAAN",
  "FUNGSI",
  "MATERIAL",
  "KOMPONEN",
  "FINISHING",
  "LAINNYA",
]);
export const qaIssueAreaSchema = z.enum([
  "MEKANIK",
  "BODI",
  "INTERIOR",
  "ELECTRICAL",
  "PAINTING",
  "AKSESORIS",
  "LAINNYA",
]);
export const qaResultStatusSchema = z.enum(["LOLOS", "TIDAK_LOLOS"]);

export const qaInspectionRecordSchema = z.object({
  qcId: z.string(),
  coreId: z.string(),
  carId: z.string(),
  inspectionDate: z.string(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  panelName: z.string().nullable(),
  jobName: z.string(),
  inspectorId: z.string().nullable(),
  inspectorName: z.string().nullable(),
  resultStatus: qaResultStatusSchema,
  qcNotes: z.string().nullable(),
  photoBeforeUrl: z.string().nullable(),
  evidencePhotoUrl: z.string().nullable(),
  issueType: qaIssueTypeSchema.nullable(),
  issueArea: qaIssueAreaSchema.nullable(),
  issueCause: z.string().nullable(),
  priorityLevel: qaPriorityLevelSchema.nullable(),
  recommendation: z.string().nullable(),
  followupStatus: qaFollowupStatusSchema.nullable(),
});

export const qaDivisionRejectItemSchema = z.object({
  divisionName: z.string(),
  rejectCount: z.number().int().nonnegative(),
});

export const qaIssueAreaDistributionItemSchema = z.object({
  issueArea: qaIssueAreaSchema,
  total: z.number().int().nonnegative(),
});

export const qaDashboardSummarySchema = z.object({
  totalInspectionsThisMonth: z.number().int().nonnegative(),
  firstTimeYieldPercent: z.number().min(0).max(100),
  openFindingsCount: z.number().int().nonnegative(),
  topRejectDivisions: z.array(qaDivisionRejectItemSchema),
  issueAreaDistribution: z.array(qaIssueAreaDistributionItemSchema),
  criticalAlerts: z.array(qaInspectionRecordSchema),
});

export const qaReferencesSchema = z.object({
  units: z.array(optionSchema),
  divisions: z.array(optionSchema),
  resultStatuses: z.array(optionSchema),
  priorityLevels: z.array(optionSchema),
  followupStatuses: z.array(optionSchema),
  issueTypes: z.array(optionSchema),
  issueAreas: z.array(optionSchema),
});

export const qaGridQuerySchema = gridQueryStateSchema;

export const qaGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(qaInspectionRecordSchema),
  meta: gridMetaSchema,
  query: qaGridQuerySchema,
  references: qaReferencesSchema,
  dashboard: qaDashboardSummarySchema,
});

export const qaUpdateInspectionRequestSchema = z.object({
  issueType: qaIssueTypeSchema.nullable().optional().default(null),
  issueArea: qaIssueAreaSchema.nullable().optional().default(null),
  issueCause: z.string().trim().max(4000).nullable().optional().default(null),
  priorityLevel: qaPriorityLevelSchema.nullable().optional().default(null),
  recommendation: z.string().trim().max(4000).nullable().optional().default(null),
  followupStatus: qaFollowupStatusSchema.nullable().optional().default(null),
});

export const qaMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: qaInspectionRecordSchema,
});

export type QaPriorityLevel = z.infer<typeof qaPriorityLevelSchema>;
export type QaFollowupStatus = z.infer<typeof qaFollowupStatusSchema>;
export type QaIssueType = z.infer<typeof qaIssueTypeSchema>;
export type QaIssueArea = z.infer<typeof qaIssueAreaSchema>;
export type QaResultStatus = z.infer<typeof qaResultStatusSchema>;
export type QaInspectionRecord = z.infer<typeof qaInspectionRecordSchema>;
export type QaDashboardSummary = z.infer<typeof qaDashboardSummarySchema>;
export type QaReferences = z.infer<typeof qaReferencesSchema>;
export type QaGridQuery = z.infer<typeof qaGridQuerySchema>;
export type QaUpdateInspectionRequest = z.infer<typeof qaUpdateInspectionRequestSchema>;
