import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  spkGridQuerySchema,
  type SpkGridQuery,
} from "@smsystem/contracts/spk";

const DEFAULT_DATE = "2026-01-01";
const VALID_SORT_FIELDS = new Set([
  "spkDate",
  "status",
  "totalUnits",
  "totalHours",
  "createdAt",
  "submittedAt",
  "approvedAt",
  "activatedAt",
]);
const VALID_FILTER_FIELDS = new Set(["status"]);

function parseIsoDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value.trim())) {
    return DEFAULT_DATE;
  }

  return value.trim();
}

export function sanitizeSpkGridQuery(searchParams: URLSearchParams): SpkGridQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const date = parseIsoDate(searchParams.get("date"));
  const sortBy = VALID_SORT_FIELDS.has(gridQuery.sortBy)
    ? gridQuery.sortBy
    : "spkDate";
  const sortDirection =
    sortBy === "spkDate" && (!searchParams.has("sortBy") || gridQuery.sortBy !== sortBy)
      ? "desc"
      : gridQuery.sortDirection;
  const filters = gridQuery.filters.filter((filter) =>
    VALID_FILTER_FIELDS.has(filter.field),
  );

  return spkGridQuerySchema.parse({
    ...gridQuery,
    sortBy,
    sortDirection,
    filters,
    date,
  });
}
