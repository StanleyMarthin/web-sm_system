import type {
  WoApproveRequest,
  WoCreateRequest,
  WoRejectRequest,
} from "@smsystem/contracts/wo";
import {
  woDetailEnvelopeSchema,
  woGridEnvelopeSchema,
  woMutationEnvelopeSchema,
  woRecordSchema,
} from "@smsystem/contracts/wo";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
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

export function buildWoGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("viewMode")) {
    params.set("viewMode", "active");
  }

  return params.toString();
}

export async function fetchWoGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildWoGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wo${suffix}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      credentials: cookieHeader ? undefined : "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: woGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchWoDetail(cookieHeader: string, woId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wo/${woId}`, {
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
      payload: woDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchWoUrgent(cookieHeader: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wo/urgent`, {
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

    const payload = (await response.json()) as {
      success: boolean;
      message: string;
      data: unknown[];
    };
    return {
      payload: payload.data.map((row) => woRecordSchema.parse(row)),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createWo(input: WoCreateRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/wo`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = woMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function updateWo(woId: string, input: WoCreateRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/wo/${woId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = woMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

async function mutateWo(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: body
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = woMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function approveWo(woId: string, input?: WoApproveRequest) {
  return mutateWo(`/api/wo/${woId}/approve`, input);
}

export function markWoDone(woId: string) {
  return mutateWo(`/api/wo/${woId}/done`);
}

export function rejectWo(woId: string, input: WoRejectRequest) {
  return mutateWo(`/api/wo/${woId}/reject`, input);
}
