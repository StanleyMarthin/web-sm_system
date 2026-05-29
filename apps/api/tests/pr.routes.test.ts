import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { PrService } from "@/services/pr.service";
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
  permissions: [
    permissionCodes.prView,
    permissionCodes.prCreate,
    permissionCodes.prApprove,
    permissionCodes.prOrder,
    permissionCodes.prReceive,
    permissionCodes.viewAllUnits,
  ],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "pr-route-session-1",
  sessionKey: "session:pr-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-15T00:00:00.000Z",
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

function createStubPrService(overrides: Partial<PrService> = {}): PrService {
  return {
    async list() {
      return {
        data: [
          {
            prId: "PR-1",
            prNumber: "PRIN/001/05/2026",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            divisionName: "INTERIOR",
            requestedBy: "SM-08.005",
            requestedByName: "Yudha Agustiana",
            accTracking: "PENDING_ADV" as const,
            status: "OPEN" as const,
            targetDate: null,
            priority: "NORMAL",
            notes: null,
            createdAt: "2026-05-15 09:00:00",
            updatedAt: "2026-05-15 09:00:00",
            totalItems: 1,
            totalQty: 2,
            totalEstimatedPrice: 1000000,
            totalActualPrice: 0,
            vendorSummary: "-",
            latestArrivalDate: null,
            agingDays: 0,
            riskScore: 30,
            isCritical: false,
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
          units: [],
          divisions: [],
          statuses: [],
          approvalStages: [],
          vendors: [],
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "createdAt",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          viewMode: "active" as const,
        },
        summary: {
          pendingApproval: 1,
          huntingCount: 0,
          orderedCount: 0,
          criticalCount: 0,
        },
      };
    },
    async listCritical() {
      return [];
    },
    async create() {
      return {
        prId: "PR-NEW",
        accTracking: "PENDING_ADV" as const,
        status: "OPEN" as const,
      };
    },
    async findDetail() {
      return {
        header: (await this.list(sampleSession, {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "createdAt",
          sortDirection: "desc",
          view: null,
          filters: [],
          viewMode: "active",
        })).data[0],
        items: [],
      };
    },
    async approve() {
      return { prId: "PR-1", accTracking: "PENDING_KP" as const, status: "OPEN" as const };
    },
    async order() {
      return { prId: "PR-1", accTracking: "APPROVED" as const, status: "ORDERED" as const };
    },
    async receive() {
      return { prId: "PR-1", accTracking: "APPROVED" as const, status: "ARRIVED" as const };
    },
    async cancel() {
      return { prId: "PR-1", accTracking: "APPROVED" as const, status: "CANCELLED" as const };
    },
    ...overrides,
  };
}

describe("pr routes", () => {
  test("defaults PR list filter to active user division for KD scope", async () => {
    const scopedUser: AuthUser = {
      ...sampleUser,
      roleId: 17,
      roleName: "ketua_divisi",
      divisionId: 12,
      divisionName: "INTERIOR",
      permissions: [permissionCodes.prView],
      scope: {
        canViewAllUnits: false,
        canViewAssignedUnits: true,
        divisionIds: [12],
        managedDivisionIds: [12],
        unitIds: [],
      },
      roleProfile: {
        roleLevel: 170,
        scopeBasis: "OWN_DIVISION",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: 2,
        notes: null,
      },
    };
    const scopedSession: WebSession = {
      ...sampleSession,
      sessionKey: "session:pr-route-kd",
      employeeId: scopedUser.employeeId,
      user: scopedUser,
    };

    let capturedFilters: Array<{ field: string; operator: string; value: string }> = [];
    const baseService = createStubPrService();
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(scopedSession),
      prService: createStubPrService({
        async list(session, query) {
          capturedFilters = query.filters;
          return baseService.list(session, query);
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/pr", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:pr-route-kd`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(capturedFilters).toEqual([
      {
        field: "divisionName",
        operator: "eq",
        value: "INTERIOR",
      },
    ]);
  });

  test("lists and creates PR", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      prService: createStubPrService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/pr", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:pr-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].prId).toBe("PR-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/pr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:pr-route-1`,
        },
        body: JSON.stringify({
          carId: "CAR-1",
          divisionName: null,
          targetDate: null,
          priority: "NORMAL",
          notes: null,
          items: [
            {
              itemName: "Karet seal",
              description: null,
              originType: "LOKAL",
              qty: 2,
              uom: "pcs",
              estimatedPrice: 1000000,
              photoUrl: null,
            },
          ],
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.data.prId).toBe("PR-NEW");
  });

  test("returns 400 for invalid PR query limit", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      prService: createStubPrService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/pr?limit=150", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:pr-route-1`,
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe("INVALID_QUERY");
  });
});
