import { dashboardSummaryEnvelopeSchema } from "@smsystem/contracts/dashboard";
import { getApiBaseUrl } from "@/shared/api/config";

async function fetchWithCookie(path: string, cookieHeader: string) {
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export interface DashboardFilterParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  divisionId?: string;
  unitId?: string;
}

export async function fetchDashboardSummary(
  cookieHeader: string,
  filters?: DashboardFilterParams,
) {
  const params = new URLSearchParams();
  if (filters?.date?.trim())       params.set("date",       filters.date.trim());
  if (filters?.dateFrom?.trim())   params.set("dateFrom",   filters.dateFrom.trim());
  if (filters?.dateTo?.trim())     params.set("dateTo",     filters.dateTo.trim());
  if (filters?.divisionId?.trim()) params.set("divisionId", filters.divisionId.trim());
  if (filters?.unitId?.trim())     params.set("unitId",     filters.unitId.trim());

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetchWithCookie(`/api/dashboard/summary${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return { payload: null, status: response?.status ?? 503 };
  }

  return {
    payload: dashboardSummaryEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}
