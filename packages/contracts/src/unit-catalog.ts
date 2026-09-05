import { z } from "zod";

export const catalogComponentCodeSchema = z.enum([
  "ENGINE",
  "UNDERCARRIAGE",
  "ELECTRICAL",
  "BODY",
  "INTERIOR",
]);

export const availabilityStatusSchema = z.enum(["UNKNOWN", "AVAILABLE", "NOT_AVAILABLE"]);
export const conditionStatusSchema = z.enum(["UNKNOWN", "GOOD", "RESTORE", "NOT_USABLE"]);
export const catalogActionTypeSchema = z.enum(["UNDECIDED", "NO_ACTION", "JOBDESC", "JOBDESC_ORDER"]);
export const taskCategorySchema = z.enum(["MAIN", "ADDITIONAL"]);

function nullableText(max: number) {
  return z.string().trim().max(max).nullable().optional().default(null);
}

function optionalNumber(max: number) {
  return z.number().positive().max(max).nullable().optional().default(null);
}

export const catalogComponentSchema = z.object({
  id: z.number().int().positive(),
  code: catalogComponentCodeSchema,
  componentName: z.string(),
});

export const catalogPanelSchema = z.object({
  id: z.number().int().positive(),
  componentId: z.number().int().positive(),
  componentCode: catalogComponentCodeSchema,
  componentName: z.string(),
  panelName: z.string(),
});

export const catalogPanelImageSchema = z.object({
  id: z.number().int().positive(),
  panelId: z.number().int().positive(),
  fileUrl: z.string(),
  caption: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().nullable(),
});

export const masterPanelSchema = z.object({
  id: z.number().int().positive(),
  carId: z.string(),
  partId: z.number().int().positive().nullable(),
  sourcePart: z.enum(["CATALOG", "ADDITIONAL"]).nullable(),
  componentId: z.number().int().positive().nullable(),
  panelId: z.number().int().positive().nullable(),
  componentName: z.string().nullable(),
  panelName: z.string().nullable(),
  namePart: z.string(),
  aliasName: z.string().nullable(),
  partNumber: z.string().nullable(),
  qty: z.number().nullable(),
  initialCondition: z.string().nullable(),
  currentStatus: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  media: z.array(catalogPanelImageSchema).default([]),
});

export const catalogItemMappingSchema = z.object({
  id: z.number().int().positive(),
  catalogReferenceMediaId: z.number().int().positive(),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
});

export const catalogWorkspaceItemSchema = z.object({
  id: z.number().int().positive().nullable(),
  clientRowId: z.string().trim().max(64).nullable().optional().default(null),
  code: nullableText(50),
  partNumber: nullableText(100),
  itemName: nullableText(150),
  position: nullableText(50),
  qtyNormal: optionalNumber(10_000_000),
  isRestoration: z.boolean().optional().default(false),
  createdAt: z.string().nullable().optional().default(null),
  updatedAt: z.string().nullable().optional().default(null),
});

export const catalogItemSchema = catalogWorkspaceItemSchema.extend({
  id: z.number().int().positive(),
  promotedPanelId: z.number().int().positive().nullable().optional().default(null),
  media: z.array(catalogPanelImageSchema).optional().default([]),
  mappings: z.array(catalogItemMappingSchema).optional().default([]),
});

export const catalogPanelSummarySchema = catalogPanelSchema.extend({
  itemCount: z.number().int().nonnegative(),
  restorationCount: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
});

export const catalogOverviewSchema = z.object({
  components: z.array(catalogComponentSchema),
  panels: z.array(catalogPanelSummarySchema),
});

export const catalogWorkspaceSchema = z.object({
  carId: z.string(),
  panel: catalogPanelSchema,
  panelImages: z.array(catalogPanelImageSchema).default([]),
  items: z.array(catalogWorkspaceItemSchema).default([]),
});

export const catalogSearchItemSchema = z.object({
  itemId: z.number().int().positive(),
  carId: z.string(),
  componentId: z.number().int().positive(),
  componentCode: catalogComponentCodeSchema,
  componentName: z.string(),
  panelId: z.number().int().positive(),
  panelName: z.string(),
  code: z.string().nullable(),
  partNumber: z.string().nullable(),
  itemName: z.string().nullable(),
  position: z.string().nullable(),
  qtyNormal: z.number().nullable(),
  isRestoration: z.boolean(),
});

export const openCatalogPanelRequestSchema = z.object({
  componentCode: catalogComponentCodeSchema,
  panelName: z.string().trim().min(1).max(150),
});

export const catalogWorkspaceItemInputSchema = z.object({
  id: z.number().int().positive().nullable().optional().default(null),
  clientRowId: z.string().trim().max(64).nullable().optional().default(null),
  code: nullableText(50),
  partNumber: nullableText(100),
  itemName: nullableText(150),
  position: nullableText(50),
  qtyNormal: optionalNumber(10_000_000),
  isRestoration: z.boolean().optional().default(false),
});

export const catalogPanelImageInputSchema = z.object({
  id: z.number().int().positive().nullable().optional().default(null),
  fileUrl: z.string().trim().min(1).max(2_000),
  caption: nullableText(255),
  sortOrder: z.number().int().min(0).max(20_000).default(0),
});

export const saveCatalogWorkspaceRequestSchema = z.object({
  items: z.array(catalogWorkspaceItemInputSchema).max(5_000),
  deletedItemIds: z.array(z.number().int().positive()).optional().default([]),
  panelImages: z.array(catalogPanelImageInputSchema).optional().default([]),
  deletedPanelImageIds: z.array(z.number().int().positive()).optional().default([]),
});

export const updateCatalogSurveyRequestSchema = z.object({
  isRestoration: z.boolean().optional(),
  qtyOpname: optionalNumber(10_000_000),
  actualName: nullableText(255),
  availabilityStatus: availabilityStatusSchema.default("UNKNOWN"),
  conditionStatus: conditionStatusSchema.default("UNKNOWN"),
  actionType: catalogActionTypeSchema.default("UNDECIDED"),
  location: nullableText(255),
  notes: nullableText(2_000),
  mapping: z.object({
    catalogReferenceMediaId: z.number().int().positive(),
    xPercent: z.number().min(0).max(100),
    yPercent: z.number().min(0).max(100),
  }).nullable().optional().default(null),
});

export const catalogMediaRequestSchema = z.object({
  fileUrl: z.string().trim().min(1).max(2_000),
  caption: nullableText(255),
});

export const catalogPanelImageRequestSchema = catalogMediaRequestSchema.extend({
  sortOrder: z.number().int().min(0).max(9_999).optional().default(0),
});

export const createAdditionalCatalogItemRequestSchema = z.object({
  componentName: nullableText(100),
  panelName: nullableText(150),
  itemName: z.string().trim().min(1).max(150),
  partNumber: nullableText(100),
  deskription: z.string().trim().max(2_000).nullable().optional().default(null),
});

export const panelJobdescInputSchema = z.object({
  divisionId: z.number().int().positive(),
  jobTypeId: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(1_000),
  targetHoursInitial: z.number().positive().max(10_000),
  picPlan: z.string().trim().max(50).nullable().optional().default(null),
  requiredGrade: z.string().trim().max(50).nullable().optional().default(null),
  standardHours: z.number().positive().nullable().optional().default(null),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional().default(null),
  notes: z.string().trim().max(1_000).nullable().optional().default(null),
  taskCategory: taskCategorySchema.default("MAIN"),
});

export const createPanelJobdescsRequestSchema = z.object({
  jobs: z.array(panelJobdescInputSchema).min(1).max(25),
});

const catalogSpreadsheetColumns = [
  "code",
  "partNumber",
  "itemName",
  "position",
  "qtyNormal",
  "isRestoration",
] as const;

type CatalogSpreadsheetColumn = typeof catalogSpreadsheetColumns[number];

const catalogSpreadsheetHeaders: Record<string, CatalogSpreadsheetColumn> = {
  CODE: "code",
  ITEM: "itemName",
  ITEMNAME: "itemName",
  NAME: "itemName",
  NAMA: "itemName",
  PARTNUMBER: "partNumber",
  PARTNUMBERS: "partNumber",
  PARTSNUMBER: "partNumber",
  PARTNO: "partNumber",
  PN: "partNumber",
  POSITION: "position",
  POSITIONCODE: "position",
  QTY: "qtyNormal",
  QTYNORMAL: "qtyNormal",
  RESTORATION: "isRestoration",
  ISRESTORATION: "isRestoration",
  PILIHRESTORASI: "isRestoration",
};

function normalizeSpreadsheetHeader(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "");
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`CATALOG_QTY_INVALID:${trimmed}`);
  }
  return parsed;
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized) return false;
  return ["1", "TRUE", "YA", "YES", "Y", "RESTORE", "RESTORATION"].includes(normalized);
}

export function parseCatalogSpreadsheetText(text: string): CatalogWorkspaceItemInput[] {
  const rows = text
    .split(/\r?\n/u)
    .map((line) => line.split("\t"))
    .filter((row) => row.some((cell) => cell.trim()));

  if (rows.length === 0) return [];

  const headerIndexes = new Map<CatalogSpreadsheetColumn, number>();
  rows[0]?.forEach((cell, index) => {
    const column = catalogSpreadsheetHeaders[normalizeSpreadsheetHeader(cell)];
    if (column) headerIndexes.set(column, index);
  });

  const hasHeader = headerIndexes.size > 0;
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  return bodyRows.map((row) => {
    const read = (column: CatalogSpreadsheetColumn) => {
      const columnIndex = hasHeader ? headerIndexes.get(column) : catalogSpreadsheetColumns.indexOf(column);
      return columnIndex === undefined || columnIndex < 0 ? undefined : row[columnIndex];
    };

    return catalogWorkspaceItemInputSchema.parse({
      code: emptyToNull(read("code")),
      partNumber: emptyToNull(read("partNumber")),
      itemName: emptyToNull(read("itemName")),
      position: emptyToNull(read("position")),
      qtyNormal: parseOptionalNumber(read("qtyNormal")),
      isRestoration: parseOptionalBoolean(read("isRestoration")),
    });
  });
}

export type CatalogComponent = z.infer<typeof catalogComponentSchema>;
export type CatalogPanel = z.infer<typeof catalogPanelSchema>;
export type CatalogPanelImage = z.infer<typeof catalogPanelImageSchema>;
export type MasterPanel = z.infer<typeof masterPanelSchema>;
export type CatalogPanelSummary = z.infer<typeof catalogPanelSummarySchema>;
export type CatalogOverview = z.infer<typeof catalogOverviewSchema>;
export type CatalogWorkspace = z.infer<typeof catalogWorkspaceSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type CatalogWorkspaceItem = z.infer<typeof catalogWorkspaceItemSchema>;
export type CatalogWorkspaceItemInput = z.infer<typeof catalogWorkspaceItemInputSchema>;
export type CatalogSearchItem = z.infer<typeof catalogSearchItemSchema>;
export type OpenCatalogPanelRequest = z.infer<typeof openCatalogPanelRequestSchema>;
export type SaveCatalogWorkspaceRequest = z.infer<typeof saveCatalogWorkspaceRequestSchema>;
export type UpdateCatalogSurveyRequest = z.infer<typeof updateCatalogSurveyRequestSchema>;
export type CatalogMediaRequest = z.infer<typeof catalogMediaRequestSchema>;
export type CatalogPanelImageRequest = z.infer<typeof catalogPanelImageRequestSchema>;
export type CreateAdditionalCatalogItemRequest = z.infer<typeof createAdditionalCatalogItemRequestSchema>;
export type CreatePanelJobdescsRequest = z.infer<typeof createPanelJobdescsRequestSchema>;
