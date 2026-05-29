import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { PlanningWorkspaceService } from "@/services/planning-workspace.service";

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
  sessionId: "planning-workspace-route-session-1",
  sessionKey: "session:planning-workspace-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-19T00:00:00.000Z",
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

function createStubPlanningWorkspaceService(): PlanningWorkspaceService {
  return {
    async getSummary(_session, input) {
      return {
        asOfDate: input.asOfDate,
        weekStartDate: input.weekStartDate,
        canManage: true,
        weeklyConfigs: [],
        workingDays: {
          startDate: input.startDate,
          endDate: input.endDate,
          includeOvertime: input.includeOvertime,
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
            ...input.riskQuery,
            asOfDate: input.asOfDate,
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
      };
    },
  };
}

describe("planning workspace routes", () => {
  test("returns one summary payload for planning page", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      planningWorkspaceService: createStubPlanningWorkspaceService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/workspace?asOfDate=2026-05-19&weekStart=2026-05-19", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:planning-workspace-route-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.canManage).toBe(true);
    expect(body.data.divisionOptions[0].label).toBe("INTERIOR");
    expect(body.data.weeklyPlan.recommendations).toBe(null);
  });

  test("blocks summary when planning and progress permissions are both missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [],
        },
      }),
      planningWorkspaceService: createStubPlanningWorkspaceService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/workspace", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:planning-workspace-route-1`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });
});
