import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

export const spkStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "DONE",
]);

export const spkApprovalStateSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const spkPreviewRecordSchema = z.object({
  planId: z.string(),
  unitName: z.string(),
  divisionName: z.string(),
  jobName: z.string(),
  picName: z.string(),
  targetHours: z.number(),
  targetDate: z.string(),
});

export const spkPlannerAllocationSchema = z.object({
  allocationKey: z.string(),
  carId: z.string(),
  unitName: z.string(),
  divisionId: z.number().int(),
  divisionName: z.string(),
  targetHours: z.number().nonnegative(),
});

export const spkPlannerMetaSchema = z.object({
  source: z.literal("WEEKLY_PLANNER"),
  weeklyPlanId: z.string(),
  planningTargetId: z.string().nullable().optional(),
  weekStartDate: z.string(),
  generatedOvertimeRows: z.number().int().nonnegative(),
  allocations: z.array(spkPlannerAllocationSchema),
  note: z.string().nullable(),
});

export const spkHeaderRecordSchema = z.object({
  spkId: z.string(),
  spkNumber: z.string(),
  spkDate: z.string(),
  status: spkStatusSchema,
  totalUnits: z.number().int().min(0),
  totalHours: z.number(),
  createdBy: z.string(),
  approvedBy: z.string().nullable(),
  rejectReason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  activatedAt: z.string().nullable(),
  plannerMeta: spkPlannerMetaSchema.nullable().optional(),
});

export const spkDetailRecordSchema = z.object({
  detailId: z.string(),
  spkId: z.string(),
  planId: z.string().nullable(),
  unitNameSnapshot: z.string(),
  divisionNameSnapshot: z.string(),
  jobNameSnapshot: z.string(),
  picNameSnapshot: z.string(),
  targetHoursSnapshot: z.number(),
  targetDateSnapshot: z.string(),
  approvalState: spkApprovalStateSchema,
  approvalNote: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
});

export const spkGridQuerySchema = gridQueryStateSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).default(() => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }),
});

export const spkSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
});

export const spkListEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(spkHeaderRecordSchema),
  storageReady: z.boolean().optional(),
  meta: gridMetaSchema,
  query: spkGridQuerySchema,
  summary: spkSummarySchema,
});

export const spkPreviewEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    rows: z.array(spkPreviewRecordSchema),
    totalUnits: z.number().int().min(0),
    totalHours: z.number(),
  }),
});

export const spkDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    header: spkHeaderRecordSchema,
    details: z.array(spkDetailRecordSchema),
  }),
});

export const spkGenerateRequestSchema = z.object({
  spkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  notes: z.string().trim().max(500).nullable().optional().default(null),
});

export const spkRejectRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const spkItemApprovalRequestSchema = z.object({
  isApproved: z.boolean(),
  note: z.string().trim().max(500).nullable().optional().default(null),
});

export const spkDraftDetailUpdateRowSchema = z.object({
  detailId: z.string().trim().min(1).nullable().optional(),
  unitNameSnapshot: z.string().trim().min(1).max(255),
  divisionNameSnapshot: z.string().trim().min(1).max(100),
  jobNameSnapshot: z.string().trim().min(1).max(255),
  picNameSnapshot: z.string().trim().min(1).max(255),
  targetHoursSnapshot: z.number().positive(),
  targetDateSnapshot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});

export const spkDraftDetailUpdateRequestSchema = z.object({
  rows: z.array(spkDraftDetailUpdateRowSchema).min(1),
});

export const spkMutationResultSchema = z.object({
  spkId: z.string(),
  status: spkStatusSchema,
});

export const spkMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: spkMutationResultSchema,
});

export const spkDraftDetailUpdateEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    spkId: z.string(),
    detailCount: z.number().int().min(0),
  }),
});

export const spkGenerateEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    spkId: z.string(),
  }),
});

export const spkItemApprovalEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    spkId: z.string(),
    detailId: z.string(),
    approvalState: spkApprovalStateSchema,
  }),
});

export const spkTodayEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(spkHeaderRecordSchema),
});

export const spkSummaryEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: spkSummarySchema,
});

export type SpkStatus = z.infer<typeof spkStatusSchema>;
export type SpkApprovalState = z.infer<typeof spkApprovalStateSchema>;
export type SpkPreviewRecord = z.infer<typeof spkPreviewRecordSchema>;
export type SpkHeaderRecord = z.infer<typeof spkHeaderRecordSchema>;
export type SpkDetailRecord = z.infer<typeof spkDetailRecordSchema>;
export type SpkGridQuery = z.infer<typeof spkGridQuerySchema>;
export type SpkSummary = z.infer<typeof spkSummarySchema>;
export type SpkGenerateRequest = z.infer<typeof spkGenerateRequestSchema>;
export type SpkRejectRequest = z.infer<typeof spkRejectRequestSchema>;
export type SpkItemApprovalRequest = z.infer<typeof spkItemApprovalRequestSchema>;
export type SpkPlannerMeta = z.infer<typeof spkPlannerMetaSchema>;
export type SpkPlannerAllocation = z.infer<typeof spkPlannerAllocationSchema>;
export type SpkDraftDetailUpdateRow = z.infer<typeof spkDraftDetailUpdateRowSchema>;
export type SpkDraftDetailUpdateRequest = z.infer<typeof spkDraftDetailUpdateRequestSchema>;
