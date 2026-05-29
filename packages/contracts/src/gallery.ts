import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

export const galleryPhotoTypeSchema = z.enum([
  "BEFORE",
  "PROCESS",
  "AFTER",
  "DEFECT",
]);

export const galleryPhotoSourceSchema = z.enum(["TEMP", "LEDGER"]);
export const galleryActualStatusSchema = z.enum([
  "pending",
  "onprogress",
  "done",
  "cancel",
]);

export const galleryReferenceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const galleryGridSortFieldSchema = z.enum([
  "latestPhotoAt",
  "workDate",
  "unitName",
  "panelName",
  "partName",
  "jobName",
  "jobDescription",
  "employeeName",
  "actualStatus",
  "photoCount",
]);

export const galleryQuerySchema = gridQueryStateSchema.extend({
  sortBy: galleryGridSortFieldSchema.default("latestPhotoAt"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  unitId: z.string().trim().min(1).nullable().default(null),
  divisionId: z.string().trim().min(1).nullable().default(null),
  panelId: z.string().trim().min(1).nullable().default(null),
  status: z.string().trim().min(1).nullable().default(null),
  part: z.string().trim().max(100).default(""),
  jobSearch: z.string().trim().max(100).default(""),
});

export const galleryRecordSchema = z.object({
  actualId: z.string(),
  planId: z.string(),
  countdownId: z.string(),
  workDate: z.string(),
  latestPhotoAt: z.string().nullable(),
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  panelId: z.number().int().nullable(),
  panelName: z.string(),
  partName: z.string(),
  jobTypeId: z.string().nullable(),
  jobName: z.string(),
  jobDescription: z.string(),
  employeeId: z.string().nullable(),
  employeeName: z.string(),
  actualStatus: galleryActualStatusSchema,
  countdownStatus: z.string(),
  progressPercent: z.number(),
  photoCount: z.number().int().min(0),
  beforeCount: z.number().int().min(0),
  processCount: z.number().int().min(0),
  afterCount: z.number().int().min(0),
  defectCount: z.number().int().min(0),
  submittedToLedger: z.boolean(),
});

export const galleryReferencesSchema = z.object({
  units: z.array(galleryReferenceOptionSchema),
  divisions: z.array(galleryReferenceOptionSchema),
  panels: z.array(galleryReferenceOptionSchema),
  statuses: z.array(galleryReferenceOptionSchema),
});

export const galleryGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(galleryRecordSchema),
  meta: gridMetaSchema,
  references: galleryReferencesSchema,
  query: galleryQuerySchema,
});

export const galleryPhotoRecordSchema = z.object({
  photoId: z.string(),
  actualId: z.string(),
  photoType: galleryPhotoTypeSchema,
  photoUrl: z.string(),
  caption: z.string().nullable(),
  source: galleryPhotoSourceSchema,
  uploadedBy: z.string().nullable(),
  uploadedByName: z.string().nullable(),
  uploadedAt: z.string(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export const galleryActualSummarySchema = z.object({
  actualId: z.string(),
  planId: z.string(),
  countdownId: z.string(),
  workDate: z.string(),
  carId: z.string(),
  unitName: z.string(),
  divisionName: z.string(),
  panelName: z.string(),
  partName: z.string(),
  jobName: z.string(),
  jobDescription: z.string(),
  employeeName: z.string(),
  actualStatus: galleryActualStatusSchema,
  countdownStatus: z.string(),
  submittedToLedger: z.boolean(),
});

export const galleryPhotoCollectionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    actual: galleryActualSummarySchema,
    photos: z.array(galleryPhotoRecordSchema),
  }),
});

export const galleryUploadTicketResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    uploadUrl: z.string().url(),
    publicUrl: z.string().url(),
    objectKey: z.string(),
  }),
});

export const createGalleryPhotoRequestSchema = z.object({
  actualId: z.string().trim().min(1),
  photoType: galleryPhotoTypeSchema,
  photoUrl: z.string().url(),
  caption: z.string().trim().max(255).nullable().optional(),
});

export const updateGalleryPhotoRequestSchema = z.object({
  photoType: galleryPhotoTypeSchema.optional(),
  photoUrl: z.string().url().optional(),
  caption: z.string().trim().max(255).nullable().optional(),
});

export const galleryPhotoMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    photo: galleryPhotoRecordSchema,
  }),
});

export const galleryPhotoDeleteEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    photoId: z.string(),
  }),
});

export type GalleryPhotoType = z.infer<typeof galleryPhotoTypeSchema>;
export type GalleryPhotoSource = z.infer<typeof galleryPhotoSourceSchema>;
export type GalleryActualStatus = z.infer<typeof galleryActualStatusSchema>;
export type GalleryQuery = z.infer<typeof galleryQuerySchema>;
export type GalleryRecord = z.infer<typeof galleryRecordSchema>;
export type GalleryPhotoRecord = z.infer<typeof galleryPhotoRecordSchema>;
export type GalleryActualSummary = z.infer<typeof galleryActualSummarySchema>;
export type CreateGalleryPhotoRequest = z.infer<typeof createGalleryPhotoRequestSchema>;
export type UpdateGalleryPhotoRequest = z.infer<typeof updateGalleryPhotoRequestSchema>;
