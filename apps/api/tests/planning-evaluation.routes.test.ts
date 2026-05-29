import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { PlanningEvaluationService } from "@/services/planning-evaluation.service";
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
  sessionId: "planning-evaluation-route-session-1",
  sessionKey: "session:planning-evaluation-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-27T00:00:00.000Z",
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

function createStubPlanningEvaluationService(): PlanningEvaluationService {
  return {
    async getEvaluation(_session, input) {
      return {
        date: input.date,
        dateTo: input.dateTo,
        span: input.span,
        mode: input.mode,
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
      };
    },
  };
}

describe("planning evaluation routes", () => {
  test("returns daily evaluation summary", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      planningEvaluationService: createStubPlanningEvaluationService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/planning/evaluation?date=2026-05-27&mode=all", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:planning-evaluation-route-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.summary.baselineHours).toBe(120);
    expect(body.data.divisions[0].divisionName).toBe("INTERIOR");
    expect(body.data.mode).toBe("all");
  });
});
