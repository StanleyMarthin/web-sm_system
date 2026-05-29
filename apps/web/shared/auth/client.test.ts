import { afterEach, describe, expect, it, mock } from "bun:test";
import { loginWithPassword } from "@/shared/auth/client";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("loginWithPassword", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("returns a user-friendly error when the API request fails", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3001";
    global.fetch = mock(async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    const result = await loginWithPassword({
      employeeId: "SM-00.001",
      password: "secret",
      force: false,
    });
    
    expect(result).toEqual({
      success: false,
      message: "Layanan login tidak dapat dihubungi. Coba beberapa saat lagi.",
      errorCode: "AUTH_SERVICE_UNAVAILABLE",
      data: {},
    });
  });
});