import { createHash } from "node:crypto";
import { DEVICE_COOKIE_NAME } from "@smsystem/contracts/auth";
import { errorResponse } from "@/http/response";
import { getCookie } from "@/http/cookies";
import { getRedisClient } from "@/redis/client";
import type { AuthService } from "@/services/auth/auth.service";

interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

function getMemoryBuckets(): Map<string, { count: number; expiresAt: number }> {
  const globalScope = globalThis as typeof globalThis & {
    __smsystemRateLimitBuckets?: Map<string, { count: number; expiresAt: number }>;
  };

  globalScope.__smsystemRateLimitBuckets ??= new Map();
  return globalScope.__smsystemRateLimitBuckets;
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

async function enforceRateLimit(
  request: Request,
  rule: RateLimitRule,
): Promise<Response | null> {
  const redisKey = `rate-limit:${hashKey(rule.key)}`;
  let count: number;

  try {
    const client = await getRedisClient();
    count = await client.incr(redisKey);
    if (count === 1) {
      await client.expire(redisKey, rule.windowSeconds);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const now = Date.now();
    const memoryBuckets = getMemoryBuckets();
    const current = memoryBuckets.get(redisKey);
    if (!current || current.expiresAt <= now) {
      count = 1;
      memoryBuckets.set(redisKey, {
        count,
        expiresAt: now + rule.windowSeconds * 1_000,
      });
    } else {
      count = current.count + 1;
      current.count = count;
    }
  }

  if (count <= rule.limit) {
    return null;
  }

  return errorResponse(
    request,
    "Terlalu banyak request. Coba lagi beberapa saat.",
    429,
    "RATE_LIMITED",
  );
}

async function getLoginEmployeeId(request: Request): Promise<string> {
  try {
    const body = (await request.clone().json()) as unknown;
    if (
      body &&
      typeof body === "object" &&
      "employeeId" in body &&
      typeof body.employeeId === "string"
    ) {
      return body.employeeId.trim() || "unknown";
    }
  } catch {
    // Invalid JSON is handled by the route parser; rate limit falls back to IP.
  }

  return "unknown";
}

async function getSessionEmployeeId(
  request: Request,
  authService: AuthService,
): Promise<string | null> {
  const session = await authService.getCurrentSession(request);
  return session?.user.employeeId ?? null;
}

export async function enforceSecurityRateLimit(
  request: Request,
  authService: AuthService,
): Promise<Response | null> {
  const url = new URL(request.url);
  const ip = getClientIp(request);

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const employeeId = await getLoginEmployeeId(request);
    return enforceRateLimit(request, {
      key: `login:${employeeId}:${ip}`,
      limit: 5,
      windowSeconds: 5 * 60,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/refresh") {
    const deviceId = getCookie(request, DEVICE_COOKIE_NAME) ?? ip;
    return enforceRateLimit(request, {
      key: `refresh:${deviceId}`,
      limit: 30,
      windowSeconds: 5 * 60,
    });
  }

  if (
    request.method === "POST" &&
    /^\/api\/users\/[^/]+\/reset-password$/u.test(url.pathname)
  ) {
    return enforceRateLimit(request, {
      key: `reset-password:${ip}`,
      limit: 5,
      windowSeconds: 10 * 60,
    });
  }

  if (url.pathname.endsWith("/upload-ticket")) {
    const employeeId = await getSessionEmployeeId(request, authService);
    if (!employeeId) {
      return null;
    }

    return enforceRateLimit(request, {
      key: `upload-ticket:${employeeId}`,
      limit: 30,
      windowSeconds: 10 * 60,
    });
  }

  if (url.pathname.endsWith("/export")) {
    const employeeId = await getSessionEmployeeId(request, authService);
    if (!employeeId) {
      return null;
    }

    return enforceRateLimit(request, {
      key: `export:${employeeId}`,
      limit: 10,
      windowSeconds: 10 * 60,
    });
  }

  return null;
}
