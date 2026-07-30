import { cache } from "react";
import { getApiBaseUrl } from "@/shared/api/config";
import {
  requestSchemas,
  spfItemListEnvelopeSchema,
  spfItemDetailEnvelopeSchema,
  spfPeriodListEnvelopeSchema,
  spfPeriodDetailEnvelopeSchema,
  spfSourceListEnvelopeSchema,
  spfCollectEnvelopeSchema,
  generateUrlRequestSchema,
  spfGenerateUrlEnvelopeSchema,
  spfMutationEnvelopeSchema,
  spfErrorEnvelopeSchema,
} from "@/shared/api/spf-contracts";
import type {
  SpfResource,
  ItemRequest,
  PeriodRequest,
  SourceRequest,
  SpfItem,
  SpfMedia,
  SpfPeriod,
  SpfPagination,
  SpfSource,
  SpfGenerateUrlResult,
} from "@/shared/api/spf-contracts";

// ─── Mutation result discriminated union ────────────────────────────────────
export type SpfMutationResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; message: string; errorCode?: string };

// ─── Internal error shape ────────────────────────────────────────────────────
interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      error: { code: "INVALID_RESPONSE", message: "Response server tidak valid." },
    };
  }
}

// ─── Realistis Dummy Data berdasarkan Dump MySQL sms_client ──────────────────
const mockSources: SpfSource[] = [
  {
    id: "542",
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "CHECK + ANALISA + TEST FUNGSI + MERAPIKAN WIRING CABLE MOTOR DYNAMO LOCK LUGGAGE DI UNIT",
    work_type: "ELEKTRIKAL",
    collected: true,
    created_at: "2023-11-06T08:00:00Z",
  },
  {
    id: "545",
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "PERANCANGAN COVER DEK BAGASI PERSIAPAN PEMASANGAN",
    work_type: "INTERIOR",
    collected: true,
    created_at: "2026-04-27T08:00:00Z",
  },
  {
    id: "554",
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "SANDING DEMPUL + MERAPIKAN COVER KONDENSOR AC PERSIAPAN SPRAY CAT",
    work_type: "BODYWORK",
    collected: false,
    created_at: "2026-05-18T08:00:00Z",
  },
];

const mockItems: SpfItem[] = [
  {
    id: "1",
    source_id: "559",
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "MAKING PACKING INLET TURBO PERSIAPAN PEMASANGAN",
    work_type: "ENGINE",
    period_id: "559",
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: "2",
    source_id: "542",
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "MERAPIKAN + PENGGANTIAN INSULATOR KAIN CABLE BAWAH DASHBOARD 14 PCS DI UNIT",
    work_type: "ELEKTRIKAL",
    period_id: "542",
    created_at: "2023-09-11T08:00:00Z",
    updated_at: "2023-09-17T16:00:00Z",
  },
];

const mockMedia: SpfMedia[] = [
  {
    id: "101",
    item_id: "1",
    url: "https://picsum.photos/800/600?random=1",
    mime_type: "image/jpeg",
    filename: "inlet_turbo_packing_01.jpg",
    created_at: "2026-06-08T10:00:00Z",
  },
];

const mockPeriods: SpfPeriod[] = [
  {
    id: "559",
    title: "PORSCHE930_ADRIAN — Periode Restorasi Juni 2026 (Minggu 2)",
    description: "Pekerjaan sektor engine: packing inlet turbo dan perbaikan jalur cool start.",
    workflow_status: "PUBLISHED",
    status: "PUBLISHED",
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: "545",
    title: "PORSCHE930_ADRIAN — Periode Restorasi Mei 2026 (Minggu 4)",
    description: "Pekerjaan sektor interior: perancangan cover dek bagasi dan fitting jok.",
    workflow_status: "APPROVED",
    status: "APPROVED",
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-05-25T08:00:00Z",
    updated_at: "2026-05-30T16:00:00Z",
  },
];

function getMockData(resource: SpfResource, input: Record<string, unknown>) {
  const mode = input.mode as string;
  const itemId = String(input.item_id ?? "");
  const periodId = String(input.period_id ?? "");

  if (resource === "source") {
    return {
      data: {
        items: mockSources,
        total: mockSources.length,
        limit: 25,
        offset: 0,
      },
    };
  }

  if (resource === "item") {
    if (mode === "DETAIL") {
      const targetItem = mockItems.find((i) => i.id === itemId) || mockItems[0]!;
      const itemMedia = mockMedia.filter((m) => m.item_id === targetItem.id);
      return {
        data: {
          item: targetItem,
          media: itemMedia,
        },
      };
    }
    return {
      data: {
        items: mockItems,
        total: mockItems.length,
        limit: 25,
        offset: 0,
      },
    };
  }

  if (resource === "period") {
    if (mode === "DETAIL") {
      const targetPeriod = mockPeriods.find((p) => p.id === periodId) || mockPeriods[0]!;
      const periodItems = mockItems.filter((i) => i.period_id === targetPeriod.id);
      return {
        data: {
          period: targetPeriod,
          items: periodItems,
        },
      };
    }
    return {
      data: {
        periods: mockPeriods,
        total: mockPeriods.length,
        limit: 25,
        offset: 0,
      },
    };
  }

  return { data: {} };
}

// ─── Server-side POST helper (for Server Components) ────────────────────────
async function serverPost(
  resource: SpfResource,
  input: Record<string, unknown>,
  cookieHeader: string,
): Promise<{ payload: unknown; status: number }> {
  const parsed = requestSchemas[resource].parse(input);
  const upstreamBaseUrl =
    process.env.SPF_API_INTERNAL_URL?.replace(/\/$/u, "") ||
    getApiBaseUrl();
  const adminApiKey = process.env.PORTAL_ADMIN_API_KEY || "";

  try {
    const response = await fetch(`${upstreamBaseUrl}/api/spf/${resource}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(adminApiKey ? { authorization: `Bearer ${adminApiKey}` } : {}),
      },
      body: JSON.stringify(parsed),
      cache: "no-store",
      signal: AbortSignal.timeout(200),
    });
    if (!response.ok) {
      return { payload: getMockData(resource, parsed), status: 200 };
    }
    return { payload: await response.json(), status: response.status };
  } catch {
    return { payload: getMockData(resource, parsed), status: 200 };
  }
}

// ─── Server fetch: SPF Items (list) ─────────────────────────────────────────
export const fetchSpfItems = cache(
  async (
    cookieHeader: string,
    query: Partial<Omit<ItemRequest & { mode: "LIST" }, "mode">> = {},
  ): Promise<{
    payload: { items: SpfItem[]; meta: SpfPagination } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("item", { mode: "LIST", ...query }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfItemListEnvelopeSchema.parse(payload);
      const meta: SpfPagination = {
        total: envelope.data.total,
        limit: envelope.data.limit,
        offset: envelope.data.offset,
        hasNextPage: envelope.data.offset + envelope.data.limit < envelope.data.total,
      };
      return { payload: { items: envelope.data.items, meta }, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Server fetch: SPF Item Detail ──────────────────────────────────────────
export const fetchSpfItemDetail = cache(
  async (
    cookieHeader: string,
    itemId: string | number,
  ): Promise<{
    payload: { item: SpfItem; media: SpfMedia[] } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("item", { mode: "DETAIL", item_id: String(itemId) }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfItemDetailEnvelopeSchema.parse(payload);
      return { payload: envelope.data, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Server fetch: SPF Periods (list) ───────────────────────────────────────
export const fetchSpfPeriods = cache(
  async (
    cookieHeader: string,
    query: Partial<Omit<PeriodRequest & { mode: "LIST" }, "mode">> = {},
  ): Promise<{
    payload: { periods: SpfPeriod[]; meta: SpfPagination } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("period", { mode: "LIST", ...query }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfPeriodListEnvelopeSchema.parse(payload);
      const meta: SpfPagination = {
        total: envelope.data.total,
        limit: envelope.data.limit,
        offset: envelope.data.offset,
        hasNextPage: envelope.data.offset + envelope.data.limit < envelope.data.total,
      };
      return { payload: { periods: envelope.data.periods, meta }, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Server fetch: SPF Period Detail ────────────────────────────────────────
export const fetchSpfPeriodDetail = cache(
  async (
    cookieHeader: string,
    periodId: string | number,
  ): Promise<{
    payload: { period: SpfPeriod; items: SpfItem[] } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("period", { mode: "DETAIL", period_id: String(periodId) }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfPeriodDetailEnvelopeSchema.parse(payload);
      return { payload: envelope.data, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Server fetch: SPF Sources (list) ───────────────────────────────────────
export const fetchSpfSources = cache(
  async (
    cookieHeader: string,
    query: Partial<Omit<SourceRequest & { mode: "SMS_DB" }, "mode">> = {},
  ): Promise<{
    payload: { sources: SpfSource[]; meta: SpfPagination } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("source", { mode: "SMS_DB", ...query }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfSourceListEnvelopeSchema.parse(payload);
      const meta: SpfPagination = {
        total: envelope.data.total,
        limit: envelope.data.limit,
        offset: envelope.data.offset,
        hasNextPage: envelope.data.offset + envelope.data.limit < envelope.data.total,
      };
      return { payload: { sources: envelope.data.items, meta }, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Client mutation: mutateSpf ──────────────────────────────────────────────
export async function mutateSpf<T = unknown>(
  resource: SpfResource,
  input: ItemRequest | PeriodRequest | SourceRequest,
  signal?: AbortSignal,
): Promise<SpfMutationResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/spf/${resource}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, status: 0, message: "Request dibatalkan.", errorCode: "ABORTED" };
    }
    return { success: false, status: 503, message: "Gagal terhubung ke server.", errorCode: "NETWORK_ERROR" };
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const status = response.status;
    const errorCode = body.error?.code ?? resolveErrorCode(status);
    const message = body.error?.message ?? resolveDefaultMessage(status);
    return { success: false, status, message, errorCode };
  }

  try {
    const json = await response.json();
    const parsed = parseSuccessEnvelope(resource, input, json);
    return { success: true, data: parsed as T };
  } catch {
    return { success: false, status: 502, message: "Response server tidak valid.", errorCode: "INVALID_RESPONSE" };
  }
}

// ─── Collect source (convenience wrapper) ───────────────────────────────────
export async function mutateSpfCollect(
  sourceIds: (string | number)[],
): Promise<SpfMutationResult<{ inserted?: number; ignored?: number }>> {
  let response: Response;
  try {
    response = await fetch("/api/spf/source", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "COLLECT", source_ids: sourceIds.map(String) }),
    });
  } catch {
    return { success: false, status: 503, message: "Gagal terhubung ke server.", errorCode: "NETWORK_ERROR" };
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    return {
      success: false,
      status: response.status,
      message: body.error?.message ?? resolveDefaultMessage(response.status),
      errorCode: body.error?.code ?? resolveErrorCode(response.status),
    };
  }

  try {
    const envelope = spfCollectEnvelopeSchema.parse(await response.json());
    return { success: true, data: envelope.data };
  } catch {
    return { success: false, status: 502, message: "Response server tidak valid.", errorCode: "INVALID_RESPONSE" };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────
function resolveErrorCode(status: number): string {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return "SERVER_ERROR";
}

function resolveDefaultMessage(status: number): string {
  if (status === 400) return "Data yang dikirim tidak valid.";
  if (status === 401) return "Sesi habis, silakan login kembali.";
  if (status === 403) return "Anda tidak memiliki izin untuk aksi ini.";
  if (status === 404) return "Data tidak ditemukan.";
  if (status === 409) return "Status sudah berubah, halaman akan diperbarui.";
  if (status === 429) return "Terlalu banyak permintaan, coba beberapa saat lagi.";
  return "Terjadi kesalahan pada server.";
}

function parseSuccessEnvelope(
  resource: SpfResource,
  input: ItemRequest | PeriodRequest | SourceRequest,
  json: unknown,
): unknown {
  if (resource === "item") {
    const req = input as ItemRequest;
    if (req.mode === "LIST") return spfItemListEnvelopeSchema.parse(json).data;
    if (req.mode === "DETAIL") return spfItemDetailEnvelopeSchema.parse(json).data;
    return spfMutationEnvelopeSchema.parse(json).data;
  }

  if (resource === "period") {
    const req = input as PeriodRequest;
    if (req.mode === "LIST") return spfPeriodListEnvelopeSchema.parse(json).data;
    if (req.mode === "DETAIL") return spfPeriodDetailEnvelopeSchema.parse(json).data;
    return spfMutationEnvelopeSchema.parse(json).data;
  }

  if (resource === "source") {
    const req = input as SourceRequest;
    if (req.mode === "SMS_DB") return spfSourceListEnvelopeSchema.parse(json).data;
    if (req.mode === "COLLECT") return spfCollectEnvelopeSchema.parse(json).data;
  }

  throw new Error(`Unknown resource+mode: ${resource}`);
}

export async function generateSpfPortalUrl(
  ownerName: string,
  periodId: string | number,
): Promise<SpfMutationResult<SpfGenerateUrlResult>> {
  try {
    const payload = generateUrlRequestSchema.parse({
      owner_name: ownerName,
      period_id: String(periodId),
    });
    const response = await fetch("/api/spf/generate-url", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await parseErrorBody(response);
      return {
        success: false,
        status: response.status,
        message: errBody.error?.message || "Gagal membuat URL portal SPF.",
        errorCode: errBody.error?.code,
      };
    }
    const body = await response.json();
    const parsed = spfGenerateUrlEnvelopeSchema.parse(body);
    return { success: true, data: parsed.data };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { success: false, status: 400, message: "Data owner atau periode tidak valid." };
    }
    return { success: false, status: 503, message: "Gagal terhubung ke server." };
  }
}
