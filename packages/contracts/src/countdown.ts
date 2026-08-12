import { gridMetaSchema, gridQueryStateSchema } from "@smsystem/contracts/grid";
import { galleryPhotoTypeSchema } from "./gallery";
import { z } from "zod";

export const countdownTaskCategorySchema = z.enum([
  "MAIN",
  "ADDITIONAL",
  "WO",
  "WOV",
]);

export const countdownStatusSchema = z.enum(["PLAN", "PROSES", "QC_READY", "DONE"]);

export const countdownRevisionStatusSchema = z.enum([
  "REQUESTED",
  "MO_REVIEW",
  "APPROVED",
  "REJECTED",
]);

const countdownRevisionDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/u);

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
  temuanAwal: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
  targetHoursInitial: z.number(),
  timeExtensionHours: z.number(),
  targetHoursRevised: z.number(),
  totalActualHours: z.number(),
  remainingHours: z.number(),
  workdayAlias: z.string().nullable().optional(),
  actualProgressPercent: z.number(),
  status: z.string(),
  extensionRequestStatus: countdownRevisionStatusSchema.nullable(),
  requestedExtensionHours: z.number().nonnegative(),
  requestedDeadline: z.string().nullable(),
  revisionReason: z.string().nullable(),
  countRevision: z.number().int().nonnegative(),
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
        code: z.string().nullable().optional(),
        parentId: z.number().int().nullable().optional(),
        parentName: z.string().nullable().optional(),
        parentCode: z.string().nullable().optional(),
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
        carId: z.string().nullable().optional(),
        section: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
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
        divisionId: z.number().int().nullable().optional(),
        divisionName: z.string().nullable().optional(),
        divisionParentId: z.number().int().nullable().optional(),
        divisionParentName: z.string().nullable().optional(),
        divisionParentCode: z.string().nullable().optional(),
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

export const countdownDetailPhotoSchema = z.object({
  photoId: z.string(),
  type: galleryPhotoTypeSchema,
  url: z.string(),
  caption: z.string().nullable(),
  uploader: z.string().nullable(),
  time: z.string(),
});

export const countdownDetailEntrySchema = z.object({
  detailId: z.string(),
  actualId: z.string().nullable(),
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
  dailyNotes: z.string().nullable(),
  photos: z.array(countdownDetailPhotoSchema),
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
  canRequestRevision: z.boolean().optional(),
  canApproveRevision: z.boolean().optional(),
  canApproveMoRevision: z.boolean().optional(),
});

export const countdownRevisionRequestSchema = z.object({
  requestedHours: z.number().positive(),
  requestedDeadline: countdownRevisionDateSchema,
  reason: z.string().trim().min(1).max(1000),
});

export const countdownRevisionDecisionSchema = z.object({
  isApproved: z.boolean(),
  approvedHours: z.number().nonnegative(),
  approvedDeadline: countdownRevisionDateSchema,
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
  temuanAwal: z.string().optional(),
  keterangan: z.string().optional(),
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
  temuanAwal: z.string().trim().max(1000).nullable().optional(),
  keterangan: z.string().trim().max(1000).nullable().optional(),
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
export type CountdownRevisionRequest = z.infer<typeof countdownRevisionRequestSchema>;
export type CountdownRevisionDecision = z.infer<typeof countdownRevisionDecisionSchema>;
