import { z } from "zod";

// ─── Primitive helpers ────────────────────────────────────────────────────────
const positiveId = z
  .number({ message: "ID wajib diisi" })
  .int("ID harus bilangan bulat")
  .positive("ID harus lebih dari 0");

const positiveIdArray = z
  .array(positiveId)
  .min(1, "Minimal satu ID diperlukan");

const pagination = z.object({
  limit: z.number().int().min(1).max(100).optional().default(25),
  offset: z.number().int().min(0).optional().default(0),
});

const trimmedString = (label: string, max: number) =>
  z
    .string({ message: `${label} wajib diisi` })
    .trim()
    .min(1, `${label} tidak boleh kosong`)
    .max(max, `${label} maksimal ${max} karakter`);

// ─── Sort allowlists ──────────────────────────────────────────────────────────
const ALLOWED_ITEM_SORTS = ["created_at", "updated_at", "car_id"] as const;
const ALLOWED_PERIOD_SORTS = ["created_at", "updated_at", "title"] as const;
const ORDER = ["ASC", "DESC", "asc", "desc"] as const;

// ─── Source request schema ────────────────────────────────────────────────────
const sourceRequestSchema = z.discriminatedUnion("mode", [
  // List raw source data dari sms_db
  z.object({
    mode: z.literal("SMS_DB"),
    car_id: positiveId.optional(),
    ...pagination.shape,
  }),
  // Collect sumber menjadi SPF items
  z.object({
    mode: z.literal("COLLECT"),
    source_ids: z
      .array(positiveId)
      .min(1, "Minimal 1 source dipilih")
      .max(200, "Maksimal 200 source per request"),
  }),
]);

// ─── Item request schema ──────────────────────────────────────────────────────
const itemRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    car_id: positiveId.optional(),
    period_id: positiveId.optional(),
    sort: z.enum(ALLOWED_ITEM_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...pagination.shape,
  }),
  z.object({
    mode: z.literal("DETAIL"),
    item_id: positiveId,
  }),
  z.object({
    mode: z.literal("CREATE"),
    car_id: positiveId,
    description: trimmedString("Deskripsi", 5000),
    work_type: trimmedString("Jenis pekerjaan", 100),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    item_id: positiveId,
    description: trimmedString("Deskripsi", 5000).optional(),
    work_type: trimmedString("Jenis pekerjaan", 100).optional(),
  }),
  z.object({
    mode: z.literal("DELETE"),
    item_id: positiveId,
  }),
  z.object({
    mode: z.literal("UPLOAD_MEDIA"),
    item_id: positiveId,
    filename: z.string().min(1, "Nama file wajib diisi"),
    mime_type: z.string().min(1, "MIME type wajib diisi"),
    data: z.string().min(1, "Data Base64 wajib diisi"), // base64
  }),
  z.object({
    mode: z.literal("DELETE_MEDIA"),
    item_id: positiveId,
    media_id: positiveId,
  }),
]);

// ─── Period request schema ────────────────────────────────────────────────────
const periodRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    sort: z.enum(ALLOWED_PERIOD_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...pagination.shape,
  }),
  z.object({
    mode: z.literal("DETAIL"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("CREATE"),
    title: trimmedString("Judul", 255),
    description: z
      .string()
      .trim()
      .max(5000, "Deskripsi maksimal 5000 karakter")
      .optional(),
    attach_item_ids: positiveIdArray.optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    period_id: positiveId,
    title: trimmedString("Judul", 255).optional(),
    description: z
      .string()
      .trim()
      .max(5000, "Deskripsi maksimal 5000 karakter")
      .optional(),
    attach_item_ids: positiveIdArray.optional(),
  }),
  z.object({
    mode: z.literal("SUBMIT"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("APPROVE"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("REJECT"),
    period_id: positiveId,
    reason: trimmedString("Alasan penolakan", 2000),
  }),
  z.object({
    mode: z.literal("PUBLISH"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("UNPUBLISH"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("EXPORT"),
    period_id: positiveId,
  }),
  z.object({
    mode: z.literal("DELETE"),
    period_id: positiveId,
  }),
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
  hasNextPage: z.boolean(),
});
export type SpfPagination = z.infer<typeof spfPaginationSchema>;

export const spfItemSchema = z.object({
  id: z.number().int().positive(),
  car_id: z.union([z.number(), z.string()]),
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string(),
  period_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SpfItem = z.infer<typeof spfItemSchema>;

export const spfMediaSchema = z.object({
  id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  url: z.string().url(),
  mime_type: z.string(),
  filename: z.string(),
  created_at: z.string(),
});
export type SpfMedia = z.infer<typeof spfMediaSchema>;

export const spfPeriodSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(SPF_PERIOD_STATUSES),
  rejection_reason: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SpfPeriod = z.infer<typeof spfPeriodSchema>;

export const spfSourceSchema = z.object({
  id: z.number().int().positive(),
  car_id: z.union([z.number(), z.string()]),
  car_name: z.string().optional(),
  description: z.string(),
  work_type: z.string().nullable(),
  collected: z.boolean(),
  created_at: z.string(),
});
export type SpfSource = z.infer<typeof spfSourceSchema>;

// ─── Response envelopes ───────────────────────────────────────────────────────
export const spfItemListEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(spfItemSchema),
    meta: spfPaginationSchema,
  }),
});

export const spfItemDetailEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    item: spfItemSchema,
    media: z.array(spfMediaSchema),
  }),
});

export const spfItemMutationEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    item: spfItemSchema,
  }),
});

export const spfPeriodListEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    periods: z.array(spfPeriodSchema),
    meta: spfPaginationSchema,
  }),
});

export const spfPeriodDetailEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    period: spfPeriodSchema,
    items: z.array(spfItemSchema),
  }),
});

export const spfPeriodMutationEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    period: spfPeriodSchema,
  }),
});

export const spfSourceListEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    sources: z.array(spfSourceSchema),
    meta: spfPaginationSchema,
  }),
});

export const spfCollectEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    inserted: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative(),
  }),
});

export const spfErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z
    .object({
      code: z.string().optional(),
    })
    .optional(),
});

// ─── Response registry (keyed by resource) ───────────────────────────────────
// Note: untuk LIST vs. DETAIL, parsing dilakukan di spf.ts berdasarkan mode.
export const responseSchemas = {
  source: spfSourceListEnvelopeSchema,
  item: spfItemListEnvelopeSchema,
  period: spfPeriodListEnvelopeSchema,
} as const;

// ─── Form-level Zod schemas (dipakai langsung oleh React Hook Form) ───────────
export const itemCreateFormSchema = z.object({
  car_id: z
    .string()
    .min(1, "Car ID wajib diisi")
    .regex(/^\d+$/, "Car ID harus berupa angka")
    .transform((val) => Number.parseInt(val, 10))
    .refine((val) => val > 0, { message: "Car ID harus lebih dari 0" }),
  description: trimmedString("Deskripsi", 5000),
  work_type: trimmedString("Jenis pekerjaan", 100),
});

export const itemUpdateFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(5000, "Deskripsi maksimal 5000 karakter")
    .optional(),
  work_type: z
    .string()
    .trim()
    .max(100, "Jenis pekerjaan maksimal 100 karakter")
    .optional(),
});

export const periodCreateFormSchema = z.object({
  title: trimmedString("Judul", 255),
  description: z
    .string()
    .trim()
    .max(5000, "Deskripsi maksimal 5000 karakter")
    .optional()
    .or(z.literal("")),
  attach_item_ids_raw: z
    .string()
    .optional()
    .describe("Comma-separated positive integers"),
});

export const periodUpdateFormSchema = periodCreateFormSchema.partial();

export type ItemCreateFormValues = z.infer<typeof itemCreateFormSchema>;
export type PeriodCreateFormValues = z.infer<typeof periodCreateFormSchema>;
export type PeriodUpdateFormValues = z.infer<typeof periodUpdateFormSchema>;
