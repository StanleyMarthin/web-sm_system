import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPool } from "mysql2/promise";
import { createClient } from "redis";
import { assertLocalConfig, type LocalConfig } from "./config";
import { createLocalLoginHandler } from "./login";

const config: LocalConfig = JSON.parse(await readFile(resolve(import.meta.dir, "../../.dev/local/config.json"), "utf8"));
assertLocalConfig(config);
const pool = createPool({ host: "127.0.0.1", port: config.mysqlPort, user: "root", password: config.rootPassword, database: "sms_db", connectionLimit: 2 });
const redis = createClient({ url: `redis://127.0.0.1:${config.redisPort}` });
redis.on("error", () => console.error("[local-login] Redis unavailable"));
await redis.connect();
const handler = createLocalLoginHandler(pool, redis, config.sessionSecret);
const server = Bun.serve({ hostname: "127.0.0.1", port: 13805, maxRequestBodySize: 16_384,
  fetch: handler, error: () => Response.json({ success: false, message: "Local authentication unavailable", data: {} }, { status: 503 }) });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop(true);
  await Promise.all([pool.end(), redis.quit()]);
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
console.log("[local-login] http://127.0.0.1:13805");
