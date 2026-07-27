import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import { sanitizeGridQuery } from "@/services/shared/grid.utils";

const COUNTDOWN_GRID_SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "unitName",
  "divisionName",
  "sectionName",
  "taskCategory",
  "status",
  "deadlineDate",
  "remainingHours",
  "actualProgressPercent",
] as const;

const COUNTDOWN_GRID_FILTER_FIELDS = [
  "status",
  "taskCategory",
  "divisionId",
  "unitId",
  "panelId",
  "sectionName",
  "jobTypeId",
] as const;

export type CountdownGridSortField = (typeof COUNTDOWN_GRID_SORT_FIELDS)[number];
export type CountdownGridFilterField = (typeof COUNTDOWN_GRID_FILTER_FIELDS)[number];

export interface CountdownGridQuery extends GridQueryState {
  sortBy: CountdownGridSortField;
  filters: Array<GridFilter & { field: CountdownGridFilterField }>;
}

export function sanitizeCountdownGridQuery(query: GridQueryState): CountdownGridQuery {
  return sanitizeGridQuery(
    query,
    COUNTDOWN_GRID_SORT_FIELDS,
    COUNTDOWN_GRID_FILTER_FIELDS,
    "updatedAt",
  );
}
