import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

export const warehouseTransactionTypeSchema = z.enum([
  "PEMINJAMAN",
  "PENGAMBILAN",
  "TRANSFER_PART",
  "PENGEMBALIAN",
  "PENYIMPANAN",
]);

export const warehouseRequestTransactionTypeSchema = z.enum([
  "PEMINJAMAN",
  "PENGAMBILAN",
  "TRANSFER_PART",
]);

export const warehouseItemCategorySchema = z.enum([
  "TOOLS",
  "BAHAN",
  "SPARE_PART",
  "CONSUMABLE",
]);

export const warehouseItemStatusSchema = z.enum([
  "OPEN",
  "READY",
  "RELEASED",
  "RETURNED",
  "STORED",
  "LOST",
]);

export const warehouseApprovalStatusSchema = z.enum([
  "PENDING_KD",
  "PENDING_KEPALA_GUDANG",
  "PENDING_PPIC",
  "APPROVED",
  "REJECTED",
]);

export const warehouseItemConditionSchema = z.enum([
  "GOOD",
  "DAMAGED",
  "SCRAP",
]);

export const warehouseStockCardStatusSchema = z.enum([
  "IN_STORAGE",
  "RETRIEVED",
  "INSTALLED",
  "LOST",
]);

export const warehouseStockCardConditionTypeSchema = z.enum([
  "BARU",
  "RESTORE",
  "BEKAS",
]);

export const warehouseLocationTypeSchema = z.enum([
  "GUDANG",
  "WORKSHOP",
  "UNIT",
]);

export const warehouseOpnameFindingStatusSchema = z.enum([
  "MATCH",
  "SHORT",
  "OVER",
  "NOT_FOUND",
]);

export const warehouseAdjustmentReasonSchema = z.enum([
  "OPNAME_CORRECTION",
  "MANUAL_CORRECTION",
  "TEST_FIT",
  "CROSS_UNIT_BORROW",
  "DAMAGE",
  "LOSS",
]);

export const warehouseTabSchema = z.enum([
  "transactions",
  "stock-card",
  "items",
  "usage",
  "locations",
  "opname",
  "adjustments",
]);

export const warehouseViewSchema = z.enum([
  "active",
  "pending",
  "prepare",
  "ready",
  "field",
  "returned",
  "overdue",
  "all",
]);

export const warehouseReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const warehouseTransactionRecordSchema = z.object({
  transactionId: z.string(),
  transactionType: warehouseTransactionTypeSchema,
  itemCategory: warehouseItemCategorySchema,
  itemName: z.string(),
  itemMasterId: z.string().nullable(),
  itemAliasUsed: z.string().nullable(),
  qty: z.number(),
  qtyReturned: z.number().nullable(),
  uom: z.string(),
  carId: z.string().nullable(),
  unitName: z.string(),
  employeeId: z.string(),
  requesterName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  stockCardId: z.string().nullable(),
  sourceCarId: z.string().nullable(),
  sourceUnitName: z.string().nullable(),
  storageLocationId: z.number().int().nullable(),
  locationLabel: z.string().nullable(),
  locationDetail: z.string().nullable(),
  requestDate: z.string(),
  targetSearchDate: z.string().nullable(),
  actualReleaseDate: z.string().nullable(),
  deadlineDate: z.string().nullable(),
  actualReturnDate: z.string().nullable(),
  itemStatus: warehouseItemStatusSchema,
  approvalStatus: warehouseApprovalStatusSchema,
  itemCondition: warehouseItemConditionSchema.nullable(),
  notes: z.string().nullable(),
  picWarehouseName: z.string().nullable(),
  accKdName: z.string().nullable(),
  photoCount: z.number().int().min(0),
  daysOverdue: z.number().int().nullable(),
  isOverdue: z.boolean(),
});

export const warehouseTransactionsSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
  readyCount: z.number().int().min(0),
  releasedCount: z.number().int().min(0),
  overdueCount: z.number().int().min(0),
  storedCount: z.number().int().min(0),
});

export const warehouseDashboardSummarySchema = z.object({
  pendingApproval: z.number().int().min(0),
  notPrepared: z.number().int().min(0),
  notPickedUp: z.number().int().min(0),
  inUse: z.number().int().min(0),
  overdueNotReturned: z.number().int().min(0),
});

export const warehouseDashboardLateUserRecordSchema = z.object({
  transactionId: z.string(),
  requesterName: z.string(),
  divisionName: z.string(),
  itemName: z.string(),
  unitName: z.string(),
  daysOverdue: z.number().int().min(0),
});

export const warehouseDashboardDivisionUsageRecordSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  itemCount: z.number().int().min(0),
  totalQty: z.number(),
});

export const warehouseDashboardMaterialOutRecordSchema = z.object({
  usageId: z.string(),
  divisionName: z.string(),
  itemName: z.string(),
  qty: z.number(),
  uom: z.string(),
  usageDate: z.string(),
});

export const warehouseDashboardLowStockRecordSchema = z.object({
  itemName: z.string(),
  itemCategory: warehouseItemCategorySchema.nullable(),
  qtyAvailable: z.number(),
  uom: z.string(),
  alertLevel: z.enum(["LOW", "CRITICAL"]),
});

export const warehouseDashboardEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    summary: warehouseDashboardSummarySchema,
    lateUsers: z.array(warehouseDashboardLateUserRecordSchema),
    divisionsUsing: z.array(warehouseDashboardDivisionUsageRecordSchema),
    materialsOut: z.array(warehouseDashboardMaterialOutRecordSchema),
    lowStockAlerts: z.array(warehouseDashboardLowStockRecordSchema),
  }),
});

export const warehouseTransactionReferencesSchema = z.object({
  units: z.array(warehouseReferenceOptionSchema),
  divisions: z.array(warehouseReferenceOptionSchema),
  itemCategories: z.array(warehouseReferenceOptionSchema),
  itemStatuses: z.array(warehouseReferenceOptionSchema),
  approvalStatuses: z.array(warehouseReferenceOptionSchema),
  transactionTypes: z.array(warehouseReferenceOptionSchema),
});

export const warehouseTransactionQuerySchema = gridQueryStateSchema.extend({
  view: warehouseViewSchema.nullable().default("active"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
});

export const warehouseTransactionsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseTransactionRecordSchema),
  meta: gridMetaSchema,
  references: warehouseTransactionReferencesSchema,
  query: warehouseTransactionQuerySchema,
  summary: warehouseTransactionsSummarySchema,
});

export const warehouseStockCardRecordSchema = z.object({
  stockCardId: z.string(),
  entryNo: z.string(),
  carId: z.string().nullable(),
  unitName: z.string(),
  partCode: z.string().nullable(),
  panelSection: z.string().nullable(),
  partName: z.string(),
  conditionType: warehouseStockCardConditionTypeSchema,
  qty: z.number(),
  uom: z.string(),
  storageLocationId: z.number().int().nullable(),
  locationLabel: z.string().nullable(),
  locationDetail: z.string().nullable(),
  dateIn: z.string().nullable(),
  dateOut: z.string().nullable(),
  takenByName: z.string().nullable(),
  status: warehouseStockCardStatusSchema,
  isLabeled: z.boolean(),
  itemCategory: warehouseItemCategorySchema.nullable(),
  photoUrls: z.array(z.string()),
});

export const warehouseRequestJobOptionSchema = z.object({
  coreId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  panelName: z.string().nullable(),
  jobName: z.string().nullable(),
  taskDate: z.string(),
  targetSearchDate: z.string().nullable(),
  deadlineDate: z.string().nullable(),
  isOvertime: z.boolean(),
});

export const warehouseRequestStockCardOptionSchema = warehouseStockCardRecordSchema.extend({
  itemMasterId: z.string().nullable(),
});

export const warehouseRequestEmployeeOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const warehouseRequestReferencesEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    jobs: z.array(warehouseRequestJobOptionSchema),
    stockCards: z.array(warehouseRequestStockCardOptionSchema),
    employees: z.array(warehouseRequestEmployeeOptionSchema),
  }),
});

export const warehouseStockCardEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseStockCardRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const warehouseItemRecordSchema = z.object({
  itemId: z.string(),
  itemCode: z.string().nullable(),
  itemName: z.string(),
  itemCategory: warehouseItemCategorySchema,
  uom: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  aliasCount: z.number().int().min(0),
  latestPrice: z.number().nullable(),
  latestVendorName: z.string().nullable(),
  usageCount: z.number().int().min(0),
  lastUsedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const warehouseItemsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseItemRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const warehouseMaterialUsageRecordSchema = z.object({
  usageId: z.string(),
  countdownId: z.string().nullable(),
  carId: z.string().nullable(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  employeeId: z.string().nullable(),
  employeeName: z.string(),
  warehouseTransactionId: z.string().nullable(),
  itemName: z.string(),
  itemCategory: warehouseItemCategorySchema,
  qty: z.number(),
  uom: z.string(),
  pricePerUnit: z.number().nullable(),
  totalPrice: z.number().nullable(),
  usageDate: z.string(),
  notes: z.string().nullable(),
});

export const warehouseMaterialUsageEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseMaterialUsageRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const warehouseStorageLocationRecordSchema = z.object({
  storageLocationId: z.number().int(),
  locationType: warehouseLocationTypeSchema,
  zone: z.string().nullable(),
  rack: z.string().nullable(),
  shelf: z.string().nullable(),
  label: z.string(),
  isActive: z.boolean(),
  itemCount: z.number().int().min(0),
});

export const warehouseStorageLocationsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseStorageLocationRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const warehouseStockOpnameRecordSchema = z.object({
  opnameId: z.string(),
  opnameNo: z.string(),
  stockCardId: z.string().nullable(),
  carId: z.string().nullable(),
  unitName: z.string(),
  itemName: z.string(),
  partCode: z.string().nullable(),
  uom: z.string(),
  storageLocationId: z.number().int().nullable(),
  locationLabel: z.string().nullable(),
  expectedQty: z.number(),
  actualQty: z.number(),
  varianceQty: z.number(),
  findingStatus: warehouseOpnameFindingStatusSchema,
  itemCondition: warehouseItemConditionSchema.nullable(),
  countedAt: z.string(),
  countedByName: z.string(),
  notes: z.string().nullable(),
});

export const warehouseStockOpnameEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseStockOpnameRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
  references: warehouseTransactionReferencesSchema,
});

export const warehouseStockAdjustmentRecordSchema = z.object({
  adjustmentId: z.string(),
  adjustmentNo: z.string(),
  opnameId: z.string().nullable(),
  stockCardId: z.string().nullable(),
  carId: z.string().nullable(),
  unitName: z.string(),
  itemName: z.string(),
  partCode: z.string().nullable(),
  uom: z.string(),
  qtyBefore: z.number(),
  qtyAfter: z.number(),
  adjustmentQty: z.number(),
  adjustmentReason: warehouseAdjustmentReasonSchema,
  itemCondition: warehouseItemConditionSchema.nullable(),
  createdAt: z.string(),
  createdByName: z.string(),
  notes: z.string().nullable(),
});

export const warehouseStockAdjustmentEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseStockAdjustmentRecordSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
  references: warehouseTransactionReferencesSchema,
});

export const warehousePendingApprovalEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(warehouseTransactionRecordSchema),
});

export const warehouseMutationResultSchema = z.object({
  transactionId: z.string(),
  approvalStatus: warehouseApprovalStatusSchema,
  itemStatus: warehouseItemStatusSchema,
  transactionType: warehouseTransactionTypeSchema,
});

export const warehouseMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: warehouseMutationResultSchema,
});

export const createWarehouseRequestSchema = z.object({
  carId: z.string().trim().min(1).max(64),
  coreId: z.string().trim().max(64).nullable().optional().default(null),
  unitName: z.string().trim().max(255).nullable().optional().default(null),
  panelName: z.string().trim().max(255).nullable().optional().default(null),
  jobName: z.string().trim().max(255).nullable().optional().default(null),
  divisionId: z.number().int().positive().nullable().optional().default(null),
  divisionName: z.string().trim().max(255).nullable().optional().default(null),
  requesterEmployeeId: z.string().trim().max(64).nullable().optional().default(null),
  stockCardId: z.string().trim().max(64).nullable().optional().default(null),
  itemCategory: warehouseItemCategorySchema,
  transactionType: warehouseRequestTransactionTypeSchema,
  itemMasterId: z.string().trim().max(64).nullable().optional().default(null),
  itemAliasUsed: z.string().trim().max(255).nullable().optional().default(null),
  itemName: z.string().trim().min(1).max(255),
  qty: z.number().positive().max(100_000),
  uom: z.string().trim().min(1).max(20),
  targetSearchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const warehouseApproveRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const warehouseRejectRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const warehouseIssueRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  actualReleaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
});

export const warehouseReadyRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const warehouseReturnRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  qtyReturned: z.number().positive().max(100_000).nullable().optional().default(null),
  itemCondition: warehouseItemConditionSchema.nullable().optional().default(null),
});

export const warehouseStoreRequestSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
  storageLocationId: z.number().int().positive().nullable().optional().default(null),
  locationDetail: z.string().trim().max(255).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const createWarehouseStockOpnameSchema = z.object({
  stockCardId: z.string().trim().max(64).nullable().optional().default(null),
  carId: z.string().trim().max(64).nullable().optional().default(null),
  itemName: z.string().trim().min(1).max(255),
  partCode: z.string().trim().max(64).nullable().optional().default(null),
  uom: z.string().trim().min(1).max(20),
  storageLocationId: z.number().int().positive().nullable().optional().default(null),
  expectedQty: z.number().min(0).max(100_000),
  actualQty: z.number().min(0).max(100_000),
  itemCondition: warehouseItemConditionSchema.nullable().optional().default(null),
  countedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const createWarehouseStockAdjustmentSchema = z.object({
  opnameId: z.string().trim().max(64).nullable().optional().default(null),
  stockCardId: z.string().trim().max(64).nullable().optional().default(null),
  carId: z.string().trim().max(64).nullable().optional().default(null),
  itemName: z.string().trim().min(1).max(255),
  partCode: z.string().trim().max(64).nullable().optional().default(null),
  uom: z.string().trim().min(1).max(20),
  qtyBefore: z.number().min(0).max(100_000),
  qtyAfter: z.number().min(0).max(100_000),
  adjustmentReason: warehouseAdjustmentReasonSchema,
  itemCondition: warehouseItemConditionSchema.nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const warehouseStockOpnameMutationResultSchema = z.object({
  opnameId: z.string(),
  opnameNo: z.string(),
  findingStatus: warehouseOpnameFindingStatusSchema,
  varianceQty: z.number(),
});

export const warehouseStockOpnameMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: warehouseStockOpnameMutationResultSchema,
});

export const warehouseStockAdjustmentMutationResultSchema = z.object({
  adjustmentId: z.string(),
  adjustmentNo: z.string(),
  adjustmentQty: z.number(),
  adjustmentReason: warehouseAdjustmentReasonSchema,
});

export const warehouseStockAdjustmentMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: warehouseStockAdjustmentMutationResultSchema,
});

export const createWarehouseStorageLocationSchema = z.object({
  locationType: warehouseLocationTypeSchema,
  zone: z.string().trim().max(50).nullable().optional().default(null),
  rack: z.string().trim().max(50).nullable().optional().default(null),
  shelf: z.string().trim().max(50).nullable().optional().default(null),
  label: z.string().trim().max(100).nullable().optional().default(null),
  isActive: z.boolean().optional().default(true),
});

export const updateWarehouseStorageLocationSchema = z.object({
  storageLocationId: z.number().int().positive(),
  locationType: warehouseLocationTypeSchema.optional(),
  zone: z.string().trim().max(50).nullable().optional().default(null),
  rack: z.string().trim().max(50).nullable().optional().default(null),
  shelf: z.string().trim().max(50).nullable().optional().default(null),
  label: z.string().trim().max(100).nullable().optional().default(null),
  isActive: z.boolean().optional(),
});

export const warehouseStorageLocationMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: warehouseStorageLocationRecordSchema,
});

export const warehouseStockCardPhotoUpdateSchema = z.object({
  stockCardId: z.string().trim().min(1).max(64),
  photoUrls: z.array(z.string().url()).max(20),
});

export const warehouseStockCardPhotoMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    stockCardId: z.string(),
    photoUrls: z.array(z.string()),
  }),
});

export const warehouseUploadTicketResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    uploadUrl: z.string().url(),
    publicUrl: z.string().url(),
    objectKey: z.string(),
  }),
});

export type WarehouseTransactionType = z.infer<typeof warehouseTransactionTypeSchema>;
export type WarehouseRequestTransactionType = z.infer<typeof warehouseRequestTransactionTypeSchema>;
export type WarehouseItemCategory = z.infer<typeof warehouseItemCategorySchema>;
export type WarehouseItemStatus = z.infer<typeof warehouseItemStatusSchema>;
export type WarehouseApprovalStatus = z.infer<typeof warehouseApprovalStatusSchema>;
export type WarehouseItemCondition = z.infer<typeof warehouseItemConditionSchema>;
export type WarehouseStockCardStatus = z.infer<typeof warehouseStockCardStatusSchema>;
export type WarehouseLocationType = z.infer<typeof warehouseLocationTypeSchema>;
export type WarehouseOpnameFindingStatus = z.infer<typeof warehouseOpnameFindingStatusSchema>;
export type WarehouseAdjustmentReason = z.infer<typeof warehouseAdjustmentReasonSchema>;
export type WarehouseTab = z.infer<typeof warehouseTabSchema>;
export type WarehouseTransactionRecord = z.infer<typeof warehouseTransactionRecordSchema>;
export type WarehouseTransactionsSummary = z.infer<typeof warehouseTransactionsSummarySchema>;
export type WarehouseDashboardSummary = z.infer<typeof warehouseDashboardSummarySchema>;
export type WarehouseDashboardLateUserRecord = z.infer<typeof warehouseDashboardLateUserRecordSchema>;
export type WarehouseDashboardDivisionUsageRecord = z.infer<typeof warehouseDashboardDivisionUsageRecordSchema>;
export type WarehouseDashboardMaterialOutRecord = z.infer<typeof warehouseDashboardMaterialOutRecordSchema>;
export type WarehouseDashboardLowStockRecord = z.infer<typeof warehouseDashboardLowStockRecordSchema>;
export type WarehouseTransactionReferences = z.infer<typeof warehouseTransactionReferencesSchema>;
export type WarehouseTransactionQuery = z.infer<typeof warehouseTransactionQuerySchema>;
export type WarehouseStockCardRecord = z.infer<typeof warehouseStockCardRecordSchema>;
export type WarehouseRequestJobOption = z.infer<typeof warehouseRequestJobOptionSchema>;
export type WarehouseRequestStockCardOption = z.infer<typeof warehouseRequestStockCardOptionSchema>;
export type WarehouseRequestEmployeeOption = z.infer<typeof warehouseRequestEmployeeOptionSchema>;
export type WarehouseItemRecord = z.infer<typeof warehouseItemRecordSchema>;
export type WarehouseMaterialUsageRecord = z.infer<typeof warehouseMaterialUsageRecordSchema>;
export type WarehouseStorageLocationRecord = z.infer<typeof warehouseStorageLocationRecordSchema>;
export type WarehouseStockOpnameRecord = z.infer<typeof warehouseStockOpnameRecordSchema>;
export type WarehouseStockAdjustmentRecord = z.infer<typeof warehouseStockAdjustmentRecordSchema>;
export type WarehouseMutationResult = z.infer<typeof warehouseMutationResultSchema>;
export type CreateWarehouseRequest = z.infer<typeof createWarehouseRequestSchema>;
export type WarehouseApproveRequest = z.infer<typeof warehouseApproveRequestSchema>;
export type WarehouseRejectRequest = z.infer<typeof warehouseRejectRequestSchema>;
export type WarehouseReadyRequest = z.infer<typeof warehouseReadyRequestSchema>;
export type WarehouseIssueRequest = z.infer<typeof warehouseIssueRequestSchema>;
export type WarehouseReturnRequest = z.infer<typeof warehouseReturnRequestSchema>;
export type WarehouseStoreRequest = z.infer<typeof warehouseStoreRequestSchema>;
export type CreateWarehouseStockOpname = z.infer<typeof createWarehouseStockOpnameSchema>;
export type CreateWarehouseStockAdjustment = z.infer<typeof createWarehouseStockAdjustmentSchema>;
export type WarehouseStockOpnameMutationResult = z.infer<typeof warehouseStockOpnameMutationResultSchema>;
export type WarehouseStockAdjustmentMutationResult = z.infer<typeof warehouseStockAdjustmentMutationResultSchema>;
export type CreateWarehouseStorageLocation = z.infer<typeof createWarehouseStorageLocationSchema>;
export type UpdateWarehouseStorageLocation = z.infer<typeof updateWarehouseStorageLocationSchema>;
