import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildJobPlanGridQueryString,
  fetchJobPlanGrid,
} from "@/shared/api/job-plan";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("job plan api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string with mode and default date window", () => {
    const query = buildJobPlanGridQueryString(
      {
        page: "1",
        limit: "25",
        filter: ["status:eq:PENDING_MP"],
      },
      "overtime",
    );

    expect(query).toContain("page=1");
    expect(query).toContain("limit=25");
    expect(query).toContain("mode=overtime");
    expect(query).toContain("window=daily");
    expect(query).toContain("filter=status%3Aeq%3APENDING_MP");
    expect(query).toContain("date=");
  });

  it("keeps all mode when page membuka gabungan normal dan lembur", () => {
    const query = buildJobPlanGridQueryString({}, "all");

    expect(query).toContain("mode=all");
    expect(query).toContain("window=daily");
    expect(query).toContain("date=");
  });

  it("overrides existing mode param when section normal atau lembur diminta server-side", () => {
    const query = buildJobPlanGridQueryString({ mode: "all" }, "overtime");

    expect(query).toContain("mode=overtime");
    expect(query.includes("mode=all")).toBe(false);
  });

  it("uses dateStart as active date when rentang mingguan dipakai", () => {
    const query = buildJobPlanGridQueryString(
      {
        window: "weekly",
        dateStart: "2026-05-19",
        dateEnd: "2026-05-23",
      },
      "normal",
    );

    expect(query).toContain("window=weekly");
    expect(query).toContain("dateStart=2026-05-19");
    expect(query).toContain("dateEnd=2026-05-23");
    expect(query).toContain("date=2026-05-19");
  });

  it("parses job plan payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              planId: "PLAN-1",
              coreId: "cd-1",
              taskDate: "2026-05-14",
              unitName: "MB 500 SEL",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelName: "Dashboard",
              panelSectionName: "Dashboard",
              jobName: "Pasang",
              masterJobName: "Pasang",
              assignedUserId: "SM-11.002",
              assignedUserName: "BUDI",
              targetHours: 4,
              targetDailyHours: 4,
              targetTotalHours: 8,
              startTime: "08:00",
              finishTime: "12:00",
              isOvertime: false,
              isPriority: false,
              status: "PENDING_MP",
              jobDescription: "Pasang ke unit",
              instructionText: "Pasang ke unit",
              note: null,
              availablePlanHours: 6,
              remainingHours: 8,
              progressPercent: 10,
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
            employees: [],
            divisions: [],
            units: [],
            countdowns: [],
            workOrders: [],
            panels: [],
            jobTypes: [],
            statuses: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "taskDate",
            sortDirection: "asc",
            view: null,
            filters: [],
            date: "2026-05-14",
            window: "daily",
            mode: "normal",
            dateStart: "2026-05-14",
            dateEnd: "2026-05-14",
          },
          summary: {
            totalHours: 4,
            pendingCount: 1,
            approvedCount: 0,
            overtimeCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchJobPlanGrid("session=abc", {}, "normal");
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.planId).toBe("PLAN-1");
    expect(result.payload?.summary.pendingCount).toBe(1);
  });

  it("parses legacy job plan payload while API is stale", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              planId: "PLAN-1",
              coreId: "cd-1",
              taskDate: "2026-05-14",
              unitName: "MB 500 SEL",
              divisionId: 12,
              divisionName: "INTERIOR",
              assignedUserId: "SM-11.002",
              assignedUserName: "BUDI",
              targetHours: 4,
              startTime: "08:00",
              finishTime: "12:00",
              isOvertime: false,
              isPriority: false,
              status: "PENDING_MP",
              jobDescription: "Pasang ke unit",
              note: null,
              availablePlanHours: 6,
              remainingHours: 8,
              progressPercent: 10,
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
            employees: [],
            divisions: [],
            units: [],
            countdowns: [],
            workOrders: [],
            panels: [],
            jobTypes: [],
            statuses: [],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "taskDate",
            sortDirection: "asc",
            view: null,
            filters: [],
            date: "2026-05-14",
            window: "daily",
            mode: "normal",
            dateStart: "2026-05-14",
            dateEnd: "2026-05-14",
          },
          summary: {
            totalHours: 4,
            pendingCount: 1,
            approvedCount: 0,
            overtimeCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchJobPlanGrid("session=abc", {}, "normal");
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.targetDailyHours).toBe(4);
    expect(result.payload?.data[0]?.masterJobName).toBe("Pasang ke unit");
    expect(result.payload?.data[0]?.targetTotalHours).toBe(null);
  });
});
