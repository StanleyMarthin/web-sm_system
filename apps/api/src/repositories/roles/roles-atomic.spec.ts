import { describe, expect, test } from "bun:test";
import type { Pool } from "mysql2/promise";
import { MySqlRolesRepository } from "./roles.repo";

function fixture(failPermissions = false, missingScopeTable = false) {
  const operations: string[] = [];
  const connection = {
    async beginTransaction() { operations.push("begin"); },
    async commit() { operations.push("commit"); },
    async rollback() { operations.push("rollback"); },
    release() { operations.push("release"); },
    async query(sql: string) {
      if (sql.includes("INSERT INTO sm_role")) { operations.push("create-role"); return [{ insertId: 5 }]; }
      if (sql.includes("UPDATE sm_role")) { operations.push("update-role"); return [{}]; }
      if (sql.includes("FOR UPDATE")) { operations.push("lock-role"); return [[{ id: 5 }]]; }
      if (sql.includes("SELECT permission_id")) { operations.push("read-permissions"); return [[{ permissionId: 1 }]]; }
      if (sql.includes("INSERT INTO sys_role_profiles")) { operations.push("profile"); return [{}]; }
      if (sql.includes("INSERT INTO sys_role_scope_presets")) {
        operations.push("scope");
        if (missingScopeTable) throw Object.assign(new Error("sys_role_scope_presets missing"), { code: "ER_NO_SUCH_TABLE" });
      }
      if (sql.includes("DELETE FROM sys_role_permissions")) operations.push("delete-permissions");
      if (sql.includes("INSERT INTO sys_role_permissions")) {
        operations.push("insert-permissions");
        if (failPermissions) throw new Error("invalid permission");
      }
      return [{}];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async query() { return [[{ id: 5, roleName: "role", description: null, userCount: 0, permissionCount: 1, createdAt: null, roleLevel: null, scopeBasis: null }]]; },
  } as unknown as Pool;
  return { operations, repository: new MySqlRolesRepository(() => pool) };
}

describe("role and permission transaction", () => {
  test("creates role and permissions in one transaction", async () => {
    const { operations, repository } = fixture();
    await repository.createRole({ roleName: "role", permissionIds: [1, 2] });
    expect(operations).toEqual(["begin", "create-role", "delete-permissions", "insert-permissions", "commit", "release"]);
  });

  test("rolls back role update when permission write fails", async () => {
    const { operations, repository } = fixture(true);
    let failure: unknown;
    try { await repository.updateRole(5, { roleName: "role", permissionIds: [999] }); } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : "").toBe("invalid permission");
    expect(operations).toEqual(["begin", "update-role", "delete-permissions", "insert-permissions", "rollback", "release"]);
  });

  test("keeps permissions untouched when they are omitted", async () => {
    const { operations, repository } = fixture();
    await repository.updateRole(5, { roleName: "role" });
    expect(operations).toEqual(["begin", "update-role", "commit", "release"]);
  });

  test("rejects stale permissions without changing the role", async () => {
    const { operations, repository } = fixture();
    let failure: unknown;
    try { await repository.updateRole(5, { roleName: "baru", permissionIds: [2], expectedPermissionIds: [] }); } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : "").toBe("ROLE_PERMISSIONS_CHANGED");
    expect(operations).toEqual(["begin", "lock-role", "read-permissions", "rollback", "release"]);
  });

  test("rolls back when a custom scope cannot be stored", async () => {
    const { operations, repository } = fixture(false, true);
    let failure: unknown;
    try {
      await repository.updateRole(5, { profile: { roleLevel: 100, scopeBasis: "ASSIGNED_DIVISIONS", webEnabled: true, mobileEnabled: true, approvalRank: null, notes: null, scopePreset: { divisionMode: "ASSIGNED_DIVISIONS", divisionIds: [12], unitMode: "NONE", unitIds: [] } } });
    } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : "").toBe("ROLE_SCOPE_STORAGE_UNAVAILABLE");
    expect(operations).toEqual(["begin", "profile", "scope", "rollback", "release"]);
  });
});
