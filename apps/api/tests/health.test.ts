import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";

describe("createApiFetchHandler", () => {
  test("returns a healthy report when probes succeed", async () => {
    const fetchHandler = createApiFetchHandler({
      now: () => "2026-05-13T00:00:00.000Z",
      checkDatabase: async () => ({
        name: "database",
        status: "ok",
        latencyMs: 12,
      }),
      checkRedis: async () => ({
        name: "redis",
        status: "ok",
        latencyMs: 8,
      }),
    });

    const response = await fetchHandler(new Request("http://localhost/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: "smsystem-bun-api",
      status: "ok",
      timestamp: "2026-05-13T00:00:00.000Z",
    });
    expect(body.checks.map((check: { name: string }) => check.name)).toEqual([
      "app",
      "database",
      "redis",
    ]);
  });

  test("returns degraded when a dependency probe fails", async () => {
    const fetchHandler = createApiFetchHandler({
      checkDatabase: async () => ({
        name: "database",
        status: "error",
        latencyMs: 30,
        detail: "connect ECONNREFUSED",
      }),
      checkRedis: async () => ({
        name: "redis",
        status: "ok",
        latencyMs: 10,
      }),
    });

    const response = await fetchHandler(new Request("http://localhost/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
  });

  test("returns degraded when a dependency probe times out", async () => {
    const fetchHandler = createApiFetchHandler({
      probeTimeoutMs: 25,
      checkDatabase: async () =>
        new Promise(() => {
          return undefined;
        }),
      checkRedis: async () => ({
        name: "redis",
        status: "ok",
        latencyMs: 5,
      }),
    });

    const response = await fetchHandler(new Request("http://localhost/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.find((check: { name: string }) => check.name === "database")).toMatchObject({
      status: "error",
      detail: "Probe timed out after 25ms",
    });
  });

  test("returns 404 for unknown routes", async () => {
    const fetchHandler = createApiFetchHandler();
    const response = await fetchHandler(new Request("http://localhost/unknown"));

    expect(response.status).toBe(404);
  });
});
