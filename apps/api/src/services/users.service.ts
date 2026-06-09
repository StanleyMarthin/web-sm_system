import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CreateUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserGridReference,
  UserRecord as ApiUserRecord,
} from "@smsystem/contracts/user";
import type { WebSession } from "@/services/auth/session.service";
import {
  MySqlUsersRepository,
  type UserRecord,
  type UsersRepository,
} from "@/repositories/users.repo";
import { buildGridMeta } from "@/services/grid/paginate";
import { sanitizeUserGridQuery } from "@/services/users/query";
import { TtlCache } from "@/lib/ttl-cache";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export interface UsersService {
  list(session: WebSession, query: GridQueryState): Promise<{
    data: ApiUserRecord[];
    meta: ReturnType<typeof buildGridMeta>;
    references: UserGridReference;
    query: ReturnType<typeof sanitizeUserGridQuery>;
  }>;
  findByEmployeeId(
    session: WebSession,
    employeeId: string,
  ): Promise<ApiUserRecord | null>;
  create(
    session: WebSession,
    input: CreateUserRequest,
  ): Promise<ApiUserRecord>;
  update(
    session: WebSession,
    employeeId: string,
    input: UpdateUserRequest,
  ): Promise<ApiUserRecord>;
  resetPassword(
    session: WebSession,
    employeeId: string,
    input: ResetPasswordRequest,
  ): Promise<void>;
  deactivate(session: WebSession, employeeId: string): Promise<void>;
  exportCsv(session: WebSession, query: GridQueryState): Promise<string>;
}

const USER_REFERENCE_CACHE_TTL_MS = 60_000;
const userReferenceCache = new TtlCache<{
  roles: Awaited<ReturnType<UsersRepository["listRoleOptions"]>>;
  divisions: Awaited<ReturnType<UsersRepository["listDivisionOptions"]>>;
}>(USER_REFERENCE_CACHE_TTL_MS);

function toApiUserRecord(record: UserRecord): ApiUserRecord {
  return {
    employeeId: record.employeeId,
    fullName: record.fullName,
    email: record.email,
    roleId: record.roleId,
    roleName: record.roleName,
    divisionId: record.divisionId,
    divisionName: record.divisionName,
    grade: record.grade,
    status: record.isActive ? "ACTIVE" : "INACTIVE",
    lastLoginAt: record.lastLoginAt,
    deviceCount: record.deviceCount,
    createdAt: record.createdAt,
    managedDivisionIds: record.managedDivisionIds,
    managedDivisionNames: record.managedDivisionNames,
    activeUnitIds: record.activeUnitIds,
  };
}

function canManageDivision(session: WebSession, divisionId: number | null): boolean {
  if (session.user.scope.canViewAllUnits) {
    return true;
  }

  if (!session.user.scope.canViewAssignedUnits || divisionId === null) {
    return false;
  }

  return session.user.scope.divisionIds.includes(divisionId);
}

function assertManageTarget(session: WebSession, record: UserRecord): void {
  if (record.employeeId === session.user.employeeId) {
    return;
  }

  if (canManageDivision(session, record.divisionId)) {
    return;
  }

  throw new Error("SCOPE_FORBIDDEN");
}

function assertManagedDivisionAssignments(
  session: WebSession,
  managedDivisionIds: number[] | undefined,
): void {
  if (!managedDivisionIds || managedDivisionIds.length === 0) {
    return;
  }

  if (session.user.scope.canViewAllUnits) {
    return;
  }

  for (const divisionId of managedDivisionIds) {
    if (!session.user.scope.divisionIds.includes(divisionId)) {
      throw new Error("SCOPE_FORBIDDEN");
    }
  }
}

function escapeCsvValue(value: string | number | null): string {
  const normalized = value === null ? "" : String(value);
  if (!/[",\n]/u.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/gu, '""')}"`;
}

export class BunPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 12,
    });
  }
}

export class DefaultUsersService implements UsersService {
  constructor(
    private readonly repository: UsersRepository = new MySqlUsersRepository(),
    private readonly passwordHasher: PasswordHasher = new BunPasswordHasher(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async list(session: WebSession, query: GridQueryState) {
    const sanitizedQuery = sanitizeUserGridQuery(query);
    const [payload, references] = await Promise.all([
      this.repository.list({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query: sanitizedQuery,
      }),
      userReferenceCache.getOrCreate("global", async () => {
        const [roles, divisions] = await Promise.all([
          this.repository.listRoleOptions(),
          this.repository.listDivisionOptions(),
        ]);

        return { roles, divisions };
      }),
    ]);

    return {
      data: payload.rows.map(toApiUserRecord),
      meta: buildGridMeta(payload.total, sanitizedQuery.page, sanitizedQuery.limit),
      references: {
        roles: references.roles,
        divisions: references.divisions,
      },
      query: sanitizedQuery,
    };
  }

  async findByEmployeeId(
    session: WebSession,
    employeeId: string,
  ): Promise<ApiUserRecord | null> {
    const record = await this.repository.findByEmployeeId(employeeId);
    if (!record) {
      return null;
    }

    assertManageTarget(session, record);
    return toApiUserRecord(record);
  }

  async create(
    session: WebSession,
    input: CreateUserRequest,
  ): Promise<ApiUserRecord> {
    if (!canManageDivision(session, input.divisionId)) {
      throw new Error("SCOPE_FORBIDDEN");
    }

    assertManagedDivisionAssignments(session, input.managedDivisionIds);

    const existingRecord = await this.repository.findByEmployeeId(input.employeeId);
    if (existingRecord) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const createdRecord = await this.repository.create({
      ...input,
      passwordHash,
    });
    userReferenceCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "user.create",
      module: "user",
      recordId: createdRecord.employeeId,
      newValue: {
        employeeId: createdRecord.employeeId,
        roleId: createdRecord.roleId,
        divisionId: createdRecord.divisionId,
        managedDivisionIds: createdRecord.managedDivisionIds,
      },
    });

    return toApiUserRecord(createdRecord);
  }

  async update(
    session: WebSession,
    employeeId: string,
    input: UpdateUserRequest,
  ): Promise<ApiUserRecord> {
    const existingRecord = await this.repository.findByEmployeeId(employeeId);
    if (!existingRecord) {
      throw new Error("USER_NOT_FOUND");
    }

    assertManageTarget(session, existingRecord);

    if (
      input.divisionId !== undefined &&
      !canManageDivision(session, input.divisionId)
    ) {
      throw new Error("SCOPE_FORBIDDEN");
    }

    assertManagedDivisionAssignments(session, input.managedDivisionIds);

    const updatedRecord = await this.repository.update(employeeId, input);
    userReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "user.update",
      module: "user",
      recordId: employeeId,
      oldValue: {
        roleId: existingRecord.roleId,
        divisionId: existingRecord.divisionId,
        managedDivisionIds: existingRecord.managedDivisionIds,
        isActive: existingRecord.isActive,
      },
      newValue: {
        roleId: updatedRecord.roleId,
        divisionId: updatedRecord.divisionId,
        managedDivisionIds: updatedRecord.managedDivisionIds,
        isActive: updatedRecord.isActive,
      },
    });
    return toApiUserRecord(updatedRecord);
  }

  async resetPassword(
    session: WebSession,
    employeeId: string,
    input: ResetPasswordRequest,
  ): Promise<void> {
    const existingRecord = await this.repository.findByEmployeeId(employeeId);
    if (!existingRecord) {
      throw new Error("USER_NOT_FOUND");
    }

    assertManageTarget(session, existingRecord);

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.repository.resetPassword(employeeId, passwordHash);
    userReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "user.reset-password",
      module: "user",
      recordId: employeeId,
      oldValue: {
        passwordChanged: false,
      },
      newValue: {
        passwordChanged: true,
      },
    });
  }

  async deactivate(session: WebSession, employeeId: string): Promise<void> {
    if (employeeId === session.user.employeeId) {
      throw new Error("CANNOT_DEACTIVATE_SELF");
    }

    const existingRecord = await this.repository.findByEmployeeId(employeeId);
    if (!existingRecord) {
      throw new Error("USER_NOT_FOUND");
    }

    assertManageTarget(session, existingRecord);
    await this.repository.deactivate(employeeId);
    userReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "user.deactivate",
      module: "user",
      recordId: employeeId,
      oldValue: {
        isActive: existingRecord.isActive,
      },
      newValue: {
        isActive: false,
      },
    });
  }

  async exportCsv(session: WebSession, query: GridQueryState): Promise<string> {
    const sanitizedQuery = sanitizeUserGridQuery(query);
    const payload = await this.repository.list({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: sanitizedQuery,
      exportMode: true,
    });

    const rows = payload.rows.map((row) =>
      [
        row.employeeId,
        row.fullName,
        row.email,
        row.roleName,
        row.divisionName,
        row.grade,
        row.isActive ? "ACTIVE" : "INACTIVE",
        row.lastLoginAt,
        row.deviceCount,
        row.createdAt,
        row.managedDivisionNames.join(" | "),
        row.activeUnitIds.join(" | "),
      ]
        .map(escapeCsvValue)
        .join(","),
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "user.export",
      module: "user",
      recordId: "users",
      newValue: {
        query: sanitizedQuery,
        rowCount: payload.rows.length,
      },
    });

    return [
      "employeeId,fullName,email,roleName,divisionName,grade,status,lastLoginAt,deviceCount,createdAt,managedDivisions,activeUnits",
      ...rows,
    ].join("\n");
  }
}
