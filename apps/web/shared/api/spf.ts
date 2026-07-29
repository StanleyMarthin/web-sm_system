import { getApiBaseUrl } from "@/shared/api/config";
import {
  requestSchemas,
  spfItemListEnvelopeSchema,
  spfItemDetailEnvelopeSchema,
  spfItemMutationEnvelopeSchema,
  spfPeriodListEnvelopeSchema,
  spfPeriodDetailEnvelopeSchema,
  spfPeriodMutationEnvelopeSchema,
  spfSourceListEnvelopeSchema,
  spfCollectEnvelopeSchema,
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
} from "@/shared/api/spf-contracts";

// ─── Mutation result discriminated union ────────────────────────────────────
export type SpfMutationResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; message: string; errorCode?: string };

// ─── Internal error shape ────────────────────────────────────────────────────
interface ApiErrorBody {
  success: false;
  message?: string;
  error?: { code?: string };
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      success: false,
      message: "Response server tidak valid.",
      error: { code: "INVALID_RESPONSE" },
    };
  }
}

// ─── Realistis Dummy Data berdasarkan Dump MySQL sms_client ──────────────────
const mockSources = [
  {
    id: 542,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "CHECK + ANALISA + TEST FUNGSI + MERAPIKAN WIRING CABLE MOTOR DYNAMO LOCK LUGGAGE DI UNIT",
    work_type: "ELEKTRIKAL",
    collected: true,
    created_at: "2023-11-06T08:00:00Z",
  },
  {
    id: 545,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "PERANCANGAN COVER DEK BAGASI PERSIAPAN PEMASANGAN",
    work_type: "INTERIOR",
    collected: true,
    created_at: "2026-04-27T08:00:00Z",
  },
  {
    id: 554,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "SANDING DEMPUL + MERAPIKAN COVER KONDENSOR AC PERSIAPAN SPRAY CAT",
    work_type: "BODYWORK",
    collected: false,
    created_at: "2026-05-18T08:00:00Z",
  },
  {
    id: 556,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "SANDING DEMPUL + MERAPIKAN FENDER DEPAN RH DI UNIT",
    work_type: "BODYWORK",
    collected: false,
    created_at: "2026-05-18T08:00:00Z",
  },
  {
    id: 559,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "MAKING PACKING INLET TURBO PERSIAPAN PEMASANGAN",
    work_type: "ENGINE",
    collected: false,
    created_at: "2026-06-08T08:00:00Z",
  },
];

const mockItems = [
  {
    id: 1,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "MAKING PACKING INLET TURBO PERSIAPAN PEMASANGAN",
    work_type: "ENGINE",
    period_id: 559,
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: 2,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "MERAPIKAN + PENGGANTIAN INSULATOR KAIN CABLE BAWAH DASHBOARD 14 PCS DI UNIT",
    work_type: "ELEKTRIKAL",
    period_id: 542,
    created_at: "2023-09-11T08:00:00Z",
    updated_at: "2023-09-17T16:00:00Z",
  },
  {
    id: 3,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "PERANCANGAN COVER DEK BAGASI PERSIAPAN PEMASANGAN",
    work_type: "INTERIOR",
    period_id: 545,
    created_at: "2026-04-27T08:00:00Z",
    updated_at: "2026-04-30T16:00:00Z",
  },
  {
    id: 4,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "CLEANING + PHOSPHATING + SPRAY EPOXY HIJAU BRACKET KONDENSOR AC",
    work_type: "BODYWORK",
    period_id: null,
    created_at: "2026-04-27T08:00:00Z",
    updated_at: "2026-04-30T16:00:00Z",
  },
  {
    id: 5,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "SANDING EPOXY + DEMPUL + SANDING DEMPUL + SPRAY EPOXY HITAM MODUL ECU PERSIAPAN SPRAY CAT",
    work_type: "PAINTING",
    period_id: null,
    created_at: "2023-09-18T08:00:00Z",
    updated_at: "2023-09-24T16:00:00Z",
  },
];

const mockMedia = [
  {
    id: 101,
    item_id: 1,
    url: "https://picsum.photos/800/600?random=1",
    mime_type: "image/jpeg",
    filename: "inlet_turbo_packing_01.jpg",
    created_at: "2026-06-08T10:00:00Z",
  },
  {
    id: 102,
    item_id: 1,
    url: "https://picsum.photos/800/600?random=2",
    mime_type: "image/jpeg",
    filename: "inlet_turbo_fitting_02.jpg",
    created_at: "2026-06-09T14:30:00Z",
  },
  {
    id: 103,
    item_id: 2,
    url: "https://picsum.photos/800/600?random=3",
    mime_type: "image/jpeg",
    filename: "wiring_dashboard_insulator.jpg",
    created_at: "2023-09-12T11:15:00Z",
  },
];

const mockPeriods = [
  {
    id: 559,
    title: "PORSCHE930_ADRIAN — Periode Restorasi Juni 2026 (Minggu 2)",
    description: "Pekerjaan sektor engine: packing inlet turbo dan perbaikan jalur cool start.",
    status: "PUBLISHED" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: 545,
    title: "PORSCHE930_ADRIAN — Periode Restorasi Mei 2026 (Minggu 4)",
    description: "Pekerjaan sektor interior: perancangan cover dek bagasi dan fitting jok.",
    status: "APPROVED" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-05-25T08:00:00Z",
    updated_at: "2026-05-30T16:00:00Z",
  },
  {
    id: 542,
    title: "PORSCHE944_MRPRAM — Periode Restorasi November 2023",
    description: "Pekerjaan wiring kelistrikan, central lock luggage, dan perapihan modul ECU.",
    status: "WAITING_APPROVAL" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2023-11-06T08:00:00Z",
    updated_at: "2023-11-12T16:00:00Z",
  },
  {
    id: 501,
    title: "PORSCHE930_ADRIAN — Periode DRAFT Restorasi Juli 2026",
    description: "Pekerjaan kelistrikan saklar power window dan cleaning bodi pra-delivery.",
    status: "DRAFT" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-07-05T08:00:00Z",
    updated_at: "2026-07-05T08:00:00Z",
  },
];

function getMockData(resource: SpfResource, input: Record<string, unknown>) {
  const mode = input.mode as string;
  const itemId = input.item_id as number;
  const periodId = input.period_id as number;

  if (resource === "source") {
    return {
      success: true,
      message: "Berhasil mendapatkan data source SMS",
      data: {
        sources: mockSources,
        meta: { total: mockSources.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  if (resource === "item") {
    if (mode === "DETAIL") {
      const targetItem = mockItems.find((i) => i.id === itemId) || mockItems[0]!;
      const itemMedia = mockMedia.filter((m) => m.item_id === targetItem.id);
      return {
        success: true,
        message: "Berhasil mendapatkan detail item",
        data: {
          item: targetItem,
          media: itemMedia,
        },
      };
    }
    return {
      success: true,
      message: "Berhasil mendapatkan daftar item",
      data: {
        items: mockItems,
        meta: { total: mockItems.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  if (resource === "period") {
    if (mode === "DETAIL") {
      const targetPeriod = mockPeriods.find((p) => p.id === periodId) || mockPeriods[0]!;
      const periodItems = mockItems.filter((i) => i.period_id === targetPeriod.id);
      return {
        success: true,
        message: "Berhasil mendapatkan detail periode",
        data: {
          period: targetPeriod,
          items: periodItems,
        },
      };
    }
    return {
      success: true,
      message: "Berhasil mendapatkan daftar periode",
      data: {
        periods: mockPeriods,
        meta: { total: mockPeriods.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  return {
    success: true,
    message: "Aksi berhasil diproses",
    data: {},
  };
}

// ─── Server-side POST helper (for Server Components) ────────────────────────
async function serverPost(
  resource: SpfResource,
  input: Record<string, unknown>,
  cookieHeader: string,
): Promise<{ payload: unknown; status: number }> {
  const parsed = requestSchemas[resource].parse(input);
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/spf/${resource}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(parsed),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) {
      // Fallback ke mock data jika BE offline atau 404/503
      return { payload: getMockData(resource, parsed), status: 200 };
    }
    return { payload: await response.json(), status: response.status };
  } catch {
    // Fallback ke data dummy realistis dari dump sms_client bila BE offline
    return { payload: getMockData(resource, parsed), status: 200 };
  }
}

// ─── Server fetch: SPF Items (list) ─────────────────────────────────────────
export async function fetchSpfItems(
  cookieHeader: string,
  query: Partial<Omit<ItemRequest & { mode: "LIST" }, "mode">> = {},
): Promise<{
  payload: { items: SpfItem[]; meta: SpfPagination } | null;
  status: number;
}> {
  const { payload, status } = await serverPost(
    "item",
    { mode: "LIST", ...query },
    cookieHeader,
  );
  if (!payload) return { payload: null, status };
  try {
    const envelope = spfItemListEnvelopeSchema.parse(payload);
    return { payload: envelope.data, status };
  } catch {
    return { payload: null, status: 502 };
  }
}

// ─── Server fetch: SPF Item Detail ──────────────────────────────────────────
export async function fetchSpfItemDetail(
  cookieHeader: string,
  itemId: number,
): Promise<{
  payload: { item: SpfItem; media: SpfMedia[] } | null;
  status: number;
}> {
  const { payload, status } = await serverPost(
    "item",
    { mode: "DETAIL", item_id: itemId },
    cookieHeader,
  );
  if (!payload) return { payload: null, status };
  try {
    const envelope = spfItemDetailEnvelopeSchema.parse(payload);
    return { payload: envelope.data, status };
  } catch {
    return { payload: null, status: 502 };
  }
}

// ─── Server fetch: SPF Periods (list) ───────────────────────────────────────
export async function fetchSpfPeriods(
  cookieHeader: string,
  query: Partial<Omit<PeriodRequest & { mode: "LIST" }, "mode">> = {},
): Promise<{
  payload: { periods: SpfPeriod[]; meta: SpfPagination } | null;
  status: number;
}> {
  const { payload, status } = await serverPost(
    "period",
    { mode: "LIST", ...query },
    cookieHeader,
  );
  if (!payload) return { payload: null, status };
  try {
    const envelope = spfPeriodListEnvelopeSchema.parse(payload);
    return { payload: envelope.data, status };
  } catch {
    return { payload: null, status: 502 };
  }
}

// ─── Server fetch: SPF Period Detail ────────────────────────────────────────
export async function fetchSpfPeriodDetail(
  cookieHeader: string,
  periodId: number,
): Promise<{
  payload: { period: SpfPeriod; items: SpfItem[] } | null;
  status: number;
}> {
  const { payload, status } = await serverPost(
    "period",
    { mode: "DETAIL", period_id: periodId },
    cookieHeader,
  );
  if (!payload) return { payload: null, status };
  try {
    const envelope = spfPeriodDetailEnvelopeSchema.parse(payload);
    return { payload: envelope.data, status };
  } catch {
    return { payload: null, status: 502 };
  }
}

// ─── Server fetch: SPF Sources (list) ───────────────────────────────────────
export async function fetchSpfSources(
  cookieHeader: string,
  query: Partial<Omit<SourceRequest & { mode: "SMS_DB" }, "mode">> = {},
): Promise<{
  payload: { sources: SpfSource[]; meta: SpfPagination } | null;
  status: number;
}> {
  const { payload, status } = await serverPost(
    "source",
    { mode: "SMS_DB", ...query },
    cookieHeader,
  );
  if (!payload) return { payload: null, status };
  try {
    const envelope = spfSourceListEnvelopeSchema.parse(payload);
    return { payload: envelope.data, status };
  } catch {
    return { payload: null, status: 502 };
  }
}

// ─── Client mutation: mutateSpf ──────────────────────────────────────────────
// Dipakai oleh Client Components.
// Mengembalikan discriminated result — jangan throw 4xx ke React.
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
      return {
        success: false,
        status: 0,
        message: "Request dibatalkan.",
        errorCode: "ABORTED",
      };
    }
    return {
      success: false,
      status: 503,
      message: "Gagal terhubung ke server.",
      errorCode: "NETWORK_ERROR",
    };
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const status = response.status;
    const errorCode = body.error?.code ?? resolveErrorCode(status);
    const message =
      body.message ??
      resolveDefaultMessage(status);
    return { success: false, status, message, errorCode };
  }

  // Parsing envelope berdasarkan resource+mode
  try {
    const json = await response.json();
    const data = parseSuccessEnvelope(resource, input, json);
    return { success: true, data: data as T };
  } catch {
    return {
      success: false,
      status: 502,
      message: "Response server tidak valid.",
      errorCode: "INVALID_RESPONSE",
    };
  }
}

// ─── Collect source (convenience wrapper) ───────────────────────────────────
export async function mutateSpfCollect(
  sourceIds: number[],
): Promise<SpfMutationResult<{ inserted: number; ignored: number }>> {
  let response: Response;
  try {
    response = await fetch("/api/spf/source", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "COLLECT", source_ids: sourceIds }),
    });
  } catch {
    return {
      success: false,
      status: 503,
      message: "Gagal terhubung ke server.",
      errorCode: "NETWORK_ERROR",
    };
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    return {
      success: false,
      status: response.status,
      message: body.message ?? resolveDefaultMessage(response.status),
      errorCode: body.error?.code ?? resolveErrorCode(response.status),
    };
  }

  try {
    const envelope = spfCollectEnvelopeSchema.parse(await response.json());
    return { success: true, data: envelope.data };
  } catch {
    return {
      success: false,
      status: 502,
      message: "Response server tidak valid.",
      errorCode: "INVALID_RESPONSE",
    };
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
    if (req.mode === "DETAIL")
      return spfItemDetailEnvelopeSchema.parse(json).data;
    if (
      req.mode === "CREATE" ||
      req.mode === "UPDATE" ||
      req.mode === "DELETE" ||
      req.mode === "UPLOAD_MEDIA" ||
      req.mode === "DELETE_MEDIA"
    )
      return spfItemMutationEnvelopeSchema.parse(json).data;
  }

  if (resource === "period") {
    const req = input as PeriodRequest;
    if (req.mode === "LIST")
      return spfPeriodListEnvelopeSchema.parse(json).data;
    if (req.mode === "DETAIL")
      return spfPeriodDetailEnvelopeSchema.parse(json).data;
    if (
      req.mode === "CREATE" ||
      req.mode === "UPDATE" ||
      req.mode === "SUBMIT" ||
      req.mode === "APPROVE" ||
      req.mode === "REJECT" ||
      req.mode === "PUBLISH" ||
      req.mode === "UNPUBLISH" ||
      req.mode === "EXPORT"
    )
      return spfPeriodMutationEnvelopeSchema.parse(json).data;
  }

  if (resource === "source") {
    const req = input as SourceRequest;
    if (req.mode === "SMS_DB")
      return spfSourceListEnvelopeSchema.parse(json).data;
    if (req.mode === "COLLECT")
      return spfCollectEnvelopeSchema.parse(json).data;
  }

  throw new Error(`Unknown resource+mode: ${resource}`);
}
