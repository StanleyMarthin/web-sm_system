import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { CreateRoleRequest, UpdateRoleRequest } from "@smsystem/contracts/rbac";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { RolesService } from "@/services/roles.service";

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

function createStubRolesService(overrides: Partial<RolesService> = {}): RolesService {
  return {
    async listRoles() {
      return [
        {
          id: 20,
          roleName: "mis",
          description: "Management information system",
          userCount: 1,
          permissionCount: 3,
          createdAt: "2026-05-13 07:30:00",
          profile: {
            roleLevel: 900,
            scopeBasis: "GLOBAL",
            webEnabled: true,
            mobileEnabled: true,
            approvalRank: 9,
            notes: "Admin lintas platform",
          },
        },
      ];
    },
    async createRole(_session, input: CreateRoleRequest) {
      return {
        id: 99,
        roleName: input.roleName,
        description: input.description ?? null,
        userCount: 0,
        permissionCount: 0,
        createdAt: "2026-05-13 07:30:00",
        profile: input.profile ?? null,
      };
    },
    async updateRole(_session, roleId, input: UpdateRoleRequest) {
      return {
        id: roleId,
        roleName: input.roleName ?? "mis_updated",
        description: input.description ?? "Updated role",
        userCount: 1,
        permissionCount: 3,
        createdAt: "2026-05-13 07:30:00",
        profile: {
          roleLevel: input.profile?.roleLevel ?? 700,
          scopeBasis: input.profile?.scopeBasis ?? "ASSIGNED_DIVISIONS",
          webEnabled: input.profile?.webEnabled ?? true,
          mobileEnabled: input.profile?.mobileEnabled ?? true,
          approvalRank: input.profile?.approvalRank ?? 2,
          notes: input.profile?.notes ?? "Updated profile",
        },
      };
    },
    async listPermissions() {
      return [
        {
          id: 31,
          permissionCode: "PROFILE_VIEW",
          description: "View profile",
          moduleName: "profile",
          platforms: ["WEB", "MOBILE"],
          audience: "SHARED",
        },
      ];
    },
    async getRolePermissionIds() {
      return [31];
    },
    async listReferences() {
      return {
        divisions: [{ label: "INTERIOR", value: "12" }],
        units: [{ label: "MB 500 SEL", value: "CAR-1" }],
      };
    },
    async updateRolePermissions() {
      return [31];
    },
    ...overrides,
  };
}

describe("roles routes", () => {
  test("lists roles and permissions and updates the matrix", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      rolesService: createStubRolesService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/roles", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listBody.data.roles[0].roleName).toBe("mis");
    expect(listBody.data.roles[0].profile.scopeBasis).toBe("GLOBAL");

    const permissionsResponse = await fetchHandler(
      new Request("http://localhost/api/permissions", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    const permissionsBody = await permissionsResponse.json();
    expect(permissionsResponse.status).toBe(200);
    expect(permissionsBody.data.permissions[0].permissionCode).toBe("PROFILE_VIEW");
    expect(permissionsBody.data.permissions[0].platforms).toEqual(["WEB", "MOBILE"]);

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          roleName: "advisor_body",
          description: "Advisor bodi",
          profile: {
            roleLevel: 200,
            scopeBasis: "ASSIGNED_DIVISIONS",
            webEnabled: true,
            mobileEnabled: true,
            approvalRank: 2,
            notes: "Scope divisi",
          },
        } satisfies CreateRoleRequest),
      }),
    );

    const createBody = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(createBody.data.role.profile.scopeBasis).toBe("ASSIGNED_DIVISIONS");

    const referencesResponse = await fetchHandler(
      new Request("http://localhost/api/roles/references", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    const referencesBody = await referencesResponse.json();
    expect(referencesResponse.status).toBe(200);
    expect(referencesBody.data.divisions[0].label).toBe("INTERIOR");
    expect(referencesBody.data.units[0].value).toBe("CAR-1");

    const rolePermissionsResponse = await fetchHandler(
      new Request("http://localhost/api/roles/20/permissions", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    const rolePermissionsBody = await rolePermissionsResponse.json();
    expect(rolePermissionsResponse.status).toBe(200);
    expect(rolePermissionsBody.data.permissionIds).toEqual([31]);

    const updateResponse = await fetchHandler(
      new Request("http://localhost/api/roles/20/permissions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          permissionIds: [31],
        }),
      }),
    );

    const updateBody = await updateResponse.json();
    expect(updateResponse.status).toBe(200);
    expect(updateBody.data.permissionIds).toEqual([31]);

    const patchResponse = await fetchHandler(
      new Request("http://localhost/api/roles/20", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
        body: JSON.stringify({
          roleName: "advisor_trim",
          profile: {
            roleLevel: 210,
            scopeBasis: "ASSIGNED_UNITS",
            webEnabled: false,
            mobileEnabled: true,
            approvalRank: 3,
            notes: "Pegangan unit",
          },
        } satisfies UpdateRoleRequest),
      }),
    );

    const patchBody = await patchResponse.json();
    expect(patchResponse.status).toBe(200);
    expect(patchBody.data.role.profile.scopeBasis).toBe("ASSIGNED_UNITS");
  });

  test("blocks role matrix when the session does not have global scope", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              scope: {
                ...sampleUser.scope,
                canViewAllUnits: false,
                canViewAssignedUnits: true,
              },
            },
          };
        },
      }),
      rolesService: createStubRolesService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/roles", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });
});
