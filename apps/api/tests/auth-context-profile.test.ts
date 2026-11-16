import { describe, expect, test } from "bun:test";
import type { Pool } from "mysql2/promise";
import { MySqlAuthContextRepository } from "@/repositories/auth-context/auth-context.repo";

function repository(scopeBasis: string, missingPreset = false) {
  const pool = {
    async query(sql: string) {
      if (sql.includes("FROM sm_employee")) return [[{ employee_id: "EMP", full_name: "Test", role_id: 17, role_name: "custom", division_id: 4, is_active: 1 }]];
      if (sql.includes("FROM sys_role_permissions")) return [[{ permission_code: "TASK_VIEW" }]];
      if (sql.includes("FROM employee_managed_divisions")) return [[{ division_id: 4 }]];
      if (sql.includes("FROM sm_divisi")) return [[{ id: 4, parent_id: null }, { id: 5, parent_id: 4 }]];
      if (sql.includes("FROM sys_role_profiles")) {
        if (missingPreset && sql.includes("LEFT JOIN sys_role_scope_presets")) throw Object.assign(new Error("missing preset"), { code: "ER_NO_SUCH_TABLE" });
        return [[{ role_level: 180, scope_basis: scopeBasis, web_enabled: 1, mobile_enabled: 1, approval_rank: 1, notes: null,
          ...(!missingPreset ? { division_mode: scopeBasis === "SELF_ONLY" ? "NONE" : "ASSIGNED_DIVISIONS", division_ids_json: "[]", unit_mode: "NONE", unit_ids_json: "[]" } : {}),
        }]];
      }
      if (sql.includes("car_project_assignment")) return [[]];
      throw new Error(`Unexpected query: ${sql}`);
    },
  } as unknown as Pool;
  return new MySqlAuthContextRepository(() => pool);
}

describe("DB role profile projection", () => {
  test("preserves stored SELF_ONLY instead of broadening to the default", async () => {
    const user = await repository("SELF_ONLY").findByEmployeeId("EMP");
    expect(user?.roleProfile).toMatchObject({ scopeBasis: "SELF_ONLY", roleLevel: 180, approvalRank: 1 });
    expect(user?.scope.canViewAssignedUnits).toBe(false);
    expect(user?.scope.canViewAllUnits).toBe(false);
  });
  test("default assigned preset follows actual employee division assignments", async () => {
    const user = await repository("ASSIGNED_DIVISIONS").findByEmployeeId("EMP");
    expect(user?.scope.divisionIds).toEqual([4, 5]);
  });
  test("missing preset table retains the real role profile and assignment scope", async () => {
    const user = await repository("ASSIGNED_DIVISIONS", true).findByEmployeeId("EMP");
    expect(user?.roleProfile?.scopeBasis).toBe("ASSIGNED_DIVISIONS");
    expect(user?.scope.divisionIds).toEqual([4, 5]);
  });
});
