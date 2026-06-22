import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type { CalendarService } from "@/services/calendar.service";
import type { MonitoringService } from "@/services/monitoring.service";
import {
  DefaultPlanningWorkspaceService,
} from "@/services/planning-workspace.service";
import type { WeeklyPlanningService } from "@/services/planning.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["UPDATE_PLAN", "LIST_CAR_PROGRESS", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "planning-workspace-session-1",
  sessionKey: "session:planning-workspace-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-19T00:00:00.000Z",
};

describe("DefaultPlanningWorkspaceService", () => {
  test("merges calendar, ETA, and weekly simulation into one summary", async () => {
    let recomputeCalled = 0;

    const calendarService: CalendarService = {
      async listWeeklyConfigs() {
        return [];
      },
      async upsertWeeklyConfig() {
        throw new Error("Not implemented");
      },
      async listDayOverrides() {
        return [];
      },
      async upsertDayOverride() {
        throw new Error("Not implemented");
      },
      async getWorkingDays() {
        return {
          startDate: "2026-05-19",
          endDate: "2026-05-25",
          includeOvertime: false,
          days: [],
        };
      },
      async simulateCapacity() {
        throw new Error("Not implemented");
      },
      async getUnitEta() {
        throw new Error("Not implemented");
      },
      async listDeliveryRisk() {
        return {
          data: [],
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
        };
      },
    };

    const planningService: WeeklyPlanningService = {
      async upsertPlan() {
        throw new Error("Not implemented");
      },
      async getPlanByWeek() {
        return {
          planId: "PLAN-1",
          weekStartDate: "2026-05-19",
          targetHours: 120,
          targetIncome: 12000000,
          labourRate: 100000,
          createdBy: "SM-03.004",
          notes: null,
          status: "DRAFT",
          createdAt: "2026-05-19 08:00:00",
        };
      },
      async listPlanOvertime() {
        return [];
      },
      async listPlanDivisionInputs() {
        return [];
      },
      async listPlanUnits() {
        return [];
      },
      async listPlanningUnitsForWeek() {
        return [];
      },
      async setOvertime() {
        return;
      },
      async setDivisionInputs() {
        return;
      },
      async setUnitAllocations() {
        return;
      },
      async snapshotAbsence() {
        return {
          snapshotCount: 0,
          capacity: [],
        };
      },
      async recomputeCapacity() {
        recomputeCalled += 1;
        return [
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
        ];
      },
      async computeGap() {
        return {
          targetHours: 120,
          totalNetCapacity: 332,
          deficit: -212,
          byDivision: [],
        };
      },
      async generateAlerts() {
        return [];
      },
      async getRecommendations() {
        return {
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
        };
      },
      async getCapacityCache() {
        return [];
      },
      async publishPlan() {
        throw new Error("Not implemented");
      },
    };

    const monitoringService: MonitoringService = {
      async listToday() {
        throw new Error("Not implemented");
      },
      async listOvertime() {
        throw new Error("Not implemented");
      },
      async listNoStart() {
        throw new Error("Not implemented");
      },
      async listNoSubmit() {
        throw new Error("Not implemented");
      },
      async listDivisionLoad() {
        throw new Error("Not implemented");
      },
      async getDivisionDetail() {
        throw new Error("Not implemented");
      },
      async listUnitLoad() {
        throw new Error("Not implemented");
      },
      async listEmployeeTimesheet() {
        throw new Error("Not implemented");
      },
      async listReferences() {
        return {
          divisions: [{ label: "INTERIOR", value: "12" }],
          units: [],
          employees: [],
        };
      },
      async createActual() {
        throw new Error("Not implemented");
      },
    };

    const service = new DefaultPlanningWorkspaceService(
      calendarService,
      planningService,
      monitoringService,
    );

    const result = await service.getSummary(sampleSession, {
      asOfDate: "2026-05-19",
      startDate: "2026-05-19",
      endDate: "2026-05-25",
      includeOvertime: false,
      weekStartDate: "2026-05-19",
      riskQuery: {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "predictedDeliveryDate",
        sortDirection: "asc",
        view: null,
        filters: [],
      },
    });

    expect(result.canManage).toBe(true);
    expect(result.divisionOptions[0]?.label).toBe("INTERIOR");
    expect(result.weeklyPlan.plan?.planId).toBe("PLAN-1");
    expect(result.weeklyPlan.capacity[0]?.divisionName).toBe("INTERIOR");
    expect(result.weeklyPlan.divisionInputs).toEqual([]);
    expect(result.weeklyPlan.recommendations?.summary.bottleneckDivisionName).toBe("INTERIOR");
    expect(recomputeCalled).toBe(1);
  });
});
