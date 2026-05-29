import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchPlanningEvaluation,
  fetchPlanningWorkspaceSummary,
  fetchWeeklyPlan,
} from "@/shared/api/planning";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("planning api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses weekly planning detail payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            plan: {
              planId: "PLAN-1",
              weekStartDate: "2026-05-18",
              targetHours: 120,
              targetIncome: 12000000,
              labourRate: 100000,
              createdBy: "SM-03.004",
              notes: "Minggu fokus unit deadline dekat",
              status: "DRAFT",
              createdAt: "2026-05-18 08:00:00",
            },
            capacity: [
              {
                divisionId: 12,
                divisionName: "INTERIOR",
                memberCountActive: 8,
                normalCapacityHours: 320,
                overtimeCapacityHours: 20,
                absenceLostHours: 8,
                netCapacityHours: 332,
                allocatedHours: 280,
                utilizationPct: 84.34,
              },
            ],
            gap: {
              targetHours: 120,
              totalNetCapacity: 332,
              deficit: -212,
              byDivision: [
                {
                  divisionId: 12,
                  divisionName: "INTERIOR",
                  memberCountActive: 8,
                  normalCapacityHours: 320,
                  overtimeCapacityHours: 20,
                  absenceLostHours: 8,
                  netCapacityHours: 332,
                  allocatedHours: 280,
                  utilizationPct: 84.34,
                },
              ],
            },
            alerts: [
              {
                type: "GAP_SURPLUS",
                severity: "INFO",
                message: "Kapasitas minggu ini jauh di atas target.",
              },
            ],
            recommendations: {
              summary: {
                targetHours: 120,
                totalDemandHours: 140,
                effectiveNormalHours: 312,
                scheduledOvertimeHours: 20,
                additionalOvertimeHours: 0,
                uncoveredHours: 0,
                overtimeDaysRecommended: 0,
                bottleneckDivisionName: "INTERIOR",
              },
              divisions: [],
              units: [],
            },
            overtime: [
              {
                divisionId: 12,
                divisionName: "INTERIOR",
                overtimeDate: "2026-05-20",
                dayType: "WEEKDAY",
                overtimeHours: 2,
                memberCount: 5,
                includeHead: true,
                notes: "Support final assembly",
              },
            ],
            divisionInputs: [
              {
                divisionId: 12,
                divisionName: "INTERIOR",
                autoMemberCount: 8,
                memberCount: 8,
              },
            ],
            units: [
              {
                carId: "CAR-1",
                divisionId: 12,
                divisionName: "INTERIOR",
                allocatedHours: 40,
                priorityRank: 1,
                notes: "Prioritas deadline",
                unitName: "MB 500 SEL",
                customerName: "Mr. Silmy",
                isMargin: false,
                materialStatus: "READY",
                materialReady: true,
                materialNote: null,
                targetDeliveryDate: "2026-05-22",
                remainingHours: 64,
              },
            ],
            planningUnits: [
              {
                carId: "CAR-1",
                unitName: "MB 500 SEL",
                customerName: "Mr. Silmy",
                targetDeliveryDate: "2026-05-22",
                remainingHours: 64,
                isMargin: false,
                materialStatus: "READY",
                materialReady: true,
                materialNote: null,
                lockedDivisionName: "INTERIOR",
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchWeeklyPlan("session=abc", "2026-05-18");

    expect(result.status).toBe(200);
    expect(result.payload?.data.plan?.planId).toBe("PLAN-1");
    expect(result.payload?.data.capacity[0]?.divisionName).toBe("INTERIOR");
    expect(result.payload?.data.alerts[0]?.type).toBe("GAP_SURPLUS");
    expect(result.payload?.data.recommendations?.summary.bottleneckDivisionName).toBe("INTERIOR");
  });

  it("parses planning workspace summary payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            asOfDate: "2026-05-19",
            weekStartDate: "2026-05-19",
            canManage: true,
            weeklyConfigs: [],
            workingDays: {
              startDate: "2026-05-19",
              endDate: "2026-05-25",
              includeOvertime: false,
              days: [],
            },
            deliveryRisk: {
              rows: [],
              meta: {
                page: 1,
                limit: 25,
                total: 0,
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
                asOfDate: "2026-05-19",
              },
              summary: {
                green: 0,
                yellow: 0,
                orange: 0,
                red: 0,
                black: 0,
              },
            },
            divisionOptions: [
              {
                label: "INTERIOR",
                value: "12",
              },
            ],
            weeklyPlan: {
              plan: null,
              capacity: [],
              gap: {
                targetHours: 0,
                totalNetCapacity: 0,
                deficit: 0,
                byDivision: [],
              },
              alerts: [],
              recommendations: null,
              overtime: [],
              divisionInputs: [],
              units: [],
              planningUnits: [],
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchPlanningWorkspaceSummary("session=abc", {
      asOfDate: "2026-05-19",
      weekStart: "2026-05-19",
    });

    expect(result.status).toBe(200);
    expect(result.payload?.data.canManage).toBe(true);
    expect(result.payload?.data.divisionOptions[0]?.label).toBe("INTERIOR");
  });

  it("parses planning evaluation payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            date: "2026-05-27",
            dateTo: "2026-05-27",
            span: "daily",
            mode: "all",
            summary: {
              baselineHours: 120,
              revisionHours: 132,
              actualHours: 118,
              revisionDeltaHours: 12,
              actualDeltaHours: -14,
            },
            divisions: [
              {
                divisionId: 12,
                divisionName: "INTERIOR",
                baselineHours: 72,
                revisionHours: 80,
                actualHours: 74,
                revisionDeltaHours: 8,
                actualDeltaHours: -6,
                baselineUnitCount: 2,
                revisionJobCount: 5,
                actualUnitCount: 2,
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchPlanningEvaluation("session=abc", {
      date: "2026-05-27",
      mode: "all",
    });

    expect(result.status).toBe(200);
    expect(result.payload?.data.summary.revisionHours).toBe(132);
    expect(result.payload?.data.divisions[0]?.divisionName).toBe("INTERIOR");
  });
});
