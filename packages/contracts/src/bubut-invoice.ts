import { z } from "zod";
import { gridFilterSchema, gridMetaSchema } from "./grid";

export const bubutInvoiceTypeSchema = z.enum(["DIREKSI", "CUSTOMER"]);
export const bubutInvoiceStatusSchema = z.enum(["RELEASED", "CANCELLED"]);
export const bubutInvoiceLineStatusSchema = z.enum([
  "NOT_RELEASED",
  "RELEASED",
  "CANCELLED",
]);
export const bubutInvoiceCombinedStatusSchema = z.enum([
  "BELUM_RILIS",
  "RILIS_DIREKSI",
  "RILIS_CUSTOMER",
  "RILIS_KEDUANYA",
  "DIBATALKAN",
]);

export const bubutInvoiceWorkOrderQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().default(""),
  sortBy: z.string().default("woDate"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  view: z.string().nullable().default(null),
  filters: z.array(gridFilterSchema).default([]),
  woDateFrom: z.string().nullable().default(null),
  woDateTo: z.string().nullable().default(null),
  workDateFrom: z.string().nullable().default(null),
  workDateTo: z.string().nullable().default(null),
  team: z.string().nullable().default(null),
  carId: z.string().nullable().default(null),
  operatorId: z.string().nullable().default(null),
  invoiceStatus: bubutInvoiceCombinedStatusSchema.nullable().default(null),
  invoiceType: bubutInvoiceTypeSchema.nullable().default(null),
});

export const bubutInvoiceMaterialLineSchema = z.object({
  no: z.number().int().positive(),
  materialName: z.string(),
  qty: z.number(),
  unit: z.string().nullable(),
  price: z.number(),
  total: z.number(),
  warehouseTransactionId: z.string().nullable().optional(),
  stockCardId: z.string().nullable().optional(),
});

export const bubutInvoiceWorkingHourLineSchema = z.object({
  no: z.number().int().positive(),
  date: z.string(),
  start: z.string().nullable(),
  break: z.string().nullable(),
  finish: z.string().nullable(),
  workingHourText: z.string(),
  workingHourDecimal: z.number(),
  powerWatt: z.number(),
  powerCostKwh: z.number(),
  total: z.number(),
  actualId: z.string().nullable().optional(),
});

export const bubutInvoicePictureLineSchema = z.object({
  url: z.string(),
  caption: z.string().nullable(),
  source: z.enum(["GALLERY", "LEDGER"]),
});

export const bubutInvoiceTotalsSchema = z.object({
  totalWorkMinutes: z.number().int().min(0),
  totalWorkHourText: z.string(),
  totalWorkHourDecimal: z.number(),
  workingHourTotal: z.number(),
  materialTotal: z.number(),
  totalPriceBubut: z.number(),
  markupPercent: z.number(),
  markupMultiplier: z.number(),
  priceAfterMarkup: z.number().nullable(),
  roundingStep: z.number().int().positive(),
  priceRounding: z.number().nullable(),
});

export const bubutInvoiceSnapshotSchema = z.object({
  invoiceId: z.number().int().positive().nullable().optional(),
  invoiceNo: z.string().nullable().optional(),
  invoiceType: bubutInvoiceTypeSchema,
  status: bubutInvoiceStatusSchema.optional().default("RELEASED"),
  salesInvoiceDate: z.string(),
  woDate: z.string().nullable(),
  sourceWoId: z.string(),
  sourceWobNo: z.string(),
  headProjectName: z.string().nullable(),
  poNo: z.string().nullable(),
  poDate: z.string().nullable(),
  carId: z.string().nullable(),
  carType: z.string().nullable(),
  sparepartName: z.string().nullable(),
  qty: z.number().nullable(),
  qtyUnit: z.string().nullable(),
  operatorName: z.string().nullable(),
  divisionName: z.string().nullable(),
  processDetailText: z.string().nullable(),
  materials: z.array(bubutInvoiceMaterialLineSchema),
  workingHours: z.array(bubutInvoiceWorkingHourLineSchema),
  pictures: z.array(bubutInvoicePictureLineSchema),
  totals: bubutInvoiceTotalsSchema,
  sourceSnapshot: z.record(z.string(), z.unknown()),
  releasedBy: z.string().nullable().optional(),
  releasedByName: z.string().nullable().optional(),
  releasedAt: z.string().nullable().optional(),
  printedCount: z.number().int().min(0).optional(),
  lastPrintedAt: z.string().nullable().optional(),
  cancelledBy: z.string().nullable().optional(),
  cancelledByName: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  cancelReason: z.string().nullable().optional(),
});

export const bubutInvoiceWorkOrderRowSchema = z.object({
  sourceKey: z.string().optional(),
  sourceWoId: z.string(),
  sourceWobNo: z.string(),
  woDate: z.string().nullable(),
  workDate: z.string().nullable(),
  teamName: z.string().nullable(),
  carId: z.string().nullable(),
  carType: z.string().nullable(),
  sparepartName: z.string().nullable(),
  qty: z.number().nullable(),
  qtyUnit: z.string().nullable(),
  operatorName: z.string().nullable(),
  divisionName: z.string().nullable(),
  totalWorkHourText: z.string(),
  materialTotal: z.number(),
  workingHourTotal: z.number(),
  totalPriceBubut: z.number(),
  invoiceStatus: bubutInvoiceCombinedStatusSchema,
  direksiInvoiceStatus: bubutInvoiceLineStatusSchema,
  customerInvoiceStatus: bubutInvoiceLineStatusSchema,
  direksiInvoiceId: z.number().int().positive().nullable(),
  customerInvoiceId: z.number().int().positive().nullable(),
});

export const bubutInvoiceWorkHistoryInvoiceStatusSchema = z.enum([
  "NO_INVOICE",
  "DIREKSI_RELEASED",
  "CUSTOMER_RELEASED",
  "BOTH_RELEASED",
]);

export const bubutInvoiceWorkHistorySchema = z.object({
  sourceKey: z.string(),
  header: z.object({
    woId: z.union([z.string(), z.number()]).nullable(),
    wobNo: z.string().nullable(),
    woDate: z.string().nullable(),
    teamName: z.string().nullable(),
    carId: z.union([z.string(), z.number()]).nullable(),
    carName: z.string().nullable(),
    divisionName: z.string().nullable(),
    operatorName: z.string().nullable(),
    sparepartName: z.string().nullable(),
    qtyLabel: z.string().nullable(),
    jobdesc: z.string().nullable(),
    invoiceStatus: bubutInvoiceWorkHistoryInvoiceStatusSchema,
    direksiInvoiceId: z.number().int().positive().nullable(),
    customerInvoiceId: z.number().int().positive().nullable(),
  }),
  workRows: z.array(z.object({
    id: z.string(),
    workDate: z.string().nullable(),
    startTime: z.string().nullable(),
    breakTime: z.string().nullable(),
    finishTime: z.string().nullable(),
    workingHourText: z.string(),
    workingHourDecimal: z.number(),
    resultStatus: z.string().nullable(),
    operatorName: z.string().nullable(),
    panelPartName: z.string().nullable(),
    jobdesc: z.string().nullable(),
    processDetail: z.string().nullable(),
    documentationUrls: z.array(z.string()),
    powerWatt: z.number(),
    powerCostKwh: z.number(),
    workingHourCost: z.number(),
  })),
  materialRows: z.array(z.object({
    id: z.string(),
    materialName: z.string(),
    qty: z.number(),
    quom: z.string().nullable(),
    price: z.number(),
    total: z.number(),
    sourceTransactionId: z.union([z.string(), z.number()]).nullable().optional(),
  })),
  totals: z.object({
    totalWorkingHourText: z.string(),
    totalWorkingHourDecimal: z.number(),
    totalWorkingHourCost: z.number(),
    totalMaterial: z.number(),
    totalBasePrice: z.number(),
    customerUpTotal: z.number(),
    customerRoundedTotal: z.number(),
  }),
});

export const bubutInvoiceWorkOrderEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(bubutInvoiceWorkOrderRowSchema),
  meta: gridMetaSchema,
  query: bubutInvoiceWorkOrderQuerySchema,
});

export const bubutInvoicePreviewQuerySchema = z.object({
  sourceWoId: z.string().min(1),
  invoiceType: bubutInvoiceTypeSchema,
  salesInvoiceDate: z.string().optional(),
  poNo: z.string().nullable().optional(),
  poDate: z.string().nullable().optional(),
  roundingStep: z.number().int().positive().optional().default(1000),
});

export const bubutInvoiceReleaseRequestSchema = z.object({
  sourceWoId: z.string().min(1),
  invoiceType: bubutInvoiceTypeSchema,
  salesInvoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  poNo: z.string().trim().max(128).nullable().optional().default(null),
  poDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  roundingStep: z.number().int().positive().max(1_000_000).optional().default(1000),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const bubutInvoiceCancelRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const bubutInvoicePreviewEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: bubutInvoiceSnapshotSchema,
});

export const bubutInvoiceDetailEnvelopeSchema = bubutInvoicePreviewEnvelopeSchema;

export const bubutInvoiceWorkHistoryEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: bubutInvoiceWorkHistorySchema,
});

export const bubutInvoiceReleaseEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    invoiceId: z.number().int().positive(),
    invoiceNo: z.string(),
    invoiceType: bubutInvoiceTypeSchema,
  }),
});

export const bubutInvoiceCancelEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    invoiceId: z.number().int().positive(),
    status: bubutInvoiceStatusSchema,
  }),
});

export type BubutInvoiceType = z.infer<typeof bubutInvoiceTypeSchema>;
export type BubutInvoiceStatus = z.infer<typeof bubutInvoiceStatusSchema>;
export type BubutInvoiceCombinedStatus = z.infer<typeof bubutInvoiceCombinedStatusSchema>;
export type BubutInvoiceMaterialLine = z.infer<typeof bubutInvoiceMaterialLineSchema>;
export type BubutInvoiceWorkingHourLine = z.infer<typeof bubutInvoiceWorkingHourLineSchema>;
export type BubutInvoicePictureLine = z.infer<typeof bubutInvoicePictureLineSchema>;
export type BubutInvoiceWorkOrderQuery = z.infer<typeof bubutInvoiceWorkOrderQuerySchema>;
export type BubutInvoiceWorkOrderRow = z.infer<typeof bubutInvoiceWorkOrderRowSchema>;
export type BubutInvoiceSnapshot = z.infer<typeof bubutInvoiceSnapshotSchema>;
export type BubutInvoiceReleaseRequest = z.infer<typeof bubutInvoiceReleaseRequestSchema>;
export type BubutInvoiceCancelRequest = z.infer<typeof bubutInvoiceCancelRequestSchema>;
export type BubutInvoiceWorkHistory = z.infer<typeof bubutInvoiceWorkHistorySchema>;
