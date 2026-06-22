import { describe, expect, test } from "bun:test";
import type { ApiEnv } from "@/config/env";
import { MySqlAuditRepository } from "@/repositories/audit.repo";

const sampleEnv: ApiEnv = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: 3001,
  SM_LOGIN_BASE_URL: "http://127.0.0.1:8085",
  ALLOW_INSECURE_SM_LOGIN: true,
  COOKIE_SECURE: false,
  WEB_ALLOWED_ORIGINS: [],
  SESSION_TTL_SECONDS: 43_200,
  REFRESH_TTL_SECONDS: 2_592_000,
  AUDIT_DB_NAME: "sms_log",
  DB_HOST: "127.0.0.1",
  DB_PORT: 3306,
  DB_USER: "root",
  DB_PASS: "secret",
  DB_NAME: "sms_db",
  PURCHASE_DB_NAME: "sms_purchase",
  CORE_DB_NAME: "sms_db",
  WAREHOUSE_DB_NAME: "sms_warehouse",
  DB_POOL_LIMIT: 20,
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: 6379,
  REDIS_DB: 0,
  REDIS_PASSWORD: undefined,
};

describe("MySqlAuditRepository", () => {
  test("writes audit entries into the configured audit database", async () => {
    let executedSql = "";
    let executedParams: unknown[] = [];

    const repository = new MySqlAuditRepository(
      () =>
        ({
          async execute(sql: string, params: unknown[]) {
            executedSql = sql;
            executedParams = params;
            return [[], []];
          },
        }) as never,
      sampleEnv,
    );

    await repository.insert({
      actorId: "SM-03.004",
      actorName: "Sahrul Riswanto",
      action: "auth.login",
      module: "auth",
      recordId: "SM-03.004",
      newValue: {
        employeeId: "SM-03.004",
      },
      ipAddress: "127.0.0.1",
    });

    expect(executedSql).toContain("INSERT INTO `sms_log`.log_audit_trails");
    expect(executedParams[0]).toBe("sms_db");
    expect(executedParams[1]).toBe("auth");
    expect(executedParams[4]).toBe("SM-03.004");
    expect(executedParams[5]).toBe("Sahrul Riswanto");
  });
});
