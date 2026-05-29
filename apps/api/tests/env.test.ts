import { describe, expect, test } from "bun:test";
import { loadApiEnv } from "@/config/env";

describe("loadApiEnv", () => {
  test("parses required values and applies defaults", () => {
    const env = loadApiEnv(
      {
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_USER: "root",
        DB_PASS: "secret",
        DB_NAME: "sms_db",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "6379",
        REDIS_DB: "0",
      },
      "/tmp",
    );

    expect(env).toMatchObject({
      API_HOST: "0.0.0.0",
      API_PORT: 3001,
      AUDIT_DB_NAME: "sms_log",
      DB_POOL_LIMIT: 20,
      REDIS_DB: 0,
    });
  });

  test("throws when a required value is missing", () => {
    expect(() => loadApiEnv({}, "/tmp")).toThrow(/DB_HOST/);
  });
});
