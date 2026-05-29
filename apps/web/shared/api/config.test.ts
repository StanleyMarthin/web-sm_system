import { afterEach, describe, expect, it } from "bun:test";
import { getApiBaseUrl, resolveApiBaseUrl } from "@/shared/api/config";

const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalLegacyApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalApiHost = process.env.API_HOST;
const originalApiPort = process.env.API_PORT;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

describe("api config", () => {
  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }

    if (originalLegacyApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalLegacyApiUrl;
    }

    if (originalApiHost === undefined) {
      delete process.env.API_HOST;
    } else {
      process.env.API_HOST = originalApiHost;
    }

    if (originalApiPort === undefined) {
      delete process.env.API_PORT;
    } else {
      process.env.API_PORT = originalApiPort;
    }

    if (originalNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = originalNodeEnv;
    }
  });

  it("falls back to the legacy public api url env when the new key is absent", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:3203";

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:3203");
  });

  it("rewrites loopback hostnames to the current browser host to preserve cookies", () => {
    expect(resolveApiBaseUrl("http://127.0.0.1:3203", "localhost")).toBe(
      "http://localhost:3203",
    );
  });

  it("forces local api on browser-side development when the configured url is still public", () => {
    expect(resolveApiBaseUrl("https://api.smrestoration.com/v1", "127.0.0.1")).toBe(
      "http://127.0.0.1:3203",
    );
  });

  it("forces local api on server-side development when stale public env is still present", () => {
    mutableEnv.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.smrestoration.com/v1";
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = "3203";

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:3203");
  });
});
