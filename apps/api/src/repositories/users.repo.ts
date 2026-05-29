import type { AuthScope } from "@smsystem/contracts/auth";
import type { CreateUserRequest, UpdateUserRequest } from "@smsystem/contracts/user";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";
import type { UserGridQuery } from "@/services/users/query";

interface UserRow extends RowDataPacket {
  employeeId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  roleId: number | null;
  roleName: string;
  divisionId: number | null;
  divisionName: string;
  grade: string | null;
  isActive: number;
  lastLoginAt: string | null;
  deviceCount: number;
  createdAt: string | null;
  managedDivisionIdsCsv: string | null;
  managedDivisionNamesCsv: string | null;
  activeUnitIdsCsv: string | null;
}

interface ReferenceRow extends RowDataPacket {
  value: number;
  label: string;
  scopeBasis: string | null;
  approvalRank: number | null;
  webEnabled: number | null;
  mobileEnabled: number | null;
}

export interface UserRecord {
  employeeId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  roleId: number | null;
  roleName: string;
  divisionId: number | null;
  divisionName: string;
  grade: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  deviceCount: number;
  createdAt: string | null;
  managedDivisionIds: number[];
  managedDivisionNames: string[];
  activeUnitIds: string[];
}

export interface UsersRepository {
  list(params: {
    employeeId: string;
    scope: AuthScope;
    query: UserGridQuery;
    exportMode?: boolean;
  }): Promise<{ rows: UserRecord[]; total: number }>;
  findByEmployeeId(employeeId: string): Promise<UserRecord | null>;
  listRoleOptions(): Promise<Array<{ label: string; value: string }>>;
  listDivisionOptions(): Promise<Array<{ label: string; value: string }>>;
  create(input: CreateUserRequest & { passwordHash: string }): Promise<UserRecord>;
  update(employeeId: string, input: UpdateUserRequest): Promise<UserRecord>;
  resetPassword(employeeId: string, passwordHash: string): Promise<void>;
  deactivate(employeeId: string): Promise<void>;
}

function getAuditLogTableName(): string {
  const auditDbName = getApiEnv().AUDIT_DB_NAME.trim();
  if (!/^[a-zA-Z0-9_]+$/u.test(auditDbName)) {
    throw new Error(`Invalid audit database name: ${auditDbName}`);
  }

  return `${auditDbName}.sm_audit_log`;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    employeeId: row.employeeId,
    fullName: row.fullName,
    email: row.email,
    photoUrl: row.photoUrl,
    roleId: row.roleId,
    roleName: row.roleName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    grade: row.grade,
    isActive: row.isActive === 1,
    lastLoginAt: row.lastLoginAt,
    deviceCount: row.deviceCount,
    createdAt: row.createdAt,
    managedDivisionIds: parseIntegerCsv(row.managedDivisionIdsCsv),
    managedDivisionNames: parseStringCsv(row.managedDivisionNamesCsv, "||"),
    activeUnitIds: parseStringCsv(row.activeUnitIdsCsv),
  };
}

function parseIntegerCsv(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item))
    .sort((left, right) => left - right);
}

function parseStringCsv(value: string | null, separator = ","): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isMissingAuditSourceError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return code === "ER_BAD_DB_ERROR" || code === "ER_NO_SUCH_TABLE";
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  if (scope.canViewAssignedUnits && scope.divisionIds.length > 0) {
    params.push(...scope.divisionIds);
    return `e.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`;
  }

  params.push(employeeId);
  return "e.employee_id = ?";
}

function buildFilterWhereClauses(query: UserGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const searchValue = `%${query.search}%`;
    clauses.push(
      `(
        e.employee_id LIKE ?
        OR e.full_name LIKE ?
        OR COALESCE(e.email, '') LIKE ?
        OR COALESCE(r.role_name, '') LIKE ?
        OR COALESCE(d.name, '') LIKE ?
        OR COALESCE(e.grade, '') LIKE ?
      )`,
    );
    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    );
  }

  for (const filter of query.filters) {
    if (filter.field === "status") {
      const normalizedValue = filter.value.toUpperCase();
      if (normalizedValue === "ACTIVE") {
        clauses.push("e.is_active = 1");
      } else if (normalizedValue === "INACTIVE") {
        clauses.push("e.is_active = 0");
      }
      continue;
    }

    if (filter.field === "roleId") {
      const roleId = Number.parseInt(filter.value, 10);
      if (Number.isFinite(roleId)) {
        clauses.push("e.role_id = ?");
        params.push(roleId);
      }
      continue;
    }

    if (filter.field === "divisionId") {
      const divisionId = Number.parseInt(filter.value, 10);
      if (Number.isFinite(divisionId)) {
        clauses.push("e.division_id = ?");
        params.push(divisionId);
      }
    }
  }

  return clauses;
}

function buildOrderBy(sortBy: UserGridQuery["sortBy"], direction: "asc" | "desc"): string {
  const columnMap: Record<UserGridQuery["sortBy"], string> = {
    employeeId: "e.employee_id",
    fullName: "e.full_name",
    email: "e.email",
    roleName: "r.role_name",
    divisionName: "d.name",
    grade: "e.grade",
    status: "e.is_active",
    lastLoginAt: "al.last_login_at",
    deviceCount: "COALESCE(dc.device_count, 0)",
    createdAt: "e.created_at",
  };

  return `${columnMap[sortBy]} ${direction.toUpperCase()}, e.employee_id ASC`;
}

function buildUserSelectSql(includeAuditLog = true): string {
  const auditJoinSql = includeAuditLog
    ? `
    LEFT JOIN (
      SELECT actor_id, MAX(created_at) AS last_login_at
      FROM ${getAuditLogTableName()}
      WHERE action = 'auth.login'
      GROUP BY actor_id
    ) al ON al.actor_id = e.employee_id
  `
    : `
    LEFT JOIN (
      SELECT NULL AS actor_id, NULL AS last_login_at
    ) al ON 1 = 0
  `;

  return `
    SELECT
      e.employee_id AS employeeId,
      e.full_name AS fullName,
      e.email AS email,
      e.photo_url AS photoUrl,
      e.role_id AS roleId,
      COALESCE(r.role_name, '-') AS roleName,
      e.division_id AS divisionId,
      COALESCE(d.name, '-') AS divisionName,
      e.grade AS grade,
      e.is_active AS isActive,
      DATE_FORMAT(al.last_login_at, '%Y-%m-%d %H:%i:%s') AS lastLoginAt,
      COALESCE(dc.device_count, 0) AS deviceCount,
      DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      md.managedDivisionIdsCsv AS managedDivisionIdsCsv,
      md.managedDivisionNamesCsv AS managedDivisionNamesCsv,
      au.activeUnitIdsCsv AS activeUnitIdsCsv
    FROM sm_employee e
    LEFT JOIN sm_role r ON r.id = e.role_id
    LEFT JOIN sm_divisi d ON d.id = e.division_id
    LEFT JOIN (
      SELECT employee_id, COUNT(*) AS device_count
      FROM sm_user_devices
      WHERE is_active = 1
      GROUP BY employee_id
    ) dc ON dc.employee_id = e.employee_id
    ${auditJoinSql}
    LEFT JOIN (
      SELECT
        emd.employee_id,
        GROUP_CONCAT(DISTINCT emd.division_id ORDER BY emd.division_id ASC) AS managedDivisionIdsCsv,
        GROUP_CONCAT(DISTINCT managed_division.name ORDER BY managed_division.name ASC SEPARATOR '||') AS managedDivisionNamesCsv
      FROM employee_managed_divisions emd
      JOIN sm_divisi managed_division ON managed_division.id = emd.division_id
      GROUP BY emd.employee_id
    ) md ON md.employee_id = e.employee_id
    LEFT JOIN (
      SELECT
        assignment_rows.employee_id,
        GROUP_CONCAT(DISTINCT assignment_rows.car_id ORDER BY assignment_rows.car_id ASC) AS activeUnitIdsCsv
      FROM (
        SELECT kp_id AS employee_id, car_id
        FROM car_project_assignment
        WHERE ended_at IS NULL AND kp_id IS NOT NULL
        UNION ALL
        SELECT advisor_id AS employee_id, car_id
        FROM car_project_assignment
        WHERE ended_at IS NULL AND advisor_id IS NOT NULL
        UNION ALL
        SELECT kd_id AS employee_id, car_id
        FROM car_project_assignment
        WHERE ended_at IS NULL AND kd_id IS NOT NULL
      ) assignment_rows
      GROUP BY assignment_rows.employee_id
    ) au ON au.employee_id = e.employee_id
  `;
}

async function queryUsersWithAuditFallback(
  pool: Pool,
  sqlBuilder: (includeAuditLog: boolean) => string,
  params: unknown[],
): Promise<UserRow[]> {
  try {
    const [rows] = (await pool.query(sqlBuilder(true), params)) as [UserRow[], unknown];
    return rows;
  } catch (error) {
    if (!isMissingAuditSourceError(error)) {
      throw error;
    }

    const [rows] = (await pool.query(sqlBuilder(false), params)) as [UserRow[], unknown];
    return rows;
  }
}

async function replaceManagedDivisionAssignments(
  connection: PoolConnection,
  employeeId: string,
  managedDivisionIds: number[],
): Promise<void> {
  await connection.query(
    `
      DELETE FROM employee_managed_divisions
      WHERE employee_id = ?
    `,
    [employeeId],
  );

  if (managedDivisionIds.length === 0) {
    return;
  }

  const placeholders = managedDivisionIds.map(() => "(?, ?)").join(", ");
  const values = managedDivisionIds.flatMap((divisionId) => [employeeId, divisionId]);
  await connection.query(
    `
      INSERT INTO employee_managed_divisions (employee_id, division_id)
      VALUES ${placeholders}
    `,
    values,
  );
}

export class MySqlUsersRepository implements UsersRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async list(params: {
    employeeId: string;
    scope: AuthScope;
    query: UserGridQuery;
    exportMode?: boolean;
  }): Promise<{ rows: UserRecord[]; total: number }> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    whereClauses.push(...buildFilterWhereClauses(params.query, whereParams));

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const limit = params.exportMode ? 1_000 : params.query.limit;
    const offset = (params.query.page - 1) * params.query.limit;

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM sm_employee e
        LEFT JOIN sm_role r ON r.id = e.role_id
        LEFT JOIN sm_divisi d ON d.id = e.division_id
        ${whereSql}
      `,
      whereParams,
    )) as [Array<{ total: number }>, unknown];

    const dataParams = [...whereParams, limit];
    let paginationSql = "LIMIT ?";

    if (!params.exportMode) {
      dataParams.push(offset);
      paginationSql = "LIMIT ? OFFSET ?";
    }

    const rows = await queryUsersWithAuditFallback(
      pool,
      (includeAuditLog) => `
        ${buildUserSelectSql(includeAuditLog)}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        ${paginationSql}
      `,
      dataParams,
    );

    return {
      rows: rows.map(mapUserRow),
      total: countRows[0]?.total ?? 0,
    };
  }

  async findByEmployeeId(employeeId: string): Promise<UserRecord | null> {
    const pool = this.poolFactory();
    const rows = await queryUsersWithAuditFallback(
      pool,
      (includeAuditLog) => `
        ${buildUserSelectSql(includeAuditLog)}
        WHERE e.employee_id = ?
        LIMIT 1
      `,
      [employeeId],
    );

    const row = rows[0];
    return row ? mapUserRow(row) : null;
  }

  async listRoleOptions(): Promise<Array<{ label: string; value: string }>> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          r.id AS value,
          r.role_name AS label,
          rp.scope_basis AS scopeBasis,
          rp.approval_rank AS approvalRank,
          rp.web_enabled AS webEnabled,
          rp.mobile_enabled AS mobileEnabled
        FROM sm_role r
        LEFT JOIN sys_role_profiles rp ON rp.role_id = r.id
        ORDER BY r.role_name ASC
      `,
    )) as [ReferenceRow[], unknown];

    return rows.map((row) => ({
      label: row.label,
      value: String(row.value),
      scopeBasis: row.scopeBasis ?? undefined,
      approvalRank: row.approvalRank,
      webEnabled: row.webEnabled === null ? undefined : row.webEnabled === 1,
      mobileEnabled:
        row.mobileEnabled === null ? undefined : row.mobileEnabled === 1,
    }));
  }

  async listDivisionOptions(): Promise<Array<{ label: string; value: string }>> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT id AS value, name AS label
        FROM sm_divisi
        ORDER BY name ASC
      `,
    )) as [ReferenceRow[], unknown];

    return rows.map((row) => ({
      label: row.label,
      value: String(row.value),
    }));
  }

  async create(input: CreateUserRequest & { passwordHash: string }): Promise<UserRecord> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        `
          INSERT INTO sm_employee (
            employee_id,
            full_name,
            email,
            password_hash,
            role_id,
            division_id,
            grade,
            is_active,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
        `,
        [
          input.employeeId,
          input.fullName,
          input.email ?? null,
          input.passwordHash,
          input.roleId,
          input.divisionId,
          input.grade ?? null,
        ],
      );
      await replaceManagedDivisionAssignments(
        connection,
        input.employeeId,
        input.managedDivisionIds ?? [],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const createdUser = await this.findByEmployeeId(input.employeeId);
    if (!createdUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CREATE");
    }

    return createdUser;
  }

  async update(employeeId: string, input: UpdateUserRequest): Promise<UserRecord> {
    const pool = this.poolFactory();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.fullName !== undefined) {
      updates.push("full_name = ?");
      values.push(input.fullName);
    }

    if (input.email !== undefined) {
      updates.push("email = ?");
      values.push(input.email);
    }

    if (input.roleId !== undefined) {
      updates.push("role_id = ?");
      values.push(input.roleId);
    }

    if (input.divisionId !== undefined) {
      updates.push("division_id = ?");
      values.push(input.divisionId);
    }

    if (input.grade !== undefined) {
      updates.push("grade = ?");
      values.push(input.grade);
    }

    if (input.isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(input.isActive ? 1 : 0);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (updates.length > 0) {
        values.push(employeeId);
        await connection.query<ResultSetHeader>(
          `
            UPDATE sm_employee
            SET ${updates.join(", ")}
            WHERE employee_id = ?
          `,
          values,
        );
      }

      if (input.managedDivisionIds !== undefined) {
        await replaceManagedDivisionAssignments(
          connection,
          employeeId,
          input.managedDivisionIds,
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const updatedUser = await this.findByEmployeeId(employeeId);
    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_UPDATE");
    }

    return updatedUser;
  }

  async resetPassword(employeeId: string, passwordHash: string): Promise<void> {
    const pool = this.poolFactory();
    await pool.query<ResultSetHeader>(
      `
        UPDATE sm_employee
        SET password_hash = ?
        WHERE employee_id = ?
      `,
      [passwordHash, employeeId],
    );
  }

  async deactivate(employeeId: string): Promise<void> {
    const pool = this.poolFactory();
    await pool.query<ResultSetHeader>(
      `
        UPDATE sm_employee
        SET is_active = 0
        WHERE employee_id = ?
      `,
      [employeeId],
    );
  }
}
