import { z } from "zod";

export const requestIdSchema = z.union([z.string(), z.number()]).transform(String);
export const idSchema = requestIdSchema;

const paginationRequest = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const idArraySchema = z.array(requestIdSchema).max(500);
const sourceTypeSchema = z.enum(["SYSTEM", "MANUAL", "EXCEL"]);
const mediaSourceTypeSchema = z
  .enum(["SYSTEM", "MANUAL", "EXCEL", "SMS_DB"])
  .transform((value) => (value === "SMS_DB" ? "SYSTEM" : value));

const ALLOWED_ITEM_SORTS = ["created_at", "updated_at", "work_type", "car_id", "display_order"] as const;
const ALLOWED_PERIOD_SORTS = ["created_at", "updated_at", "title", "date_start", "date_end"] as const;
const ORDER = ["ASC", "DESC", "asc", "desc"] as const;

export const SPF_PERIOD_STATUSES = [
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
] as const;
export type SpfPeriodStatus = (typeof SPF_PERIOD_STATUSES)[number];

export const SPF_SOURCE_STATUSES = ["READY", "INCLUDED", "EXCLUDED"] as const;
export type SpfSourceStatus = (typeof SPF_SOURCE_STATUSES)[number];

const sourceKeySchema = z.object({
  source_type: sourceTypeSchema,
  source_id: requestIdSchema,
});

const sourceRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("SMS_DB"),
    car_id: z.string().trim().optional(),
    date_start: z.string().optional(),
    date_end: z.string().optional(),
    work_type: z.string().trim().max(100).optional(),
    spf_status: z.enum(SPF_SOURCE_STATUSES).optional(),
    technical_only: z.boolean().optional(),
    exclude_repetition: z.boolean().optional(),
    ...paginationRequest,
  }),
  z.object({
    mode: z.literal("COLLECT"),
    source_ids: idArraySchema.min(1, "Minimal satu ID diperlukan"),
  }),
]);

const itemRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    car_id: z.string().trim().optional(),
    period_id: requestIdSchema.optional(),
    source_type: sourceTypeSchema.optional(),
    spf_status: z.enum(SPF_SOURCE_STATUSES).optional(),
    sort: z.enum(ALLOWED_ITEM_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...paginationRequest,
  }),
  z.object({ mode: z.literal("DETAIL"), item_id: requestIdSchema }),
  z.object({
    mode: z.literal("CREATE"),
    car_id: z.string().trim().min(1),
    period_id: requestIdSchema.optional(),
    panel_id: requestIdSchema.nullable().optional(),
    customer_description: text(5000),
    original_description: optionalText(5000),
    work_status: text(100),
    progress: z.coerce.number().min(0).max(100),
    display_order: z.coerce.number().int().min(0).optional(),
    source_type: z.literal("MANUAL").optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    item_id: requestIdSchema,
    customer_description: optionalText(5000),
    original_description: optionalText(5000),
    work_status: optionalText(100),
    progress: z.coerce.number().min(0).max(100).optional(),
    panel_id: requestIdSchema.nullable().optional(),
    display_order: z.coerce.number().int().min(0).optional(),
    spf_status: z.enum(SPF_SOURCE_STATUSES).optional(),
  }),
  z.object({ mode: z.literal("DELETE"), item_id: requestIdSchema }),
  z.object({
    mode: z.literal("UPLOAD_MEDIA"),
    item_id: requestIdSchema,
    file_name: text(255),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
    file_data: z.string().min(1),
  }),
  z.object({
    mode: z.literal("ADD_MEDIA_URL"),
    item_id: requestIdSchema,
    media_url: z.string().trim().url().max(2048),
    media_type: z.enum(["PHOTO", "VIDEO"]),
  }),
  z.object({ mode: z.literal("DELETE_MEDIA"), media_id: requestIdSchema }),
  z.object({
    mode: z.literal("HIDE_MEDIA"),
    media_id: requestIdSchema,
    hidden: z.boolean(),
  }),
]);

const periodRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    car_id: z.string().trim().optional(),
    unit: z.string().trim().max(255).optional(),
    year: z.string().trim().optional(),
    date_start: z.string().optional(),
    date_end: z.string().optional(),
    workflow_status: z.enum(SPF_PERIOD_STATUSES).optional(),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(ALLOWED_PERIOD_SORTS).optional(),
    order: z.enum(ORDER).optional(),
    ...paginationRequest,
  }),
  z.object({ mode: z.literal("DETAIL"), period_id: requestIdSchema }),
  z.object({
    mode: z.literal("CREATE"),
    car_id: z.string().trim().min(1),
    title: optionalText(255),
    description: optionalText(5000),
    date_start: z.string().min(1),
    date_end: z.string().min(1),
    item_ids: idArraySchema.optional(),
    attach_item_ids: idArraySchema.optional(),
    source_ids: idArraySchema.optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    period_id: requestIdSchema,
    title: optionalText(255),
    description: optionalText(5000),
    date_start: z.string().optional(),
    date_end: z.string().optional(),
    item_ids: idArraySchema.optional(),
    attach_item_ids: idArraySchema.optional(),
    source_ids: idArraySchema.optional(),
  }),
  z.object({ mode: z.literal("SUBMIT"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("APPROVE"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("REJECT"), period_id: requestIdSchema, reason: text(2000) }),
  z.object({ mode: z.literal("PUBLISH"), period_id: requestIdSchema }),
  z.object({ mode: z.literal("UNPUBLISH"), period_id: requestIdSchema, reason: text(2000) }),
  z.object({ mode: z.literal("EXPORT"), period_id: requestIdSchema }),
]);

const clientRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("LIST"),
    search: z.string().trim().max(255).optional(),
    status: z.string().trim().max(50).optional(),
    ...paginationRequest,
  }),
  z.object({ mode: z.literal("DETAIL"), client_id: requestIdSchema }),
  z.object({
    mode: z.literal("CREATE"),
    name: text(255),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    access_code: z.string().trim().min(8).max(255).optional(),
  }),
  z.object({
    mode: z.literal("UPDATE"),
    client_id: requestIdSchema,
    name: optionalText(255),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
  z.object({
    mode: z.literal("SET_ACCESS_CODE"),
    client_id: requestIdSchema,
    access_code: z.string().trim().min(8).max(255),
  }),
  z.object({ mode: z.literal("RESET_ACCESS_CODE"), client_id: requestIdSchema }),
  z.object({ mode: z.literal("REVEAL_CREDENTIALS"), client_id: requestIdSchema }),
  z.object({ mode: z.literal("PREVIEW"), client_id: requestIdSchema }),
]);

export const requestSchemas = {
  source: sourceRequestSchema,
  item: itemRequestSchema,
  period: periodRequestSchema,
  client: clientRequestSchema,
} as const;

export type SpfResource = keyof typeof requestSchemas;
export type SourceRequest = z.infer<typeof sourceRequestSchema>;
export type ItemRequest = z.infer<typeof itemRequestSchema>;
export type PeriodRequest = z.infer<typeof periodRequestSchema>;
export type ClientRequest = z.infer<typeof clientRequestSchema>;

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

const nullableString = z.string().nullable().optional();

export const spfItemSchema = z.object({
  id: requestIdSchema,
  source_id: requestIdSchema.nullable().optional(),
  source_type: sourceTypeSchema.optional(),
  car_id: requestIdSchema,
  car_name: z.string().optional(),
  panel_id: requestIdSchema.nullable().optional(),
  panel_name: nullableString,
  panel: nullableString,
  description: z.string().optional(),
  customer_description: z.string().optional(),
  original_description: nullableString,
  work_type: nullableString,
  work_status: nullableString,
  progress: z.coerce.number().min(0).max(100).optional(),
  divisi: nullableString,
  pic: nullableString,
  work_date: nullableString,
  period_id: requestIdSchema.nullable().optional(),
  spf_status: z.enum(SPF_SOURCE_STATUSES).optional(),
  is_included: z.coerce.number().int().min(0).max(1).optional(),
  exclusion_reason: nullableString,
  display_order: z.coerce.number().int().min(0).optional(),
  documentation_checked: z.coerce.boolean().optional(),
  documentation_count: z.coerce.number().int().nonnegative().optional(),
  media_count: z.coerce.number().int().nonnegative().optional(),
  is_released: z.coerce.boolean().optional(),
  created_by: nullableString,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}).passthrough().transform((item) => ({
  ...item,
  id: String(item.id),
  source_id: item.source_id == null ? null : String(item.source_id),
  source_type: item.source_type ?? "SYSTEM",
  car_id: String(item.car_id),
  period_id: item.period_id == null ? null : String(item.period_id),
  panel_id: item.panel_id == null ? null : String(item.panel_id),
  customer_description: item.customer_description ?? item.description ?? "",
  original_description: item.original_description ?? item.description ?? "",
  work_status: item.work_status ?? "-",
  work_type: item.work_type ?? "-",
  description: item.description ?? item.customer_description ?? "",
  progress: item.progress ?? 0,
  spf_status: item.spf_status ?? "READY",
  is_included: item.is_included ?? (item.spf_status === "INCLUDED" ? 1 : 0),
  display_order: item.display_order ?? 0,
  documentation_checked: item.documentation_checked ?? false,
  documentation_count: item.documentation_count ?? item.media_count ?? 0,
  created_at: item.created_at ?? "",
  updated_at: item.updated_at ?? "",
}));
export type SpfItem = z.infer<typeof spfItemSchema>;

export const spfMediaSchema = z.object({
  id: requestIdSchema,
  item_id: requestIdSchema,
  source_type: mediaSourceTypeSchema.optional(),
  r2_key: z.string().optional(),
  url: z.string().optional(),
  file_name: z.string().optional(),
  filename: z.string().optional(),
  mime_type: z.string(),
  caption: nullableString,
  display_order: z.coerce.number().int().min(0).optional(),
  hidden: z.coerce.boolean().optional(),
  size_bytes: z.number().nonnegative().optional(),
  admin_id: nullableString,
  created_at: z.string().nullable().optional(),
}).passthrough().transform((m) => ({
  ...m,
  id: String(m.id),
  item_id: String(m.item_id),
  source_type: m.source_type ?? "SYSTEM",
  url: m.url ?? m.r2_key ?? "",
  filename: m.filename ?? m.file_name ?? "",
  hidden: m.hidden ?? false,
  display_order: m.display_order ?? 0,
  created_at: m.created_at ?? "",
}));
export type SpfMedia = z.infer<typeof spfMediaSchema>;

export const spfPeriodSchema = z.object({
  id: requestIdSchema,
  period_id: requestIdSchema.optional(),
  car_id: requestIdSchema.optional(),
  car_name: z.string().optional(),
  unit_name: nullableString,
  client_name: nullableString,
  title: z.string().nullable().optional(),
  description: nullableString,
  workflow_status: z.enum(SPF_PERIOD_STATUSES).optional(),
  status: z.enum(SPF_PERIOD_STATUSES).optional(),
  date_start: z.string().nullable().optional(),
  date_end: z.string().nullable().optional(),
  item_count: z.coerce.number().int().nonnegative().optional(),
  total_items: z.coerce.number().int().nonnegative().optional(),
  documentation_count: z.coerce.number().int().nonnegative().optional(),
  media_count: z.coerce.number().int().nonnegative().optional(),
  rejection_reason: nullableString,
  unpublish_reason: nullableString,
  created_by: z.string().nullable().optional(),
  submitted_by: nullableString,
  approved_by: nullableString,
  rejected_by: nullableString,
  published_by: nullableString,
  unpublished_by: nullableString,
  created_at: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  rejected_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  unpublished_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}).passthrough().transform((p) => {
  const id = String(p.period_id ?? p.id);
  const status = p.status ?? p.workflow_status ?? "DRAFT";
  return {
    ...p,
    id,
    period_id: id,
    car_id: p.car_id == null ? "" : String(p.car_id),
    car_name: p.car_name ?? (p.unit_name ? `${p.unit_name}${p.client_name ? ` – ${p.client_name}` : ""}` : undefined),
    title: p.title ?? id,
    workflow_status: p.workflow_status ?? status,
    status,
    item_count: p.item_count ?? p.total_items ?? 0,
    documentation_count: p.documentation_count ?? p.media_count ?? 0,
    created_by: p.created_by ?? "-",
    created_at: p.created_at ?? "",
    updated_at: p.updated_at ?? "",
  };
});
export type SpfPeriod = z.infer<typeof spfPeriodSchema>;

export const spfSourceSchema = z.object({
  id: requestIdSchema,
  source_id: requestIdSchema.optional(),
  source_type: sourceTypeSchema.optional(),
  car_id: requestIdSchema,
  car_name: z.string().optional(),
  panel_id: requestIdSchema.nullable().optional(),
  panel_name: nullableString,
  panel: nullableString,
  description: z.string().optional(),
  customer_description: z.string().optional(),
  original_description: nullableString,
  work_type: nullableString,
  work_status: nullableString,
  progress: z.coerce.number().min(0).max(100).optional(),
  divisi: nullableString,
  pic: nullableString,
  work_date: nullableString,
  documentation_count: z.coerce.number().int().nonnegative().optional(),
  media_count: z.coerce.number().int().nonnegative().optional(),
  collected: z.coerce.boolean().optional(),
  spf_status: z.enum(SPF_SOURCE_STATUSES).optional(),
  created_at: z.string().nullable().optional(),
}).passthrough().transform((s) => ({
  ...s,
  id: String(s.source_id ?? s.id),
  source_id: String(s.source_id ?? s.id),
  source_type: s.source_type ?? "SYSTEM",
  car_id: String(s.car_id),
  panel_id: s.panel_id == null ? null : String(s.panel_id),
  customer_description: s.customer_description ?? s.description ?? "",
  original_description: s.original_description ?? s.description ?? "",
  work_status: s.work_status ?? s.work_type ?? "-",
  work_type: s.work_type ?? s.work_status ?? "-",
  progress: s.progress ?? 0,
  documentation_count: s.documentation_count ?? s.media_count ?? 0,
  spf_status: s.spf_status ?? (s.collected ? "INCLUDED" : "READY"),
  collected: s.collected ?? false,
  created_at: s.created_at ?? s.work_date ?? "",
}));
export type SpfSource = z.infer<typeof spfSourceSchema>;

export const spfClientVehicleSchema = z.object({
  car_id: requestIdSchema,
  car_name: z.string().optional(),
  display_name: z.string().optional(),
  source_type: sourceTypeSchema.optional(),
  cover_url: z.string().nullable().optional(),
  visible: z.coerce.boolean().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  last_period_update: nullableString,
  updated_at: z.string().nullable().optional(),
}).passthrough().transform((v) => ({
  ...v,
  car_id: String(v.car_id),
  source_type: v.source_type ?? "SYSTEM",
  visible: v.visible ?? true,
  display_order: v.display_order ?? 0,
}));
export type SpfClientVehicle = z.infer<typeof spfClientVehicleSchema>;

export const spfTimelineSchema = z.object({
  id: requestIdSchema,
  type: z.enum(["FUTURE_TARGET", "CUSTOMER_VISIT", "GENERAL_PROGRESS", "PROFESSIONAL_DOCUMENTATION"]),
  title: z.string(),
  description: nullableString,
  date: z.string().nullable().optional(),
  car_id: requestIdSchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
}).passthrough().transform((t) => ({
  ...t,
  id: String(t.id),
  car_id: t.car_id == null ? null : String(t.car_id),
  created_at: t.created_at ?? "",
}));
export type SpfTimelineEntry = z.infer<typeof spfTimelineSchema>;

export const spfClientSchema = z.object({
  id: requestIdSchema,
  client_id: requestIdSchema.optional(),
  account_id: z.string().nullable().optional(),
  owner_slug: z.string().nullable().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
  unit_count: z.coerce.number().int().nonnegative().optional(),
  last_report_title: nullableString,
  last_report_at: nullableString,
  access_code_status: nullableString,
  access_code: nullableString,
  status: z.string().nullable().optional(),
  portal_url: nullableString,
  updated_at: z.string().nullable().optional(),
  vehicles: z.array(spfClientVehicleSchema).optional(),
  timeline: z.array(spfTimelineSchema).optional(),
  reports: z.array(spfPeriodSchema).optional(),
}).passthrough().transform((c) => {
  const id = String(c.client_id ?? c.id);
  return {
    ...c,
    id,
    client_id: id,
    display_name: c.display_name ?? c.name ?? id,
    unit_count: c.unit_count ?? c.vehicles?.length ?? 0,
    status: c.status ?? "ACTIVE",
    updated_at: c.updated_at ?? "",
    vehicles: c.vehicles ?? [],
    timeline: c.timeline ?? [],
    reports: c.reports ?? [],
  };
});
export type SpfClient = z.infer<typeof spfClientSchema>;

function listDataSchema<T extends z.ZodTypeAny>(itemSchema: T, keys: readonly string[]) {
  return z.object({
    success: z.boolean().optional(),
    message: z.string().optional(),
    data: z.object({
      total: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
      meta: spfPaginationSchema.optional(),
    }).catchall(z.unknown()).transform((d) => {
      const raw = keys.map((key) => d[key]).find(Array.isArray) ?? [];
      const items = z.array(itemSchema).parse(raw);
      const total = d.total ?? d.meta?.total ?? items.length;
      const limit = d.limit ?? d.meta?.limit ?? 25;
      const offset = d.offset ?? d.meta?.offset ?? 0;
      return {
        items,
        total,
        limit,
        offset,
        meta: d.meta ?? { total, limit, offset, hasNextPage: offset + limit < total },
      };
    }),
  });
}

export const spfItemListEnvelopeSchema = listDataSchema(spfItemSchema, ["items"]);
export const spfSourceListEnvelopeSchema = listDataSchema(spfSourceSchema, ["sources", "items"]);
export const spfPeriodListEnvelopeSchema = listDataSchema(spfPeriodSchema, ["periods", "items"]);
export const spfClientListEnvelopeSchema = listDataSchema(spfClientSchema, ["clients", "items"]);

export const spfItemDetailEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    item: spfItemSchema,
    media: z.array(spfMediaSchema).optional(),
  }).transform((d) => ({ item: d.item, media: d.media ?? [] })),
});

export const spfPeriodDetailEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    period: spfPeriodSchema,
    items: z.array(spfItemSchema).optional(),
    media: z.array(spfMediaSchema).optional(),
    total_items: z.number().int().nonnegative().optional(),
  }).transform((d) => ({ ...d, items: d.items ?? [], media: d.media ?? [] })),
});

export const spfClientDetailEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    client: spfClientSchema,
    vehicles: z.array(spfClientVehicleSchema).optional(),
    timeline: z.array(spfTimelineSchema).optional(),
    reports: z.array(spfPeriodSchema).optional(),
  }).transform((d) => ({
    client: {
      ...d.client,
      vehicles: d.vehicles ?? d.client.vehicles,
      timeline: d.timeline ?? d.client.timeline,
      reports: d.reports ?? d.client.reports,
    },
    vehicles: d.vehicles ?? d.client.vehicles,
    timeline: d.timeline ?? d.client.timeline,
    reports: d.reports ?? d.client.reports,
  })),
});

export const spfCollectEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    inserted: z.number().int().nonnegative().optional(),
    ignored: z.number().int().nonnegative().optional(),
    item_ids: z.array(z.string()).optional(),
  }),
});

export const spfMutationEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

export const spfErrorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  message: z.string().optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
});

export const generateUrlRequestSchema = z.object({
  account_id: z.string().trim().max(255).optional(),
  owner_slug: z.string().trim().max(255).optional(),
}).refine((value) => Boolean(value.account_id || value.owner_slug), {
  message: "account_id atau owner_slug wajib diisi",
});
export type GenerateUrlRequest = z.infer<typeof generateUrlRequestSchema>;

export const spfGenerateUrlEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({
    owner_name: z.string().optional(),
    account_id: z.string().optional(),
    owner_slug: z.string().optional(),
    period_id: z.string().optional(),
    url: z.string(),
    token: z.string().optional(),
    expires_at: z.string().optional(),
    expiry: z.string().optional(),
  }).transform((d) => ({ ...d, expires_at: d.expires_at ?? d.expiry })),
});
export type SpfGenerateUrlResult = z.infer<typeof spfGenerateUrlEnvelopeSchema>["data"];

export const responseSchemas = {
  source: spfSourceListEnvelopeSchema,
  item: spfItemListEnvelopeSchema,
  period: spfPeriodListEnvelopeSchema,
  client: spfClientListEnvelopeSchema,
} as const;

export const itemCreateFormSchema = z.object({
  car_id: z.string().trim().min(1, "Unit wajib dipilih"),
  customer_description: text(5000),
  original_description: optionalText(5000),
  work_status: text(100),
  progress: z.coerce.number().min(0).max(100),
  panel_id: z.string().optional(),
  panel_name: optionalText(255),
  divisi: optionalText(100),
  pic: optionalText(255),
  work_date: z.string().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

export const itemUpdateFormSchema = itemCreateFormSchema.partial();

const periodCreateFormSchemaBase = z.object({
  car_id: z.string().trim().min(1, "Unit wajib dipilih"),
  year: z.string().trim().min(4),
  date_start: z.string().min(1, "Tanggal mulai wajib diisi"),
  date_end: z.string().min(1, "Tanggal selesai wajib diisi"),
  description: optionalText(5000),
  item_ids: z.array(z.string()).optional(),
});

export const periodCreateFormSchema = periodCreateFormSchemaBase.refine((value) => value.date_end >= value.date_start, {
  message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
  path: ["date_end"],
});

export const periodUpdateFormSchema = periodCreateFormSchemaBase.partial();
export type ItemCreateFormValues = z.infer<typeof itemCreateFormSchema>;
export type PeriodCreateFormValues = z.infer<typeof periodCreateFormSchema>;
export type PeriodUpdateFormValues = z.infer<typeof periodUpdateFormSchema>;
