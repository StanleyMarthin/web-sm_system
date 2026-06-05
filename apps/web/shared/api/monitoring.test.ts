import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildMonitoringGridQueryString, fetchMonitoringDivision, fetchMonitoringDivisionDetail, fetchMonitoringToday } from "@/shared/api/monitoring";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("monitoring api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string with default date", () => {
    const query = buildMonitoringGridQueryString({
      filter: ["divisionId:eq:12"],
    });

    expect(query).toContain("page=1");
    expect(query).toContain("filter=divisionId%3Aeq%3A12");
  });

  it("parses monitoring payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              planId: "PLAN-1",
              coreId: "CD-1",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              employeeId: "SM-11.002",
              employeeName: "Agus Rusmawan",
              taskDate: "2026-05-14",
              panelName: "Dashboard",
              masterJobName: "Turun Dashboard",
              jobDescription: "Turunkan dashboard",
              instructionText: "Turunkan dashboard",
              targetDailyHours: 4,
              targetTotalHours: 8,
              planStatus: "ONPROGRESS",
              actualStatus: "onprogress",
              executionStatus: "ONPROGRESS",
              countdownStatus: "PROSES",
              progressPercent: 25,
              totalActualHours: 1.5,
              remainingHours: 6.5,
              latestStartTime: "2026-05-14 08:00:00",
              latestFinishTime: null,
              latestBreakDurationMinutes: 0,
              actualStartTime: "2026-05-14 08:00:00",
              actualBreakMinutes: 0,
              actualFinishTime: null,
              actualDurationHours: null,
              qcStatus: "BELUM_QC",
              qcResult: null,
              qcNotes: null,
              monitoringStatus: null,
              monitoringResult: null,
              isOvertime: false,
              isStarted: true,
              isSubmitted: false,
              hasDelayRisk: true,
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
            sortBy: "taskDate",
            sortDirection: "desc",
            view: null,
            filters: [],
            date: "2026-05-14",
          },
          references: {
            divisions: [],
            units: [],
            employees: [],
          },
          summary: {
            activeWork: 1,
            noStart: 0,
            noSubmit: 1,
            delayRisk: 1,
            overtimeCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchMonitoringToday("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.planId).toBe("PLAN-1");
    expect(result.payload?.summary.noSubmit).toBe(1);
  });

  it("parses legacy monitoring payload while API is stale", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              planId: "PLAN-1",
              coreId: "CD-1",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              employeeId: "SM-11.002",
              employeeName: "Agus Rusmawan",
              taskDate: "2026-05-14",
              panelName: "Dashboard",
              jobDescription: "Turunkan dashboard",
              planStatus: "ONPROGRESS",
              actualStatus: "onprogress",
              countdownStatus: "PROSES",
              progressPercent: 25,
              totalActualHours: 1.5,
              remainingHours: 6.5,
              latestStartTime: "2026-05-14 08:00:00",
              latestFinishTime: null,
              isOvertime: false,
              isStarted: true,
              isSubmitted: false,
              hasDelayRisk: true,
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
            sortBy: "taskDate",
            sortDirection: "desc",
            view: null,
            filters: [],
            date: "2026-05-14",
          },
          references: {
            divisions: [],
            units: [],
            employees: [],
          },
          summary: {
            activeWork: 1,
            noStart: 0,
            noSubmit: 1,
            delayRisk: 1,
            overtimeCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchMonitoringToday("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.executionStatus).toBe("ONPROGRESS");
    expect(result.payload?.data[0]?.masterJobName).toBe("Turunkan dashboard");
    expect(result.payload?.data[0]?.actualStartTime).toBe("2026-05-14 08:00:00");
    expect(result.payload?.data[0]?.qcStatus).toBe("BELUM_QC");
  });

  it("preserves division mode on division fetch", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    let requestedUrl = "";
    global.fetch = mock(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [],
          date: "2026-05-14",
          dateTo: "2026-05-20",
          mode: "overtime",
          span: "weekly",
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchMonitoringDivision("session=abc", { mode: "overtime", span: "weekly" });
    expect(result.status).toBe(200);
    expect(requestedUrl).toContain("/api/monitoring/division");
    expect(requestedUrl).toContain("mode=overtime");
    expect(requestedUrl).toContain("span=weekly");
    expect(result.payload?.mode).toBe("overtime");
    expect(result.payload?.span).toBe("weekly");
    expect(result.payload?.dateTo).toBe("2026-05-20");
  });

  it("parses division detail payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    let requestedUrl = "";
    global.fetch = mock(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          divisionId: 12,
          divisionName: "INTERIOR",
          date: "2026-05-14",
          dateTo: "2026-05-20",
          mode: "overtime",
          span: "weekly",
          summary: {
            totalUnits: 2,
            totalMembers: 3,
            totalTasks: 5,
            totalPlannedHours: 12,
            totalActualHours: 4,
            totalRemainingHours: 8,
          },
          units: [],
          members: [],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchMonitoringDivisionDetail("12", "session=abc", { mode: "overtime", span: "weekly" });
    expect(result.status).toBe(200);
    expect(requestedUrl).toContain("/api/monitoring/division/12");
    expect(requestedUrl).toContain("mode=overtime");
    expect(result.payload?.divisionId).toBe(12);
    expect(result.payload?.summary.totalUnits).toBe(2);
  });
});
