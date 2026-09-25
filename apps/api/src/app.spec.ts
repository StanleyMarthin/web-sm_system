import { describe, expect, it } from "bun:test";
import { createApiFetchHandler } from "@/app";

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
  });
});
