import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  woGridQuerySchema,
  woViewModeSchema,
  type WoGridQuery,
} from "@smsystem/contracts/wo";

const VALID_SORT_FIELDS = new Set([
  "requestDate",
  "status",
  "unitName",
  "fromDivisionName",
  "toDivisionName",
  "estimatedHours",
  "agingHours",
  "agingScore",
  "createdAt",
]);
const VALID_FILTER_FIELDS = new Set([
  "status",
  "fromDivisionId",
  "toDivisionId",
  "isPriority",
]);

export function sanitizeWoGridQuery(searchParams: URLSearchParams): WoGridQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const viewMode = woViewModeSchema.parse(searchParams.get("viewMode") ?? "active");
  const sortBy = VALID_SORT_FIELDS.has(gridQuery.sortBy)
    ? gridQuery.sortBy
    : "requestDate";
  const sortDirection =
    sortBy === "requestDate" && (!searchParams.has("sortBy") || gridQuery.sortBy !== sortBy)
      ? "desc"
      : gridQuery.sortDirection;
  const filters = gridQuery.filters.filter((filter) =>
    VALID_FILTER_FIELDS.has(filter.field),
  );

  return woGridQuerySchema.parse({
    ...gridQuery,
    sortBy,
    sortDirection,
    filters,
    viewMode,
  });
}
