import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

export const prApprovalStageSchema = z.enum([
  "PENDING_ADV",
  "PENDING_KP",
  "PENDING_MP",
  "PENDING_PUR",
  "APPROVED",
]);

export const prStatusSchema = z.enum([
  "OPEN",
  "HUNTING",
  "ORDERED",
  "ARRIVED",
  "NOT_FOUND",
  "REJECTED",
  "CANCELLED",
]);

export const prItemStatusSchema = z.enum([
  "HUNTING",
  "ORDERED",
  "ARRIVED",
  "NOT_FOUND",
  "CANCELLED",
]);

export const prOriginTypeSchema = z.enum(["LOKAL", "LN"]);

export const prViewModeSchema = z.enum(["active", "closed", "all"]);

export const prReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const prItemRecordSchema = z.object({
  itemId: z.string(),
  prId: z.string(),
  itemName: z.string(),
  description: z.string().nullable(),
  originType: prOriginTypeSchema,
  qty: z.number(),
  uom: z.string(),
  estimatedPrice: z.number().nullable(),
  actualPrice: z.number().nullable(),
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  status: prItemStatusSchema.nullable(),
  huntingNotes: z.string().nullable(),
  arrivalDate: z.string().nullable(),
});

export const prRecordSchema = z.object({
  prId: z.string(),
  prNumber: z.string(),
  carId: z.string().nullable(),
  unitName: z.string(),
  customerName: z.string(),
  divisionName: z.string(),
  requestedBy: z.string(),
  requestedByName: z.string(),
  accTracking: prApprovalStageSchema,
  status: prStatusSchema,
  targetDate: z.string().nullable(),
  priority: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  totalItems: z.number().int().min(0),
  totalQty: z.number(),
  totalEstimatedPrice: z.number(),
  totalActualPrice: z.number(),
  vendorSummary: z.string(),
  latestArrivalDate: z.string().nullable(),
  agingDays: z.number().int().min(0),
  riskScore: z.number().int().min(0).max(100),
  isCritical: z.boolean(),
});

export const prSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
  huntingCount: z.number().int().min(0),
  orderedCount: z.number().int().min(0),
  criticalCount: z.number().int().min(0),
});

export const prGridReferenceSchema = z.object({
  units: z.array(prReferenceOptionSchema),
  divisions: z.array(prReferenceOptionSchema),
  statuses: z.array(prReferenceOptionSchema),
  approvalStages: z.array(prReferenceOptionSchema),
  vendors: z.array(prReferenceOptionSchema),
});

export const prGridQuerySchema = gridQueryStateSchema.extend({
  viewMode: prViewModeSchema.default("active"),
});

export const prGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(prRecordSchema),
  meta: gridMetaSchema,
  references: prGridReferenceSchema,
  query: prGridQuerySchema,
  summary: prSummarySchema,
});

export const prDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    header: prRecordSchema,
    items: z.array(prItemRecordSchema),
  }),
});

export const prMutationResultSchema = z.object({
  prId: z.string(),
  accTracking: prApprovalStageSchema,
  status: prStatusSchema,
});

export const prMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: prMutationResultSchema,
});

export const createPrItemSchema = z.object({
  itemName: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).nullable().optional().default(null),
  originType: prOriginTypeSchema.default("LOKAL"),
  qty: z.number().positive().max(100_000),
  uom: z.string().trim().min(1).max(20),
  estimatedPrice: z.number().nonnegative().nullable().optional().default(null),
  photoUrl: z.string().trim().nullable().optional().default(null),
});

export const createPrRequestSchema = z.object({
  carId: z.string().trim().min(1).max(64),
  divisionName: z.string().trim().max(100).nullable().optional().default(null),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  priority: z.string().trim().nullable().optional().default("NORMAL"),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  items: z.array(createPrItemSchema).min(1).max(25),
});

export const approvePrRequestSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const prOrderItemUpdateSchema = z.object({
  itemId: z.string().trim().min(1).max(64),
  vendorId: z.string().trim().max(64).nullable().optional().default(null),
  vendorName: z.string().trim().min(1).max(255),
  actualPrice: z.number().nonnegative().nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const orderPrRequestSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  items: z.array(prOrderItemUpdateSchema).min(1).max(25),
});

export const prReceiveItemUpdateSchema = z.object({
  itemId: z.string().trim().min(1).max(64),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  actualPrice: z.number().nonnegative().nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const receivePrRequestSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  items: z.array(prReceiveItemUpdateSchema).min(1).max(25),
});

export const cancelPrRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type PrApprovalStage = z.infer<typeof prApprovalStageSchema>;
export type PrStatus = z.infer<typeof prStatusSchema>;
export type PrItemStatus = z.infer<typeof prItemStatusSchema>;
export type PrOriginType = z.infer<typeof prOriginTypeSchema>;
export type PrViewMode = z.infer<typeof prViewModeSchema>;
export type PrRecord = z.infer<typeof prRecordSchema>;
export type PrItemRecord = z.infer<typeof prItemRecordSchema>;
export type PrSummary = z.infer<typeof prSummarySchema>;
export type PrGridReference = z.infer<typeof prGridReferenceSchema>;
export type PrGridQuery = z.infer<typeof prGridQuerySchema>;
export type PrMutationResult = z.infer<typeof prMutationResultSchema>;
export type CreatePrRequest = z.infer<typeof createPrRequestSchema>;
export type ApprovePrRequest = z.infer<typeof approvePrRequestSchema>;
export type OrderPrRequest = z.infer<typeof orderPrRequestSchema>;
export type ReceivePrRequest = z.infer<typeof receivePrRequestSchema>;
export type CancelPrRequest = z.infer<typeof cancelPrRequestSchema>;
