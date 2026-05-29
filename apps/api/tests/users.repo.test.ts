import type { Pool } from "mysql2/promise";
import { describe, expect, test } from "bun:test";
import { resetApiEnvForTests } from "@/config/env";
import { MySqlUsersRepository } from "@/repositories/users.repo";
import { sanitizeUserGridQuery } from "@/services/users/query";

const sampleUserRow = {
  employeeId: "SM-03.003",
  fullName: "RIFKI ARISCHANDRA",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: null,
  isActive: 1,
  lastLoginAt: null,
  deviceCount: 0,
  createdAt: "2026-05-13 07:30:00",
  managedDivisionIdsCsv: null,
  managedDivisionNamesCsv: null,
  activeUnitIdsCsv: null,
};

function createMissingAuditError() {
  return Object.assign(new Error("Unknown database 'sms_log'"), {
    code: "ER_BAD_DB_ERROR",
  });
}

function seedRepositoryEnv() {
  process.env.DB_HOST = "127.0.0.1";
  process.env.DB_PORT = "3306";
  process.env.DB_USER = "tester";
  process.env.DB_PASS = "tester";
  process.env.DB_NAME = "sms_db";
  process.env.REDIS_HOST = "127.0.0.1";
  process.env.REDIS_PORT = "6379";
  process.env.REDIS_DB = "0";
  process.env.AUDIT_DB_NAME = "sms_log";
  resetApiEnvForTests();
}

describe("MySqlUsersRepository", () => {
  test("falls back when audit database is missing on list", async () => {
    seedRepositoryEnv();
    const executedSql: string[] = [];
    const repository = new MySqlUsersRepository(
      () =>
        ({
          async query(sql: string) {
            executedSql.push(sql);

            if (sql.includes("COUNT(*) AS total")) {
              return [[{ total: 1 }], undefined];
            }

            if (sql.includes("sms_log.sm_audit_log")) {
              throw createMissingAuditError();
            }

            return [[sampleUserRow], undefined];
          },
        }) as unknown as Pool,
    );

    const result = await repository.list({
      employeeId: "SM-03.003",
      scope: {
        canViewAllUnits: true,
        canViewAssignedUnits: true,
        divisionIds: [],
        managedDivisionIds: [],
        unitIds: [],
      },
      query: sanitizeUserGridQuery({
        page: 1,
        limit: 25,
        search: "",
        sortBy: "employeeId",
        sortDirection: "asc",
        filters: [],
        view: null,
      }),
    });

    expect(result.total).toBe(1);
    expect(result.rows[0]?.employeeId).toBe("SM-03.003");
    expect(result.rows[0]?.lastLoginAt).toBe(null);
    expect(executedSql.some((sql) => sql.includes("sms_log.sm_audit_log"))).toBe(true);
    expect(executedSql.some((sql) => sql.includes("SELECT NULL AS actor_id"))).toBe(true);
  });

  test("falls back when audit database is missing on detail lookup", async () => {
    seedRepositoryEnv();
    const repository = new MySqlUsersRepository(
      () =>
        ({
          async query(sql: string) {
            if (sql.includes("sms_log.sm_audit_log")) {
              throw createMissingAuditError();
            }

            return [[sampleUserRow], undefined];
          },
        }) as unknown as Pool,
    );

    const result = await repository.findByEmployeeId("SM-03.003");

    expect(result?.employeeId).toBe("SM-03.003");
    expect(result?.lastLoginAt).toBe(null);
  });
});
