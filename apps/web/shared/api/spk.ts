import type {
  SpkDraftDetailUpdateRequest,
  SpkGenerateRequest,
  SpkItemApprovalRequest,
  SpkRejectRequest,
} from "@smsystem/contracts/spk";
import {
  spkDraftDetailUpdateEnvelopeSchema,
  spkDetailEnvelopeSchema,
  spkGenerateEnvelopeSchema,
  spkItemApprovalEnvelopeSchema,
  spkListEnvelopeSchema,
  spkMutationEnvelopeSchema,
  spkPreviewEnvelopeSchema,
  spkSummaryEnvelopeSchema,
  spkTodayEnvelopeSchema,
} from "@smsystem/contracts/spk";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
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

export function buildSpkGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("date")) {
    params.set("date", getTodayIsoDate());
  }

  return params.toString();
}

export async function fetchSpkGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildSpkGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/spk${suffix}`, {
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
      payload: spkListEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchSpkPreview(
  cookieHeader: string,
  date: string,
) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/spk/preview?date=${date}`, {
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
      payload: spkPreviewEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchSpkDetail(cookieHeader: string, spkId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/spk/${spkId}`, {
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
      payload: spkDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createSpk(input: SpkGenerateRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/spk/generate`, {
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

  const payload = spkGenerateEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

async function mutateSpkStatus(
  path: string,
  body?: Record<string, unknown>,
) {
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

  const payload = spkMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function submitSpk(spkId: string) {
  return mutateSpkStatus(`/api/spk/${spkId}/submit`);
}

export function approveSpk(spkId: string) {
  return mutateSpkStatus(`/api/spk/${spkId}/approve`);
}

export function activateSpk(spkId: string) {
  return mutateSpkStatus(`/api/spk/${spkId}/activate`);
}

export function markSpkDone(spkId: string) {
  return mutateSpkStatus(`/api/spk/${spkId}/done`);
}

export function rejectSpk(spkId: string, input: SpkRejectRequest) {
  return mutateSpkStatus(`/api/spk/${spkId}/reject`, input);
}

export async function updateSpkDraftDetails(
  spkId: string,
  input: SpkDraftDetailUpdateRequest,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/spk/${spkId}/draft-details`, {
    method: "PATCH",
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

  const payload = spkDraftDetailUpdateEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function approveSpkItem(
  spkId: string,
  detailId: string,
  input: SpkItemApprovalRequest,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/spk/${spkId}/item/${detailId}`, {
    method: "PATCH",
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

  const payload = spkItemApprovalEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchSpkToday() {
  const response = await fetch(`${getApiBaseUrl()}/api/spk/today`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = spkTodayEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    data: payload.data,
  };
}

export async function fetchSpkSummary() {
  const response = await fetch(`${getApiBaseUrl()}/api/spk/summary`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = spkSummaryEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    data: payload.data,
  };
}
