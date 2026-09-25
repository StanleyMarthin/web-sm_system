import { createPool, type Pool } from "mysql2/promise";
import type { HealthCheck } from "@smsystem/contracts/health";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { logger } from "@/observability/logger";

let pool: Pool | null = null;
const QUERY_TIMEOUT_MS = 5_000;
const SLOW_QUERY_THRESHOLD_MS = 1_000;

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MySQL error";
}

// Query names only ever carry the verb and the target table, never column values.
export function describeQuery(sql: string): string {
  const normalized = sql.replace(/\s+/gu, " ").trim();
  const verb = /^([a-z]+)/iu.exec(normalized)?.[1]?.toUpperCase() ?? "QUERY";
  const table = /(?:from|into|update|join)\s+`?([a-z0-9_]+)`?/iu.exec(normalized)?.[1];

  return table ? `${verb} ${table}` : verb;
}

type QueryArgs = [sql: string, ...rest: unknown[]];
type Queryable = {
  query: (...args: QueryArgs) => unknown;
  execute?: (...args: QueryArgs) => unknown;
};

async function withQueryTiming<T>(
  sql: string,
  run: () => Promise<T>,
  slowQueryThresholdMs: number,
): Promise<T> {
  const startedAt = Date.now();

  try {
    return await run();
  } finally {
    const durationMs = Date.now() - startedAt;

    if (durationMs >= slowQueryThresholdMs) {
      logger.warn("slow mysql query", {
        queryName: describeQuery(sql),
        durationMs,
      });
    }
  }
}

function instrumentQueryable<T extends object>(target: T, slowQueryThresholdMs: number): T {
  const queryable = target as unknown as Partial<Queryable>;

  for (const method of ["query", "execute"] as const) {
    const original = queryable[method];
    if (typeof original !== "function") {
      continue;
    }

    // ponytail: assumes the promise API; a callback-style call would be timed until the
    // query object is returned. Every call site in this repo awaits, so upgrade only if that changes.
    queryable[method] = ((...args: QueryArgs) =>
      withQueryTiming(String(args[0]), () => Promise.resolve(original(...args)), slowQueryThresholdMs)) as never;
  }

  return target;
}

export function instrumentMySqlPool(poolInstance: Pool, slowQueryThresholdMs = SLOW_QUERY_THRESHOLD_MS): Pool {
  const getConnection = poolInstance.getConnection.bind(poolInstance);

  poolInstance.getConnection = (async (...args: Parameters<typeof getConnection>) =>
    instrumentQueryable(await getConnection(...args), slowQueryThresholdMs)) as typeof poolInstance.getConnection;

  return instrumentQueryable(poolInstance, slowQueryThresholdMs);
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
          logger.warn("failed to set session max execution time", { error });
        }
      },
    );
  });

  return instrumentMySqlPool(nextPool);
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
