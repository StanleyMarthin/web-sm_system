import { describe, expect, test } from "bun:test";
import type { Pool } from "mysql2/promise";
import { MySqlRolesRepository } from "@/repositories/roles.repo";

describe("MySqlRolesRepository", () => {
  test("falls back when sys_role_scope_presets is not available yet", async () => {
    let queryCount = 0;

    const pool = {
      async query(sql: string) {
        queryCount += 1;

        if (queryCount === 1) {
          expect(sql).toContain("sys_role_scope_presets");
          const error = new Error("Table 'sms_db.sys_role_scope_presets' doesn't exist");
          Object.assign(error, { code: "ER_NO_SUCH_TABLE" });
          throw error;
        }

        expect(sql.includes("sys_role_scope_presets")).toBe(false);
        return [[
          {
            id: 20,
            roleName: "mis",
            description: "Management information system",
            userCount: 1,
            permissionCount: 57,
            createdAt: "2026-05-20 08:00:00",
            roleLevel: 900,
            scopeBasis: "GLOBAL",
            webEnabled: 1,
            mobileEnabled: 1,
            approvalRank: 9,
            notes: "Fallback to legacy scope basis",
            divisionMode: null,
            divisionIdsJson: null,
            unitMode: null,
            unitIdsJson: null,
          },
        ], undefined];
      },
    } as unknown as Pool;

    const repository = new MySqlRolesRepository(() => pool);
    const roles = await repository.listRoles();

    expect(roles.length).toBe(1);
    expect(roles[0]?.roleName).toBe("mis");
    expect(roles[0]?.profile?.scopePreset).toEqual({
      divisionMode: "GLOBAL",
      divisionIds: [],
      unitMode: "GLOBAL",
      unitIds: [],
    });
    expect(queryCount).toBe(2);
  });
});
