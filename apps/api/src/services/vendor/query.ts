import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  vendorGridQuerySchema,
  vendorViewModeSchema,
  type VendorGridQuery,
} from "@smsystem/contracts/vendor";

const VALID_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "wovNumber",
  "unitName",
  "divisionName",
  "accTracking",
  "status",
  "vendorName",
  "targetDateReturn",
  "dateIn",
  "agingDays",
]);

const VALID_FILTER_FIELDS = new Set([
  "status",
  "accTracking",
  "divisionName",
  "vendorName",
]);

export function sanitizeVendorGridQuery(searchParams: URLSearchParams): VendorGridQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const viewMode = vendorViewModeSchema.parse(searchParams.get("viewMode") ?? "active");
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

  return vendorGridQuerySchema.parse({
    ...gridQuery,
    sortBy,
    sortDirection,
    filters,
    viewMode,
  });
}
