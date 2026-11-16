import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPool } from "mysql2/promise";
import { assertLocalConfig, createLocalConfig, type LocalConfig } from "./config";
import { seedLocalAdmin } from "./seed";

const root = resolve(import.meta.dir, "../..");
const folder = resolve(root, ".dev/local");
if (process.env.NODE_ENV === "production") throw new Error("Local bootstrap cannot run in production mode.");
await mkdir(folder, { recursive: true, mode: 0o700 });
const path = resolve(folder, "config.json");
let config: LocalConfig;
try {
  config = JSON.parse(await readFile(path, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  config = createLocalConfig();
  await writeFile(path, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
}
assertLocalConfig(config);
await writeFile(resolve(folder, "mysql.env"), `MYSQL_ROOT_PASSWORD=${config.rootPassword}\nMYSQL_ROOT_HOST=%\n`, { mode: 0o600 });
await chmod(path, 0o600);
await chmod(resolve(folder, "mysql.env"), 0o600);
const compose = Bun.spawn(["docker", "compose", "-p", config.project, "-f", "tools/local/compose.yml", "up", "-d", "--wait", "--wait-timeout", "180"],
  { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
if (await compose.exited !== 0) throw new Error("Local database services did not start; existing files and databases were preserved.");
const pool = createPool({ host: "127.0.0.1", port: config.mysqlPort, user: "root", password: config.rootPassword, database: "sms_db", connectionLimit: 2 });
try {
  const created = await seedLocalAdmin(pool);
  console.log(created ? "Local admin created: username admin / password admin" : "Local setup already exists; account, password and data were preserved.");
  console.log("Run npm run local:start, then open http://127.0.0.1:13000");
} finally {
  await pool.end();
}
