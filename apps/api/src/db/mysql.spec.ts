import { afterEach, describe, expect, it } from "bun:test";
import type { Pool } from "mysql2/promise";
import { describeQuery, instrumentMySqlPool } from "@/db/mysql";

const originalLogLevel = process.env.LOG_LEVEL;
const originalWrite = process.stdout.write.bind(process.stdout);

type QueryArgs = [sql: string, ...rest: unknown[]];

function createFakePool(query: (...args: QueryArgs) => Promise<unknown>): Pool {
  return {
    query,
    execute: query,
    getConnection: async () => ({ query, execute: query, release: () => undefined }),
  } as unknown as Pool;
}

function captureWarnings(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  process.env.LOG_LEVEL = "warn";
  process.stdout.write = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  return run().finally(() => {
    process.stdout.write = originalWrite;
  }).then(() => lines);
}

afterEach(() => {
  process.stdout.write = originalWrite;
  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

describe("describeQuery", () => {
  it("keeps the verb and table without column values", () => {
    expect(describeQuery("SELECT id, password FROM sm_employee WHERE email = 'a@b.c'")).toBe("SELECT sm_employee");
    expect(describeQuery("UPDATE sm_jobdesc_plan SET status = 'DONE' WHERE id = ?")).toBe("UPDATE sm_jobdesc_plan");
  });
});

describe("instrumentMySqlPool", () => {
  it("warns when a query exceeds the slow threshold", async () => {
    const pool = instrumentMySqlPool(
      createFakePool(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return [[]];
      }),
      10,
    );

    const lines = await captureWarnings(async () => {
      await pool.query("SELECT id FROM sm_employee WHERE employee_id = ?", ["SM-1"]);
    });

    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("warn");
    expect(entry.context.queryName).toBe("SELECT sm_employee");
    expect(entry.context.durationMs >= 10).toBe(true);
  });

  it("stays quiet for fast queries", async () => {
    const pool = instrumentMySqlPool(createFakePool(async () => [[]]), 10);

    const lines = await captureWarnings(async () => {
      await pool.query("SELECT id FROM sm_employee WHERE employee_id = ?", ["SM-1"]);
    });

    expect(lines.length).toBe(0);
  });
});
