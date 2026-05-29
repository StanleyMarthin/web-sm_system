import { z } from "zod";

export const unitBomPhysicalStatusSchema = z.enum([
  "INSTALLED",
  "IN_DIVISION",
  "DISASSEMBLED",
]);

export const unitBomLogisticStatusSchema = z.enum([
  "READY_GUDANG",
  "ORDER_PR",
  "AT_VENDOR",
  "CANNIBALIZED",
]);

export const unitBomNodeTypeSchema = z.enum([
  "CATEGORY",
  "SECTION",
  "PART",
]);

export const unitBomTimelineEventTypeSchema = z.enum([
  "HANDOVER",
  "JOB_PLAN",
  "QC",
]);

export const unitBomPhotoSlotSchema = z.enum([
  "BEFORE",
  "EVIDENCE",
  "AFTER",
]);

export const unitBomDocumentTypeSchema = z.enum([
  "PR",
  "WOV",
  "STOCK",
  "TRANSFER",
]);

export const unitBomTimelineItemSchema = z.object({
  eventType: unitBomTimelineEventTypeSchema,
  title: z.string(),
  description: z.string(),
  occurredAt: z.string().nullable(),
  actorName: z.string().nullable(),
  statusLabel: z.string().nullable(),
});

export const unitBomPhotoSlotSummarySchema = z.object({
  slot: unitBomPhotoSlotSchema,
  label: z.string(),
  photoCount: z.number().int().nonnegative(),
  latestPhotoUrl: z.string().nullable(),
  latestPhotoAt: z.string().nullable(),
});

export const unitBomDocumentSchema = z.object({
  documentType: unitBomDocumentTypeSchema,
  title: z.string(),
  description: z.string(),
  statusLabel: z.string().nullable(),
  path: z.string().nullable(),
});

export const unitBomPartDetailSchema = z.object({
  workStatusLabel: z.string(),
  isLocked: z.boolean(),
  timeline: z.array(unitBomTimelineItemSchema),
  photos: z.array(unitBomPhotoSlotSummarySchema),
  documents: z.array(unitBomDocumentSchema),
});

export interface UnitBomNodeShape {
  nodeId: string;
  nodeType: "CATEGORY" | "SECTION" | "PART";
  label: string;
  category: string | null;
  section: string | null;
  panelId: number | null;
  physicalStatus: "INSTALLED" | "IN_DIVISION" | "DISASSEMBLED" | null;
  divisionId: number | null;
  divisionName: string | null;
  progressPercent: number | null;
  remainingHours: number | null;
  actualId: string | null;
  logisticStatus: "READY_GUDANG" | "ORDER_PR" | "AT_VENDOR" | "CANNIBALIZED" | null;
  logisticReference: string | null;
  logisticPath: string | null;
  detail?: UnitBomPartDetail | null;
  children: UnitBomNodeShape[];
}

export const unitBomSummarySchema = z.object({
  totalParts: z.number().int().nonnegative(),
  installedParts: z.number().int().nonnegative(),
  inDivisionParts: z.number().int().nonnegative(),
  disassembledParts: z.number().int().nonnegative(),
});

export const unitBomNodeSchema: z.ZodType<UnitBomNodeShape> = z.lazy(() =>
  z.object({
    nodeId: z.string(),
    nodeType: unitBomNodeTypeSchema,
    label: z.string(),
    category: z.string().nullable(),
    section: z.string().nullable(),
    panelId: z.number().int().nullable(),
    physicalStatus: unitBomPhysicalStatusSchema.nullable(),
    divisionId: z.number().int().nullable(),
    divisionName: z.string().nullable(),
    progressPercent: z.number().nullable(),
    remainingHours: z.number().nullable(),
    actualId: z.string().nullable(),
    logisticStatus: unitBomLogisticStatusSchema.nullable(),
    logisticReference: z.string().nullable(),
    logisticPath: z.string().nullable(),
    detail: unitBomPartDetailSchema.nullable().optional(),
    children: z.array(unitBomNodeSchema),
  }),
);

export const unitBomWorkspaceSchema = z.object({
  unitId: z.string(),
  summary: unitBomSummarySchema,
  tree: z.array(unitBomNodeSchema),
});

export const unitBomWorkspaceEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitBomWorkspaceSchema,
});

export type UnitBomPhysicalStatus = z.infer<typeof unitBomPhysicalStatusSchema>;
export type UnitBomLogisticStatus = z.infer<typeof unitBomLogisticStatusSchema>;
export type UnitBomNodeType = z.infer<typeof unitBomNodeTypeSchema>;
export type UnitBomTimelineEventType = z.infer<typeof unitBomTimelineEventTypeSchema>;
export type UnitBomPhotoSlot = z.infer<typeof unitBomPhotoSlotSchema>;
export type UnitBomDocumentType = z.infer<typeof unitBomDocumentTypeSchema>;
export type UnitBomTimelineItem = z.infer<typeof unitBomTimelineItemSchema>;
export type UnitBomPhotoSlotSummary = z.infer<typeof unitBomPhotoSlotSummarySchema>;
export type UnitBomDocument = z.infer<typeof unitBomDocumentSchema>;
export type UnitBomPartDetail = z.infer<typeof unitBomPartDetailSchema>;
export type UnitBomSummary = z.infer<typeof unitBomSummarySchema>;
export type UnitBomNode = z.infer<typeof unitBomNodeSchema>;
export type UnitBomWorkspace = z.infer<typeof unitBomWorkspaceSchema>;
