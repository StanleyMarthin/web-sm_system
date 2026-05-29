import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

export const woStatusSchema = z.enum([
  "OPEN",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "DONE",
  "CLOSED",
]);

export const woViewModeSchema = z.enum([
  "active",
  "done",
  "all",
]);

export const woReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const woRecordSchema = z.object({
  woId: z.string(),
  woNumber: z.string(),
  carId: z.string().nullable(),
  unitName: z.string(),
  customerName: z.string(),
  fromDivisionId: z.number().int().nullable(),
  fromDivisionName: z.string(),
  toDivisionId: z.number().int().nullable(),
  toDivisionName: z.string(),
  panelName: z.string().nullable(),
  jobDetail: z.string(),
  estimatedHours: z.number().nullable(),
  isPriority: z.boolean(),
  status: woStatusSchema,
  requestDate: z.string(),
  approvalDate: z.string().nullable(),
  createdAt: z.string(),
  notes: z.string().nullable(),
  picId: z.string().nullable(),
  picName: z.string().nullable(),
  approverId: z.string().nullable(),
  linkedCountdownId: z.string().nullable(),
  linkedCountdownStatus: z.string().nullable(),
  agingHours: z.number(),
  agingScore: z.number().int().min(0).max(100),
  isUrgent: z.boolean(),
});

export const woSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
  approvedOpen: z.number().int().min(0),
  urgentCount: z.number().int().min(0),
});

export const woGridReferenceSchema = z.object({
  units: z.array(woReferenceOptionSchema),
  divisions: z.array(woReferenceOptionSchema),
  statuses: z.array(woReferenceOptionSchema),
});

export const woLinkedCountdownSchema = z.object({
  coreId: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const woGridQuerySchema = gridQueryStateSchema.extend({
  viewMode: woViewModeSchema.default("active"),
});

export const woGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(woRecordSchema),
  meta: gridMetaSchema,
  references: woGridReferenceSchema,
  query: woGridQuerySchema,
  summary: woSummarySchema,
});

export const woDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    ticket: woRecordSchema,
    linkedCountdowns: z.array(woLinkedCountdownSchema),
  }),
});

export const woMutationResultSchema = z.object({
  woId: z.string(),
  status: woStatusSchema,
});

export const woMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: woMutationResultSchema,
});

export const woCreateItemSchema = z.object({
  jobDetail: z.string().trim().min(1).max(1000),
  panelName: z.string().trim().max(255).nullable().optional().default(null),
  sectionName: z.string().trim().max(255).nullable().optional().default(null),
  panelCategory: z.string().trim().max(100).nullable().optional().default(null),
  addPanelToMaster: z.boolean().nullable().optional().default(false),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  estimatedHours: z.number().positive().max(72).nullable().optional().default(null),
});

export const woCreateRequestSchema = z.object({
  carId: z.string().trim().min(1).max(64),
  toDivisionId: z.number().int().positive(),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  isPriority: z.boolean().default(false),
  panelName: z.string().trim().max(255).nullable().optional().default(null),
  jobDetail: z.string().trim().max(1000).nullable().optional().default(null),
  estimatedHours: z.number().positive().max(72).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  items: z.array(woCreateItemSchema).optional().default([]),
});

export const woRejectRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type WoStatus = z.infer<typeof woStatusSchema>;
export type WoViewMode = z.infer<typeof woViewModeSchema>;
export type WoRecord = z.infer<typeof woRecordSchema>;
export type WoSummary = z.infer<typeof woSummarySchema>;
export type WoGridReference = z.infer<typeof woGridReferenceSchema>;
export type WoLinkedCountdown = z.infer<typeof woLinkedCountdownSchema>;
export type WoGridQuery = z.infer<typeof woGridQuerySchema>;
export type WoCreateRequest = z.infer<typeof woCreateRequestSchema>;
export type WoRejectRequest = z.infer<typeof woRejectRequestSchema>;
