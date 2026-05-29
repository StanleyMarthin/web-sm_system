import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildWarehouseGridQueryString,
  createWarehouseStockAdjustment,
  createWarehouseStockOpname,
  fetchWarehouseStockAdjustments,
  fetchWarehouseStockOpnames,
  fetchWarehouseTransactions,
  readyWarehouseRequest,
} from "@/shared/api/warehouse";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("warehouse api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string for warehouse grid", () => {
    const query = buildWarehouseGridQueryString({
      tab: "transactions",
      filter: ["itemStatus:eq:OPEN"],
      search: "clip",
    });

    expect(query).toContain("tab=transactions");
    expect(query).toContain("filter=itemStatus%3Aeq%3AOPEN");
    expect(query).toContain("search=clip");
  });

  it("parses warehouse transaction payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              transactionId: "WH-1",
              transactionType: "PENGAMBILAN",
              itemCategory: "SPARE_PART",
              itemName: "Chrome clip",
              itemMasterId: null,
              itemAliasUsed: null,
              qty: 2,
              qtyReturned: null,
              uom: "pcs",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              employeeId: "SM-11.003",
              requesterName: "Asep Gudang",
              divisionId: 8,
              divisionName: "INTERIOR",
              stockCardId: null,
              sourceCarId: null,
              sourceUnitName: null,
              storageLocationId: null,
              locationLabel: null,
              locationDetail: null,
              requestDate: "2026-05-15 09:00:00",
              targetSearchDate: null,
              actualReleaseDate: null,
              deadlineDate: "2026-05-17",
              actualReturnDate: null,
              itemStatus: "OPEN",
              approvalStatus: "PENDING_KD",
              itemCondition: null,
              notes: null,
              picWarehouseName: null,
              accKdName: null,
              photoCount: 0,
              daysOverdue: null,
              isOverdue: false,
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
          references: {
            units: [],
            divisions: [],
            itemCategories: [],
            itemStatuses: [],
            approvalStatuses: [],
            transactionTypes: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "requestDate",
            sortDirection: "desc",
            view: "active",
            filters: [],
          },
          summary: {
            pendingApproval: 1,
            readyCount: 0,
            releasedCount: 0,
            overdueCount: 0,
            storedCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWarehouseTransactions("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.transactionId).toBe("WH-1");
    expect(result.payload?.summary.pendingApproval).toBe(1);
  });

  it("posts ready mutation to warehouse endpoint", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3203/api/warehouse/ready");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          transactionId: "WH-1",
          notes: "Siap ambil",
        }),
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            transactionId: "WH-1",
            approvalStatus: "APPROVED",
            itemStatus: "READY",
            transactionType: "PENGAMBILAN",
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await readyWarehouseRequest({
      transactionId: "WH-1",
      notes: "Siap ambil",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.itemStatus).toBe("READY");
    }
  });

  it("parses stock opname payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              opnameId: "OPN-1",
              opnameNo: "OPN/2026/05/0001",
              stockCardId: "SC-1",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              itemName: "Chrome clip",
              partCode: "CC-01",
              uom: "pcs",
              storageLocationId: 11,
              locationLabel: "A-01",
              expectedQty: 10,
              actualQty: 8,
              varianceQty: -2,
              findingStatus: "SHORT",
              itemCondition: "GOOD",
              countedAt: "2026-05-18",
              countedByName: "Asep Gudang",
              notes: "Kurang dua pcs",
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
          references: {
            units: [],
            divisions: [],
            itemCategories: [],
            itemStatuses: [],
            approvalStatuses: [],
            transactionTypes: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "countedAt",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWarehouseStockOpnames("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.opnameId).toBe("OPN-1");
  });

  it("posts stock opname mutation to warehouse endpoint", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3203/api/warehouse/opname");
      expect(init?.method).toBe("POST");

      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            opnameId: "OPN-NEW",
            opnameNo: "OPN/2026/05/0002",
            findingStatus: "SHORT",
            varianceQty: -1,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await createWarehouseStockOpname({
      stockCardId: "SC-1",
      carId: "CAR-1",
      itemName: "Bumper clip",
      partCode: "BC-01",
      uom: "pcs",
      storageLocationId: 12,
      expectedQty: 12,
      actualQty: 11,
      itemCondition: "GOOD",
      countedAt: "2026-05-20",
      notes: "Kurang satu",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.opnameId).toBe("OPN-NEW");
    }
  });

  it("parses stock adjustment payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              adjustmentId: "ADJ-1",
              adjustmentNo: "ADJ/2026/05/0001",
              opnameId: "OPN-1",
              stockCardId: "SC-1",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              itemName: "Chrome clip",
              partCode: "CC-01",
              uom: "pcs",
              qtyBefore: 10,
              qtyAfter: 8,
              adjustmentQty: -2,
              adjustmentReason: "OPNAME_CORRECTION",
              itemCondition: "GOOD",
              createdAt: "2026-05-18",
              createdByName: "Asep Gudang",
              notes: "Selisih opname",
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
          references: {
            units: [],
            divisions: [],
            itemCategories: [],
            itemStatuses: [],
            approvalStatuses: [],
            transactionTypes: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "createdAt",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWarehouseStockAdjustments("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.adjustmentId).toBe("ADJ-1");
  });

  it("posts stock adjustment mutation to warehouse endpoint", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3203/api/warehouse/adjustments");
      expect(init?.method).toBe("POST");

      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            adjustmentId: "ADJ-NEW",
            adjustmentNo: "ADJ/2026/05/0002",
            adjustmentQty: -2,
            adjustmentReason: "OPNAME_CORRECTION",
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await createWarehouseStockAdjustment({
      opnameId: "OPN-1",
      stockCardId: "SC-1",
      carId: "CAR-1",
      itemName: "Bumper clip",
      partCode: "BC-01",
      uom: "pcs",
      qtyBefore: 12,
      qtyAfter: 10,
      adjustmentReason: "OPNAME_CORRECTION",
      itemCondition: "GOOD",
      notes: "Selisih opname",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.adjustmentId).toBe("ADJ-NEW");
    }
  });
});
