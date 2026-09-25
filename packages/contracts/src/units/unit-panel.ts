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
  code?: string | null;
  aliasName?: string | null;
  partNumber?: string | null;
  sourcePart?: "CATALOG" | "ADDITIONAL" | null;
  initialCondition?: string | null;
  currentStatus?: string | null;
  location?: string | null;
  notes?: string | null;
  totalJobdesc?: number;
  totalHours?: number;
  remainingHours?: number;
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
    code: z.string().nullable().optional(),
    aliasName: z.string().nullable().optional(),
    partNumber: z.string().nullable().optional(),
    sourcePart: z.enum(["CATALOG", "ADDITIONAL"]).nullable().optional(),
    initialCondition: z.string().nullable().optional(),
    currentStatus: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    totalJobdesc: z.number().nonnegative().optional(),
    totalHours: z.number().nonnegative().optional(),
    remainingHours: z.number().nonnegative().optional(),
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

export const unitPanelActivityTypeSchema = z.enum(["COUNTDOWN", "JOBDESC", "PR", "WO", "WOV"]);

export const unitPanelActivitySchema = z.object({
  type: unitPanelActivityTypeSchema,
  id: z.string(),
  title: z.string(),
  status: z.string().nullable(),
  date: z.string().nullable(),
  url: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const unitPanelImageSchema = z.object({
  id: z.number().int().positive(),
  partId: z.number().int().positive(),
  fileUrl: z.string(),
  caption: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().nullable(),
});

export const unitPanelOperationalSummarySchema = z.object({
  countdown: z.number().int().nonnegative(),
  jobdesc: z.number().int().nonnegative(),
  pr: z.number().int().nonnegative(),
  wo: z.number().int().nonnegative(),
  wov: z.number().int().nonnegative(),
  totalHours: z.number().nonnegative(),
  remainingHours: z.number().nonnegative(),
  progressPercent: z.number().nonnegative(),
});

const unitPanelCountdownReferenceOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  code: z.string().nullable().optional(),
  carId: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  parentId: z.number().int().nullable().optional(),
  parentName: z.string().nullable().optional(),
  parentCode: z.string().nullable().optional(),
  divisionId: z.number().int().nullable().optional(),
  divisionName: z.string().nullable().optional(),
  divisionParentId: z.number().int().nullable().optional(),
  divisionParentName: z.string().nullable().optional(),
  divisionParentCode: z.string().nullable().optional(),
});

export const unitPanelCountdownReferencesSchema = z.object({
  divisions: z.array(unitPanelCountdownReferenceOptionSchema),
  units: z.array(unitPanelCountdownReferenceOptionSchema),
  panels: z.array(unitPanelCountdownReferenceOptionSchema),
  sections: z.array(unitPanelCountdownReferenceOptionSchema),
  jobTypes: z.array(unitPanelCountdownReferenceOptionSchema),
  taskCategories: z.array(unitPanelCountdownReferenceOptionSchema),
});

export const unitPanelDetailSchema = z.object({
  unitId: z.string(),
  panel: unitPanelRecordSchema,
  images: z.array(unitPanelImageSchema),
  summary: unitPanelOperationalSummarySchema,
  activities: z.array(unitPanelActivitySchema),
  countdownReferences: unitPanelCountdownReferencesSchema,
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
  aliasName: z.string().trim().max(150).nullable().optional(),
  partNumber: z.string().trim().max(100).nullable().optional(),
  initialCondition: z.string().trim().max(50).nullable().optional(),
  currentStatus: z.string().trim().max(50).nullable().optional(),
  location: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
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
  aliasName: z.string().trim().max(150).nullable().optional(),
  partNumber: z.string().trim().max(100).nullable().optional(),
  initialCondition: z.string().trim().max(50).nullable().optional(),
  currentStatus: z.string().trim().max(50).nullable().optional(),
  location: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
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

export const unitPanelDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitPanelDetailSchema,
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
export type UnitPanelActivityType = z.infer<typeof unitPanelActivityTypeSchema>;
export type UnitPanelActivity = z.infer<typeof unitPanelActivitySchema>;
export type UnitPanelDetail = z.infer<typeof unitPanelDetailSchema>;
export type UnitPanelCountdownReferences = z.infer<typeof unitPanelCountdownReferencesSchema>;
export type UnitPanelGeneralCollection = z.infer<typeof unitPanelGeneralCollectionSchema>;
export type CreateUnitPanelRequest = z.infer<typeof createUnitPanelRequestSchema>;
export type UpdateUnitPanelRequest = z.infer<typeof updateUnitPanelRequestSchema>;
export type RenameUnitPanelCategoryRequest = z.infer<typeof renameUnitPanelCategoryRequestSchema>;
