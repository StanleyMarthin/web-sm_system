import {
  DEVICE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@smsystem/contracts/auth";
import { getApiEnv, type ApiEnv } from "@/config/env";

type CookieName =
  | typeof DEVICE_COOKIE_NAME
  | typeof REFRESH_COOKIE_NAME
  | typeof SESSION_COOKIE_NAME;

interface CookieOptions {
  httpOnly?: boolean;
  maxAge?: number;
}

function getBaseCookieOptions(env: ApiEnv) {
  return {
    path: "/",
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
  } as const;
}

function serializeCookie(
  name: CookieName,
  value: string,
  env: ApiEnv,
  options: CookieOptions = {},
): string {
  const base = getBaseCookieOptions(env);
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${base.path}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`SameSite=${base.sameSite}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (base.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const values = new Map<string, string>();
  if (!cookieHeader) {
    return values;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }

    values.set(name, decodeURIComponent(rest.join("=")));
  }

  return values;
}

export function getCookie(request: Request, name: CookieName): string | null {
  return parseCookieHeader(request.headers.get("cookie")).get(name) ?? null;
}

export function buildSessionCookie(value: string, env: ApiEnv = getApiEnv()): string {
  return serializeCookie(SESSION_COOKIE_NAME, value, env, {
    httpOnly: true,
    maxAge: env.SESSION_TTL_SECONDS,
  });
}

export function buildRefreshCookie(value: string, env: ApiEnv = getApiEnv()): string {
  return serializeCookie(REFRESH_COOKIE_NAME, value, env, {
    httpOnly: true,
    maxAge: env.REFRESH_TTL_SECONDS,
  });
}

export function buildDeviceCookie(value: string, env: ApiEnv = getApiEnv()): string {
  return serializeCookie(DEVICE_COOKIE_NAME, value, env, {
    httpOnly: true,
    maxAge: env.REFRESH_TTL_SECONDS,
  });
}

export function buildExpiredCookie(name: CookieName, env: ApiEnv = getApiEnv()): string {
  return serializeCookie(name, "", env, {
    httpOnly: name !== DEVICE_COOKIE_NAME,
    maxAge: 0,
  });
}
