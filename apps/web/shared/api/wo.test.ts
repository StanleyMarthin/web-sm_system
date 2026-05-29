import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildWoGridQueryString,
  fetchWoGrid,
} from "@/shared/api/wo";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("wo api client", () => {
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
    const query = buildWoGridQueryString({
      filter: ["status:eq:APPROVED"],
    });

    expect(query).toContain("viewMode=active");
    expect(query).toContain("filter=status%3Aeq%3AAPPROVED");
  });

  it("parses wo payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              woId: "WO-1",
              woNumber: "WO/001/05/2026",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              fromDivisionId: 12,
              fromDivisionName: "INTERIOR",
              toDivisionId: 13,
              toDivisionName: "MEKANIK",
              panelName: "Dashboard",
              jobDetail: "Turunkan mesin",
              estimatedHours: 4,
              isPriority: true,
              status: "SUBMITTED",
              requestDate: "2026-05-14",
              approvalDate: null,
              createdAt: "2026-05-14 09:00:00",
              notes: null,
              picId: null,
              picName: null,
              approverId: null,
              linkedCountdownId: null,
              linkedCountdownStatus: null,
              agingHours: 6,
              agingScore: 72,
              isUrgent: true,
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
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "requestDate",
            sortDirection: "desc",
            view: null,
            filters: [],
            viewMode: "active",
          },
          summary: {
            pendingApproval: 1,
            approvedOpen: 0,
            urgentCount: 1,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWoGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.woId).toBe("WO-1");
    expect(result.payload?.summary.urgentCount).toBe(1);
  });
});
