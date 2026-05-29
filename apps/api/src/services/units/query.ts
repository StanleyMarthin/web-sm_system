import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";

const UNIT_GRID_SORT_FIELDS = [
  "targetDeliveryDate",
  "unitName",
  "customerName",
  "etaDate",
  "riskLevel",
  "progressPercent",
  "remainingHours",
  "woOpenCount",
  "issueOpenCount",
  "status",
] as const;

const UNIT_GRID_FILTER_FIELDS = ["riskLevel", "status"] as const;

export type UnitGridSortField = (typeof UNIT_GRID_SORT_FIELDS)[number];
export type UnitGridFilterField = (typeof UNIT_GRID_FILTER_FIELDS)[number];

export interface UnitGridQuery extends GridQueryState {
  sortBy: UnitGridSortField;
  filters: Array<GridFilter & { field: UnitGridFilterField }>;
}

export function sanitizeUnitGridQuery(query: GridQueryState): UnitGridQuery {
  const sortBy = UNIT_GRID_SORT_FIELDS.includes(query.sortBy as UnitGridSortField)
    ? (query.sortBy as UnitGridSortField)
    : "targetDeliveryDate";

  const filters = query.filters.filter(
    (filter): filter is GridFilter & { field: UnitGridFilterField } =>
      UNIT_GRID_FILTER_FIELDS.includes(filter.field as UnitGridFilterField),
  );

  return {
    ...query,
    limit: Math.min(query.limit, 100),
    page: Math.max(query.page, 1),
    sortBy,
    filters,
  };
}
