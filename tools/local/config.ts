import { randomBytes } from "node:crypto";

export interface LocalConfig {
  project: "smsystem-local";
  mysqlPort: 13306;
  redisPort: 16379;
  rootPassword: string;
  sessionSecret: string;
}

export function createLocalConfig(): LocalConfig {
  return { project: "smsystem-local", mysqlPort: 13306, redisPort: 16379,
    rootPassword: randomBytes(24).toString("hex"), sessionSecret: randomBytes(32).toString("hex") };
}

export function assertLocalConfig(value: unknown, mode = process.env.NODE_ENV): asserts value is LocalConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid local bootstrap config.");
  const config = value as Partial<LocalConfig>;
  if (mode === "production" || config.project !== "smsystem-local" || config.mysqlPort !== 13306 ||
      config.redisPort !== 16379 || typeof config.rootPassword !== "string" || typeof config.sessionSecret !== "string" || !/^[a-f0-9]{48}$/u.test(config.rootPassword) || !/^[a-f0-9]{64}$/u.test(config.sessionSecret)) {
    throw new Error("Local bootstrap only: isolated ports and development mode are required.");
  }
}

export function localRuntimeEnv(config: LocalConfig): Record<string, string> {
  assertLocalConfig(config);
  // Explicit values prevent existing private .env files from redirecting local services.
  return {
    NODE_ENV: "development", API_HOST: "127.0.0.1", API_PORT: "3203",
    DB_HOST: "127.0.0.1", DB_PORT: String(config.mysqlPort), DB_USER: "root", DB_PASS: config.rootPassword,
    DB_SOCKET_PATH: "", DB_NAME: "sms_db", CORE_DB_NAME: "sms_db", CLIENT_DB_NAME: "sms_client",
    PURCHASE_DB_NAME: "sms_purchase", WAREHOUSE_DB_NAME: "sms_warehouse", AUDIT_DB_NAME: "sms_log", DB_POOL_LIMIT: "5",
    REDIS_HOST: "127.0.0.1", REDIS_PORT: String(config.redisPort), REDIS_DB: "0", REDIS_PASSWORD: "",
    SM_LOGIN_BASE_URL: "http://127.0.0.1:13805", SM_LOGIN_INTERNAL_TOKEN: config.sessionSecret,
    SM_TASKS_BASE_URL: "http://127.0.0.1:13806", JOB_PLAN_RUNTIME_BASE_URL: "http://127.0.0.1:13803",
    WEB_ALLOWED_ORIGINS: "http://127.0.0.1:13000", COOKIE_SECURE: "false", ALLOW_INSECURE_SM_LOGIN: "false",
    SESSION_TTL_SECONDS: "43200", REFRESH_TTL_SECONDS: "2592000", REFRESH_TOKEN_ENCRYPTION_KEY: config.sessionSecret,
    R2_ENDPOINT_URL: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", R2_BUCKET_NAME: "", R2_PUBLIC_URL: "", FCM_SERVER_KEY: "",
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3203", NEXT_PUBLIC_LOCAL_API_PORT: "3203",
    SPF_API_INTERNAL_URL: "http://127.0.0.1:13003", NEXT_TELEMETRY_DISABLED: "1",
    SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "",
  };
}
