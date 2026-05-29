import { gridMetaSchema, gridQueryStateSchema } from "@smsystem/contracts/grid";
import { z } from "zod";

export const countdownTaskCategorySchema = z.enum([
  "MAIN",
  "ADDITIONAL",
  "WO",
  "WOV",
]);

export const countdownStatusSchema = z.enum(["PLAN", "PROSES", "QC_READY", "DONE"]);

export const countdownBoardRowSchema = z.object({
  countdownId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  panelId: z.number().int().nullable(),
  panelName: z.string().nullable(),
  sectionName: z.string().nullable(),
  taskCategory: z.string(),
  jobTypeId: z.string().nullable(),
  jobTypeName: z.string().nullable(),
  prerequisiteCoreId: z.string().nullable().optional(),
  refWoId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  targetHoursInitial: z.number(),
  timeExtensionHours: z.number(),
  targetHoursRevised: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  workdayAlias: z.string().nullable().optional(),
  actualProgressPercent: z.number(),
  status: z.string(),
  startDate: z.string().nullable(),
  deadlineDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  isOverdue: z.boolean(),
});

export const countdownBoardEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(countdownBoardRowSchema),
  references: z.object({
    divisions: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    units: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    panels: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    sections: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ).optional(),
    jobTypes: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    taskCategories: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ).optional(),
  }).optional(),
  canManage: z.boolean().optional(),
  meta: gridMetaSchema,
  query: gridQueryStateSchema,
});

export const countdownDetailEntrySchema = z.object({
  detailId: z.string(),
  entryType: z.string(),
  employeeId: z.string().nullable(),
  employeeName: z.string(),
  employeeRole: z.string().nullable(),
  workDate: z.string(),
  startTime: z.string(),
  finishTime: z.string(),
  billedHours: z.number(),
  progressPercent: z.number(),
  taskStatus: z.string(),
});

export const countdownDetailSchema = countdownBoardRowSchema.extend({
  details: z.array(countdownDetailEntrySchema),
});

export const countdownDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    countdown: countdownDetailSchema,
  }),
  canManage: z.boolean().optional(),
});

export const countdownImportIssueSchema = z.object({
  rowNumber: z.number().int().nonnegative(),
  field: z.string(),
  message: z.string(),
  value: z.string().nullable(),
});

export const countdownImportResultSchema = z.object({
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  issues: z.array(countdownImportIssueSchema),
});

export const countdownImportEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: countdownImportResultSchema,
});

export const countdownTemplateRowSchema = z.object({
  carId: z.string(),
  unitName: z.string().optional(),
  divisionId: z.string(),
  divisionName: z.string().optional(),
  panelId: z.string().optional(),
  panelName: z.string().optional(),
  taskCategory: countdownTaskCategorySchema,
  sectionName: z.string(),
  jobTypeId: z.string().optional(),
  jobTypeName: z.string().optional(),
  targetHoursInitial: z.number(),
  startDate: z.string().optional(),
  deadlineDate: z.string().optional(),
  prerequisiteCoreId: z.string().optional(),
  refWoId: z.string().optional(),
  note: z.string().optional(),
});

export const countdownCreateRequestSchema = z.object({
  carId: z.string().trim().min(1).max(100),
  divisionId: z.number().int().positive(),
  panelId: z.number().int().positive().nullable().optional(),
  taskCategory: countdownTaskCategorySchema.optional(),
  sectionName: z.string().trim().min(1).max(255),
  jobTypeId: z.string().trim().min(1).max(100).nullable().optional(),
  targetHoursInitial: z.number().nonnegative(),
  startDate: z.string().trim().min(1).max(20).nullable().optional(),
  deadlineDate: z.string().trim().min(1).max(20),
  prerequisiteCoreId: z.string().trim().min(1).max(100).nullable().optional(),
  refWoId: z.string().trim().min(1).max(100).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  status: countdownStatusSchema.optional(),
});

export const countdownUpdateRequestSchema = countdownCreateRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field wajib diisi untuk update countdown.",
  });

export type CountdownBoardRow = z.infer<typeof countdownBoardRowSchema>;
export type CountdownDetail = z.infer<typeof countdownDetailSchema>;
export type CountdownImportResult = z.infer<typeof countdownImportResultSchema>;
export type CountdownTemplateRow = z.infer<typeof countdownTemplateRowSchema>;
export type CountdownCreateRequest = z.infer<typeof countdownCreateRequestSchema>;
export type CountdownUpdateRequest = z.infer<typeof countdownUpdateRequestSchema>;
