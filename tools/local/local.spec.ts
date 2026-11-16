import { describe, expect, test } from "bun:test";
import { assertLocalConfig, createLocalConfig, localRuntimeEnv } from "./config";

describe("local bootstrap boundary", () => {
  test("uses isolated database, Redis and loopback HTTP ports", () => {
    const config = createLocalConfig();
    expect(config.mysqlPort).toBe(13306);
    expect(config.redisPort).toBe(16379);
    const env = localRuntimeEnv(config);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DB_HOST).toBe("127.0.0.1");
    expect(env.API_HOST).toBe("127.0.0.1");
    expect(env.SM_LOGIN_BASE_URL).toBe("http://127.0.0.1:13805");
    expect(env.R2_SECRET_ACCESS_KEY).toBe("");
    expect(env.COOKIE_SECURE).toBe("false");
    expect(createLocalConfig().rootPassword).not.toBe(config.rootPassword);
  });

  test("rejects reused service ports, foreign config and production mode", () => {
    const config = createLocalConfig();
    for (const patch of [{ project: "production" }, { mysqlPort: 3306 }, { redisPort: 6379 }, { rootPassword: "" }]) {
      expect(() => assertLocalConfig({ ...config, ...patch })).toThrow();
    }
    expect(() => assertLocalConfig(config, "production")).toThrow();
  });
});

import { createLocalLoginHandler } from "./login";

describe("local login contract", () => {
  async function fixture() {
    const values = new Map<string, string>();
    const sets = new Map<string, Set<string>>();
    const hash = await Bun.password.hash("admin", { algorithm: "bcrypt", cost: 4 });
    const redis = {
      async get(key: string) { return values.get(key) ?? null; },
      async getDel(key: string) { const raw = values.get(key) ?? null; values.delete(key); return raw; },
      async set(key: string, value: string) { values.set(key, value); },
      async del(key: string) { values.delete(key); sets.delete(key); },
      async sAdd(key: string, value: string) { const set = sets.get(key) ?? new Set<string>(); set.add(value); sets.set(key, set); },
      async sRem(key: string, value: string) { sets.get(key)?.delete(value); },
      async sMembers(key: string) { return [...(sets.get(key) ?? [])]; },
      async expire() {},
    };
    const pool = { async query(_sql: string, [name]: string[]) {
      const matches = ["admin", "ADMIN", "SM-03.004"].includes(name!);
      return [matches ? [{ employee_id: "SM-03.004", password_hash: hash, is_active: 1 }] : []];
    } };
    const handler = createLocalLoginHandler(pool as never, redis as never, "internal-local-secret");
    const request = (path: string, body: object, token = "") => handler(new Request(`http://127.0.0.1${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-SM-Internal-Token": token }, body: JSON.stringify(body),
    }));
    const login = () => request("/api/v1/auth/login-web", { employeeId: "admin", password: "admin", deviceId: "device-1" });
    return { handler, request, login };
  }

  test("authenticates admin using its database password hash and preserves the canonical identity", async () => {
    const { login, request } = await fixture();
    const response = await login();
    expect(response.status).toBe(200);
    expect((await response.json()).data.user.employeeId).toBe("SM-03.004");
    expect((await request("/api/v1/auth/login-web", { employeeId: "admin", password: "wrong", deviceId: "device-1" })).status).toBe(401);
    expect((await request("/api/v1/auth/login-web", { employeeId: "unknown", password: "admin", deviceId: "device-1" })).status).toBe(401);
  });

  test("binds refresh tokens to a device and rotates them once", async () => {
    const { login, request } = await fixture();
    const token = (await (await login()).json()).data.refreshToken;
    expect((await request("/api/v1/auth/refresh", { refreshToken: token, deviceId: "other-device" })).status).toBe(401);
    expect((await request("/api/v1/auth/refresh", { refreshToken: token, deviceId: "device-1" })).status).toBe(200);
    expect((await request("/api/v1/auth/refresh", { refreshToken: token, deviceId: "device-1" })).status).toBe(401);
  });

  test("requires the internal token before invalidating an employee's sessions", async () => {
    const { login, request, handler } = await fixture();
    const token = (await (await login()).json()).data.refreshToken;
    const path = "/api/v1/auth/internal/sessions/invalidate";
    expect((await request(path, { employeeIds: ["SM-03.004"] })).status).toBe(403);
    expect((await request(path, { employeeIds: ["SM-03.004"] }, "internal-local-secret")).status).toBe(200);
    expect((await request("/api/v1/auth/refresh", { refreshToken: token, deviceId: "device-1" })).status).toBe(401);
    expect((await handler(new Request("http://example.com/health"))).status).toBe(403);
  });
});

import { seedLocalAdmin } from "./seed";

describe("local seed preservation", () => {
  test("leaves an initialized account and its grants untouched", async () => {
    let writes = 0;
    let rolledBack = false;
    let released = false;
    const connection = {
      async query(sql: string) {
        if (sql.includes("installation")) return [[{ schema_version: 1 }]];
        return [[{ employee_id: "SM-03.004" }]];
      },
      async execute() { writes += 1; },
      async beginTransaction() {},
      async rollback() { rolledBack = true; },
      release() { released = true; },
    };
    expect(await seedLocalAdmin({ async getConnection() { return connection; } } as never)).toBe(false);
    expect(writes).toBe(0);
    expect(rolledBack).toBe(true);
    expect(released).toBe(true);
  });

  test("refuses an unmarked database before any account or permission write", async () => {
    let writes = 0;
    let refused = false;
    const connection = {
      async query() { return [[]]; },
      async execute() { writes += 1; },
      async rollback() {},
      release() {},
    };
    try { await seedLocalAdmin({ async getConnection() { return connection; } } as never); } catch { refused = true; }
    expect(refused).toBe(true);
    expect(writes).toBe(0);
  });
});
