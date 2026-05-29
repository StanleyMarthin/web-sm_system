import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

export const vendorApprovalStageSchema = z.enum([
  "PENDING_ADV",
  "PENDING_KP",
  "PENDING_PM",
  "APPROVED",
]);

export const vendorStatusSchema = z.enum([
  "OPEN",
  "SENT",
  "PROSES_VENDOR",
  "DONE_VENDOR",
  "RECEIVED",
  "REWORK_VENDOR",
  "REJECTED",
  "CANCELLED",
]);

export const vendorQcStatusSchema = z.enum(["GOOD", "REJECT"]);

export const vendorViewModeSchema = z.enum(["active", "received", "all"]);

export const vendorReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const vendorRecordSchema = z.object({
  wovId: z.string(),
  wovNumber: z.string(),
  carId: z.string().nullable(),
  unitName: z.string(),
  customerName: z.string(),
  coreId: z.string().nullable(),
  prId: z.string().nullable(),
  divisionName: z.string(),
  requestedBy: z.string().nullable(),
  requestedByName: z.string(),
  accTracking: vendorApprovalStageSchema,
  status: vendorStatusSchema,
  vendorId: z.string().nullable(),
  vendorName: z.string(),
  picVendor: z.string().nullable(),
  itemName: z.string(),
  quantity: z.number().nullable(),
  uom: z.string().nullable(),
  goodsConditionOut: z.string().nullable(),
  goodsConditionIn: z.string().nullable(),
  dateOut: z.string().nullable(),
  targetDateReturn: z.string().nullable(),
  dateIn: z.string().nullable(),
  qcStatus: vendorQcStatusSchema.nullable(),
  estimatedCost: z.number().nullable(),
  actualCost: z.number().nullable(),
  remarks: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  agingDays: z.number().int().min(0),
  riskScore: z.number().int().min(0).max(100),
  isCritical: z.boolean(),
});

export const vendorSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
  activeVendorCount: z.number().int().min(0),
  overdueCount: z.number().int().min(0),
  reworkCount: z.number().int().min(0),
});

export const vendorGridReferenceSchema = z.object({
  units: z.array(vendorReferenceOptionSchema),
  divisions: z.array(vendorReferenceOptionSchema),
  statuses: z.array(vendorReferenceOptionSchema),
  approvalStages: z.array(vendorReferenceOptionSchema),
  vendors: z.array(vendorReferenceOptionSchema),
});

export const vendorGridQuerySchema = gridQueryStateSchema.extend({
  viewMode: vendorViewModeSchema.default("active"),
});

export const vendorGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(vendorRecordSchema),
  meta: gridMetaSchema,
  references: vendorGridReferenceSchema,
  query: vendorGridQuerySchema,
  summary: vendorSummarySchema,
});

export const vendorDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    ticket: vendorRecordSchema,
  }),
});

export const vendorMutationResultSchema = z.object({
  wovId: z.string(),
  accTracking: vendorApprovalStageSchema,
  status: vendorStatusSchema,
});

export const vendorMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: vendorMutationResultSchema,
});

export const vendorCreateItemSchema = z.object({
  itemName: z.string().trim().min(1).max(255),
  quantity: z.number().positive().max(100_000).nullable().optional().default(null),
  uom: z.string().trim().max(20).nullable().optional().default(null),
  goodsConditionOut: z.string().trim().max(1000).nullable().optional().default(null),
  estimatedCost: z.number().nonnegative().nullable().optional().default(null),
});

export const createVendorRequestSchema = z.object({
  carId: z.string().trim().min(1).max(64),
  coreId: z.string().trim().max(64).nullable().optional().default(null),
  prId: z.string().trim().max(64).nullable().optional().default(null),
  vendorId: z.string().trim().max(64).nullable().optional().default(null),
  vendorName: z.string().trim().min(1).max(255),
  picVendor: z.string().trim().max(150).nullable().optional().default(null),
  itemName: z.string().trim().max(255).nullable().optional().default(null),
  quantity: z.number().positive().max(100_000).nullable().optional().default(null),
  uom: z.string().trim().max(20).nullable().optional().default(null),
  goodsConditionOut: z.string().trim().max(1000).nullable().optional().default(null),
  targetDateReturn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  estimatedCost: z.number().nonnegative().nullable().optional().default(null),
  remarks: z.string().trim().max(1000).nullable().optional().default(null),
  items: z.array(vendorCreateItemSchema).optional().default([]),
});

export const approveVendorRequestSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const vendorStatusUpdateRequestSchema = z.object({
  status: vendorStatusSchema,
  remarks: z.string().trim().max(1000).nullable().optional().default(null),
  targetDateReturn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  actualCost: z.number().nonnegative().nullable().optional().default(null),
});

export const receiveVendorRequestSchema = z.object({
  dateIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  goodsConditionIn: z.string().trim().max(1000).nullable().optional().default(null),
  qcStatus: vendorQcStatusSchema.nullable().optional().default(null),
  actualCost: z.number().nonnegative().nullable().optional().default(null),
  remarks: z.string().trim().max(1000).nullable().optional().default(null),
});

export const cancelVendorRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type VendorApprovalStage = z.infer<typeof vendorApprovalStageSchema>;
export type VendorStatus = z.infer<typeof vendorStatusSchema>;
export type VendorQcStatus = z.infer<typeof vendorQcStatusSchema>;
export type VendorViewMode = z.infer<typeof vendorViewModeSchema>;
export type VendorRecord = z.infer<typeof vendorRecordSchema>;
export type VendorSummary = z.infer<typeof vendorSummarySchema>;
export type VendorGridReference = z.infer<typeof vendorGridReferenceSchema>;
export type VendorGridQuery = z.infer<typeof vendorGridQuerySchema>;
export type VendorMutationResult = z.infer<typeof vendorMutationResultSchema>;
export type CreateVendorRequest = z.infer<typeof createVendorRequestSchema>;
export type ApproveVendorRequest = z.infer<typeof approveVendorRequestSchema>;
export type VendorStatusUpdateRequest = z.infer<typeof vendorStatusUpdateRequestSchema>;
export type ReceiveVendorRequest = z.infer<typeof receiveVendorRequestSchema>;
export type CancelVendorRequest = z.infer<typeof cancelVendorRequestSchema>;
