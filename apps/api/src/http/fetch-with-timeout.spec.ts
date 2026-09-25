import { afterEach, describe, expect, test } from "bun:test";
import { fetchWithTimeout } from "@/http/fetch-with-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubPendingFetch(onAbort: () => void): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        onAbort();
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    })) as typeof fetch;
}

async function expectRejected(promise: Promise<unknown>): Promise<void> {
  let failed = false;

  try {
    await promise;
  } catch {
    failed = true;
  }

  expect(failed).toBe(true);
}

describe("fetchWithTimeout", () => {
  test("aborts the request when the timeout elapses", async () => {
    let aborted = false;
    globalThis.fetch = stubPendingFetch(() => {
      aborted = true;
    });

    await expectRejected(fetchWithTimeout("https://example.invalid/slow", { timeoutMs: 10 }));

    expect(aborted).toBe(true);
  });

  test("propagates the caller abort signal", async () => {
    let aborted = false;
    globalThis.fetch = stubPendingFetch(() => {
      aborted = true;
    });
    const controller = new AbortController();

    const pending = fetchWithTimeout("https://example.invalid/slow", {
      timeoutMs: 1_000,
      signal: controller.signal,
    });
    controller.abort();

    await expectRejected(pending);

    expect(aborted).toBe(true);
  });
});
