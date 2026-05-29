import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildCountdownGridQueryString, fetchCountdownBoard, fetchCountdownDetail } from "@/shared/api/countdown";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("countdown api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string from search params", () => {
    const query = buildCountdownGridQueryString({
      page: "1",
      limit: "25",
      filter: ["status:eq:PLAN", "taskCategory:eq:MAIN"],
    });

    expect(query).toContain("page=1");
    expect(query).toContain("limit=25");
    expect(query).toContain("filter=status%3Aeq%3APLAN");
    expect(query).toContain("filter=taskCategory%3Aeq%3AMAIN");
  });

  it("parses countdown board payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              countdownId: "cd-1",
              carId: "MB500SEL_MRSILMY",
              unitName: "MB 500 SEL",
              customerName: "Mr. SILMY",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelId: 457,
              panelName: "KARPET COVER BAWAH DASHBOARD",
              sectionName: "KARPET COVER BAWAH DASHBOARD",
              taskCategory: "MAIN",
              jobTypeId: null,
              jobTypeName: null,
              targetHoursInitial: 8,
              timeExtensionHours: 0,
              targetHoursRevised: 8,
              totalActualHours: 1,
              remainingHours: 7,
              actualProgressPercent: 12.5,
              status: "PROSES",
              startDate: "2026-05-15",
              deadlineDate: "2026-05-18",
              createdAt: "2026-05-14 10:00:00",
              updatedAt: "2026-05-14 10:00:00",
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
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "updatedAt",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCountdownBoard("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.countdownId).toBe("cd-1");
  });

  it("parses countdown detail payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            countdown: {
              countdownId: "cd-1",
              carId: "MB500SEL_MRSILMY",
              unitName: "MB 500 SEL",
              customerName: "Mr. SILMY",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelId: 457,
              panelName: "KARPET COVER BAWAH DASHBOARD",
              sectionName: "KARPET COVER BAWAH DASHBOARD",
              taskCategory: "MAIN",
              jobTypeId: null,
              jobTypeName: null,
              targetHoursInitial: 8,
              timeExtensionHours: 0,
              targetHoursRevised: 8,
              totalActualHours: 1,
              remainingHours: 7,
              actualProgressPercent: 12.5,
              status: "PROSES",
              startDate: "2026-05-15",
              deadlineDate: "2026-05-18",
              createdAt: "2026-05-14 10:00:00",
              updatedAt: "2026-05-14 10:00:00",
              isOverdue: false,
              details: [],
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCountdownDetail("session=abc", "cd-1");
    expect(result.status).toBe(200);
    expect(result.payload?.data.countdown.unitName).toBe("MB 500 SEL");
  });
});
