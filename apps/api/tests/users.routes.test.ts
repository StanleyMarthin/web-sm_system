import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { GridQueryState } from "@smsystem/contracts/grid";
import type { CreateUserRequest, UpdateUserRequest } from "@smsystem/contracts/user";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import { sanitizeUserGridQuery } from "@/services/users/query";
import type { UsersService } from "@/services/users.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: [permissionCodes.manageUsers, permissionCodes.viewAllUnits],
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
  sessionKey: "session:SM-03.004:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

const sampleGridQuery = sanitizeUserGridQuery({
  page: 1,
  limit: 25,
  search: "",
  sortBy: "employeeId",
  sortDirection: "asc",
  view: null,
  filters: [],
} satisfies GridQueryState);

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
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
      return sampleSession;
    },
    async getCurrentUser() {
      return sampleUser;
    },
    async getCurrentPermissions() {
      return sampleUser.permissions;
    },
    ...overrides,
  };
}

function createStubUsersService(overrides: Partial<UsersService> = {}): UsersService {
  return {
    async list(_session: WebSession, query: GridQueryState) {
      const normalizedQuery = sanitizeUserGridQuery(query);
      return {
        data: [
          {
            employeeId: "SM-08.005",
            fullName: "YUDHA AGUSTIANA",
            email: null,
            roleId: 19,
            roleName: "kepala_produksi",
            divisionId: 29,
            divisionName: "MANAGER PRODUKSI",
            grade: "KEPALA PRODUKSI",
            status: "ACTIVE",
            lastLoginAt: "2026-05-13 07:30:00",
            deviceCount: 2,
            createdAt: "2026-05-01 07:30:00",
            managedDivisionIds: [29],
            managedDivisionNames: ["MANAGER PRODUKSI"],
            activeUnitIds: ["MB500SEL_MRSILMY"],
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
          roles: [
            {
              label: "kepala_produksi",
              value: "19",
              scopeBasis: "ASSIGNED_UNITS",
              approvalRank: 3,
              webEnabled: true,
              mobileEnabled: true,
            },
          ],
          divisions: [{ label: "MANAGER PRODUKSI", value: "29" }],
        },
        query: normalizedQuery,
      };
    },
    async findByEmployeeId() {
      return {
        employeeId: "SM-08.005",
        fullName: "YUDHA AGUSTIANA",
        email: null,
        roleId: 19,
        roleName: "kepala_produksi",
        divisionId: 29,
        divisionName: "MANAGER PRODUKSI",
        grade: "KEPALA PRODUKSI",
        status: "ACTIVE",
        lastLoginAt: "2026-05-13 07:30:00",
        deviceCount: 2,
        createdAt: "2026-05-01 07:30:00",
        managedDivisionIds: [29],
        managedDivisionNames: ["MANAGER PRODUKSI"],
        activeUnitIds: ["MB500SEL_MRSILMY"],
      };
    },
    async create() {
      return {
        employeeId: "SM-99.001",
        fullName: "Demo User",
        email: "demo@example.com",
        roleId: 20,
        roleName: "mis",
        divisionId: 3,
        divisionName: "MANAGEMENT INFORMATION SYSTEM",
        grade: "MIS",
        status: "ACTIVE",
        lastLoginAt: null,
        deviceCount: 0,
        createdAt: "2026-05-13 07:30:00",
        managedDivisionIds: [3],
        managedDivisionNames: ["MANAGEMENT INFORMATION SYSTEM"],
        activeUnitIds: [],
      };
    },
    async update(
      _session: WebSession,
      employeeId: string,
      _input: UpdateUserRequest,
    ) {
      return {
        employeeId,
        fullName: "Updated User",
        email: "updated@example.com",
        roleId: 20,
        roleName: "mis",
        divisionId: 3,
        divisionName: "MANAGEMENT INFORMATION SYSTEM",
        grade: "MIS",
        status: "ACTIVE",
        lastLoginAt: null,
        deviceCount: 0,
        createdAt: "2026-05-13 07:30:00",
        managedDivisionIds: [3],
        managedDivisionNames: ["MANAGEMENT INFORMATION SYSTEM"],
        activeUnitIds: [],
      };
    },
    async resetPassword(
      _session: WebSession,
      _employeeId: string,
      _input: { newPassword: string },
    ) {
      return;
    },
    async deactivate(_session: WebSession, _employeeId: string) {
      return;
    },
    async exportCsv(_session: WebSession, _query: GridQueryState) {
      return "employeeId,fullName\nSM-08.005,YUDHA AGUSTIANA\n";
    },
    ...overrides,
  };
}

describe("users routes", () => {
  test("returns server-side paginated users grid data", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      usersService: createStubUsersService(),
    });

    const response = await fetchHandler(
      new Request(
        "http://localhost/api/users?page=1&limit=25&sortBy=employeeId&sortDirection=asc",
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
          },
        },
      ),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data[0].employeeId).toBe("SM-08.005");
    expect(body.meta.total).toBe(1);
    expect(body.references.roles[0].value).toBe("19");
    expect(body.query).toEqual(sampleGridQuery);
  });

  test("creates and updates a user", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      usersService: createStubUsersService(),
    });

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          employeeId: "SM-99.001",
          fullName: "Demo User",
          email: "demo@example.com",
          password: "secret123",
          roleId: 20,
          divisionId: 3,
          grade: "MIS",
          managedDivisionIds: [3],
        } satisfies CreateUserRequest),
      }),
    );

    const createBody = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(createBody.data.user.employeeId).toBe("SM-99.001");

    const updateResponse = await fetchHandler(
      new Request("http://localhost/api/users/SM-99.001", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          fullName: "Updated User",
          email: "updated@example.com",
        } satisfies UpdateUserRequest),
      }),
    );

    const updateBody = await updateResponse.json();
    expect(updateResponse.status).toBe(200);
    expect(updateBody.data.user.fullName).toBe("Updated User");
  });

  test("resets password, deactivates a user, and exports csv", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      usersService: createStubUsersService(),
    });

    const resetResponse = await fetchHandler(
      new Request("http://localhost/api/users/SM-08.005/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          newPassword: "new-secret-123",
        }),
      }),
    );

    expect(resetResponse.status).toBe(200);

    const deactivateResponse = await fetchHandler(
      new Request("http://localhost/api/users/SM-08.005/deactivate", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(deactivateResponse.status).toBe(200);

    const exportResponse = await fetchHandler(
      new Request("http://localhost/api/users/export", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(exportResponse.status).toBe(200);
    expect(await exportResponse.text()).toContain("employeeId,fullName");
  });

  test("blocks users routes when manage permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [],
            },
          };
        },
      }),
      usersService: createStubUsersService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/users", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });
});
