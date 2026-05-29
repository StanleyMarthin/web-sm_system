import type { QaUpdateInspectionRequest } from "@smsystem/contracts/qa";
import {
  qaGridEnvelopeSchema,
  qaMutationEnvelopeSchema,
} from "@smsystem/contracts/qa";
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

function buildQaGridQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("page")) params.set("page", "1");
  if (!params.has("limit")) params.set("limit", "25");
  if (!params.has("sortBy")) params.set("sortBy", "inspectionDate");
  if (!params.has("sortDirection")) params.set("sortDirection", "desc");

  return params.toString();
}

export async function fetchQaPortal(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildQaGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetch(`${getApiBaseUrl()}/api/qa/inspections${suffix}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: qaGridEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function updateQaInspection(qcId: string, input: QaUpdateInspectionRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/qa/inspections/${qcId}`, {
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

  const payload = qaMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
