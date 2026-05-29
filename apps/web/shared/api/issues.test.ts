import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildIssueGridQueryString, fetchIssueGrid } from "@/shared/api/issues";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("issues api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string for issue filters", () => {
    const query = buildIssueGridQueryString({
      filter: ["status:eq:OPEN"],
    });

    expect(query).toContain("filter=status%3Aeq%3AOPEN");
  });

  it("parses issue payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          storageReady: true,
          data: [
            {
              issueId: "ISSUE-1",
              issueNumber: "ISS-20260514-001",
              sourceType: "MANUAL",
              sourceRefId: null,
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              countdownId: null,
              planId: null,
              qcId: null,
              ledgerId: null,
              issueType: "HAMBATAN",
              severity: "HIGH",
              title: "Parts belum datang",
              description: "Perlu follow-up vendor.",
              status: "OPEN",
              isUrgent: true,
              assignedTo: null,
              assignedToName: null,
              reportedBy: "SM-08.005",
              reportedByName: "Yudha Agustiana",
              createdAt: "2026-05-14 09:00:00",
              updatedAt: "2026-05-14 09:00:00",
              resolutionNotes: null,
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
            sortBy: "createdAt",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
          references: {
            units: [],
            divisions: [],
            statuses: [],
            severities: [],
            employees: [],
          },
          summary: {
            openCount: 1,
            urgentCount: 1,
            escalatedCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchIssueGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.issueId).toBe("ISSUE-1");
    expect(result.payload?.summary.urgentCount).toBe(1);
  });
});
