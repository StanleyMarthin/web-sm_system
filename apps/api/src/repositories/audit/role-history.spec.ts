import { describe, expect, test } from "bun:test";
import type { Pool } from "mysql2/promise";
import type { ApiEnv } from "@/config/env";
import { MySqlAuditRepository } from "./audit.repo";

describe("role audit history", () => {
  test("limits history to the requested role and source database", async () => {
    let values: unknown[] = [];
    const pool = { async execute(sql: string, params: unknown[]) {
      expect(sql).toContain("`sms_log`.log_audit_trails");
      expect(sql).toContain("LIMIT 100");
      values = params;
      return [[{ id: 7, actorName: "Admin", action: "role.update", createdAt: "2026-10-23 10:00:00", oldValue: null, newValue: {} }]];
    } } as unknown as Pick<Pool, "execute">;
    const repository = new MySqlAuditRepository(() => pool, { AUDIT_DB_NAME: "sms_log", DB_NAME: "sms_db" } as ApiEnv);
    const history = await repository.listRoleHistory(12);
    expect(values).toEqual(["sms_db", "12"]);
    expect(history[0]?.actorName).toBe("Admin");
  });
});
