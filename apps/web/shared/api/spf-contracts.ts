import { z } from "zod";

// ─── Primitive helpers ────────────────────────────────────────────────────────
// Request ID accepts string or number from UI/caller
export const requestIdSchema = z.union([z.string(), z.number()]);
export const idSchema = requestIdSchema;
const requestIdArraySchema = z.array(requestIdSchema).min(1, "Minimal satu ID diperlukan");
const flexibleRequestIdArray = z.array(requestIdSchema);

// Response ID transforms any number/string from backend to string for UI consistency
export const responseIdSchema = z.union([z.string(), z.number()]).transform(String);

const paginationRequest = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
};

const text = (max: number) => z.string().trim().min(1).max(max);
const trimmedString = (label: string, max: number) =>
  z
    .string({ message: `${label} wajib diisi` })
    .trim()
    .min(1, `${label} tidak boleh kosong`)
    .max(max, `${label} maksimal ${max} karakter`);

// ─── Sort allowlists ──────────────────────────────────────────────────────────
const ALLOWED_ITEM_SORTS = ["created_at", "updated_at", "work_type", "car_id"] as const;
const ALLOWED_PERIOD_SORTS = ["created_at", "updated_at", "title"] as const;
const ORDER = ["ASC", "DESC", "asc", "desc"] as const;

// ─── Source request schema ────────────────────────────────────────────────────
const sourceRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("SMS_DB"),
    car_id: requestIdSchema.optional(),
    work_type: z.string().trim().max(100).optional(),
    ...paginationRequest,
  }),
  z.object({
    mode: z.literal("COLLECT"),
    source_ids: requestIdArraySchema.max(200, "Maksimal 200 source per request"),
  }),
]);

// ─── Item request schema ──────────────────────────────────────────────────────
const itemRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    car_id: requestIdSchema.optional(),
    period_id: requestIdSchema.optional(),
    sort: z.enum(ALLOWED_ITEM_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...paginationRequest,
  }),
  z.object({
    mode: z.literal("DETAIL"),
    item_id: requestIdSchema,
  }),
  z.object({
    mode: z.literal("CREATE"),
    car_id: requestIdSchema,
    panel_id: z.coerce.number().int().positive().optional(),
    description: text(5000),
    work_type: text(100),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    item_id: requestIdSchema,
    description: text(5000).optional(),
    work_type: text(100).optional(),
  }),
  z.object({
    mode: z.literal("DELETE"),
    item_id: requestIdSchema,
  }),
  z.object({
    mode: z.literal("UPLOAD_MEDIA"),
    item_id: requestIdSchema,
    file_name: text(255).refine((name) => !/[\\/\u0000-\u001f\u007f]/u.test(name), "Nama file tidak valid").optional(),
    filename: text(255).optional(),
    mime_type: z.string().min(1),
    file_data: z.string().min(1).optional(),
    data: z.string().min(1).optional(),
  }),
  z.object({
    mode: z.literal("DELETE_MEDIA"),
    media_id: requestIdSchema,
    item_id: requestIdSchema.optional(),
  }),
]);

// ─── Period request schema ────────────────────────────────────────────────────
const periodRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    sort: z.enum(ALLOWED_PERIOD_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...paginationRequest,
  }),
  z.object({
    mode: z.literal("DETAIL"),
    period_id: requestIdSchema,
  }),
  z.object({
    mode: z.literal("CREATE"),
    title: text(255),
    description: z.string().trim().max(5000).optional(),
    date_start: z.string().optional(),
    date_end: z.string().optional(),
    item_ids: flexibleRequestIdArray.optional(),
    attach_item_ids: flexibleRequestIdArray.optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    period_id: requestIdSchema,
    title: text(255).optional(),
    description: z.string().trim().max(5000).optional(),
    date_start: z.string().optional(),
    date_end: z.string().optional(),
    item_ids: flexibleRequestIdArray.optional(),
    attach_item_ids: flexibleRequestIdArray.optional(),
  }),
  z.object({ mode: z.literal("SUBMIT"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("APPROVE"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("REJECT"), period_id: requestIdSchema, reason: text(2000).optional() }),
  z.object({ mode: z.literal("PUBLISH"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("UNPUBLISH"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("EXPORT"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("DELETE"), period_id: requestIdSchema }),
]);

// ─── Request registry ─────────────────────────────────────────────────────────
export const requestSchemas = {
  source: sourceRequestSchema,
  item: itemRequestSchema,
  period: periodRequestSchema,
} as const;

export type SpfResource = keyof typeof requestSchemas;
export type SourceRequest = z.infer<typeof sourceRequestSchema>;
export type ItemRequest = z.infer<typeof itemRequestSchema>;
export type PeriodRequest = z.infer<typeof periodRequestSchema>;

// ─── Period status ────────────────────────────────────────────────────────────
export const SPF_PERIOD_STATUSES = [
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
] as const;
export type SpfPeriodStatus = (typeof SPF_PERIOD_STATUSES)[number];

// ─── Response schemas ─────────────────────────────────────────────────────────
export const spfPaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasNextPage: z.boolean().optional(),
}).transform((p) => ({
  ...p,
  hasNextPage: p.hasNextPage ?? (p.offset + p.limit < p.total),
}));
export type SpfPagination = z.infer<typeof spfPaginationSchema>;

export const spfItemSchema = z.object({
  id: responseIdSchema,
  source_id: responseIdSchema.nullable().optional(),
  car_id: responseIdSchema,
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string(),
  period_id: responseIdSchema.nullable(),
  is_released: z.coerce.boolean().optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string().nullable().transform((v) => v ?? ""),
  updated_at: z.string().nullable().transform((v) => v ?? ""),
});
export type SpfItem = z.infer<typeof spfItemSchema>;

export const spfMediaSchema = z.object({
  id: responseIdSchema,
  item_id: responseIdSchema,
  r2_key: z.string().optional(),
  url: z.string().optional(),
  file_name: z.string().optional(),
  filename: z.string().optional(),
  mime_type: z.string(),
  size_bytes: z.number().nonnegative().optional(),
  admin_id: z.string().nullable().optional(),
  created_at: z.string().nullable().transform((v) => v ?? ""),
}).transform((m) => ({
  ...m,
  url: m.url ?? m.r2_key ?? "",
  filename: m.filename ?? m.file_name ?? "",
}));
export type SpfMedia = z.infer<typeof spfMediaSchema>;

export const spfPeriodSchema = z.object({
  id: responseIdSchema,
  title: z.string().nullable().transform((v) => v ?? "-"),
  description: z.string().nullable().optional(),
  workflow_status: z.enum(SPF_PERIOD_STATUSES).optional(),
  status: z.enum(SPF_PERIOD_STATUSES).optional(),
  date_start: z.string().nullable().optional(),
  date_end: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  created_by: z.string().nullable().transform((v) => v ?? "-"),
  created_at: z.string().nullable().transform((v) => v ?? ""),
  updated_at: z.string().nullable().transform((v) => v ?? ""),
}).transform((p) => ({
  ...p,
  workflow_status: p.workflow_status ?? p.status ?? "DRAFT",
  status: p.status ?? p.workflow_status ?? "DRAFT",
}));
export type SpfPeriod = z.infer<typeof spfPeriodSchema>;

export const spfSourceSchema = z.object({
  id: responseIdSchema,
  car_id: responseIdSchema,
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string().nullable(),
  collected: z.coerce.boolean(),
  created_at: z.string().nullable().transform((v) => v ?? ""),
});
export type SpfSource = z.infer<typeof spfSourceSchema>;

// ─── Response envelopes ───────────────────────────────────────────────────────
export const spfItemListEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    items: z.array(spfItemSchema),
    total: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    meta: spfPaginationSchema.optional(),
  }).transform((d) => {
    const total = d.total ?? d.meta?.total ?? d.items.length;
    const limit = d.limit ?? d.meta?.limit ?? 25;
    const offset = d.offset ?? d.meta?.offset ?? 0;
    return {
      items: d.items,
      total,
      limit,
      offset,
      meta: d.meta ?? { total, limit, offset, hasNextPage: offset + limit < total },
    };
  }),
});

export const spfItemDetailEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    item: spfItemSchema,
    media: z.array(spfMediaSchema),
  }),
});

export const spfPeriodListEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    periods: z.array(spfPeriodSchema),
    total: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    meta: spfPaginationSchema.optional(),
  }).transform((d) => {
    const total = d.total ?? d.meta?.total ?? d.periods.length;
    const limit = d.limit ?? d.meta?.limit ?? 25;
    const offset = d.offset ?? d.meta?.offset ?? 0;
    return {
      periods: d.periods,
      total,
      limit,
      offset,
      meta: d.meta ?? { total, limit, offset, hasNextPage: offset + limit < total },
    };
  }),
});

export const spfPeriodDetailEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    period: spfPeriodSchema,
    items: z.array(spfItemSchema),
    total_items: z.number().int().nonnegative().optional(),
  }),
});

export const spfSourceListEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    sources: z.array(spfSourceSchema).optional(),
    items: z.array(spfSourceSchema).optional(),
    total: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    meta: spfPaginationSchema.optional(),
  }).transform((d) => {
    const list = d.sources ?? d.items ?? [];
    const total = d.total ?? d.meta?.total ?? list.length;
    const limit = d.limit ?? d.meta?.limit ?? 25;
    const offset = d.offset ?? d.meta?.offset ?? 0;
    return {
      sources: list,
      items: list,
      total,
      limit,
      offset,
      meta: d.meta ?? { total, limit, offset, hasNextPage: offset + limit < total },
    };
  }),
});

export const spfCollectEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    inserted: z.number().int().nonnegative().optional(),
    ignored: z.number().int().nonnegative().optional(),
  }),
});

export const spfMutationEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export const spfErrorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  message: z.string().optional(),
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export const generateUrlRequestSchema = z.object({
  owner_name: text(255),
  period_id: text(100),
});
export type GenerateUrlRequest = z.infer<typeof generateUrlRequestSchema>;

export const spfGenerateUrlEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    owner_name: z.string().optional(),
    period_id: z.string().optional(),
    url: z.string(),
    token: z.string().optional(),
    expires_at: z.string().optional(),
  }),
});
export type SpfGenerateUrlResult = z.infer<typeof spfGenerateUrlEnvelopeSchema>["data"];

// ─── Response registry ────────────────────────────────────────────────────────
export const responseSchemas = {
  source: spfSourceListEnvelopeSchema,
  item: spfItemListEnvelopeSchema,
  period: spfPeriodListEnvelopeSchema,
} as const;

// ─── Form-level Zod schemas ───────────────────────────────────────────────────
export const itemCreateFormSchema = z.object({
  car_id: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).trim())
    .refine((val) => /^\d+$/u.test(val) && Number.parseInt(val, 10) > 0, {
      message: "Car ID harus berupa angka positif",
    })
    .transform((val) => Number.parseInt(val, 10)),
  description: trimmedString("Deskripsi", 5000),
  work_type: trimmedString("Jenis pekerjaan", 100),
});

export const itemUpdateFormSchema = z.object({
  description: z.string().trim().max(5000).optional(),
  work_type: z.string().trim().max(100).optional(),
});

export const periodCreateFormSchema = z.object({
  title: trimmedString("Judul", 255),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  attach_item_ids_raw: z.string().optional(),
});

export const periodUpdateFormSchema = periodCreateFormSchema.partial();

export type ItemCreateFormValues = z.infer<typeof itemCreateFormSchema>;
export type PeriodCreateFormValues = z.infer<typeof periodCreateFormSchema>;
export type PeriodUpdateFormValues = z.infer<typeof periodUpdateFormSchema>;
