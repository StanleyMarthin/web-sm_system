import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
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
  permissions: [permissionCodes.updatePlan, permissionCodes.listCarProgress],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "planning-route-session-1",
  sessionKey: "session:planning-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-18T00:00:00.000Z",
};

function createStubAuthService(session: WebSession): AuthService {
  return {
    async login() {
      throw new Error("Not implemented");
    },
    async logout() {
      return [];
    },
    async refresh() {
      throw new Error("Not implemented");
    },
    async getCurrentSession() {
      return session;
    },
    async getCurrentUser() {
      return session.user;
    },
    async getCurrentPermissions() {
      return session.user.permissions;
    },
  };
}

function createStubPlanningService(): WeeklyPlanningService {
  return {
    async upsertPlan(_session, input) {
      return {
        planId: "PLAN-1",
        weekStartDate: input.weekStartDate,
        targetHours: input.targetHours,
        targetIncome: 12000000,
        labourRate: input.labourRate ?? null,
        createdBy: "SM-03.004",
        notes: input.notes ?? null,
        status: "DRAFT" as const,
        createdAt: "2026-05-18 08:00:00",
      };
    },
    async getPlanByWeek(weekStartDate) {
      return {
        planId: "PLAN-1",
        weekStartDate,
        targetHours: 120,
        targetIncome: 12000000,
        labourRate: 100000,
        createdBy: "SM-03.004",
        notes: null,
        status: "DRAFT" as const,
        createdAt: "2026-05-18 08:00:00",
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
      };
    },
    async generateAlerts() {
      return [
        {
          type: "GAP_SURPLUS" as const,
          severity: "INFO" as const,
          message: "Kapasitas minggu ini jauh di atas target.",
        },
      ];
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
    async publishPlan() {
      return {
        plan: {
          planId: "PLAN-1",
          weekStartDate: "2026-05-18",
          targetHours: 120,
          targetIncome: 12000000,
          labourRate: 100000,
          createdBy: "SM-03.004",
          notes: null,
          status: "PUBLISHED" as const,
          createdAt: "2026-05-18 08:00:00",
        },
        spkDraftId: "SPK-PLANNER-1",
        generatedOvertimeRows: 2,
      };
    },
  };
}

describe("planning routes", () => {
  test("creates weekly plan draft via upsert route", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      planningService: createStubPlanningService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/weekly-plan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:planning-route-1`,
        },
        body: JSON.stringify({
          weekStartDate: "2026-05-18",
          targetHours: 120,
          labourRate: 100000,
          notes: "Fokus unit deadline dekat",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.planId).toBe("PLAN-1");
    expect(body.data.targetHours).toBe(120);
  });

  test("returns weekly plan detail with gap and alerts", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [permissionCodes.listCarProgress],
        },
      }),
      planningService: createStubPlanningService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/weekly-plan/2026-05-18", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:planning-route-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.gap.totalNetCapacity).toBe(332);
    expect(body.data.alerts.length).toBe(1);
    expect(body.data.recommendations.summary.bottleneckDivisionName).toBe("INTERIOR");
  });

  test("updates division team input for one weekly plan", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      planningService: createStubPlanningService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/weekly-plan/PLAN-1/divisions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:planning-route-1`,
        },
        body: JSON.stringify({
          rows: [
            {
              divisionId: 12,
              memberCount: 6,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].divisionName).toBe("INTERIOR");
  });

  test("blocks weekly plan upsert when update plan permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [permissionCodes.listCarProgress],
        },
      }),
      planningService: createStubPlanningService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/weekly-plan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:planning-route-1`,
        },
        body: JSON.stringify({
          weekStartDate: "2026-05-18",
          targetHours: 100,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("publish returns planner-origin SPK draft id", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      planningService: createStubPlanningService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/weekly-plan/PLAN-1/publish", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:planning-route-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.plan.status).toBe("PUBLISHED");
    expect(body.data.spkDraftId).toBe("SPK-PLANNER-1");
  });
});
