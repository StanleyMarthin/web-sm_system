import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import { sanitizeGridQuery } from "@/services/shared/grid.utils";

const USER_GRID_SORT_FIELDS = [
  "employeeId",
  "fullName",
  "email",
  "roleName",
  "divisionName",
  "grade",
  "status",
  "lastLoginAt",
  "deviceCount",
  "createdAt",
] as const;

const USER_GRID_FILTER_FIELDS = ["status", "roleId", "divisionId"] as const;

export type UserGridSortField = (typeof USER_GRID_SORT_FIELDS)[number];
export type UserGridFilterField = (typeof USER_GRID_FILTER_FIELDS)[number];

export interface UserGridQuery extends GridQueryState {
  sortBy: UserGridSortField;
  filters: Array<GridFilter & { field: UserGridFilterField }>;
}

export function sanitizeUserGridQuery(query: GridQueryState): UserGridQuery {
  return sanitizeGridQuery(
    query,
    USER_GRID_SORT_FIELDS,
    USER_GRID_FILTER_FIELDS,
    "employeeId",
  );
}
