import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchDeliveryRisk, fetchWorkingDays } from "@/shared/api/calendar";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("calendar api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses working day payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            startDate: "2026-05-18",
            endDate: "2026-05-24",
            includeOvertime: false,
            days: [
              {
                date: "2026-05-18",
                dayName: "Monday",
                workingHours: 8,
                overtimeHours: 0,
                totalCapacityHours: 8,
                isWorkingDay: true,
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWorkingDays("session=abc", {
      startDate: "2026-05-18",
      endDate: "2026-05-24",
    });

    expect(result.status).toBe(200);
    expect(result.payload?.data.days[0]?.workingHours).toBe(8);
  });

  it("parses delivery risk payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              targetDeliveryDate: "2026-05-22",
              predictedDeliveryDate: "2026-05-21",
              riskLevel: "YELLOW",
              remainingHours: 16,
              effectiveDailyCapacity: 8,
              etaDays: 2,
              blockerDelayDays: 0,
              qcBufferDays: 1,
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
            sortBy: "predictedDeliveryDate",
            sortDirection: "asc",
            view: null,
            filters: [],
            asOfDate: "2026-05-18",
          },
          summary: {
            green: 0,
            yellow: 1,
            orange: 0,
            red: 0,
            black: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchDeliveryRisk("session=abc", {
      asOfDate: "2026-05-18",
    });

    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.riskLevel).toBe("YELLOW");
  });
});
