import { cache } from "react";
import { getApiBaseUrl } from "@/shared/api/config";
import {
  requestSchemas,
  spfItemListEnvelopeSchema,
  spfItemDetailEnvelopeSchema,
  spfPeriodListEnvelopeSchema,
  spfPeriodDetailEnvelopeSchema,
  spfSourceListEnvelopeSchema,
  spfClientListEnvelopeSchema,
  spfClientDetailEnvelopeSchema,
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
  ClientRequest,
  SpfItem,
  SpfMedia,
  SpfPeriod,
  SpfPagination,
  SpfSource,
  SpfClient,
  SpfClientVehicle,
  SpfTimelineEntry,
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
    const csrfMatch = cookieHeader.match(/sm_csrf=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";

    const response = await fetch(`${upstreamBaseUrl}/api/spf/${resource}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(adminApiKey ? { authorization: `Bearer ${adminApiKey}` } : {}),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: JSON.stringify(parsed),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { payload: null, status: response.status };
    }
    return { payload: await response.json(), status: response.status };
  } catch {
    return { payload: null, status: 503 };
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
      return { payload: { periods: envelope.data.items, meta }, status };
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
    payload: { period: SpfPeriod; items: SpfItem[]; media: SpfMedia[] } | null;
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

// ─── Server fetch: SPF Clients (list) ───────────────────────────────────────
export const fetchSpfClients = cache(
  async (
    cookieHeader: string,
    query: Partial<Omit<ClientRequest & { mode: "LIST" }, "mode">> = {},
  ): Promise<{
    payload: { clients: SpfClient[]; meta: SpfPagination } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("client", { mode: "LIST", ...query }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfClientListEnvelopeSchema.parse(payload);
      return { payload: { clients: envelope.data.items, meta: envelope.data.meta }, status };
    } catch {
      return { payload: null, status: 502 };
    }
  },
);

// ─── Server fetch: SPF Client Detail ────────────────────────────────────────
export const fetchSpfClientDetail = cache(
  async (
    cookieHeader: string,
    clientId: string,
  ): Promise<{
    payload: {
      client: SpfClient;
      vehicles: SpfClientVehicle[];
      timeline: SpfTimelineEntry[];
      reports: SpfPeriod[];
    } | null;
    status: number;
  }> => {
    const { payload, status } = await serverPost("client", { mode: "DETAIL", client_id: clientId }, cookieHeader);
    if (!payload) return { payload: null, status };
    try {
      const envelope = spfClientDetailEnvelopeSchema.parse(payload);
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
  input: ItemRequest | PeriodRequest | SourceRequest | ClientRequest,
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
  input: ItemRequest | PeriodRequest | SourceRequest | ClientRequest,
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

  if (resource === "client") {
    const req = input as ClientRequest;
    if (req.mode === "LIST") return spfClientListEnvelopeSchema.parse(json).data;
    if (req.mode === "DETAIL") return spfClientDetailEnvelopeSchema.parse(json).data;
    return spfMutationEnvelopeSchema.parse(json).data;
  }

  throw new Error(`Unknown resource+mode: ${resource}`);
}

export async function generateSpfPortalUrl(
  input: { account_id?: string; owner_slug?: string },
): Promise<SpfMutationResult<SpfGenerateUrlResult>> {
  try {
    const payload = generateUrlRequestSchema.parse(input);
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

export async function exportSpfPeriod(periodId: string): Promise<SpfMutationResult<{ blob: Blob; filename: string }>> {
  let response: Response;
  try {
    response = await fetch("/api/spf/period", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "EXPORT", period_id: periodId }),
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

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  const filename = decodeURIComponent(match?.[1] ?? match?.[2] ?? `spf-${periodId}.pdf`);
  return { success: true, data: { blob: await response.blob(), filename } };
}

export async function uploadSpfItemMedia(
  itemId: string,
  file: File,
  _metadata: { caption?: string; display_order?: number } = {},
): Promise<SpfMutationResult<Record<string, unknown>>> {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });
    const matches = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!matches?.[1] || !matches[2]) {
      return { success: false, status: 400, message: "Format file tidak valid.", errorCode: "INVALID_FILE" };
    }
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"] as const;
    const mimeType = allowedMimeTypes.find((type) => type === matches[1]);
    if (!mimeType) {
      return { success: false, status: 400, message: "Tipe media tidak didukung.", errorCode: "INVALID_MEDIA_TYPE" };
    }
    return await mutateSpf("item", {
      mode: "UPLOAD_MEDIA",
      item_id: String(itemId),
      file_name: file.name,
      mime_type: mimeType,
      file_data: matches[2],
    });
  } catch {
    return { success: false, status: 503, message: "Gagal memproses file.", errorCode: "FILE_READ_ERROR" };
  }
}
