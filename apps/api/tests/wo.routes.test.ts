import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WoService } from "@/services/wo.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-17.001",
  fullName: "RUHIAT",
  email: null,
  roleId: 17,
  roleName: "ketua_divisi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KD",
  permissions: [permissionCodes.woView, permissionCodes.woCreate],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const approverUser: AuthUser = {
  ...sampleUser,
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  permissions: [
    permissionCodes.woView,
    permissionCodes.woApprove,
    permissionCodes.woReject,
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
  sessionId: "session-1",
  sessionKey: "session:SM-17.001:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-17.001",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-14T00:00:00.000Z",
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

function createStubWoService(overrides: Partial<WoService> = {}): WoService {
  return {
    async list() {
      return {
        data: [
          {
            woId: "WO-1",
            woNumber: "WO/001/05/2026",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            fromDivisionId: 12,
            fromDivisionName: "INTERIOR",
            toDivisionId: 13,
            toDivisionName: "MEKANIK",
            panelName: "Dashboard",
            jobDetail: "Turunkan mesin",
            estimatedHours: 4,
            isPriority: true,
            status: "SUBMITTED" as const,
            requestDate: "2026-05-14",
            approvalDate: null,
            createdAt: "2026-05-14 09:00:00",
            notes: null,
            picId: null,
            picName: null,
            approverId: null,
            linkedCountdownId: null,
            linkedCountdownStatus: null,
            agingHours: 6,
            agingScore: 72,
            isUrgent: true,
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
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "requestDate",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          viewMode: "active" as const,
        },
        summary: {
          pendingApproval: 1,
          approvedOpen: 0,
          urgentCount: 1,
        },
      };
    },
    async listPendingApproval(session) {
      return this.list(session, {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "requestDate",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      });
    },
    async listMyDivision(session) {
      return this.list(session, {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "requestDate",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      });
    },
    async listUrgent() {
      return [
        {
          woId: "WO-1",
          woNumber: "WO/001/05/2026",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          fromDivisionId: 12,
          fromDivisionName: "INTERIOR",
          toDivisionId: 13,
          toDivisionName: "MEKANIK",
          panelName: "Dashboard",
          jobDetail: "Turunkan mesin",
          estimatedHours: 4,
          isPriority: true,
          status: "SUBMITTED" as const,
          requestDate: "2026-05-14",
          approvalDate: null,
          createdAt: "2026-05-14 09:00:00",
          notes: null,
          picId: null,
          picName: null,
          approverId: null,
          linkedCountdownId: null,
          linkedCountdownStatus: null,
          agingHours: 6,
          agingScore: 72,
          isUrgent: true,
        },
      ];
    },
    async create() {
      return { woId: "WO-1" };
    },
    async findDetail() {
      return {
        ticket: {
          woId: "WO-1",
          woNumber: "WO/001/05/2026",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          fromDivisionId: 12,
          fromDivisionName: "INTERIOR",
          toDivisionId: 13,
          toDivisionName: "MEKANIK",
          panelName: "Dashboard",
          jobDetail: "Turunkan mesin",
          estimatedHours: 4,
          isPriority: true,
          status: "SUBMITTED" as const,
          requestDate: "2026-05-14",
          approvalDate: null,
          createdAt: "2026-05-14 09:00:00",
          notes: null,
          picId: null,
          picName: null,
          approverId: null,
          linkedCountdownId: null,
          linkedCountdownStatus: null,
          agingHours: 6,
          agingScore: 72,
          isUrgent: true,
        },
        linkedCountdowns: [],
      };
    },
    async approve() {
      return { woId: "WO-1", status: "APPROVED" as const };
    },
    async reject() {
      return { woId: "WO-1", status: "REJECTED" as const };
    },
    async markDone() {
      return { woId: "WO-1", status: "DONE" as const };
    },
    async findLinkedCountdowns() {
      return [];
    },
    ...overrides,
  };
}

describe("wo routes", () => {
  test("defaults WO list filter to active user division for KD scope", async () => {
    let capturedFilters: Array<{ field: string; operator: string; value: string }> = [];
    const baseService = createStubWoService();
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      woService: createStubWoService({
        async list(session, query) {
          capturedFilters = query.filters;
          return baseService.list(session, query);
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/wo", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-17.001:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(capturedFilters).toEqual([
      {
        field: "fromDivisionId",
        operator: "eq",
        value: "12",
      },
    ]);
  });

  test("lists WO grid and creates WO", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      woService: createStubWoService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/wo?viewMode=active", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-17.001`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].woId).toBe("WO-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/wo", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-17.001`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          carId: "CAR-1",
          toDivisionId: 13,
          panelName: "Dashboard",
          jobDetail: "Turunkan mesin",
          requestDate: "2026-05-14",
          estimatedHours: 4,
          isPriority: true,
          notes: null,
        }),
      }),
    );

    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.data.woId).toBe("WO-1");
  });

  test("returns 400 for invalid WO query limit", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      woService: createStubWoService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/wo?limit=150", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-17.001`,
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe("INVALID_QUERY");
  });

  test("blocks approve route when permission missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      woService: createStubWoService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/wo/WO-1/approve", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-17.001`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("allows approve route for approver permission", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: approverUser,
      }),
      woService: createStubWoService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/wo/WO-1/approve", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("APPROVED");
  });
});
