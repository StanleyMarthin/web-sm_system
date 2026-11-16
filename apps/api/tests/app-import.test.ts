import { tmpdir } from "node:os";
import { expect, test } from "bun:test";

test("imports the API handler without database or Redis environment", () => {
  const appPath = new URL("../src/app.ts", import.meta.url).pathname;
  const result = Bun.spawnSync({
    cmd: [process.execPath, "--eval", `await import(${JSON.stringify(appPath)})`],
    cwd: tmpdir(),
    env: { NODE_ENV: "test" },
  });

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
