import { afterEach, describe, expect, test } from "bun:test";
import { fetchWithTimeout } from "@/http/fetch-with-timeout";

let server: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
  server?.stop();
  server = null;
});

describe("fetchWithTimeout", () => {
  test("aborts requests after timeout", async () => {
    server = Bun.serve({
      port: 0,
      async fetch() {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new Response("late");
      },
    });

    const url = `http://${server.hostname}:${server.port}`;
    let aborted = false;

    try {
      await fetchWithTimeout(url, { timeoutMs: 10 });
    } catch {
      aborted = true;
    }

    expect(aborted).toBe(true);
  });
});
