import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildVendorGridQueryString, fetchVendorGrid } from "@/shared/api/vendor";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("vendor api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string with default active view", () => {
    const query = buildVendorGridQueryString({
      filter: ["status:eq:OPEN"],
    });

    expect(query).toContain("viewMode=active");
    expect(query).toContain("filter=status%3Aeq%3AOPEN");
  });

  it("parses vendor payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              wovId: "WOV-1",
              wovNumber: "WOV/001/05/2026",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              coreId: null,
              prId: null,
              divisionName: "INTERIOR",
              requestedBy: "SM-17.001",
              requestedByName: "Ruhiat",
              accTracking: "PENDING_ADV",
              status: "OPEN",
              vendorId: null,
              vendorName: "Vendor A",
              picVendor: null,
              itemName: "Bumper chrome",
              quantity: 1,
              uom: "pcs",
              goodsConditionOut: "Retak halus",
              goodsConditionIn: null,
              dateOut: "2026-05-15",
              targetDateReturn: "2026-05-20",
              dateIn: null,
              qcStatus: null,
              estimatedCost: 2000000,
              actualCost: null,
              remarks: null,
              createdAt: "2026-05-15 09:00:00",
              updatedAt: "2026-05-15 09:00:00",
              agingDays: 0,
              riskScore: 30,
              isCritical: false,
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
            statuses: [],
            approvalStages: [],
            vendors: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "createdAt",
            sortDirection: "desc",
            view: null,
            filters: [],
            viewMode: "active",
          },
          summary: {
            pendingApproval: 1,
            activeVendorCount: 1,
            overdueCount: 0,
            reworkCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchVendorGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.wovId).toBe("WOV-1");
    expect(result.payload?.summary.activeVendorCount).toBe(1);
  });
});
