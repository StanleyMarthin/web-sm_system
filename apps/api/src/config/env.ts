import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_KEYS = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "REDIS_HOST",
  "REDIS_PORT",
] as const;

export interface ApiEnv {
  NODE_ENV: string;
  API_HOST: string;
  API_PORT: number;
  SM_LOGIN_BASE_URL: string;
  WEB_ALLOWED_ORIGINS: string[];
  SESSION_TTL_SECONDS: number;
  REFRESH_TTL_SECONDS: number;
  AUDIT_DB_NAME: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_SOCKET_PATH?: string;
  DB_USER: string;
  DB_PASS: string;
  DB_NAME: string;
  PURCHASE_DB_NAME: string;
  CORE_DB_NAME: string;
  WAREHOUSE_DB_NAME: string;
  DB_POOL_LIMIT: number;
  R2_ENDPOINT_URL?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_DB: number;
  REDIS_PASSWORD?: string;
}

let cachedEnv: ApiEnv | null = null;

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value.replace(/^['"]|['"]$/gu, "");
  }

  return parsed;
}

function resolveEnvFiles(cwd: string): string[] {
  const candidates = [
    resolve(cwd, ".env"),
    resolve(cwd, ".env.local"),
    resolve(cwd, "apps/api/.env"),
    resolve(cwd, "apps/api/.env.local"),
    resolve(cwd, "../../.env"),
    resolve(cwd, "../../.env.local"),
  ];

  return [...new Set(candidates)];
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  key: string,
  minimum: number = 1,
): number {
  const rawValue = value?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`Invalid integer value for ${key}: ${rawValue}`);
  }

  return parsed;
}

export function loadApiEnv(
  source: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): ApiEnv {
  const fileEnv = resolveEnvFiles(cwd).reduce<Record<string, string>>((accumulator, filePath) => {
    return { ...accumulator, ...parseEnvFile(filePath) };
  }, {});

  const merged = {
    ...fileEnv,
    ...source,
  };

  const missing = REQUIRED_KEYS.filter((key) => {
    const value = merged[key];
    return !value || !value.trim();
  });

  if (missing.length > 0) {
    throw new Error(`Missing required API env: ${missing.join(", ")}`);
  }

  return {
    NODE_ENV: merged.NODE_ENV?.trim() || "development",
    API_HOST: merged.API_HOST?.trim() || "0.0.0.0",
    API_PORT: parseInteger(merged.API_PORT, 3001, "API_PORT"),
    SM_LOGIN_BASE_URL:
      merged.SM_LOGIN_BASE_URL?.trim() || "http://108.136.189.225:8085",
    WEB_ALLOWED_ORIGINS: (merged.WEB_ALLOWED_ORIGINS?.trim() || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    SESSION_TTL_SECONDS: parseInteger(
      merged.SESSION_TTL_SECONDS,
      43_200,
      "SESSION_TTL_SECONDS",
    ),
    REFRESH_TTL_SECONDS: parseInteger(
      merged.REFRESH_TTL_SECONDS,
      2_592_000,
      "REFRESH_TTL_SECONDS",
    ),
    AUDIT_DB_NAME: merged.AUDIT_DB_NAME?.trim() || "sms_log",
    DB_HOST: merged.DB_HOST!.trim(),
    DB_PORT: parseInteger(merged.DB_PORT, 3306, "DB_PORT"),
    DB_SOCKET_PATH: merged.DB_SOCKET_PATH?.trim() || undefined,
    DB_USER: merged.DB_USER!.trim(),
    DB_PASS: merged.DB_PASS!.trim(),
    DB_NAME: merged.DB_NAME!.trim(),
    PURCHASE_DB_NAME: merged.PURCHASE_DB_NAME?.trim() || "sms_purchase",
    CORE_DB_NAME: merged.CORE_DB_NAME?.trim() || merged.DB_NAME!.trim(),
    WAREHOUSE_DB_NAME: merged.WAREHOUSE_DB_NAME?.trim() || "sms_warehouse",
    DB_POOL_LIMIT: parseInteger(merged.DB_POOL_LIMIT, 20, "DB_POOL_LIMIT"),
    R2_ENDPOINT_URL: merged.R2_ENDPOINT_URL?.trim() || undefined,
    R2_ACCESS_KEY_ID: merged.R2_ACCESS_KEY_ID?.trim() || undefined,
    R2_SECRET_ACCESS_KEY: merged.R2_SECRET_ACCESS_KEY?.trim() || undefined,
    R2_BUCKET_NAME: merged.R2_BUCKET_NAME?.trim() || undefined,
    R2_PUBLIC_URL: merged.R2_PUBLIC_URL?.trim() || undefined,
    REDIS_HOST: merged.REDIS_HOST!.trim(),
    REDIS_PORT: parseInteger(merged.REDIS_PORT, 6379, "REDIS_PORT"),
    REDIS_DB: parseInteger(merged.REDIS_DB, 0, "REDIS_DB", 0),
    REDIS_PASSWORD: merged.REDIS_PASSWORD?.trim() || undefined,
  };
}

export function getApiEnv(): ApiEnv {
  if (!cachedEnv) {
    cachedEnv = loadApiEnv();
  }

  return cachedEnv;
}

export function resetApiEnvForTests(): void {
  cachedEnv = null;
}
