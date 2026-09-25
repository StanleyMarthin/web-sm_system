import { createPool, type Pool } from "mysql2/promise";
import type { HealthCheck } from "@smsystem/contracts/health";
import { getApiEnv, type ApiEnv } from "@/config/env";

let pool: Pool | null = null;
const QUERY_TIMEOUT_MS = 5_000;

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MySQL error";
}

export function createMySqlPool(env: ApiEnv): Pool {
  const nextPool = createPool({
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
    queueLimit: Math.max(env.DB_POOL_LIMIT * 4, 20),
  });

  nextPool.on("connection", (connection: unknown) => {
    (connection as { query: (sql: string, callback: (error: unknown) => void) => void }).query(
      `SET SESSION MAX_EXECUTION_TIME=${QUERY_TIMEOUT_MS}`,
      (error: unknown) => {
        if (error) {
          console.warn("[mysql] failed to set session max execution time", error);
        }
      },
    );
  });

  return nextPool;
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
