import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  warehouseTransactionQuerySchema,
  type WarehouseTransactionQuery,
} from "@smsystem/contracts/warehouse";

const VALID_TRANSACTION_SORT_FIELDS = new Set([
  "requestDate",
  "deadlineDate",
  "actualReleaseDate",
  "unitName",
  "requesterName",
  "itemName",
  "itemStatus",
  "approvalStatus",
  "itemCategory",
  "transactionType",
  "qty",
]);

const VALID_GRID_SORT_FIELDS = new Set([
  "dateIn",
  "entryNo",
  "partName",
  "status",
  "itemName",
  "itemCode",
  "itemCategory",
  "latestPrice",
  "usageCount",
  "updatedAt",
  "usageDate",
  "unitName",
  "divisionName",
  "employeeName",
  "totalPrice",
  "label",
  "locationType",
  "zone",
  "rack",
  "itemCount",
  "countedAt",
  "expectedQty",
  "actualQty",
  "varianceQty",
  "findingStatus",
  "createdAt",
  "qtyBefore",
  "qtyAfter",
  "adjustmentQty",
  "adjustmentReason",
]);

const VALID_TRANSACTION_FILTER_FIELDS = new Set([
  "itemCategory",
  "itemStatus",
  "approvalStatus",
  "transactionType",
  "divisionId",
]);

const VALID_GENERIC_FILTER_FIELDS = new Set(["itemCategory", "divisionId"]);

function resolveSortBy(
  searchParams: URLSearchParams,
  fallback: string,
  validFields: Set<string>,
) {
  const gridQuery = parseGridQueryParams(searchParams);
  return validFields.has(gridQuery.sortBy) ? gridQuery.sortBy : fallback;
}

function resolveSortDirection(searchParams: URLSearchParams) {
  return parseGridQueryParams(searchParams).sortDirection;
}

export function sanitizeWarehouseTransactionsQuery(
  searchParams: URLSearchParams,
): WarehouseTransactionQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const filters = gridQuery.filters.filter((filter) =>
    VALID_TRANSACTION_FILTER_FIELDS.has(filter.field),
  );
  const requestedView = searchParams.get("view");
  const view =
    requestedView &&
    ["active", "pending", "prepare", "ready", "field", "returned", "overdue", "all"].includes(
      requestedView,
    )
      ? requestedView
      : "active";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  return warehouseTransactionQuerySchema.parse({
    ...gridQuery,
    sortBy: resolveSortBy(searchParams, "requestDate", VALID_TRANSACTION_SORT_FIELDS),
    sortDirection: resolveSortDirection(searchParams),
    filters,
    view,
    dateFrom,
    dateTo,
  });
}

export function sanitizeWarehouseGenericGridQuery(
  searchParams: URLSearchParams,
  fallbackSortBy: string,
): WarehouseTransactionQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const filters = gridQuery.filters.filter((filter) =>
    VALID_GENERIC_FILTER_FIELDS.has(filter.field),
  );

  return warehouseTransactionQuerySchema.parse({
    ...gridQuery,
    sortBy: resolveSortBy(searchParams, fallbackSortBy, VALID_GRID_SORT_FIELDS),
    sortDirection: resolveSortDirection(searchParams),
    filters,
    view: null,
  });
}
