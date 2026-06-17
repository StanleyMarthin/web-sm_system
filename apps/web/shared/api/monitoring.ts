import {
  createMonitoringActualRequestSchema,
  monitoringDivisionDetailEnvelopeSchema,
  monitoringDivisionEnvelopeSchema,
  monitoringActualMutationEnvelopeSchema,
  monitoringGridEnvelopeSchema,
  monitoringTaskListEnvelopeSchema,
  monitoringUnitEnvelopeSchema,
} from "@smsystem/contracts/monitoring";
import type { CreateMonitoringActualRequest } from "@smsystem/contracts/monitoring";
import { getApiBaseUrl } from "@/shared/api/config";

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

async function fetchWithCookie(path: string, cookieHeader: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      credentials: "include",
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    return response;
  } catch {
    return null;
  }
}

export function buildMonitoringGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("page")) {
    params.set("page", "1");
  }

  if (!params.has("limit")) {
    params.set("limit", "25");
  }

  if (!params.has("date")) {
    params.set("date", getTodayIsoDate());
  }

  return params.toString();
}

async function fetchMonitoringGridRoute(
  routePath: string,
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildMonitoringGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(`${routePath}${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: monitoringGridEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

async function fetchMonitoringTaskRoute(
  routePath: string,
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildMonitoringGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(`${routePath}${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: monitoringTaskListEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export function fetchMonitoringToday(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchMonitoringGridRoute("/api/monitoring/today", cookieHeader, searchParams);
}

export function fetchMonitoringOvertime(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchMonitoringGridRoute(
    "/api/monitoring/overtime",
    cookieHeader,
    searchParams,
  );
}

export async function fetchMonitoringDivision(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildMonitoringGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(
    `/api/monitoring/division${suffix}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: monitoringDivisionEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchMonitoringUnit(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildMonitoringGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(
    `/api/monitoring/unit${suffix}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: monitoringUnitEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchMonitoringDivisionDetail(
  divisionId: string,
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildMonitoringGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(
    `/api/monitoring/division/${divisionId}${suffix}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: monitoringDivisionDetailEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export function fetchMonitoringNoStart(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchMonitoringTaskRoute("/api/monitoring/no-start", cookieHeader, searchParams);
}

export function fetchMonitoringNoSubmit(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  return fetchMonitoringTaskRoute("/api/monitoring/no-submit", cookieHeader, searchParams);
}

export async function fetchMonitoringEmployee(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = toUrlSearchParams(searchParams);
  
  if (!params.has("date")) {
    params.set("date", getTodayIsoDate());
  }

  const response = await fetch(`${getApiBaseUrl()}/api/monitoring/employee?${params.toString()}`, {
    headers: {
      cookie: cookieHeader,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: await response.json(),
    status: response.status,
  };
}

async function parseFailure(response: Response) {
  try {
    return (await response.json()) as { message?: string; errorCode?: string };
  } catch {
    return { message: "Response API tidak valid.", errorCode: "INVALID_RESPONSE" };
  }
}

export async function createMonitoringActual(input: CreateMonitoringActualRequest) {
  const parsed = createMonitoringActualRequestSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/api/monitoring/actual`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsed),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      success: false as const,
      message: failure.message ?? "Actual belum bisa disimpan.",
      errorCode: failure.errorCode,
    };
  }

  const payload = monitoringActualMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
