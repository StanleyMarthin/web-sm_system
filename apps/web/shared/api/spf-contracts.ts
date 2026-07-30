import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(100);
const idArraySchema = z.array(idSchema).min(1);
const paginationRequest = {
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
};
const text = (max: number) => z.string().trim().min(1).max(max);

const sourceRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("SMS_DB"),
    car_id: idSchema.optional(),
    work_type: z.string().trim().max(100).optional(),
    ...paginationRequest,
  }),
  z.object({ mode: z.literal("COLLECT"), source_ids: idArraySchema.max(200) }),
]);

const itemRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    car_id: idSchema.optional(),
    period_id: idSchema.optional(),
    sort: z.enum(["created_at", "updated_at", "work_type", "car_id"]).optional(),
    order: z.enum(["ASC", "DESC", "asc", "desc"]).optional(),
    ...paginationRequest,
  }),
  z.object({ mode: z.literal("DETAIL"), item_id: idSchema }),
  z.object({
    mode: z.literal("CREATE"),
    car_id: idSchema,
    panel_id: z.number().int().positive().optional(),
    description: text(5000),
    work_type: text(100),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    item_id: idSchema,
    description: text(5000).optional(),
    work_type: text(100).optional(),
  }),
  z.object({ mode: z.literal("DELETE"), item_id: idSchema }),
  z.object({
    mode: z.literal("UPLOAD_MEDIA"),
    item_id: idSchema,
    file_name: text(255).refine(
      (name) => !/[\\/\u0000-\u001f\u007f]/u.test(name),
      "Nama file tidak valid",
    ),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
    file_data: z.string().min(1).max(6_990_508).regex(/^[A-Za-z0-9+/]+={0,2}$/u, "Data file tidak valid"),
  }),
  z.object({ mode: z.literal("DELETE_MEDIA"), media_id: idSchema }),
]);

const periodRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("LIST"), ...paginationRequest }),
  z.object({ mode: z.literal("DETAIL"), period_id: idSchema }),
  z.object({
    mode: z.literal("CREATE"),
    title: text(255),
    description: z.string().trim().max(5000).optional(),
    date_start: z.iso.date(),
    date_end: z.iso.date(),
    item_ids: z.array(idSchema).optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    period_id: idSchema,
    title: text(255).optional(),
    description: z.string().trim().max(5000).optional(),
    date_start: z.iso.date().optional(),
    date_end: z.iso.date().optional(),
    attach_item_ids: z.array(idSchema).optional(),
  }),
  z.object({ mode: z.literal("SUBMIT"), period_id: idSchema }),
  z.object({ mode: z.literal("APPROVE"), period_id: idSchema }),
  z.object({ mode: z.literal("REJECT"), period_id: idSchema, reason: text(2000).optional() }),
  z.object({ mode: z.literal("PUBLISH"), period_id: idSchema }),
  z.object({ mode: z.literal("UNPUBLISH"), period_id: idSchema }),
  z.object({ mode: z.literal("EXPORT"), period_id: idSchema }),
]);

export const requestSchemas = {
  source: sourceRequestSchema,
  item: itemRequestSchema,
  period: periodRequestSchema,
} as const;
export type SpfResource = keyof typeof requestSchemas;
export type SourceRequest = z.infer<typeof sourceRequestSchema>;
export type ItemRequest = z.infer<typeof itemRequestSchema>;
export type PeriodRequest = z.infer<typeof periodRequestSchema>;

export const SPF_PERIOD_STATUSES = [
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
] as const;
export type SpfPeriodStatus = (typeof SPF_PERIOD_STATUSES)[number];

export const spfPaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});
export type SpfPagination = z.infer<typeof spfPaginationSchema>;

export const spfItemSchema = z.object({
  id: idSchema,
  source_id: idSchema.nullable().optional(),
  car_id: idSchema,
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string(),
  period_id: idSchema.nullable(),
  is_released: z.coerce.boolean().optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string().nullable().transform((value) => value ?? ""),
  updated_at: z.string().nullable().transform((value) => value ?? ""),
});
export type SpfItem = z.infer<typeof spfItemSchema>;

export const spfMediaSchema = z.object({
  id: idSchema,
  item_id: idSchema,
  r2_key: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().nonnegative(),
  admin_id: z.string().nullable(),
  created_at: z.string().nullable().transform((value) => value ?? ""),
}).transform((media) => ({
  ...media,
  url: media.r2_key,
  filename: media.file_name,
}));
export type SpfMedia = z.infer<typeof spfMediaSchema>;

export const spfPeriodSchema = z.object({
  id: idSchema,
  title: z.string().nullable().transform((value) => value ?? "-"),
  description: z.string().nullable().optional(),
  workflow_status: z.enum(SPF_PERIOD_STATUSES),
  date_start: z.string().nullable().optional(),
  date_end: z.string().nullable().optional(),
  rejection_reason: z.string().nullable(),
  created_by: z.string().nullable().transform((value) => value ?? "-"),
  created_at: z.string().nullable().transform((value) => value ?? ""),
  updated_at: z.string().nullable().transform((value) => value ?? ""),
});
export type SpfPeriod = z.infer<typeof spfPeriodSchema>;

export const spfSourceSchema = z.object({
  id: idSchema,
  car_id: idSchema,
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string().nullable(),
  collected: z.coerce.boolean(),
  created_at: z.string().nullable().transform((value) => value ?? ""),
});
export type SpfSource = z.infer<typeof spfSourceSchema>;

export const spfItemListEnvelopeSchema = z.object({
  data: z.object({
    items: z.array(spfItemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});
export const spfItemDetailEnvelopeSchema = z.object({
  data: z.object({ item: spfItemSchema, media: z.array(spfMediaSchema) }),
});
export const spfPeriodListEnvelopeSchema = z.object({
  data: z.object({
    periods: z.array(spfPeriodSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});
export const spfPeriodDetailEnvelopeSchema = z.object({
  data: z.object({
    period: spfPeriodSchema,
    items: z.array(spfItemSchema),
    total_items: z.number().int().nonnegative().optional(),
  }),
});
export const spfSourceListEnvelopeSchema = z.object({
  data: z.object({
    items: z.array(spfSourceSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});
export const spfMutationEnvelopeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});
export const spfErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string().optional(), message: z.string().optional() }),
});
