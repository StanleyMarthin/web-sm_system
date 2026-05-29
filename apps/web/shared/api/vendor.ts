import type {
  ApproveVendorRequest,
  CancelVendorRequest,
  CreateVendorRequest,
  ReceiveVendorRequest,
  VendorStatusUpdateRequest,
} from "@smsystem/contracts/vendor";
import {
  vendorDetailEnvelopeSchema,
  vendorGridEnvelopeSchema,
  vendorMutationEnvelopeSchema,
} from "@smsystem/contracts/vendor";
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

export function buildVendorGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("viewMode")) {
    params.set("viewMode", "active");
  }

  return params.toString();
}

export async function fetchVendorGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildVendorGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vendor${suffix}`, {
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
      payload: vendorGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchVendorDetail(cookieHeader: string, wovId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vendor/${wovId}`, {
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
      payload: vendorDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createVendor(input: CreateVendorRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/vendor`, {
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

  const payload = vendorMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

async function mutateVendor(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "PATCH",
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

  const payload = vendorMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function approveVendor(wovId: string, input: ApproveVendorRequest) {
  return mutateVendor(`/api/vendor/${wovId}/approve`, input);
}

export function updateVendorStatus(wovId: string, input: VendorStatusUpdateRequest) {
  return mutateVendor(`/api/vendor/${wovId}/status`, input);
}

export function receiveVendor(wovId: string, input: ReceiveVendorRequest) {
  return mutateVendor(`/api/vendor/${wovId}/receive`, input);
}

export function cancelVendor(wovId: string, input: CancelVendorRequest) {
  return mutateVendor(`/api/vendor/${wovId}/cancel`, input);
}
