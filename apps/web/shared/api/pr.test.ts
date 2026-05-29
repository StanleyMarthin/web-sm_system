import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildPrGridQueryString, fetchPrGrid } from "@/shared/api/pr";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("pr api client", () => {
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
    const query = buildPrGridQueryString({
      filter: ["status:eq:OPEN"],
    });

    expect(query).toContain("viewMode=active");
    expect(query).toContain("filter=status%3Aeq%3AOPEN");
  });

  it("parses pr payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              prId: "PR-1",
              prNumber: "PRIN/001/05/2026",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionName: "INTERIOR",
              requestedBy: "SM-08.005",
              requestedByName: "Yudha Agustiana",
              accTracking: "PENDING_ADV",
              status: "OPEN",
              targetDate: null,
              priority: "NORMAL",
              notes: null,
              createdAt: "2026-05-15 09:00:00",
              updatedAt: "2026-05-15 09:00:00",
              totalItems: 1,
              totalQty: 2,
              totalEstimatedPrice: 1000000,
              totalActualPrice: 0,
              vendorSummary: "-",
              latestArrivalDate: null,
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
            huntingCount: 0,
            orderedCount: 0,
            criticalCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchPrGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.prId).toBe("PR-1");
    expect(result.payload?.summary.pendingApproval).toBe(1);
  });
});
