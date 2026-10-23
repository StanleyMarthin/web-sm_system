import { gridMetaSchema, gridQueryStateSchema } from "@smsystem/contracts/grid";
import { z } from "zod";

export const unitRiskLevelSchema = z.enum(["GREEN", "YELLOW", "ORANGE", "RED", "UNKNOWN", "DELIVERED"]);
export const unitMasterStatusSchema = z.enum(["PLAN", "ON_PROGRESS", "HOLD", "DONE"]);
export const unitRestorationTypeSchema = z.enum(["FULL_RESTORATION", "PARTIAL_RESTORATION"]);

const nullableTrimmedText = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const optionalNullableTrimmedText = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value.length > 0 ? value : null;
  });

const nullableLongText = z
  .string()
  .trim()
  .max(4000)
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    return value.length > 0 ? value : null;
  });

const nullableDateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Tanggal harus berformat YYYY-MM-DD")
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

export const unitBoardRowSchema = z.object({
  unitId: z.string(),
  unitName: z.string(),
  plateNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  vehicleNotes: z.string().nullable().optional(),
  restorationType: unitRestorationTypeSchema.nullable(),
  isMargin: z.boolean(),
  incomingDate: z.string().nullable(),
  targetTdAwal: z.string().nullable(),
  targetTdCoo: z.string().nullable(),
  targetDelivery: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  kpId: z.string().nullable(),
  kdId: z.string().nullable(),
  kpName: z.string(),
  advisorName: z.string(),
  targetDeliveryDate: z.string().nullable(),
  etaDate: z.string().nullable(),
  riskLevel: unitRiskLevelSchema,
  progressPercent: z.number(),
  remainingHours: z.number(),
  woOpenCount: z.number().int().nonnegative(),
  prOpenCount: z.number().int().nonnegative(),
  qcIssueOpenCount: z.number().int().nonnegative(),
  issueOpenCount: z.number().int().nonnegative(),
  status: unitMasterStatusSchema,
});

export const unitBoardEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(unitBoardRowSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const unitClientSchema = z.object({
  name: z.string(),
  unitCount: z.number().int().nonnegative(),
});

export const unitClientUnitSchema = z.object({
  unitId: z.string(),
  unitName: z.string(),
  status: z.string(),
});

export const unitClientsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    clients: z.array(unitClientSchema),
    selectedClient: z.object({ name: z.string(), units: z.array(unitClientUnitSchema) }).nullable(),
  }),
});

export type UnitClient = z.infer<typeof unitClientSchema>;
export type UnitClientUnit = z.infer<typeof unitClientUnitSchema>;

export const createUnitRequestSchema = z.object({
  unitId: nullableTrimmedText.refine((value) => value === null || value.length <= 36, "ID unit maksimal 36 karakter"),
  unitName: z.string().trim().min(1).max(255),
  plateNumber: nullableTrimmedText,
  customerName: nullableTrimmedText,
  vehicleNotes: nullableLongText,
  restorationType: unitRestorationTypeSchema.default("FULL_RESTORATION"),
  isMargin: z.boolean().default(true),
  incomingDate: nullableDateText,
  targetTdAwal: nullableDateText,
  targetTdCoo: nullableDateText,
  targetDelivery: nullableDateText,
  kpId: z.string().trim().min(1).max(50),
  kdId: nullableTrimmedText,
});

export const updateUnitRequestSchema = z.object({
  unitName: z.string().trim().min(1).max(255),
  plateNumber: nullableTrimmedText,
  customerName: nullableTrimmedText,
  vehicleNotes: nullableLongText,
  restorationType: unitRestorationTypeSchema.default("FULL_RESTORATION"),
  isMargin: z.boolean().default(true),
  incomingDate: nullableDateText,
  targetTdAwal: nullableDateText,
  targetTdCoo: nullableDateText,
  targetDelivery: nullableDateText,
  kpId: z.string().trim().min(1).max(50),
  kdId: nullableTrimmedText,
  status: unitMasterStatusSchema.optional(),
});

export const unitReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const unitReferencesEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    customers: z.array(unitReferenceOptionSchema),
    kps: z.array(unitReferenceOptionSchema),
    kds: z.array(unitReferenceOptionSchema),
    qa: unitReferenceOptionSchema.nullable(),
  }),
});

export const unitMediaFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

export const unitMediaSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  folderName: z.string(),
  mediaType: z.enum(["PHOTO", "VIDEO"]),
  source: z.enum(["UPLOAD", "GOOGLE_DRIVE"]),
  mediaUrl: z.string().url(),
  caption: z.string().nullable(),
  isCover: z.boolean(),
  createdAt: z.string().nullable(),
});

export const unitMediaCollectionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    folders: z.array(unitMediaFolderSchema),
    media: z.array(unitMediaSchema),
  }),
});

export const createUnitMediaFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createUnitMediaRequestSchema = z.object({
  folderId: z.string().trim().min(1).max(36),
  mediaType: z.enum(["PHOTO", "VIDEO"]),
  source: z.enum(["UPLOAD", "GOOGLE_DRIVE"]),
  mediaUrl: z.string().trim().url().max(2048),
  caption: nullableTrimmedText,
});

export const updateUnitMediaRequestSchema = z.object({
  folderId: z.string().trim().min(1).max(36).optional(),
  caption: optionalNullableTrimmedText,
  isCover: z.boolean().optional(),
});

export const unitMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unit: unitBoardRowSchema,
  }),
});

export const unitDeleteEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    deletedUnitId: z.string(),
  }),
});

export const countdownSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  plan: z.number().int().nonnegative(),
  proses: z.number().int().nonnegative(),
  qcReady: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  remainingHours: z.number(),
  progressPercent: z.number(),
});

export const woSummarySchema = z.object({
  submitted: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
});

export const issueSummarySchema = z.object({
  open: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  highSeverityOpen: z.number().int().nonnegative(),
});

export const deliveryRiskSchema = z.object({
  level: unitRiskLevelSchema,
  reason: z.string(),
});

export const unitWorkspaceDivisionProgressSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  total: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  remainingHours: z.number(),
  progressPercent: z.number(),
});

export const unitWorkspaceCountdownItemSchema = z.object({
  countdownId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  panelId: z.number().int().nullable(),
  panelName: z.string().nullable(),
  sectionName: z.string().nullable(),
  taskCategory: z.string(),
  jobTypeId: z.string().nullable(),
  jobTypeName: z.string().nullable(),
  targetHoursRevised: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  recommendationHours: z.number(),
  workdayAlias: z.string(),
  actualProgressPercent: z.number(),
  status: z.string(),
  deadlineDate: z.string().nullable(),
  isOverdue: z.boolean(),
});

export const unitWorkspaceSchema = z.object({
  unitId: z.string(),
  countdownSummary: countdownSummarySchema,
  divisionProgress: z.array(unitWorkspaceDivisionProgressSchema).optional(),
  countdownItems: z.array(unitWorkspaceCountdownItemSchema).optional(),
  woSummary: woSummarySchema,
  issueSummary: issueSummarySchema,
  deliveryRisk: deliveryRiskSchema,
});

export const unitWorkspaceEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitWorkspaceSchema,
});

export type UnitBoardRow = z.infer<typeof unitBoardRowSchema>;
export type UnitWorkspace = z.infer<typeof unitWorkspaceSchema>;
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;
export type UnitReferenceOption = z.infer<typeof unitReferenceOptionSchema>;
export type UnitMediaFolder = z.infer<typeof unitMediaFolderSchema>;
export type UnitMedia = z.infer<typeof unitMediaSchema>;
export type CreateUnitMediaFolderRequest = z.infer<typeof createUnitMediaFolderRequestSchema>;
export type CreateUnitMediaRequest = z.infer<typeof createUnitMediaRequestSchema>;
export type UpdateUnitMediaRequest = z.infer<typeof updateUnitMediaRequestSchema>;
