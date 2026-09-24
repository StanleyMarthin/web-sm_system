import type { RowDataPacket } from "mysql2";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { RoleProfile } from "@smsystem/contracts/rbac";
import { permissionCodes } from "@smsystem/permissions";
import { getMySqlPool } from "@/db/mysql";
import { buildUserScope } from "@/services/rbac/scope";
import { normalizeReservedAuthUser } from "@/services/rbac/reserved-role";

interface EmployeeRow extends RowDataPacket {
  employee_id: string;
  full_name: string;
  email: string | null;
  photo_url: string | null;
  role_id: number | null;
  role_name: string | null;
  division_id: number | null;
  division_name: string | null;
  grade: string | null;
  is_active: number;
}

interface PermissionRow extends RowDataPacket {
  permission_code: string;
}

interface ManagedDivisionRow extends RowDataPacket {
  division_id: number;
}

interface DivisionRow extends RowDataPacket {
  id: number;
  parent_id: number | null;
}

interface RoleProfileRow extends RowDataPacket {
  role_level: number;
  scope_basis: RoleProfile["scopeBasis"];
  web_enabled: number;
  mobile_enabled: number;
  approval_rank: number | null;
  notes: string | null;
}

interface UnitAssignmentRow extends RowDataPacket {
  car_id: string;
}

function mapRoleProfile(row: RoleProfileRow | undefined): RoleProfile | null {
  if (!row) {
    return null;
  }

  return {
    roleLevel: row.role_level,
    scopeBasis: row.scope_basis,
    webEnabled: row.web_enabled === 1,
    mobileEnabled: row.mobile_enabled === 1,
    approvalRank: row.approval_rank,
    notes: row.notes,
  };
}

export interface AuthContextRepository {
  findByEmployeeId(employeeId: string): Promise<AuthUser | null>;
}

export class MySqlAuthContextRepository implements AuthContextRepository {
  async findByEmployeeId(employeeId: string): Promise<AuthUser | null> {
    const pool = getMySqlPool();
    const [employeeRows] = await pool.query<EmployeeRow[]>(
      `
        SELECT
          e.employee_id,
          e.full_name,
          e.email,
          e.photo_url,
          e.role_id,
          r.role_name,
          e.division_id,
          d.name AS division_name,
          e.grade,
          e.is_active
        FROM sm_employee e
        LEFT JOIN sm_role r ON r.id = e.role_id
        LEFT JOIN sm_divisi d ON d.id = e.division_id
        WHERE e.employee_id = ?
        LIMIT 1
      `,
      [employeeId.toUpperCase()],
    );

    const employee = employeeRows[0];
    if (!employee || employee.is_active !== 1) {
      return null;
    }

    const [
      permissionRows,
      managedDivisionRows,
      divisionRows,
      roleProfileRows,
      unitAssignmentRows,
    ] = await Promise.all([
      pool.query<PermissionRow[]>(
        `
          SELECT sp.permission_code
          FROM sys_role_permissions srp
          JOIN sys_permissions sp ON sp.id = srp.permission_id
          WHERE srp.role_id = ?
          ORDER BY sp.permission_code ASC
        `,
        [employee.role_id],
      ),
      pool.query<ManagedDivisionRow[]>(
        `
          SELECT division_id
          FROM employee_managed_divisions
          WHERE employee_id = ?
          ORDER BY division_id ASC
        `,
        [employee.employee_id],
      ),
      pool.query<DivisionRow[]>(
        `
          SELECT id, parent_id
          FROM sm_divisi
        `,
      ),
      pool.query<RoleProfileRow[]>(
        `
          SELECT
            role_level,
            scope_basis,
            web_enabled,
            mobile_enabled,
            approval_rank,
            notes
          FROM sys_role_profiles
          WHERE role_id = ?
          LIMIT 1
        `,
        [employee.role_id],
      ),
      pool.query<UnitAssignmentRow[]>(
        `
          SELECT DISTINCT car_id
          FROM (
            SELECT car_id
            FROM car_project_assignment
            WHERE ended_at IS NULL AND kp_id = ?
            UNION
            SELECT car_id
            FROM car_project_assignment
            WHERE ended_at IS NULL AND advisor_id = ?
            UNION
            SELECT car_id
            FROM car_project_assignment
            WHERE ended_at IS NULL AND kd_id = ?
          ) unit_scope
          ORDER BY car_id ASC
        `,
        [employee.employee_id, employee.employee_id, employee.employee_id],
      ),
    ]);

    const permissions = permissionRows[0].map((row) => row.permission_code);
    const managedDivisionIds = managedDivisionRows[0].map((row) => row.division_id);
    const managedUnitIds = unitAssignmentRows[0].map((row) => row.car_id);
    const divisions = divisionRows[0].map((row) => ({
      id: row.id,
      parentId: row.parent_id,
    }));
    const roleProfile = mapRoleProfile(roleProfileRows[0][0]);

    return normalizeReservedAuthUser({
      employeeId: employee.employee_id,
      fullName: employee.full_name,
      email: employee.email,
      photoUrl: employee.photo_url,
      roleId: employee.role_id,
      roleName: employee.role_name ?? "viewer",
      divisionId: employee.division_id,
      divisionName: employee.division_name ?? "",
      grade: employee.grade,
      permissions,
      roleProfile,
      scope: buildUserScope({
        divisionId: employee.division_id,
        divisions,
        managedDivisionIds,
        managedUnitIds,
        permissions,
        viewAllUnitsPermission: permissionCodes.viewAllUnits,
        viewAssignedUnitsPermission: permissionCodes.viewAssignedUnits,
        roleProfile,
      }),
    });
  }
}
