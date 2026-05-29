import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildReportsQueryString,
  fetchReportGrid,
} from "@/shared/api/reports";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("reports api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds report query string with date range", () => {
    const query = buildReportsQueryString({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-15",
      filter: ["deliveryStatus:eq:DELAYED"],
      sortBy: "delayDays",
    });

    expect(query).toContain("dateFrom=2026-05-01");
    expect(query).toContain("dateTo=2026-05-15");
    expect(query).toContain("filter=deliveryStatus%3Aeq%3ADELAYED");
    expect(query).toContain("sortBy=delayDays");
  });

  it("parses report payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              unitName: "MB 500 SEL",
              delayDays: 2,
              deliveryStatus: "DELAYED",
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
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "delayDays",
            sortDirection: "desc",
            view: null,
            filters: [],
            dateFrom: "2026-05-01",
            dateTo: "2026-05-15",
          },
          definition: {
            type: "delivery-accuracy",
            title: "Delivery Accuracy",
            description: "Tracking akurasi delivery unit.",
            columns: [
              { key: "unitName", label: "Unit", kind: "mono", align: "left", sticky: true },
              { key: "delayDays", label: "Delay", kind: "number", align: "right", sticky: false },
              { key: "deliveryStatus", label: "Status", kind: "status", align: "left", sticky: false },
            ],
            sortOptions: [{ label: "Delay", value: "delayDays" }],
            filters: [],
            exportFormats: ["csv", "xlsx"],
          },
          summary: [
            {
              label: "Total Unit",
              value: "1",
              helper: "Rows in current query.",
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchReportGrid("session=abc", "delivery-accuracy", {});
    expect(result.status).toBe(200);
    expect(result.payload?.definition.type).toBe("delivery-accuracy");
    expect(result.payload?.data[0]?.deliveryStatus).toBe("DELAYED");
  });
});
