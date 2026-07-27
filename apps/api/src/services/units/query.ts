import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import { sanitizeGridQuery } from "@/services/shared/grid.utils";

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
  return sanitizeGridQuery(
    query,
    UNIT_GRID_SORT_FIELDS,
    UNIT_GRID_FILTER_FIELDS,
    "targetDeliveryDate",
  );
}
