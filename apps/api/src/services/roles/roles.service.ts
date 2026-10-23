import type {
  CreateRoleRequest,
  PermissionRecord,
  RoleReferenceOption,
  RoleRecord,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from "@smsystem/contracts/rbac";
import type { WebSession } from "@/services/auth/session.service";
import { isSystemSuperadminEmployee } from "@smsystem/contracts/auth";
import {
  MySqlRolesRepository,
  type RolesRepository,
} from "@/repositories/roles/roles.repo";
import { TtlCache } from "@/lib/ttl-cache";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit/audit.repo";

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

function assertSystemSuperadmin(session: WebSession): void {
  if (!isSystemSuperadminEmployee(session.user.employeeId)) {
    throw new Error("SUPERADMIN_REQUIRED");
  }
}

function normalizeRoleName(roleName: string): string {
  return roleName.trim().toLowerCase().replace(/[\s-]+/gu, "_");
}

function assertRoleNameAvailable(roleName: string, currentRoleName?: string): void {
  const normalized = normalizeRoleName(roleName);
  const currentNormalized = currentRoleName ? normalizeRoleName(currentRoleName) : null;
  if (
    currentNormalized !== normalized &&
    ["mis", "superadmin", "management_information_system"].includes(normalized)
  ) {
    throw new Error("RESERVED_ROLE_NAME");
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

export class DefaultRolesService implements RolesService {
  constructor(
    private readonly repository: RolesRepository = new MySqlRolesRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async listRoles(session: WebSession): Promise<RoleRecord[]> {
    assertSystemSuperadmin(session);
    return rolesListCache.getOrCreate("global", () => this.repository.listRoles());
  }

  async createRole(
    session: WebSession,
    input: CreateRoleRequest,
  ): Promise<RoleRecord> {
    assertSystemSuperadmin(session);
    assertRoleNameAvailable(input.roleName);
    const role = await this.repository.createRole(input);
    invalidateRoleCaches(role.id);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "role.create",
      module: "rbac",
      recordId: String(role.id),
      newValue: role,
    });
    return role;
  }

  async listReferences(session: WebSession): Promise<{
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  }> {
    assertSystemSuperadmin(session);
    return roleReferencesCache.getOrCreate("global", () =>
      this.repository.listRoleReferences(),
    );
  }

  async updateRole(
    session: WebSession,
    roleId: number,
    input: UpdateRoleRequest,
  ): Promise<RoleRecord> {
    assertSystemSuperadmin(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
    }
    if (input.roleName !== undefined) {
      assertRoleNameAvailable(input.roleName, existingRole.roleName);
    }

    const role = await this.repository.updateRole(roleId, mergeRoleProfile(existingRole, input));
    invalidateRoleCaches(roleId);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "role.update",
      module: "rbac",
      recordId: String(roleId),
      oldValue: existingRole,
      newValue: role,
    });
    return role;
  }

  async listPermissions(session: WebSession): Promise<PermissionRecord[]> {
    assertSystemSuperadmin(session);
    return permissionCatalogCache.getOrCreate("global", () =>
      this.repository.listPermissions(),
    );
  }

  async getRolePermissionIds(
    session: WebSession,
    roleId: number,
  ): Promise<number[]> {
    assertSystemSuperadmin(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
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
    assertSystemSuperadmin(session);

    const existingRole = await this.repository.findRoleById(roleId);
    if (!existingRole) {
      throw new Error("ROLE_NOT_FOUND");
    }

    const permissionIds = await this.repository.updateRolePermissions(
      roleId,
      input.permissionIds,
    );
    rolePermissionCache.delete(`role:${roleId}`);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "role.permissions.update",
      module: "rbac",
      recordId: String(roleId),
      newValue: { permissionIds },
    });
    return permissionIds;
  }
}
