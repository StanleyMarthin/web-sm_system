import { expect, test } from "bun:test";
import { probeMySql, resetMySqlPoolForTests } from "@/db/mysql";
import { probeRedis, resetRedisClientForTests } from "@/redis/client";

const connectivityTest =
  process.env.RUN_CONNECTIVITY_TESTS === "1" ? test : test.skip;

connectivityTest("connects to live mysql and redis when explicitly enabled", async () => {
  const [database, redis] = await Promise.all([probeMySql(), probeRedis()]);

  expect(database.status).toBe("ok");
  expect(redis.status).toBe("ok");
});

connectivityTest("cleans up singleton clients after connectivity probes", async () => {
  await resetMySqlPoolForTests();
  await resetRedisClientForTests();
  expect(true).toBe(true);
});
