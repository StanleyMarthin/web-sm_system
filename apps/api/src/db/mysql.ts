import { createPool, type Pool } from "mysql2/promise";
import type { HealthCheck } from "@smsystem/contracts/health";
import { getApiEnv, type ApiEnv } from "@/config/env";

let pool: Pool | null = null;

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MySQL error";
}

export function createMySqlPool(env: ApiEnv): Pool {
  return createPool({
    ...(env.DB_SOCKET_PATH
      ? {
          socketPath: env.DB_SOCKET_PATH,
        }
      : {
          host: env.DB_HOST,
          port: env.DB_PORT,
        }),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    connectTimeout: 1_000,
    waitForConnections: true,
    connectionLimit: env.DB_POOL_LIMIT,
    queueLimit: 0,
  });
}

export function getMySqlPool(env: ApiEnv = getApiEnv()): Pool {
  if (!pool) {
    pool = createMySqlPool(env);
  }

  return pool;
}

export async function probeMySql(poolInstance: Pool = getMySqlPool()): Promise<HealthCheck> {
  const startedAt = Date.now();

  try {
    await poolInstance.query("SELECT 1 AS ok");
    return {
      name: "database",
      status: "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: "database",
      status: "error",
      latencyMs: Date.now() - startedAt,
      detail: toErrorDetail(error),
    };
  }
}

export async function resetMySqlPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
