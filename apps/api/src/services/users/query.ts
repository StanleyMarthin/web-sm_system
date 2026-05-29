import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";

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
  const sortBy = USER_GRID_SORT_FIELDS.includes(query.sortBy as UserGridSortField)
    ? (query.sortBy as UserGridSortField)
    : "employeeId";

  const filters = query.filters.filter(
    (filter): filter is GridFilter & { field: UserGridFilterField } =>
      USER_GRID_FILTER_FIELDS.includes(filter.field as UserGridFilterField),
  );

  return {
    ...query,
    limit: Math.min(query.limit, 100),
    page: Math.max(query.page, 1),
    sortBy,
    filters,
  };
}
