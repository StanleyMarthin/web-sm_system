import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildQcGridQueryString, fetchQcQueue } from "@/shared/api/qc";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("qc api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string for qc filters", () => {
    const query = buildQcGridQueryString({
      filter: ["divisionId:eq:12"],
    });

    expect(query).toContain("page=1");
    expect(query).toContain("filter=divisionId%3Aeq%3A12");
  });

  it("parses ready qc payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              coreId: "CD-1",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelId: 459,
              panelName: "Dashboard",
              taskCategory: "MAIN",
              jobName: "Pasang dashboard",
              countdownStatus: "READY_QC",
              qcLastStatus: null,
              qcLevel: null,
              latestQcId: null,
              refWoId: null,
              waitingHours: 2,
              remainingHours: 2,
              targetHours: 4,
              deadlineDate: "2026-05-14",
              latestInspectionDate: null,
              latestInspectionNotes: null,
              photoBeforeUrl: null,
              evidencePhotoUrl: null,
              reworkPlanId: null,
              reworkTaskDate: null,
              reworkAssignedUserId: null,
              reworkAssignedUserName: null,
              reworkPlanStatus: null,
              linkedIssueId: null,
              openIssueCount: 0,
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
            sortBy: "waitingHours",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
          references: {
            divisions: [],
            units: [],
            statuses: [],
            qcLevels: [],
          },
          summary: {
            readyCount: 1,
            recheckCount: 0,
            activeReworkCount: 0,
            finalReadyUnits: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchQcQueue("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.coreId).toBe("CD-1");
    expect(result.payload?.summary.readyCount).toBe(1);
  });
});
