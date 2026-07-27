import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";

export function sanitizeGridQuery<
  SortField extends string,
  FilterField extends string,
>(
  query: GridQueryState,
  sortFields: readonly SortField[],
  filterFields: readonly FilterField[],
  fallbackSortBy: SortField,
): GridQueryState & {
  sortBy: SortField;
  filters: Array<GridFilter & { field: FilterField }>;
} {
  const sortBy = sortFields.includes(query.sortBy as SortField)
    ? (query.sortBy as SortField)
    : fallbackSortBy;

  const filters = query.filters.filter(
    (filter): filter is GridFilter & { field: FilterField } =>
      filterFields.includes(filter.field as FilterField),
  );

  return {
    ...query,
    limit: Math.min(query.limit, 100),
    page: Math.max(query.page, 1),
    sortBy,
    filters,
  };
}
