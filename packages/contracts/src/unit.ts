import { gridMetaSchema, gridQueryStateSchema } from "@smsystem/contracts/grid";
import { z } from "zod";

export const unitRiskLevelSchema = z.enum(["GREEN", "YELLOW", "ORANGE", "RED", "UNKNOWN"]);
export const unitMasterStatusSchema = z.enum(["In_Progress", "Done"]);

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
  restorationType: z.string().nullable(),
  isMargin: z.boolean(),
  incomingDate: z.string().nullable(),
  revisionContract: z.string().nullable(),
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
  status: z.string(),
});

export const unitBoardEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(unitBoardRowSchema),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const createUnitRequestSchema = z.object({
  unitId: z.string().trim().min(1).max(64),
  unitName: z.string().trim().min(1).max(255),
  plateNumber: nullableTrimmedText,
  customerName: nullableTrimmedText,
  restorationType: z.string().trim().max(50).default("FULL_RESTORASI"),
  isMargin: z.boolean().default(true),
  contractDeliveryDate: nullableDateText,
  incomingDate: nullableDateText,
  revisionContract: nullableDateText,
  status: unitMasterStatusSchema.default("In_Progress"),
});

export const updateUnitRequestSchema = z.object({
  unitName: z.string().trim().min(1).max(255),
  plateNumber: nullableTrimmedText,
  customerName: nullableTrimmedText,
  restorationType: z.string().trim().max(50).default("FULL_RESTORASI"),
  isMargin: z.boolean().default(true),
  contractDeliveryDate: nullableDateText,
  incomingDate: nullableDateText,
  revisionContract: nullableDateText,
  status: unitMasterStatusSchema.default("In_Progress"),
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
