import { createClient, type RedisClientType } from "redis";
import type { HealthCheck } from "@smsystem/contracts/health";
import { getApiEnv, type ApiEnv } from "@/config/env";

let client: RedisClientType | null = null;
let connectionPromise: Promise<RedisClientType> | null = null;

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Redis error";
}

function createRedisConnection(env: ApiEnv): RedisClientType {
  return createClient({
    password: env.REDIS_PASSWORD,
    database: env.REDIS_DB,
    socket: {
      connectTimeout: 1_000,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    },
  });
}

export async function getRedisClient(env: ApiEnv = getApiEnv()): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  if (!client) {
    client = createRedisConnection(env);
    client.on("error", () => {
      // Health probes surface the connection failure in the response body.
    });
  }

  if (!connectionPromise) {
    connectionPromise = client.connect().then(() => client as RedisClientType);
  }

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

export async function probeRedis(
  redisClientPromise: Promise<RedisClientType> = getRedisClient(),
): Promise<HealthCheck> {
  const startedAt = Date.now();

  try {
    const redisClient = await redisClientPromise;
    await redisClient.ping();
    return {
      name: "redis",
      status: "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: "redis",
      status: "error",
      latencyMs: Date.now() - startedAt,
      detail: toErrorDetail(error),
    };
  }
}

export async function resetRedisClientForTests(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }

  client = null;
  connectionPromise = null;
}
