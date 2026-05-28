import type {
  CreateRoleRequest,
  PermissionRecord,
  RoleReferenceOption,
  RoleRecord,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from "@smsystem/contracts/rbac";
import type { WebSession } from "@/services/auth/session.service";
import {
  MySqlRolesRepository,
  type RolesRepository,
} from "@/repositories/roles.repo";
import {
  RESERVED_SUPERADMIN_PROFILE,
  RESERVED_SUPERADMIN_ROLE,
  isReservedSuperadminRole,
} from "@/services/rbac/reserved-role";
import { TtlCache } from "@/lib/ttl-cache";

export interface RolesService {
  listRoles(session: WebSession): Promise<RoleRecord[]>;
  listReferences(session: WebSession): Promise<{
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  }>;
  createRole(session: WebSession, input: CreateRoleRequest): Promise<RoleRecord>;
  updateRole(
    session: WebSession,
    roleId: number,
    input: UpdateRoleRequest,
  ): Promise<RoleRecord>;
  listPermissions(session: WebSession): Promise<PermissionRecord[]>;
  getRolePermissionIds(session: WebSession, roleId: number): Promise<number[]>;
  updateRolePermissions(
    session: WebSession,
    roleId: number,
    input: UpdateRolePermissionsRequest,
  ): Promise<number[]>;
}

const REFERENCE_CACHE_TTL_MS = 60_000;
const rolesListCache = new TtlCache<RoleRecord[]>(REFERENCE_CACHE_TTL_MS);
const roleReferencesCache = new TtlCache<{
  divisions: RoleReferenceOption[];
  units: RoleReferenceOption[];
}>(REFERENCE_CACHE_TTL_MS);
const permissionCatalogCache = new TtlCache<PermissionRecord[]>(REFERENCE_CACHE_TTL_MS);
const rolePermissionCache = new TtlCache<number[]>(REFERENCE_CACHE_TTL_MS);

function invalidateRoleCaches(roleId?: number): void {
  rolesListCache.clear();
  roleReferencesCache.clear();
  if (typeof roleId === "number" && roleId > 0) {
    rolePermissionCache.delete(`role:${roleId}`);
  }
}

function assertGlobalScope(session: WebSession): void {
  if (!session.user.scope.canViewAllUnits) {
    throw new Error("SCOPE_FORBIDDEN");
  }
}

function mergeRoleProfile(
  existingRole: RoleRecord | null,
  input: UpdateRoleRequest,
): UpdateRoleRequest {
  if (input.profile === undefined) {
    return input;
  }

  const previousProfile = existingRole?.profile ?? {
    roleLevel: 0,
    scopeBasis: "OWN_DIVISION" as const,
    webEnabled: true,
    mobileEnabled: true,
    approvalRank: null,
    notes: null,
  };

  return {
    ...input,
    profile: {
      ...previousProfile,
      ...input.profile,
    },
  };
}

function enforceReservedSuperadminProfile(
  existingRole: RoleRecord | null,
  input: UpdateRoleRequest,
): UpdateRoleRequest {
  if (!existingRole || !isReservedSuperadminRole(existingRole.roleName)) {
    return input;
  }

  return {
    ...input,
    roleName: existingRole.roleName,
    profile: {
      ...RESERVED_SUPERADMIN_PROFILE,
    },
  };
}

function buildCreateRolePayload(input: CreateRoleRequest): CreateRoleRequest {
  if (!isReservedSuperadminRole(input.roleName)) {
    return input;
  }

  return {
    ...input,
    roleName: RESERVED_SUPERADMIN_ROLE,
    profile: {
      ...RESERVED_SUPERADMIN_PROFILE,
    },
  };
}

export class DefaultRolesService implements RolesService {
  constructor(
    private readonly repository: RolesRepository = new MySqlRolesRepository(),
  ) {}

  async listRoles(session: WebSession): Promise<RoleRecord[]> {
    assertGlobalScope(session);
    return rolesListCache.getOrCreate("global", () => this.repository.listRoles());
  }

  async createRole(
    session: WebSession,
    input: CreateRoleRequest,
  ): Promise<RoleRecord> {
    assertGlobalScope(session);
    const role = await this.repository.createRole(buildCreateRolePayload(input));
    invalidateRoleCaches(role.id);
    return role;
  }

  async listReferences(session: WebSession): Promise<{
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  }> {
    assertGlobalScope(session);
    return roleReferencesCache.getOrCreate("global", () =>
      this.repository.listRoleReferences(),
    );
  }

  async updateRole(
    session: WebSession,
    roleId: number,
    input: UpdateRoleRequest,
  ): Promise<RoleRecord> {
    assertGlobalScope(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
    }

    const role = await this.repository.updateRole(
      roleId,
      enforceReservedSuperadminProfile(
        existingRole,
        mergeRoleProfile(existingRole, input),
      ),
    );
    invalidateRoleCaches(roleId);
    return role;
  }

  async listPermissions(session: WebSession): Promise<PermissionRecord[]> {
    assertGlobalScope(session);
    return permissionCatalogCache.getOrCreate("global", () =>
      this.repository.listPermissions(),
    );
  }

  async getRolePermissionIds(
    session: WebSession,
    roleId: number,
  ): Promise<number[]> {
    assertGlobalScope(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
    }

    if (isReservedSuperadminRole(existingRole.roleName)) {
      const permissionCatalog = await permissionCatalogCache.getOrCreate(
        "global",
        () => this.repository.listPermissions(),
      );
      return permissionCatalog.map((permission) => permission.id);
    }

    return rolePermissionCache.getOrCreate(`role:${roleId}`, () =>
      this.repository.getRolePermissionIds(roleId),
    );
  }

  async updateRolePermissions(
    session: WebSession,
    roleId: number,
    input: UpdateRolePermissionsRequest,
  ): Promise<number[]> {
    assertGlobalScope(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
    }

    if (isReservedSuperadminRole(existingRole.roleName)) {
      const permissionCatalog = await permissionCatalogCache.getOrCreate(
        "global",
        () => this.repository.listPermissions(),
      );
      const permissionIds = await this.repository.updateRolePermissions(
        roleId,
        permissionCatalog.map((permission) => permission.id),
      );
      rolePermissionCache.delete(`role:${roleId}`);
      return permissionIds;
    }

    const permissionIds = await this.repository.updateRolePermissions(
      roleId,
      input.permissionIds,
    );
    rolePermissionCache.delete(`role:${roleId}`);
    return permissionIds;
  }
}
