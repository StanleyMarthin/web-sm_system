import type {
  ApprovePrRequest,
  CancelPrRequest,
  CreatePrInput,
  OrderPrRequest,
  ReceivePrRequest,
} from "@smsystem/contracts/pr";
import {
  prDetailEnvelopeSchema,
  prGridEnvelopeSchema,
  prMutationEnvelopeSchema,
  prRecordSchema,
} from "@smsystem/contracts/pr";
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

export function buildPrGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("viewMode")) {
    params.set("viewMode", "active");
  }

  return params.toString();
}

export async function fetchPrGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildPrGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/pr${suffix}`, {
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
      payload: prGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchPrCritical(cookieHeader: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/pr/critical`, {
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
      payload: payload.data.map((row) => prRecordSchema.parse(row)),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchPrDetail(cookieHeader: string, prId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/pr/${prId}`, {
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
      payload: prDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createPr(input: CreatePrInput) {
  const response = await fetch(`${getApiBaseUrl()}/api/pr`, {
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

  const payload = prMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function updatePr(prId: string, input: CreatePrInput) {
  const response = await fetch(`${getApiBaseUrl()}/api/pr/${prId}`, {
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

  const payload = prMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

async function mutatePr(path: string, body: Record<string, unknown>) {
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

  const payload = prMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function approvePr(prId: string, input: ApprovePrRequest) {
  return mutatePr(`/api/pr/${prId}/approve`, input);
}

export function orderPr(prId: string, input: OrderPrRequest) {
  return mutatePr(`/api/pr/${prId}/order`, input);
}

export function receivePr(prId: string, input: ReceivePrRequest) {
  return mutatePr(`/api/pr/${prId}/receive`, input);
}

export function cancelPr(prId: string, input: CancelPrRequest) {
  return mutatePr(`/api/pr/${prId}/cancel`, input);
}

export async function requestPrUploadTicket(input: {
  filename: string;
  contentType: string;
  size: number;
}) {
  const params = new URLSearchParams({
    filename: input.filename,
    contentType: input.contentType,
    size: String(input.size),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/pr/upload-ticket?${params}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = (await response.json()) as {
    success: boolean;
    message: string;
    data: {
      uploadUrl: string;
      publicUrl: string;
      objectKey: string;
    };
  };

  return {
    success: true as const,
    result: payload.data,
  };
}
