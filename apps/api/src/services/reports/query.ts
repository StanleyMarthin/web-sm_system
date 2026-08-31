import type { ReportQuery, ReportType } from "@smsystem/contracts/reports";
import { reportQuerySchema } from "@smsystem/contracts/reports";
import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { getReportConfig } from "@/services/reports/definitions";

function resolveDate(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function sanitizeReportQuery(
  type: ReportType,
  searchParams: URLSearchParams,
): ReportQuery {
  const config = getReportConfig(type);
  const gridQuery = parseGridQueryParams(searchParams);
  const allowedSorts = new Set(config.sortOptions.map((option) => option.value));
  const allowedFilters = new Set(config.filterConfigs.map((filter) => filter.field));
  const filters = gridQuery.filters.filter((filter) => allowedFilters.has(filter.field));
  const defaultDate = type === "ar-labour" ? todayInJakarta() : null;

  return reportQuerySchema.parse({
    ...gridQuery,
    sortBy: allowedSorts.has(gridQuery.sortBy)
      ? gridQuery.sortBy
      : config.defaultSortBy,
    sortDirection: gridQuery.sortDirection || config.defaultSortDirection,
    filters,
    dateFrom: resolveDate(searchParams.get("dateFrom")) ?? defaultDate,
    dateTo: resolveDate(searchParams.get("dateTo")) ?? defaultDate,
  });
}
