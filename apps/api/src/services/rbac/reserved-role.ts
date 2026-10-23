import {
  isSystemSuperadminEmployee,
  type AuthUser,
} from "@smsystem/contracts/auth";
import type { RoleProfile } from "@smsystem/contracts/rbac";
import { permissionCatalog } from "@smsystem/permissions";

const systemSuperadminProfile: RoleProfile = {
  roleLevel: 900,
  scopeBasis: "GLOBAL",
  webEnabled: true,
  mobileEnabled: true,
  approvalRank: 9,
  notes: "Akses superadmin sistem.",
};

function cloneSystemSuperadminProfile(): RoleProfile {
  return {
    ...systemSuperadminProfile,
  };
}

function uniqueSortedPermissions(permissionCodes: readonly string[]): string[] {
  return [...new Set(permissionCodes)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function normalizeReservedAuthUser(user: AuthUser): AuthUser {
  if (!isSystemSuperadminEmployee(user.employeeId)) {
    return user;
  }

  return {
    ...user,
    permissions: uniqueSortedPermissions([...permissionCatalog, ...user.permissions]),
    roleProfile: cloneSystemSuperadminProfile(),
    scope: {
      ...user.scope,
      canViewAllUnits: true,
      canViewAssignedUnits: true,
    },
  };
}
