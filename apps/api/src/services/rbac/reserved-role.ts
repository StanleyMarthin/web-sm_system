import type { AuthScope, AuthUser } from "@smsystem/contracts/auth";
import type { RoleProfile } from "@smsystem/contracts/rbac";
import { permissionCatalog, permissionCodes } from "@smsystem/permissions";

export const RESERVED_SUPERADMIN_ROLE = "mis";

export const RESERVED_SUPERADMIN_PROFILE: RoleProfile = {
  roleLevel: 900,
  scopeBasis: "GLOBAL",
  webEnabled: true,
  mobileEnabled: true,
  approvalRank: 9,
  notes: "Role MIS selalu memegang seluruh akses lintas web dan mobile.",
};

function cloneReservedSuperadminProfile(): RoleProfile {
  return {
    ...RESERVED_SUPERADMIN_PROFILE,
  };
}

function uniqueSortedPermissions(permissionCodes: readonly string[]): string[] {
  return [...new Set(permissionCodes)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeRoleName(roleName: string | null | undefined): string {
  return roleName?.trim().toLowerCase().replace(/[\s-]+/gu, "_") ?? "";
}

export function isReservedSuperadminRole(
  roleName: string | null | undefined,
): boolean {
  if (!roleName) return false;
  const normalized = normalizeRoleName(roleName);
  return normalized === RESERVED_SUPERADMIN_ROLE ||
         normalized.includes("mis") ||
         normalized.includes("management_information_system") ||
         normalized.includes("superadmin");
}

export function isQaRole(roleName: string | null | undefined): boolean {
  const normalized = normalizeRoleName(roleName);
  return normalized.includes("advisor") || ["adv", "qa", "quality_assurance"].includes(normalized);
}

function isGlobalDivisionAccessRole(roleName: string | null | undefined): boolean {
  const normalized = normalizeRoleName(roleName);
  return [
    "kepala_produksi",
    "manager_produksi",
    "manager_operational",
  ].includes(normalized);
}

function buildRoleProfileWithScopeBasis(
  roleProfile: RoleProfile | null | undefined,
  scopeBasis: RoleProfile["scopeBasis"],
): RoleProfile {
  return {
    roleLevel: roleProfile?.roleLevel ?? 900,
    scopeBasis,
    webEnabled: roleProfile?.webEnabled ?? true,
    mobileEnabled: roleProfile?.mobileEnabled ?? true,
    approvalRank: roleProfile?.approvalRank ?? null,
    notes: roleProfile?.notes ?? null,
  };
}

function normalizeAdvisorScope(scope: AuthScope): AuthScope {
  const divisionIds = scope.managedDivisionIds.length > 0
    ? [...new Set(scope.managedDivisionIds)].sort((left, right) => left - right)
    : scope.divisionIds;

  return {
    ...scope,
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds,
  };
}

export function normalizeReservedPermissionCodes(
  roleName: string | null | undefined,
  permissionCodes: readonly string[],
): string[] {
  if (!isReservedSuperadminRole(roleName)) {
    return [...permissionCodes];
  }

  return uniqueSortedPermissions([...permissionCatalog, ...permissionCodes]);
}

export function normalizeReservedRoleProfile(
  roleName: string | null | undefined,
  roleProfile: RoleProfile | null | undefined,
): RoleProfile | null {
  if (isReservedSuperadminRole(roleName)) {
    return cloneReservedSuperadminProfile();
  }

  if (isGlobalDivisionAccessRole(roleName)) {
    return buildRoleProfileWithScopeBasis(roleProfile, "GLOBAL");
  }

  if (isQaRole(roleName)) {
    return buildRoleProfileWithScopeBasis(roleProfile, "ASSIGNED_DIVISIONS");
  }

  return roleProfile ?? null;
}

export function normalizeReservedScope(
  roleName: string | null | undefined,
  scope: AuthScope,
): AuthScope {
  if (isReservedSuperadminRole(roleName) || isGlobalDivisionAccessRole(roleName)) {
    return {
      ...scope,
      canViewAllUnits: true,
      canViewAssignedUnits: true,
    };
  }

  if (isQaRole(roleName)) {
    return normalizeAdvisorScope(scope);
  }

  return scope;
}

export function normalizeReservedAuthUser(user: AuthUser): AuthUser {
  const isSuper = isReservedSuperadminRole(user.roleName) ||
                  user.divisionName?.toLowerCase().includes("management information system") ||
                  user.divisionName?.toLowerCase().includes("mis") ||
                  user.grade?.toLowerCase() === "mis";
  const isGlobalDivisionRole = isGlobalDivisionAccessRole(user.roleName);
  const isAdvisor = isQaRole(user.roleName);

  if (!isSuper && !isGlobalDivisionRole && !isAdvisor) {
    return user;
  }

  const permissions = isSuper
    ? uniqueSortedPermissions([...permissionCatalog, ...user.permissions])
    : isAdvisor
      ? uniqueSortedPermissions([
          ...user.permissions,
          permissionCodes.qcView,
          permissionCodes.qcValidate,
        ])
      : [...user.permissions];

  if (!isSuper) {
    return {
      ...user,
      permissions,
      roleProfile: normalizeReservedRoleProfile(user.roleName, user.roleProfile),
      scope: normalizeReservedScope(user.roleName, user.scope),
    };
  }

  return {
    ...user,
    permissions,
    roleProfile: cloneReservedSuperadminProfile(),
    scope: {
      ...user.scope,
      canViewAllUnits: true,
      canViewAssignedUnits: true,
    },
  };
}
