import { afterEach, describe, expect, it } from "bun:test";
import { runWithRequestContext } from "@/observability/context";
import { logger } from "@/observability/logger";

const originalLogLevel = process.env.LOG_LEVEL;
const originalWrite = process.stdout.write.bind(process.stdout);

function captureLogs(run: () => void): string[] {
  const lines: string[] = [];
  process.stdout.write = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return lines;
}

afterEach(() => {
  process.stdout.write = originalWrite;
  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

describe("logger", () => {
  it("writes one JSON line with the request id and context", () => {
    process.env.LOG_LEVEL = "info";

    const lines = captureLogs(() => {
      runWithRequestContext({ requestId: "req-log-1" }, () => {
        logger.info("request completed", { method: "GET", status: 200 });
      });
    });

    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("request completed");
    expect(entry.requestId).toBe("req-log-1");
    expect(entry.context.method).toBe("GET");
    expect(typeof entry.timestamp).toBe("string");
    expect(typeof entry.service).toBe("string");
    expect(typeof entry.env).toBe("string");
  });

  it("redacts sensitive context keys", () => {
    process.env.LOG_LEVEL = "info";

    const lines = captureLogs(() => {
      logger.info("login attempt", {
        password: "p@ss",
        cookie: "sid=1",
        nested: { authorization: "bearer x" },
      });
    });

    const entry = JSON.parse(lines[0]!);
    expect(entry.context.password).toBe("[redacted]");
    expect(entry.context.cookie).toBe("[redacted]");
    expect(entry.context.nested.authorization).toBe("[redacted]");
  });

  it("skips levels below the configured threshold", () => {
    process.env.LOG_LEVEL = "warn";

    const lines = captureLogs(() => {
      logger.info("request completed");
    });

    expect(lines.length).toBe(0);
  });
});
