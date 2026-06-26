import type {
  CreateWarehouseItem,
  CreateWarehouseStorageLocation,
  CreateWarehouseStockCard,
  CreateWarehouseStockAdjustment,
  CreateWarehouseStockOpname,
  CreateWarehouseRequest,
  UpdateWarehouseStockCard,
  UpdateWarehouseItem,
  UpdateWarehouseStorageLocation,
  WarehouseStockAdjustmentMutationResult,
  WarehouseStockOpnameMutationResult,
  WarehouseApproveRequest,
  WarehouseIssueRequest,
  WarehouseReadyRequest,
  WarehouseRejectRequest,
  WarehouseReturnRequest,
  WarehouseStoreRequest,
} from "@smsystem/contracts/warehouse";
import {
  warehouseDashboardEnvelopeSchema,
  warehouseItemsEnvelopeSchema,
  warehouseItemMutationEnvelopeSchema,
  warehouseMaterialUsageEnvelopeSchema,
  warehouseMutationEnvelopeSchema,
  warehousePendingApprovalEnvelopeSchema,
  warehouseRequestReferencesEnvelopeSchema,
  warehouseStockCardPhotoMutationEnvelopeSchema,
  warehouseStockAdjustmentEnvelopeSchema,
  warehouseStockAdjustmentMutationEnvelopeSchema,
  warehouseStockCardEnvelopeSchema,
  warehouseStockCardMutationEnvelopeSchema,
  warehouseStockCardReferencesEnvelopeSchema,
  warehouseStockOpnameEnvelopeSchema,
  warehouseStockOpnameMutationEnvelopeSchema,
  warehouseStorageLocationMutationEnvelopeSchema,
  warehouseStorageLocationsEnvelopeSchema,
  warehouseTransactionsEnvelopeSchema,
  warehouseUploadTicketResponseSchema,
} from "@smsystem/contracts/warehouse";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

interface ClientCacheEntry<T> {
  expiresAt: number;
  pending?: Promise<{ payload: T | null; status: number }>;
  value?: { payload: T | null; status: number };
}

const CLIENT_CACHE_TTL_MS = 60_000;
const warehouseClientCache = new Map<string, ClientCacheEntry<unknown>>();

function getCachedClientResult<T>(key: string) {
  const cached = warehouseClientCache.get(key) as ClientCacheEntry<T> | undefined;
  if (!cached) {
    return null;
  }

  if (cached.value && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached.pending) {
    return cached.pending;
  }

  warehouseClientCache.delete(key);
  return null;
}

function setCachedClientPromise<T>(
  key: string,
  loader: Promise<{ payload: T | null; status: number }>,
) {
  warehouseClientCache.set(key, {
    expiresAt: 0,
    pending: loader,
  });

  return loader
    .then((value) => {
      warehouseClientCache.set(key, {
        expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .catch((error) => {
      warehouseClientCache.delete(key);
      throw error;
    });
}

function clearWarehouseClientCache(prefix: string) {
  for (const key of warehouseClientCache.keys()) {
    if (key.startsWith(prefix)) {
      warehouseClientCache.delete(key);
    }
  }
}

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      params.append(key, item);
    }
  }

  return params;
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  try {
    const payload = (await response.json()) as ApiFailure;
    return payload;
  } catch {
    return {
      success: false,
      message: "Response API tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

async function fetchGrid<T>(
  path: string,
  cookieHeader: string,
  schema: { parse(input: unknown): T },
) {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: schema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

async function mutateWarehouse(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = warehouseMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

async function mutateWarehouseTyped<T>(
  path: string,
  method: "POST" | "PUT" = "POST",
  body: Record<string, unknown>,
  schema: { parse(input: unknown): { data: T } },
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = schema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function buildWarehouseGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchWarehouseTransactions(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/transactions${suffix}`,
    cookieHeader,
    warehouseTransactionsEnvelopeSchema,
  );
}

export async function fetchWarehouseDashboard(cookieHeader: string) {
  return fetchGrid(
    "/api/warehouse/dashboard",
    cookieHeader,
    warehouseDashboardEnvelopeSchema,
  );
}

export async function fetchWarehousePendingApproval(cookieHeader: string) {
  return fetchGrid(
    "/api/warehouse/pending-approval",
    cookieHeader,
    warehousePendingApprovalEnvelopeSchema,
  );
}

export async function fetchWarehouseRequestReferences(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/request-references${suffix}`,
    cookieHeader,
    warehouseRequestReferencesEnvelopeSchema,
  );
}

export async function fetchWarehouseRequestReferencesClient(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const cacheKey = `request-references:${suffix}`;
  const cached = getCachedClientResult<
    ReturnType<typeof warehouseRequestReferencesEnvelopeSchema.parse>
  >(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedClientPromise(
    cacheKey,
    (async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/warehouse/request-references${suffix}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return {
            payload: null,
            status: response.status,
          };
        }

        return {
          payload: warehouseRequestReferencesEnvelopeSchema.parse(await response.json()),
          status: response.status,
        };
      } catch {
        return {
          payload: null,
          status: 503,
        };
      }
    })(),
  );
}

export async function fetchWarehouseStockCard(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/stock-card${suffix}`,
    cookieHeader,
    warehouseStockCardEnvelopeSchema,
  );
}

export async function fetchWarehouseStockCardReferences(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/stock-card/references${suffix}`,
    cookieHeader,
    warehouseStockCardReferencesEnvelopeSchema,
  );
}

export async function fetchWarehouseStockCardReferencesClient(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const cacheKey = `stock-card-references:${suffix}`;
  const cached = getCachedClientResult<
    ReturnType<typeof warehouseStockCardReferencesEnvelopeSchema.parse>
  >(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedClientPromise(
    cacheKey,
    (async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/warehouse/stock-card/references${suffix}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return {
            payload: null,
            status: response.status,
          };
        }

        return {
          payload: warehouseStockCardReferencesEnvelopeSchema.parse(await response.json()),
          status: response.status,
        };
      } catch {
        return {
          payload: null,
          status: 503,
        };
      }
    })(),
  );
}

export async function fetchWarehouseItems(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/items${suffix}`,
    cookieHeader,
    warehouseItemsEnvelopeSchema,
  );
}

export async function fetchWarehouseMaterialUsage(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/material-usage${suffix}`,
    cookieHeader,
    warehouseMaterialUsageEnvelopeSchema,
  );
}

export function createWarehouseItem(input: CreateWarehouseItem) {
  return mutateWarehouseTyped(
    "/api/warehouse/items",
    "POST",
    input,
    warehouseItemMutationEnvelopeSchema,
  );
}

export function updateWarehouseItem(input: UpdateWarehouseItem) {
  return mutateWarehouseTyped(
    "/api/warehouse/items",
    "PUT",
    input,
    warehouseItemMutationEnvelopeSchema,
  );
}

export async function deleteWarehouseItem(itemId: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/warehouse/items/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = warehouseItemMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchWarehouseStorageLocations(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/storage-locations${suffix}`,
    cookieHeader,
    warehouseStorageLocationsEnvelopeSchema,
  );
}

export async function fetchWarehouseStorageLocationsClient(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const cacheKey = `storage-locations:${suffix}`;
  const cached = getCachedClientResult<
    ReturnType<typeof warehouseStorageLocationsEnvelopeSchema.parse>
  >(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedClientPromise(
    cacheKey,
    (async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/warehouse/storage-locations${suffix}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return {
            payload: null,
            status: response.status,
          };
        }

        return {
          payload: warehouseStorageLocationsEnvelopeSchema.parse(await response.json()),
          status: response.status,
        };
      } catch {
        return {
          payload: null,
          status: 503,
        };
      }
    })(),
  );
}

export async function fetchWarehouseStockOpnames(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/opname${suffix}`,
    cookieHeader,
    warehouseStockOpnameEnvelopeSchema,
  );
}

export async function fetchWarehouseStockAdjustments(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWarehouseGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  return fetchGrid(
    `/api/warehouse/adjustments${suffix}`,
    cookieHeader,
    warehouseStockAdjustmentEnvelopeSchema,
  );
}

export function createWarehouseRequest(input: CreateWarehouseRequest) {
  clearWarehouseClientCache("request-references:");
  return mutateWarehouse("/api/warehouse/request", input);
}

export function approveWarehouseRequest(input: WarehouseApproveRequest) {
  return mutateWarehouse("/api/warehouse/approve", input);
}

export function rejectWarehouseRequest(input: WarehouseRejectRequest) {
  return mutateWarehouse("/api/warehouse/reject", input);
}

export function readyWarehouseRequest(input: WarehouseReadyRequest) {
  return mutateWarehouse("/api/warehouse/ready", input);
}

export function issueWarehouseRequest(input: WarehouseIssueRequest) {
  return mutateWarehouse("/api/warehouse/issue", input);
}

export function returnWarehouseRequest(input: WarehouseReturnRequest) {
  return mutateWarehouse("/api/warehouse/return", input);
}

export function storeWarehouseRequest(input: WarehouseStoreRequest) {
  return mutateWarehouse("/api/warehouse/store", input);
}

export function createWarehouseStockOpname(input: CreateWarehouseStockOpname) {
  return mutateWarehouseTyped<WarehouseStockOpnameMutationResult>(
    "/api/warehouse/opname",
    "POST",
    input,
    warehouseStockOpnameMutationEnvelopeSchema,
  );
}

export function createWarehouseStockAdjustment(input: CreateWarehouseStockAdjustment) {
  return mutateWarehouseTyped<WarehouseStockAdjustmentMutationResult>(
    "/api/warehouse/adjustments",
    "POST",
    input,
    warehouseStockAdjustmentMutationEnvelopeSchema,
  );
}

export async function requestWarehouseStockCardUploadTicket(input: {
  stockCardId: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  const params = new URLSearchParams({
    stockCardId: input.stockCardId,
    filename: input.filename,
    contentType: input.contentType,
    size: String(input.size),
  });
  const response = await fetch(
    `${getApiBaseUrl()}/api/warehouse/stock-card/upload-ticket?${params.toString()}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = warehouseUploadTicketResponseSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function updateWarehouseStockCardPhotos(input: {
  stockCardId: string;
  photoUrls: string[];
}) {
  return mutateWarehouseTyped<{ stockCardId: string; photoUrls: string[] }>(
    "/api/warehouse/stock-card/photos",
    "POST",
    input,
    warehouseStockCardPhotoMutationEnvelopeSchema,
  );
}

export function createWarehouseStockCard(input: CreateWarehouseStockCard) {
  clearWarehouseClientCache("request-references:");
  clearWarehouseClientCache("stock-card-references:");
  return mutateWarehouseTyped(
    "/api/warehouse/stock-card",
    "POST",
    input,
    warehouseStockCardMutationEnvelopeSchema,
  );
}

export function updateWarehouseStockCard(input: UpdateWarehouseStockCard) {
  clearWarehouseClientCache("request-references:");
  clearWarehouseClientCache("stock-card-references:");
  return mutateWarehouseTyped(
    "/api/warehouse/stock-card",
    "PUT",
    input,
    warehouseStockCardMutationEnvelopeSchema,
  );
}

export async function deleteWarehouseStockCard(stockCardId: string) {
  clearWarehouseClientCache("request-references:");
  clearWarehouseClientCache("stock-card-references:");
  const response = await fetch(
    `${getApiBaseUrl()}/api/warehouse/stock-card/${encodeURIComponent(stockCardId)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = warehouseStockCardMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function createWarehouseStorageLocation(input: CreateWarehouseStorageLocation) {
  clearWarehouseClientCache("storage-locations:");
  return mutateWarehouseTyped(
    "/api/warehouse/storage-locations",
    "POST",
    input,
    warehouseStorageLocationMutationEnvelopeSchema,
  );
}

export function updateWarehouseStorageLocation(input: UpdateWarehouseStorageLocation) {
  clearWarehouseClientCache("storage-locations:");
  return mutateWarehouseTyped(
    "/api/warehouse/storage-locations",
    "PUT",
    input,
    warehouseStorageLocationMutationEnvelopeSchema,
  );
}

export async function deleteWarehouseStorageLocation(storageLocationId: number) {
  clearWarehouseClientCache("storage-locations:");
  const response = await fetch(
    `${getApiBaseUrl()}/api/warehouse/storage-locations/${storageLocationId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = warehouseStorageLocationMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
