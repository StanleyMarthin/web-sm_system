import {
  requestSchemas,
  spfErrorEnvelopeSchema,
  spfItemDetailEnvelopeSchema,
  spfItemListEnvelopeSchema,
  spfMutationEnvelopeSchema,
  spfPeriodDetailEnvelopeSchema,
  spfPeriodListEnvelopeSchema,
  spfSourceListEnvelopeSchema,
  type ItemRequest,
  type PeriodRequest,
  type SourceRequest,
  type SpfItem,
  type SpfMedia,
  type SpfPagination,
  type SpfPeriod,
  type SpfResource,
  type SpfSource,
} from "@/shared/api/spf-contracts";

type SpfRequest = ItemRequest | PeriodRequest | SourceRequest;
export type SpfMutationResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; message: string; errorCode?: string };

interface RequestOptions {
  cookieHeader?: string;
  origin?: string;
  signal?: AbortSignal;
}

export function getSpfBffOrigin(): string {
  return process.env.WEB_INTERNAL_URL?.replace(/\/$/u, "") ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

function pagination(data: { total: number; limit: number; offset: number }): SpfPagination {
  return {
    ...data,
    hasNextPage: data.offset + data.limit < data.total,
  };
}

function errorResult(status: number, body?: unknown): SpfMutationResult<never> {
  const parsed = spfErrorEnvelopeSchema.safeParse(body);
  return {
    success: false,
    status,
    message: parsed.success
      ? parsed.data.error.message ?? defaultMessage(status)
      : defaultMessage(status),
    errorCode: parsed.success ? parsed.data.error.code : undefined,
  };
}

async function postSpf(
  resource: SpfResource,
  input: SpfRequest,
  options: RequestOptions = {},
): Promise<{ body: unknown; status: number }> {
  const parsed = requestSchemas[resource].parse(input);
  const url = `${options.origin?.replace(/\/$/u, "") ?? ""}/api/spf/${resource}`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.cookieHeader ? { cookie: options.cookieHeader } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
    },
    body: JSON.stringify(parsed),
    cache: "no-store",
    signal: options.signal,
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // EXPORT returns a file; JSON callers treat other non-JSON responses as invalid.
  }
  return { body, status: response.status };
}

export async function fetchSpfItems(
  cookieHeader: string,
  query: Partial<Omit<Extract<ItemRequest, { mode: "LIST" }>, "mode">> = {},
  origin = "",
): Promise<{ payload: { items: SpfItem[]; meta: SpfPagination } | null; status: number }> {
  try {
    const result = await postSpf("item", { mode: "LIST", ...query }, { cookieHeader, origin });
    if (result.status >= 400) return { payload: null, status: result.status };
    const { data } = spfItemListEnvelopeSchema.parse(result.body);
    return { payload: { items: data.items, meta: pagination(data) }, status: result.status };
  } catch {
    return { payload: null, status: 502 };
  }
}

export async function fetchSpfItemDetail(
  cookieHeader: string,
  itemId: string,
  origin = "",
): Promise<{ payload: { item: SpfItem; media: SpfMedia[] } | null; status: number }> {
  try {
    const result = await postSpf("item", { mode: "DETAIL", item_id: itemId }, { cookieHeader, origin });
    if (result.status >= 400) return { payload: null, status: result.status };
    return { payload: spfItemDetailEnvelopeSchema.parse(result.body).data, status: result.status };
  } catch {
    return { payload: null, status: 502 };
  }
}

export async function fetchSpfPeriods(
  cookieHeader: string,
  query: Partial<Omit<Extract<PeriodRequest, { mode: "LIST" }>, "mode">> = {},
  origin = "",
): Promise<{ payload: { periods: SpfPeriod[]; meta: SpfPagination } | null; status: number }> {
  try {
    const result = await postSpf("period", { mode: "LIST", ...query }, { cookieHeader, origin });
    if (result.status >= 400) return { payload: null, status: result.status };
    const { data } = spfPeriodListEnvelopeSchema.parse(result.body);
    return { payload: { periods: data.periods, meta: pagination(data) }, status: result.status };
  } catch (error) {
    console.error("fetchSpfPeriods Zod Error:", error);
    return { payload: null, status: 502 };
  }
}

export async function fetchSpfPeriodDetail(
  cookieHeader: string,
  periodId: string,
  origin = "",
): Promise<{ payload: { period: SpfPeriod; items: SpfItem[] } | null; status: number }> {
  try {
    const result = await postSpf("period", { mode: "DETAIL", period_id: periodId }, { cookieHeader, origin });
    if (result.status >= 400) return { payload: null, status: result.status };
    const { data } = spfPeriodDetailEnvelopeSchema.parse(result.body);
    return { payload: { period: data.period, items: data.items }, status: result.status };
  } catch {
    return { payload: null, status: 502 };
  }
}

export async function fetchSpfSources(
  cookieHeader: string,
  query: Partial<Omit<Extract<SourceRequest, { mode: "SMS_DB" }>, "mode">> = {},
  origin = "",
): Promise<{ payload: { sources: SpfSource[]; meta: SpfPagination } | null; status: number }> {
  try {
    const result = await postSpf("source", { mode: "SMS_DB", ...query }, { cookieHeader, origin });
    if (result.status >= 400) return { payload: null, status: result.status };
    const { data } = spfSourceListEnvelopeSchema.parse(result.body);
    return { payload: { sources: data.items, meta: pagination(data) }, status: result.status };
  } catch {
    return { payload: null, status: 502 };
  }
}

export async function mutateSpf<T = Record<string, unknown>>(
  resource: SpfResource,
  input: SpfRequest,
  signal?: AbortSignal,
): Promise<SpfMutationResult<T>> {
  try {
    const result = await postSpf(resource, input, { signal });
    if (result.status >= 400) return errorResult(result.status, result.body);
    const data = spfMutationEnvelopeSchema.parse(result.body).data;
    return { success: true, data: data as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, status: 0, message: "Request dibatalkan.", errorCode: "ABORTED" };
    }
    return { success: false, status: 503, message: "Gagal terhubung ke server.", errorCode: "NETWORK_ERROR" };
  }
}

export async function mutateSpfCollect(
  sourceIds: string[],
): Promise<SpfMutationResult<{ collected: number }>> {
  return mutateSpf("source", { mode: "COLLECT", source_ids: sourceIds });
}

export async function downloadSpfPeriod(
  periodId: string,
): Promise<SpfMutationResult<{ blob: Blob; filename: string }>> {
  try {
    const response = await fetch("/api/spf/period", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestSchemas.period.parse({ mode: "EXPORT", period_id: periodId })),
    });
    if (!response.ok) {
      return errorResult(response.status, await response.json().catch(() => null));
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/iu)?.[1];
    return {
      success: true,
      data: {
        blob: await response.blob(),
        filename: filename ? decodeURIComponent(filename) : `spf-${periodId}.xlsx`,
      },
    };
  } catch {
    return { success: false, status: 503, message: "Gagal mengunduh laporan." };
  }
}

function defaultMessage(status: number): string {
  if (status === 400) return "Data yang dikirim tidak valid.";
  if (status === 401) return "Sesi habis, silakan login kembali.";
  if (status === 403) return "Anda tidak memiliki izin untuk aksi ini.";
  if (status === 404) return "Data tidak ditemukan.";
  if (status === 409) return "Status data telah berubah.";
  if (status === 429) return "Terlalu banyak permintaan.";
  return "Backend SPF tidak dapat memproses permintaan.";
}
