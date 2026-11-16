import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertLocalConfig, localRuntimeEnv, type LocalConfig } from "./config";

const root = resolve(import.meta.dir, "../..");
const config: LocalConfig = JSON.parse(await readFile(resolve(root, ".dev/local/config.json"), "utf8"));
assertLocalConfig(config);
const env = { ...process.env, ...localRuntimeEnv(config) };
const children = [
  Bun.spawn([process.execPath, "--no-env-file", "tools/local/login-server.ts"], { cwd: root, env, stdout: "inherit", stderr: "inherit" }),
  Bun.spawn([process.execPath, "--no-env-file", "apps/api/src/index.ts"], { cwd: root, env, stdout: "inherit", stderr: "inherit" }),
];
if (!process.argv.includes("--api-only")) {
  children.push(Bun.spawn(["node", "../../node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "13000"],
    { cwd: resolve(root, "apps/web"), env: { ...env, JOB_PLAN_RUNTIME_BASE_URL: "" }, stdout: "inherit", stderr: "inherit" }));
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(children.map(child => child.exited));
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
const first = await Promise.race(children.map(async child => ({ code: await child.exited })));
await stop();
process.exit(first.code);
