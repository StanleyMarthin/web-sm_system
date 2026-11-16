import type {
  CreateRoleRequest,
  PermissionRecord,
  RoleRecord,
  UpdateRoleRequest,
} from "@smsystem/contracts/rbac";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { DefaultRolesService } from "@/services/roles/roles.service";
import type { RolesRepository } from "@/repositories/roles/roles.repo";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Rifki Arischandra",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: null,
  permissions: ["user.manage", "view_all_units"],
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
  sessionKey: "session:SM-03.003:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.003",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-18T00:00:00.000Z",
};

const reservedRole: RoleRecord = {
  id: 20,
  roleName: "mis",
  description: "Management information system",
  userCount: 1,
  permissionCount: 25,
  createdAt: "2026-05-18 00:00:00",
  profile: {
    roleLevel: 900,
    scopeBasis: "GLOBAL",
    webEnabled: true,
    mobileEnabled: true,
    approvalRank: 9,
    notes: "Profile awal hasil migrasi RBAC pusat.",
  },
};

const permissionCatalog: PermissionRecord[] = [
  {
    id: 1,
    permissionCode: "PROFILE_VIEW",
    description: "View profile",
    moduleName: "shared",
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  {
    id: 2,
    permissionCode: "VIEW_UNITS",
    description: "View units",
    moduleName: "monitoring",
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  {
    id: 3,
    permissionCode: "REPORT_EXPORT",
    description: "Export reports",
    moduleName: "reports",
    platforms: ["WEB"],
    audience: "WEB",
  },
];

describe("DefaultRolesService", () => {
  test("stores the permissions selected by the designated employee", async () => {
    let savedPermissionIds: number[] = [];

    const repository: RolesRepository = {
      async listRoles() {
        return [reservedRole];
      },
      async findRoleById() {
        return reservedRole;
      },
      async createRole(input: CreateRoleRequest) {
        return {
          ...reservedRole,
          roleName: input.roleName,
          profile: input.profile ?? reservedRole.profile,
        };
      },
      async updateRole(_roleId: number, input: UpdateRoleRequest) {
        return {
          ...reservedRole,
          roleName: input.roleName ?? reservedRole.roleName,
          profile: input.profile
            ? {
                roleLevel: input.profile.roleLevel ?? reservedRole.profile!.roleLevel,
                scopeBasis:
                  input.profile.scopeBasis ?? reservedRole.profile!.scopeBasis,
                webEnabled:
                  input.profile.webEnabled ?? reservedRole.profile!.webEnabled,
                mobileEnabled:
                  input.profile.mobileEnabled ?? reservedRole.profile!.mobileEnabled,
                approvalRank:
                  input.profile.approvalRank ?? reservedRole.profile!.approvalRank,
                notes: input.profile.notes ?? reservedRole.profile!.notes,
              }
            : reservedRole.profile,
        };
      },
      async listPermissions() {
        return permissionCatalog;
      },
      async listRoleReferences() {
        return {
          divisions: [],
          units: [],
        };
      },
      async getRolePermissionIds() {
        return [1];
      },
      async updateRolePermissions(_roleId: number, permissionIds: number[]) {
        savedPermissionIds = permissionIds;
        return permissionIds;
      },
      async listEmployeeIdsByRoleId() {
        return [];
      },
    };

    const service = new DefaultRolesService(repository, { async log() {} }, { async listRoleHistory() { return []; } });
    const result = await service.updateRolePermissions(sampleSession, 20, {
      permissionIds: [1],
    });

    expect(savedPermissionIds).toEqual([1]);
    expect(result).toEqual([1]);
  });

  test("allows the designated employee to change a role profile", async () => {
    let savedUpdate: UpdateRoleRequest | null = null;

    const repository: RolesRepository = {
      async listRoles() {
        return [reservedRole];
      },
      async findRoleById() {
        return reservedRole;
      },
      async createRole(input: CreateRoleRequest) {
        return {
          ...reservedRole,
          roleName: input.roleName,
          profile: input.profile ?? reservedRole.profile,
        };
      },
      async updateRole(_roleId: number, input: UpdateRoleRequest) {
        savedUpdate = input;
        return {
          ...reservedRole,
          roleName: input.roleName ?? reservedRole.roleName,
          description: input.description ?? reservedRole.description,
          profile: input.profile
            ? {
                roleLevel: input.profile.roleLevel ?? reservedRole.profile!.roleLevel,
                scopeBasis:
                  input.profile.scopeBasis ?? reservedRole.profile!.scopeBasis,
                webEnabled:
                  input.profile.webEnabled ?? reservedRole.profile!.webEnabled,
                mobileEnabled:
                  input.profile.mobileEnabled ?? reservedRole.profile!.mobileEnabled,
                approvalRank:
                  input.profile.approvalRank ?? reservedRole.profile!.approvalRank,
                notes: input.profile.notes ?? reservedRole.profile!.notes,
              }
            : reservedRole.profile,
        };
      },
      async listPermissions() {
        return permissionCatalog;
      },
      async listRoleReferences() {
        return {
          divisions: [],
          units: [],
        };
      },
      async getRolePermissionIds() {
        return [1, 2, 3];
      },
      async updateRolePermissions(_roleId: number, permissionIds: number[]) {
        return permissionIds;
      },
      async listEmployeeIdsByRoleId() {
        return [];
      },
    };

    const service = new DefaultRolesService(repository, { async log() {} }, { async listRoleHistory() { return []; } });
    const updatedRole = await service.updateRole(sampleSession, 20, {
      roleName: "mis_custom",
      profile: {
        roleLevel: 100,
        scopeBasis: "OWN_DIVISION",
        webEnabled: false,
        mobileEnabled: false,
        approvalRank: 1,
        notes: "temporary",
      },
    });

    expect(savedUpdate).toEqual({
      roleName: "mis_custom",
      profile: {
        roleLevel: 100,
        scopeBasis: "OWN_DIVISION",
        webEnabled: false,
        mobileEnabled: false,
        approvalRank: 1,
        notes: "temporary",
      },
    });
    expect(updatedRole.roleName).toBe("mis_custom");
    expect(updatedRole.profile?.scopeBasis).toBe("OWN_DIVISION");
    expect(updatedRole.profile?.webEnabled).toBe(false);
    expect(updatedRole.profile?.mobileEnabled).toBe(false);
  });

  test("synchronizes members after their role permissions change", async () => {
    const synchronized: string[][] = [];
    const repository: RolesRepository = {
      async listRoles() { return [reservedRole]; },
      async findRoleById() { return reservedRole; },
      async createRole() { return reservedRole; },
      async updateRole() { return reservedRole; },
      async listPermissions() { return permissionCatalog; },
      async listRoleReferences() { return { divisions: [], units: [] }; },
      async getRolePermissionIds() { return [1]; },
      async updateRolePermissions(_roleId, permissionIds) { return permissionIds; },
      async listEmployeeIdsByRoleId() { return ["SM-08.001", "SM-08.002"]; },
    };
    const service = new DefaultRolesService(
      repository,
      { async log() {} },
      { async listRoleHistory() { return []; } },
      {
        async sync(employeeIds) { synchronized.push([...employeeIds]); },
        async invalidate() {},
      },
    );

    await service.updateRolePermissions(sampleSession, 20, { permissionIds: [1, 2] });

    expect(synchronized).toEqual([["SM-08.001", "SM-08.002"]]);
  });
});
