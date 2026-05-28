import type {
  CreateRoleRequest,
  PermissionRecord,
  RoleDivisionScopeMode,
  RoleProfile,
  RoleRecord,
  RoleReferenceOption,
  RoleScopeBasis,
  RoleScopePreset,
  RoleUnitScopeMode,
  UpdateRoleRequest,
} from "@smsystem/contracts/rbac";
import { getPermissionMeta } from "@smsystem/permissions";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface RoleRow extends RowDataPacket {
  id: number;
  roleName: string;
  description: string | null;
  userCount: number;
  permissionCount: number;
  createdAt: string | null;
  roleLevel: number | null;
  scopeBasis: RoleProfile["scopeBasis"] | null;
  webEnabled: number | null;
  mobileEnabled: number | null;
  approvalRank: number | null;
  notes: string | null;
  divisionMode: RoleDivisionScopeMode | null;
  divisionIdsJson: string | null;
  unitMode: RoleUnitScopeMode | null;
  unitIdsJson: string | null;
}

interface PermissionRow extends RowDataPacket {
  id: number;
  permissionCode: string;
  description: string | null;
  moduleName: string | null;
}

interface PermissionIdRow extends RowDataPacket {
  permissionId: number;
}

function isMissingRoleScopePresetTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const message =
    "message" in error && typeof error.message === "string" ? error.message : "";

  return (
    code === "ER_NO_SUCH_TABLE" &&
    message.toLowerCase().includes("sys_role_scope_presets")
  );
}

export interface RolesRepository {
  listRoles(): Promise<RoleRecord[]>;
  findRoleById(roleId: number): Promise<RoleRecord | null>;
  createRole(input: CreateRoleRequest): Promise<RoleRecord>;
  updateRole(roleId: number, input: UpdateRoleRequest): Promise<RoleRecord>;
  listRoleReferences(): Promise<{
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  }>;
  listPermissions(): Promise<PermissionRecord[]>;
  getRolePermissionIds(roleId: number): Promise<number[]>;
  updateRolePermissions(roleId: number, permissionIds: number[]): Promise<number[]>;
}

function deriveScopePresetFromScopeBasis(
  scopeBasis: RoleScopeBasis | null | undefined,
): RoleScopePreset {
  switch (scopeBasis) {
    case "GLOBAL":
      return {
        divisionMode: "GLOBAL",
        divisionIds: [],
        unitMode: "GLOBAL",
        unitIds: [],
      };
    case "ASSIGNED_UNITS":
      return {
        divisionMode: "NONE",
        divisionIds: [],
        unitMode: "ASSIGNED_UNITS",
        unitIds: [],
      };
    case "ASSIGNED_DIVISIONS":
      return {
        divisionMode: "ASSIGNED_DIVISIONS",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
    case "OWN_DIVISION":
      return {
        divisionMode: "OWN_DIVISION",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
    default:
      return {
        divisionMode: "NONE",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
  }
}

function parseJsonIntegerArray(value: string | null): number[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => Number.parseInt(String(item), 10))
      .filter((item) => Number.isFinite(item) && item > 0)
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

function parseJsonStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item).trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function resolveScopePreset(row: RoleRow): RoleScopePreset {
  const fallback = deriveScopePresetFromScopeBasis(row.scopeBasis);
  return {
    divisionMode: row.divisionMode ?? fallback.divisionMode,
    divisionIds: parseJsonIntegerArray(row.divisionIdsJson),
    unitMode: row.unitMode ?? fallback.unitMode,
    unitIds: parseJsonStringArray(row.unitIdsJson),
  };
}

function mapRoleRow(row: RoleRow): RoleRecord {
  return {
    id: row.id,
    roleName: row.roleName,
    description: row.description,
    userCount: row.userCount,
    permissionCount: row.permissionCount,
    createdAt: row.createdAt,
    profile:
      row.roleLevel === null || row.scopeBasis === null
        ? null
        : {
            roleLevel: row.roleLevel,
            scopeBasis: row.scopeBasis,
            webEnabled: row.webEnabled === 1,
            mobileEnabled: row.mobileEnabled === 1,
            approvalRank: row.approvalRank,
            notes: row.notes,
            scopePreset: resolveScopePreset(row),
          },
  };
}

function mapPermissionRow(row: PermissionRow): PermissionRecord {
  const meta = getPermissionMeta(row.permissionCode);
  return {
    id: row.id,
    permissionCode: row.permissionCode,
    description: row.description,
    moduleName: row.moduleName,
    platforms: meta.platforms,
    audience: meta.audience,
  };
}

function buildRoleSelectSql(includeScopePresets = true): string {
  return `
    SELECT
      r.id AS id,
      r.role_name AS roleName,
      r.description AS description,
      COUNT(DISTINCT e.employee_id) AS userCount,
      COUNT(DISTINCT srp.permission_id) AS permissionCount,
      DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      rp.role_level AS roleLevel,
      rp.scope_basis AS scopeBasis,
      rp.web_enabled AS webEnabled,
      rp.mobile_enabled AS mobileEnabled,
      rp.approval_rank AS approvalRank,
      rp.notes AS notes,
      ${
        includeScopePresets
          ? `
      rsp.division_mode AS divisionMode,
      CAST(rsp.division_ids_json AS CHAR) AS divisionIdsJson,
      rsp.unit_mode AS unitMode,
      CAST(rsp.unit_ids_json AS CHAR) AS unitIdsJson
      `
          : `
      NULL AS divisionMode,
      NULL AS divisionIdsJson,
      NULL AS unitMode,
      NULL AS unitIdsJson
      `
      }
    FROM sm_role r
    LEFT JOIN sm_employee e ON e.role_id = r.id
    LEFT JOIN sys_role_permissions srp ON srp.role_id = r.id
    LEFT JOIN sys_role_profiles rp ON rp.role_id = r.id
    ${
      includeScopePresets
        ? "LEFT JOIN sys_role_scope_presets rsp ON rsp.role_id = r.id"
        : ""
    }
  `;
}

async function queryRoleRows(
  pool: Pool,
  whereClause = "",
  tailClause = "",
  params: unknown[] = [],
): Promise<RoleRow[]> {
  const baseSql = `
    ${buildRoleSelectSql()}
    ${whereClause}
    GROUP BY
      r.id,
      r.role_name,
      r.description,
      r.created_at,
      rp.role_level,
      rp.scope_basis,
      rp.web_enabled,
      rp.mobile_enabled,
      rp.approval_rank,
      rp.notes
    ${tailClause}
  `;

  try {
    const [rows] = (await pool.query(baseSql, params)) as [RoleRow[], unknown];
    return rows;
  } catch (error) {
    if (!isMissingRoleScopePresetTableError(error)) {
      throw error;
    }

    const fallbackSql = `
      ${buildRoleSelectSql(false)}
      ${whereClause}
      GROUP BY
        r.id,
        r.role_name,
        r.description,
        r.created_at,
        rp.role_level,
        rp.scope_basis,
        rp.web_enabled,
        rp.mobile_enabled,
        rp.approval_rank,
        rp.notes
      ${tailClause}
    `;
    const [rows] = (await pool.query(fallbackSql, params)) as [RoleRow[], unknown];
    return rows;
  }
}

async function upsertRoleProfile(
  connection: PoolConnection,
  roleId: number,
  profile: RoleProfile,
): Promise<void> {
  await connection.query(
    `
      INSERT INTO sys_role_profiles (
        role_id,
        role_level,
        scope_basis,
        web_enabled,
        mobile_enabled,
        approval_rank,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        role_level = VALUES(role_level),
        scope_basis = VALUES(scope_basis),
        web_enabled = VALUES(web_enabled),
        mobile_enabled = VALUES(mobile_enabled),
        approval_rank = VALUES(approval_rank),
        notes = VALUES(notes),
        updated_at = NOW()
    `,
    [
      roleId,
      profile.roleLevel,
      profile.scopeBasis,
      profile.webEnabled ? 1 : 0,
      profile.mobileEnabled ? 1 : 0,
      profile.approvalRank,
      profile.notes,
    ],
  );
}

function deriveScopeBasisFromPreset(scopePreset: RoleScopePreset): RoleScopeBasis {
  if (scopePreset.divisionMode === "GLOBAL" || scopePreset.unitMode === "GLOBAL") {
    return "GLOBAL";
  }

  if (scopePreset.unitMode === "ASSIGNED_UNITS") {
    return "ASSIGNED_UNITS";
  }

  if (scopePreset.divisionMode === "ASSIGNED_DIVISIONS") {
    return "ASSIGNED_DIVISIONS";
  }

  if (scopePreset.divisionMode === "OWN_DIVISION") {
    return "OWN_DIVISION";
  }

  return "SELF_ONLY";
}

function resolveScopePresetPayload(profile: RoleProfile): RoleScopePreset {
  const fallback = deriveScopePresetFromScopeBasis(profile.scopeBasis);
  return {
    divisionMode: profile.scopePreset?.divisionMode ?? fallback.divisionMode,
    divisionIds: [...new Set(profile.scopePreset?.divisionIds ?? [])].sort((left, right) => left - right),
    unitMode: profile.scopePreset?.unitMode ?? fallback.unitMode,
    unitIds: [...new Set(profile.scopePreset?.unitIds ?? [])].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

async function upsertRoleScopePreset(
  connection: PoolConnection,
  roleId: number,
  profile: RoleProfile,
): Promise<void> {
  const scopePreset = resolveScopePresetPayload(profile);
  await connection.query(
    `
      INSERT INTO sys_role_scope_presets (
        role_id,
        division_mode,
        division_ids_json,
        unit_mode,
        unit_ids_json,
        created_at,
        updated_at
      ) VALUES (?, ?, CAST(? AS JSON), ?, CAST(? AS JSON), NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        division_mode = VALUES(division_mode),
        division_ids_json = VALUES(division_ids_json),
        unit_mode = VALUES(unit_mode),
        unit_ids_json = VALUES(unit_ids_json),
        updated_at = NOW()
    `,
    [
      roleId,
      scopePreset.divisionMode,
      JSON.stringify(scopePreset.divisionIds),
      scopePreset.unitMode,
      JSON.stringify(scopePreset.unitIds),
    ],
  );
}

export class MySqlRolesRepository implements RolesRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async listRoles(): Promise<RoleRecord[]> {
    const pool = this.poolFactory();
    const rows = await queryRoleRows(pool, "", "ORDER BY r.role_name ASC");

    return rows.map(mapRoleRow);
  }

  async findRoleById(roleId: number): Promise<RoleRecord | null> {
    const pool = this.poolFactory();
    const rows = await queryRoleRows(pool, "WHERE r.id = ?", "LIMIT 1", [roleId]);

    const row = rows[0];
    return row ? mapRoleRow(row) : null;
  }

  async createRole(input: CreateRoleRequest): Promise<RoleRecord> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    let roleId = 0;

    try {
      await connection.beginTransaction();
      const [result] = await connection.query<ResultSetHeader>(
        `
          INSERT INTO sm_role (role_name, description, created_at)
          VALUES (?, ?, NOW())
        `,
        [input.roleName, input.description ?? null],
      );
      roleId = result.insertId;

      if (input.profile) {
        const normalizedProfile = {
          ...input.profile,
          scopeBasis: deriveScopeBasisFromPreset(resolveScopePresetPayload(input.profile)),
        };
        await upsertRoleProfile(connection, roleId, normalizedProfile);
        try {
          await upsertRoleScopePreset(connection, roleId, normalizedProfile);
        } catch (error) {
          if (!isMissingRoleScopePresetTableError(error)) {
            throw error;
          }
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const createdRole = await this.findRoleById(roleId);
    if (!createdRole) {
      throw new Error("ROLE_NOT_FOUND_AFTER_CREATE");
    }

    return createdRole;
  }

  async updateRole(roleId: number, input: UpdateRoleRequest): Promise<RoleRecord> {
    const pool = this.poolFactory();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.roleName !== undefined) {
      updates.push("role_name = ?");
      values.push(input.roleName);
    }

    if (input.description !== undefined) {
      updates.push("description = ?");
      values.push(input.description);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (updates.length > 0) {
        values.push(roleId);
        await connection.query<ResultSetHeader>(
          `
            UPDATE sm_role
            SET ${updates.join(", ")}
            WHERE id = ?
          `,
          values,
        );
      }

      if (input.profile) {
        const normalizedProfile: RoleProfile = {
          roleLevel: input.profile.roleLevel ?? 0,
          scopeBasis: input.profile.scopeBasis ?? "OWN_DIVISION",
          webEnabled: input.profile.webEnabled ?? true,
          mobileEnabled: input.profile.mobileEnabled ?? true,
          approvalRank:
            input.profile.approvalRank === undefined
              ? null
              : input.profile.approvalRank,
          notes: input.profile.notes ?? null,
          scopePreset: input.profile.scopePreset,
        };
        normalizedProfile.scopeBasis = deriveScopeBasisFromPreset(
          resolveScopePresetPayload(normalizedProfile),
        );
        await upsertRoleProfile(connection, roleId, normalizedProfile);
        try {
          await upsertRoleScopePreset(connection, roleId, normalizedProfile);
        } catch (error) {
          if (!isMissingRoleScopePresetTableError(error)) {
            throw error;
          }
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const updatedRole = await this.findRoleById(roleId);
    if (!updatedRole) {
      throw new Error("ROLE_NOT_FOUND_AFTER_UPDATE");
    }

    return updatedRole;
  }

  async listPermissions(): Promise<PermissionRecord[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          id AS id,
          permission_code AS permissionCode,
          description AS description,
          module_name AS moduleName
        FROM sys_permissions
        ORDER BY module_name ASC, permission_code ASC
      `,
    )) as [PermissionRow[], unknown];

    return rows.map(mapPermissionRow);
  }

  async listRoleReferences(): Promise<{
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  }> {
    const pool = this.poolFactory();
    const [divisionResult, unitResult] = await Promise.all([
      pool.query<Array<RowDataPacket & { value: string; label: string }>>(
        `
          SELECT CAST(id AS CHAR) AS value, name AS label
          FROM sm_divisi
          WHERE name IS NOT NULL AND TRIM(name) <> ''
          ORDER BY name ASC
        `,
      ),
      pool.query<Array<RowDataPacket & { value: string; label: string }>>(
        `
          SELECT CAST(id AS CHAR) AS value, unit_name AS label
          FROM cars
          WHERE unit_name IS NOT NULL AND TRIM(unit_name) <> ''
          ORDER BY unit_name ASC
        `,
      ),
    ]);
    const divisionRows = divisionResult[0];
    const unitRows = unitResult[0];

    return {
      divisions: divisionRows.map((row) => ({ label: row.label, value: row.value })),
      units: unitRows.map((row) => ({ label: row.label, value: row.value })),
    };
  }

  async getRolePermissionIds(roleId: number): Promise<number[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT permission_id AS permissionId
        FROM sys_role_permissions
        WHERE role_id = ?
        ORDER BY permission_id ASC
      `,
      [roleId],
    )) as [PermissionIdRow[], unknown];

    return rows.map((row) => row.permissionId);
  }

  async updateRolePermissions(
    roleId: number,
    permissionIds: number[],
  ): Promise<number[]> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        `
          DELETE FROM sys_role_permissions
          WHERE role_id = ?
        `,
        [roleId],
      );

      if (permissionIds.length > 0) {
        const placeholders = permissionIds.map(() => "(?, ?)").join(", ");
        const values = permissionIds.flatMap((permissionId) => [roleId, permissionId]);
        await connection.query(
          `
            INSERT INTO sys_role_permissions (role_id, permission_id)
            VALUES ${placeholders}
          `,
          values,
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.getRolePermissionIds(roleId);
  }
}
