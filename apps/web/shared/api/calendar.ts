import type {
  CalendarDayOverrideRequest,
  WeeklyWorkConfigRequest,
} from "@smsystem/contracts/calendar";
import {
  calendarDayOverrideEnvelopeSchema,
  calendarDayOverrideListEnvelopeSchema,
  capacityPreviewEnvelopeSchema,
  deliveryRiskEnvelopeSchema,
  unitEtaEnvelopeSchema,
  weeklyWorkConfigRecordSchema,
  weeklyConfigListEnvelopeSchema,
  workingDaysEnvelopeSchema,
} from "@smsystem/contracts/calendar";
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
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
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

export function buildDeliveryRiskQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("page")) {
    params.set("page", "1");
  }

  if (!params.has("limit")) {
    params.set("limit", "25");
  }

  return params.toString();
}

export async function fetchWeeklyConfigs(cookieHeader: string) {
  const response = await fetchWithCookie("/api/calendar/weekly-config", cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: weeklyConfigListEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function upsertWeeklyConfig(input: WeeklyWorkConfigRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/calendar/weekly-config`, {
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

  const payload = (await response.json()) as {
    data: unknown;
  };

  return {
    success: true as const,
    result: weeklyWorkConfigRecordSchema.parse(payload.data),
  };
}

export async function fetchWorkingDays(
  cookieHeader: string,
  input: {
    startDate: string;
    endDate: string;
    includeOvertime?: boolean;
  },
) {
  const params = new URLSearchParams({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (input.includeOvertime) {
    params.set("includeOvertime", "true");
  }

  const response = await fetchWithCookie(
    `/api/calendar/working-days?${params.toString()}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: workingDaysEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchCalendarDayOverrides(
  cookieHeader: string,
  input: {
    startDate: string;
    endDate: string;
  },
) {
  const params = new URLSearchParams({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  const response = await fetchWithCookie(
    `/api/calendar/day-overrides?${params.toString()}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: calendarDayOverrideListEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function upsertCalendarDayOverride(input: CalendarDayOverrideRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/calendar/day-overrides`, {
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

  const payload = calendarDayOverrideEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function simulateCapacity(input: {
  divisionId: number;
  date: string;
  activePicCount: number;
  includeOvertime?: boolean;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/calendar/simulate-capacity`, {
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

  const payload = capacityPreviewEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchUnitEta(cookieHeader: string, carId: string, asOfDate?: string) {
  const suffix = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : "";
  const response = await fetchWithCookie(`/api/planning/eta/${carId}${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: unitEtaEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchDeliveryRisk(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildDeliveryRiskQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(`/api/planning/delivery-risk${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: deliveryRiskEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}
