import type {
  QcFinalApproveRequest,
  QcPassRequest,
  QcRejectRequest,
} from "@smsystem/contracts/qc";
import {
  qcDetailEnvelopeSchema,
  qcFinalApproveEnvelopeSchema,
  qcFinalChecklistEnvelopeSchema,
  qcGridEnvelopeSchema,
  qcMutationEnvelopeSchema,
} from "@smsystem/contracts/qc";
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

async function fetchWithCookie(path: string, cookieHeader: string) {
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

async function mutateQc<TPayload extends Record<string, unknown>>(
  path: string,
  body: TPayload,
) {
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

  return response;
}

export function buildQcGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("page")) {
    params.set("page", "1");
  }

  if (!params.has("limit")) {
    params.set("limit", "25");
  }

  if (!params.has("sortBy")) {
    params.set("sortBy", "waitingHours");
  }

  if (!params.has("sortDirection")) {
    params.set("sortDirection", "desc");
  }

  return params.toString();
}

async function fetchQcGrid(
  path: string,
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildQcGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(`${path}${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: qcGridEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export function fetchQcQueue(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchQcGrid("/api/qc/queue", cookieHeader, searchParams);
}

export function fetchQcRework(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchQcGrid("/api/qc/rework", cookieHeader, searchParams);
}

export function fetchQcRecheck(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchQcGrid("/api/qc/recheck", cookieHeader, searchParams);
}

export async function fetchQcDetail(cookieHeader: string, coreId: string) {
  const response = await fetchWithCookie(`/api/qc/${coreId}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: qcDetailEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchQcFinalChecklist(cookieHeader: string, carId: string) {
  const response = await fetchWithCookie(`/api/qc/final-checklist/${carId}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: qcFinalChecklistEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function passQc(coreId: string, input: QcPassRequest) {
  const response = await mutateQc(`/api/qc/${coreId}/pass`, input);
  if (!("ok" in response)) {
    return response;
  }

  const payload = qcMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function rejectQc(coreId: string, input: QcRejectRequest) {
  const response = await mutateQc(`/api/qc/${coreId}/reject`, input);
  if (!("ok" in response)) {
    return response;
  }

  const payload = qcMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function approveQcFinalChecklist(carId: string, input: QcFinalApproveRequest) {
  const response = await mutateQc(`/api/qc/final-checklist/${carId}/approve`, input);
  if (!("ok" in response)) {
    return response;
  }

  const payload = qcFinalApproveEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
