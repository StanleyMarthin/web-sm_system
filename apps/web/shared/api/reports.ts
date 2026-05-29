import { reportGridEnvelopeSchema, type ReportType } from "@smsystem/contracts/reports";
import { getApiBaseUrl } from "@/shared/api/config";

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

export function buildReportsQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchReportGrid(
  cookieHeader: string,
  type: ReportType,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildReportsQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/reports/${type}${suffix}`, {
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
      payload: reportGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}
