import {
  countdownCreateRequestSchema,
  countdownBoardEnvelopeSchema,
  countdownDetailEnvelopeSchema,
  countdownImportEnvelopeSchema,
  countdownRevisionDecisionSchema,
  countdownRevisionRequestSchema,
  countdownUpdateRequestSchema,
} from "@smsystem/contracts/countdown";
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
    return (await response.json()) as ApiFailure;
  } catch {
    return {
      success: false,
      message: "Response API tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

export function buildCountdownGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchCountdownBoard(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildCountdownGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/countdown${suffix}`, {
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
      payload: countdownBoardEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchCountdownDetail(cookieHeader: string, countdownId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/countdown/${countdownId}`, {
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
      payload: countdownDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createCountdownRecord(
  input: Parameters<typeof countdownCreateRequestSchema.parse>[0],
) {
  const payload = countdownCreateRequestSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/api/countdown`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
    payload: countdownDetailEnvelopeSchema.parse(await response.json()),
  };
}

export async function updateCountdownRecord(
  countdownId: string,
  input: Parameters<typeof countdownUpdateRequestSchema.parse>[0],
) {
  const payload = countdownUpdateRequestSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/api/countdown/${countdownId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
    payload: countdownDetailEnvelopeSchema.parse(await response.json()),
  };
}

export async function deleteCountdownRecord(countdownId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/countdown/${countdownId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
  };
}

async function submitCountdownRevisionAction(
  countdownId: string,
  path: string,
  method: "POST" | "PUT",
  input: Record<string, unknown>,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/countdown/${countdownId}/${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ...(await parseFailure(response)), success: false as const };
  return { success: true as const };
}

export function requestCountdownRevision(
  countdownId: string,
  input: { requestedHours: number; requestedDeadline: string; reason: string },
) {
  return submitCountdownRevisionAction(countdownId, "revision", "POST", countdownRevisionRequestSchema.parse(input));
}

export function approveCountdownRevision(
  countdownId: string,
  input: { isApproved: boolean; approvedHours: number; approvedDeadline: string },
) {
  return submitCountdownRevisionAction(countdownId, "revision/approval", "PUT", countdownRevisionDecisionSchema.parse(input));
}

export async function uploadCountdownWorkbook(file: File, params: { unitId: string }) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("unitId", params.unitId);

  const response = await fetch(`${getApiBaseUrl()}/api/countdown/import`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = countdownImportEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function downloadCountdownTemplate(params: { unitId: string }) {
  const qs = toUrlSearchParams({ unitId: params.unitId }).toString();
  const response = await fetch(`${getApiBaseUrl()}/api/countdown/template?${qs}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `countdown-template-${params.unitId}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return {
    success: true as const,
  };
}

export async function downloadCountdownWorkbook(params: { unitId: string; divisionId?: string; status?: string }) {
  const query: Record<string, string> = { unitId: params.unitId };
  if (params.divisionId) query.divisionId = params.divisionId;
  if (params.status) query.status = params.status;
  const qs = toUrlSearchParams(query).toString();
  
  const response = await fetch(`${getApiBaseUrl()}/api/countdown/download?${qs}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `countdown-export-${params.unitId}${params.divisionId ? `-${params.divisionId}` : ""}${params.status ? `-${params.status}` : ""}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return {
    success: true as const,
  };
}
