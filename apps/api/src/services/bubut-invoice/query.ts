import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  bubutInvoiceCombinedStatusSchema,
  bubutInvoiceTypeSchema,
  bubutInvoiceWorkOrderQuerySchema,
  type BubutInvoiceWorkOrderQuery,
} from "@smsystem/contracts/bubut-invoice";

const VALID_SORT_FIELDS = new Set([
  "woDate",
  "workDate",
  "sourceWobNo",
  "teamName",
  "carType",
  "operatorName",
  "divisionName",
  "totalWorkHourDecimal",
  "materialTotal",
  "totalPriceBubut",
]);
const VALID_FILTER_FIELDS = new Set([
  "invoiceStatus",
  "invoiceType",
  "sourceWobNo",
  "teamName",
  "carType",
  "operatorName",
  "divisionName",
  "sparepartName",
]);

function nullableParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key)?.trim();
  return value ? value : null;
}

export function sanitizeBubutInvoiceWorkOrderQuery(
  searchParams: URLSearchParams,
): BubutInvoiceWorkOrderQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const rawSortBy = gridQuery.sortBy;
  const rawSortDirection = gridQuery.sortDirection;
  const invoiceStatus = nullableParam(searchParams, "invoiceStatus");
  const invoiceType = nullableParam(searchParams, "invoiceType");
  const filters = gridQuery.filters.filter((filter) =>
    VALID_FILTER_FIELDS.has(filter.field),
  );
  const statusFilter = filters.find((filter) => filter.field === "invoiceStatus")?.value;
  const typeFilter = filters.find((filter) => filter.field === "invoiceType")?.value;

  return bubutInvoiceWorkOrderQuerySchema.parse({
    page: gridQuery.page,
    limit: gridQuery.limit,
    search: gridQuery.search,
    sortBy: VALID_SORT_FIELDS.has(rawSortBy) ? rawSortBy : "woDate",
    sortDirection: rawSortDirection === "asc" ? "asc" : "desc",
    view: gridQuery.view,
    filters,
    woDateFrom: nullableParam(searchParams, "woDateFrom"),
    woDateTo: nullableParam(searchParams, "woDateTo"),
    workDateFrom: nullableParam(searchParams, "workDateFrom"),
    workDateTo: nullableParam(searchParams, "workDateTo"),
    team: nullableParam(searchParams, "team"),
    carId: nullableParam(searchParams, "carId"),
    sparepartName: nullableParam(searchParams, "sparepartName"),
    operatorId: nullableParam(searchParams, "operatorId"),
    invoiceStatus: invoiceStatus || statusFilter
      ? bubutInvoiceCombinedStatusSchema.parse(invoiceStatus || statusFilter)
      : null,
    invoiceType: invoiceType || typeFilter
      ? bubutInvoiceTypeSchema.parse(invoiceType || typeFilter)
      : null,
  });
}
