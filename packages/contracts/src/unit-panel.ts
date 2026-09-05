import { z } from "zod";

const nullableCategorySchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}, z.string().max(100).nullable());

export const unitPanelNodeTypeSchema = z.enum(["PANEL", "PART"]);
export const unitPanelLocationTypeSchema = z.enum(["GUDANG", "WORKSHOP", "UNIT"]);
export const unitPanelStockStatusSchema = z.enum(["IN_STORAGE", "RETRIEVED", "INSTALLED", "LOST"]);
export const unitPanelConditionTypeSchema = z.enum(["BARU", "RESTORE", "BEKAS"]);

export interface UnitPanelRecordShape {
  id: number;
  carId: string;
  componentId: number | null;
  catalogPanelId: number | null;
  sourceGeneralId: number | null;
  parentId: number | null;
  nodeType: "PANEL" | "PART";
  section: string;
  name: string;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  qty: number;
  defaultLocationType: "GUDANG" | "WORKSHOP" | "UNIT";
  defaultStockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST";
  defaultConditionType: "BARU" | "RESTORE" | "BEKAS";
  countdownUsageCount: number;
  statusUsageCount: number;
  childCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  children: UnitPanelRecordShape[];
}

export const unitPanelRecordSchema: z.ZodType<UnitPanelRecordShape> = z.lazy(() =>
  z.object({
    id: z.number().int().positive(),
    carId: z.string(),
    componentId: z.number().int().positive().nullable(),
    catalogPanelId: z.number().int().positive().nullable(),
    sourceGeneralId: z.number().int().positive().nullable(),
    parentId: z.number().int().positive().nullable(),
    nodeType: unitPanelNodeTypeSchema,
    section: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
    qty: z.number().positive(),
    defaultLocationType: unitPanelLocationTypeSchema,
    defaultStockStatus: unitPanelStockStatusSchema,
    defaultConditionType: unitPanelConditionTypeSchema,
    countdownUsageCount: z.number().int().nonnegative(),
    statusUsageCount: z.number().int().nonnegative(),
    childCount: z.number().int().nonnegative(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    children: z.array(unitPanelRecordSchema),
  }),
);

export interface UnitPanelGeneralRecordShape {
  id: number;
  parentId: number | null;
  nodeType: "PANEL" | "PART";
  section: string;
  name: string;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  defaultDivisionId: number | null;
  childCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  children: UnitPanelGeneralRecordShape[];
}

export const unitPanelGeneralRecordSchema: z.ZodType<UnitPanelGeneralRecordShape> = z.lazy(() =>
  z.object({
    id: z.number().int().positive(),
    parentId: z.number().int().positive().nullable(),
    nodeType: unitPanelNodeTypeSchema,
    section: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
    defaultDivisionId: z.number().int().positive().nullable(),
    childCount: z.number().int().nonnegative(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    children: z.array(unitPanelGeneralRecordSchema),
  }),
);

export const unitPanelCollectionSchema = z.object({
  unitId: z.string(),
  tree: z.array(unitPanelRecordSchema),
});

export const unitPanelGeneralCollectionSchema = z.object({
  tree: z.array(unitPanelGeneralRecordSchema),
});

export const createUnitPanelRequestSchema = z.object({
  sourceGeneralId: z.number().int().positive().nullable().optional(),
  parentId: z.number().int().positive().nullable().optional().default(null),
  section: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  category: nullableCategorySchema.default(null),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  qty: z.number().positive().max(100_000).default(1),
  defaultLocationType: unitPanelLocationTypeSchema.default("UNIT"),
  defaultStockStatus: unitPanelStockStatusSchema.default("INSTALLED"),
  defaultConditionType: unitPanelConditionTypeSchema.default("BEKAS"),
  isActive: z.boolean().optional().default(true),
});

export const updateUnitPanelRequestSchema = z.object({
  parentId: z.number().int().positive().nullable().optional(),
  section: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  category: nullableCategorySchema.default(null),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  qty: z.number().positive().max(100_000).default(1),
  defaultLocationType: unitPanelLocationTypeSchema.default("UNIT"),
  defaultStockStatus: unitPanelStockStatusSchema.default("INSTALLED"),
  defaultConditionType: unitPanelConditionTypeSchema.default("BEKAS"),
  isActive: z.boolean().optional().default(true),
});

export const renameUnitPanelCategoryRequestSchema = z.object({
  fromCategory: z.string().trim().min(1).max(100),
  toCategory: z.string().trim().min(1).max(100),
});

export const unitPanelCollectionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitPanelCollectionSchema,
});

export const unitPanelGeneralCollectionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitPanelGeneralCollectionSchema,
});

export const unitPanelMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    record: unitPanelRecordSchema,
  }),
});

export const unitPanelDeleteEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    deletedId: z.number().int().positive(),
  }),
});

export const unitPanelCategoryRenameEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    updatedCount: z.number().int().nonnegative(),
  }),
});

export type UnitPanelNodeType = z.infer<typeof unitPanelNodeTypeSchema>;
export type UnitPanelLocationType = z.infer<typeof unitPanelLocationTypeSchema>;
export type UnitPanelStockStatus = z.infer<typeof unitPanelStockStatusSchema>;
export type UnitPanelConditionType = z.infer<typeof unitPanelConditionTypeSchema>;
export type UnitPanelRecord = z.infer<typeof unitPanelRecordSchema>;
export type UnitPanelGeneralRecord = z.infer<typeof unitPanelGeneralRecordSchema>;
export type UnitPanelCollection = z.infer<typeof unitPanelCollectionSchema>;
export type UnitPanelGeneralCollection = z.infer<typeof unitPanelGeneralCollectionSchema>;
export type CreateUnitPanelRequest = z.infer<typeof createUnitPanelRequestSchema>;
export type UpdateUnitPanelRequest = z.infer<typeof updateUnitPanelRequestSchema>;
export type RenameUnitPanelCategoryRequest = z.infer<typeof renameUnitPanelCategoryRequestSchema>;
