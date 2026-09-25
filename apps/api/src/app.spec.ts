import { describe, expect, it } from "bun:test";
import { createApiFetchHandler } from "@/app";
import { getRequestId } from "@/observability/context";

describe("createApiFetchHandler global errors", () => {
  it("returns standard JSON without exposing internal errors", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: {
        async getCurrentUser() {
          throw new Error("redis stack should stay server-side");
        },
      } as never,
    });

    const response = await fetchHandler(new Request("http://localhost/api/auth/me", {
      headers: { "x-request-id": "req-test-1" },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId: "req-test-1",
    });
    expect(response.headers.get("x-request-id")).toBe("req-test-1");
  });

  it("propagates the request id down to the service layer", async () => {
    let serviceRequestId: string | null = null;
    const fetchHandler = createApiFetchHandler({
      authService: {
        async getCurrentUser() {
          serviceRequestId = getRequestId();
          return null;
        },
      } as never,
    });

    await fetchHandler(new Request("http://localhost/api/auth/me", {
      headers: { "x-request-id": "req-test-2" },
    }));

    expect(serviceRequestId).toBe("req-test-2");
  });

  it("generates a request id when the caller does not send one", async () => {
    const fetchHandler = createApiFetchHandler();

    const response = await fetchHandler(new Request("http://localhost/api/auth/me", {
      method: "OPTIONS",
    }));

    expect(typeof response.headers.get("x-request-id")).toBe("string");
  });
});
