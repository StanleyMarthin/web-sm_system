import { getRequestId } from "@/observability/context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /pass|token|cookie|authorization|secret|credential|session/i;
const MAX_DEPTH = 3;

function currentLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (configured && configured in LEVEL_WEIGHT) {
    return configured as LogLevel;
  }

  return process.env.NODE_ENV === "test" ? "error" : "info";
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(nested, depth + 1);
  }

  return sanitized;
}

function sanitizeContext(context: LogContext | undefined): Record<string, unknown> {
  return context ? (sanitizeValue(context, 0) as Record<string, unknown>) : {};
}

function stringify(entry: Record<string, unknown>): string {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({ ...entry, context: "[unserializable]" });
  }
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) {
    return;
  }

  const line = `${stringify({
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME?.trim() || "smsystem-api",
    env: process.env.NODE_ENV?.trim() || "development",
    requestId: getRequestId(),
    message,
    context: sanitizeContext(context),
  })}\n`;

  if (level === "error") {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

export const logger = {
  debug: (message: string, context?: LogContext): void => emit("debug", message, context),
  info: (message: string, context?: LogContext): void => emit("info", message, context),
  warn: (message: string, context?: LogContext): void => emit("warn", message, context),
  error: (message: string, context?: LogContext): void => emit("error", message, context),
  isLevelEnabled: (level: LogLevel): boolean => LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[currentLevel()],
};
