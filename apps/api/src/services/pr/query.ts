import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  prGridQuerySchema,
  prViewModeSchema,
  type PrGridQuery,
} from "@smsystem/contracts/pr";

const VALID_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "prNumber",
  "unitName",
  "divisionName",
  "accTracking",
  "status",
  "totalItems",
  "totalQty",
  "totalEstimatedPrice",
  "totalActualPrice",
  "latestArrivalDate",
  "agingDays",
]);

const VALID_FILTER_FIELDS = new Set([
  "status",
  "accTracking",
  "divisionName",
  "vendorSummary",
]);

export function sanitizePrGridQuery(searchParams: URLSearchParams): PrGridQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const viewMode = prViewModeSchema.parse(searchParams.get("viewMode") ?? "active");
  const sortBy = VALID_SORT_FIELDS.has(gridQuery.sortBy)
    ? gridQuery.sortBy
    : "createdAt";
  const sortDirection =
    sortBy === "createdAt" && (!searchParams.has("sortBy") || gridQuery.sortBy !== sortBy)
      ? "desc"
      : gridQuery.sortDirection;
  const filters = gridQuery.filters.filter((filter) =>
    VALID_FILTER_FIELDS.has(filter.field),
  );

  return prGridQuerySchema.parse({
    ...gridQuery,
    sortBy,
    sortDirection,
    filters,
    viewMode,
  });
}
