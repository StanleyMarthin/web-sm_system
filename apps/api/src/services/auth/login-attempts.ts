import { createHash } from "node:crypto";
import { getRedisClient } from "@/redis/client";

export interface LoginAttemptBlock {
  errorCode: "LOGIN_RATE_LIMITED" | "ACCOUNT_DISABLED" | "ACTIVE_SESSION_CANCEL_LIMITED";
  message: string;
  retryAfterSeconds: number | null;
}

const FAILURE_TTL_SECONDS = 24 * 60 * 60;
const LOCK_STEPS = new Map<number, number>([
  [3, 60],
  [4, 5 * 60],
  [5, 15 * 60],
]);

interface MemoryAttemptState {
  failures: number;
  failuresExpireAt: number;
  lockedUntil: number;
  disabled: boolean;
  activeSessionWarnings: number;
  activeSessionWarningsExpireAt: number;
  activeSessionWarningStrikes: number;
  activeSessionLockedUntil: number;
}

function getMemoryAttempts(): Map<string, MemoryAttemptState> {
  const globalScope = globalThis as typeof globalThis & {
    __smsystemLoginAttempts?: Map<string, MemoryAttemptState>;
  };

  globalScope.__smsystemLoginAttempts ??= new Map();
  return globalScope.__smsystemLoginAttempts;
}

function normalizeEmployeeId(employeeId: string): string {
  return employeeId.trim().toUpperCase();
}

function hashEmployeeId(employeeId: string): string {
  return createHash("sha256").update(normalizeEmployeeId(employeeId)).digest("hex");
}

function getKeys(employeeId: string) {
  const hashed = hashEmployeeId(employeeId);
  return {
    failures: `login-failures:${hashed}`,
    lock: `login-lock:${hashed}`,
    disabled: `login-disabled:${hashed}`,
    activeWarnings: `login-active-warnings:${hashed}`,
    activeStrikes: `login-active-warning-strikes:${hashed}`,
    activeLock: `login-active-warning-lock:${hashed}`,
  };
}

function buildLockBlock(retryAfterSeconds: number): LoginAttemptBlock {
  return {
    errorCode: "LOGIN_RATE_LIMITED",
    message: `Terlalu banyak percobaan login salah. Coba lagi dalam ${retryAfterSeconds} detik.`,
    retryAfterSeconds,
  };
}

function buildDisabledBlock(): LoginAttemptBlock {
  return {
    errorCode: "ACCOUNT_DISABLED",
    message: "Akun dinonaktifkan karena 6 kali percobaan login salah. Hubungi administrator.",
    retryAfterSeconds: null,
  };
}

function buildActiveSessionWarningLockBlock(retryAfterSeconds: number): LoginAttemptBlock {
  return {
    errorCode: "ACTIVE_SESSION_CANCEL_LIMITED",
    message: `Terlalu sering membatalkan konfirmasi login. Coba lagi dalam ${retryAfterSeconds} detik.`,
    retryAfterSeconds,
  };
}

function isRedisUnavailableFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

function shouldUseMemoryOnly(): boolean {
  return process.env.NODE_ENV === "test";
}

export function isCredentialFailure(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status === 401;
  }

  return false;
}

export async function getLoginAttemptBlock(employeeId: string): Promise<LoginAttemptBlock | null> {
  const keys = getKeys(employeeId);

  if (shouldUseMemoryOnly()) {
    return getMemoryLoginAttemptBlock(keys.failures);
  }

  try {
    const client = await getRedisClient();
    const [disabled, lockTtl, activeLockTtl] = await Promise.all([
      client.get(keys.disabled),
      client.ttl(keys.lock),
      client.ttl(keys.activeLock),
    ]);

    if (disabled) {
      return buildDisabledBlock();
    }

    if (lockTtl > 0) {
      return buildLockBlock(lockTtl);
    }

    if (activeLockTtl > 0) {
      return buildActiveSessionWarningLockBlock(activeLockTtl);
    }

    return null;
  } catch (error) {
    if (!isRedisUnavailableFallbackAllowed()) {
      throw error;
    }

    return getMemoryLoginAttemptBlock(keys.failures);
  }
}

export async function recordActiveSessionWarning(employeeId: string): Promise<LoginAttemptBlock | null> {
  const keys = getKeys(employeeId);

  if (shouldUseMemoryOnly()) {
    return recordMemoryActiveSessionWarning(keys.failures);
  }

  try {
    const client = await getRedisClient();
    const warnings = await client.incr(keys.activeWarnings);
    if (warnings === 1) {
      await client.expire(keys.activeWarnings, FAILURE_TTL_SECONDS);
    }

    if (warnings < 5) {
      return null;
    }

    await client.del(keys.activeWarnings);
    const strikes = await client.incr(keys.activeStrikes);
    if (strikes === 1) {
      await client.expire(keys.activeStrikes, FAILURE_TTL_SECONDS);
    }

    if (strikes >= 3) {
      await client.set(keys.disabled, "1");
      await Promise.all([
        client.del(keys.activeLock),
        client.del(keys.activeWarnings),
        client.del(keys.activeStrikes),
      ]);
      return buildDisabledBlock();
    }

    await client.set(keys.activeLock, String(strikes), {
      expiration: {
        type: "EX",
        value: 60,
      },
    });
    return buildActiveSessionWarningLockBlock(60);
  } catch (error) {
    if (!isRedisUnavailableFallbackAllowed()) {
      throw error;
    }

    return recordMemoryActiveSessionWarning(keys.failures);
  }
}

export async function recordLoginFailure(employeeId: string): Promise<LoginAttemptBlock | null> {
  const keys = getKeys(employeeId);

  if (shouldUseMemoryOnly()) {
    return recordMemoryLoginFailure(keys.failures);
  }

  try {
    const client = await getRedisClient();
    const failures = await client.incr(keys.failures);
    if (failures === 1) {
      await client.expire(keys.failures, FAILURE_TTL_SECONDS);
    }

    if (failures >= 6) {
      await Promise.all([
        client.set(keys.disabled, "1"),
        client.del(keys.lock),
      ]);
      return buildDisabledBlock();
    }

    const lockSeconds = LOCK_STEPS.get(failures);
    if (lockSeconds) {
      await client.set(keys.lock, String(failures), {
        expiration: {
          type: "EX",
          value: lockSeconds,
        },
      });
      return buildLockBlock(lockSeconds);
    }

    return null;
  } catch (error) {
    if (!isRedisUnavailableFallbackAllowed()) {
      throw error;
    }

    return recordMemoryLoginFailure(keys.failures);
  }
}

export async function resetLoginFailures(employeeId: string): Promise<void> {
  const keys = getKeys(employeeId);

  if (shouldUseMemoryOnly()) {
    resetMemoryLoginFailures(keys.failures);
    return;
  }

  try {
    const client = await getRedisClient();
    await Promise.all([
      client.del(keys.failures),
      client.del(keys.lock),
      client.del(keys.activeWarnings),
      client.del(keys.activeStrikes),
      client.del(keys.activeLock),
    ]);
  } catch (error) {
    if (!isRedisUnavailableFallbackAllowed()) {
      throw error;
    }

    resetMemoryLoginFailures(keys.failures);
  }
}

function getMemoryLoginAttemptBlock(key: string): LoginAttemptBlock | null {
  const now = Date.now();
  const state = getMemoryAttempts().get(key);
  if (!state) {
    return null;
  }

  if (state.disabled) {
    return buildDisabledBlock();
  }

  if (state.activeSessionLockedUntil > now) {
    return buildActiveSessionWarningLockBlock(
      Math.ceil((state.activeSessionLockedUntil - now) / 1_000),
    );
  }

  if (state.lockedUntil > now) {
    return buildLockBlock(Math.ceil((state.lockedUntil - now) / 1_000));
  }

  return null;
}

function recordMemoryLoginFailure(key: string): LoginAttemptBlock | null {
  const now = Date.now();
  const attempts = getMemoryAttempts();
  const current = attempts.get(key);
  const state =
    current && current.failuresExpireAt > now
      ? current
      : {
          failures: 0,
          failuresExpireAt: now + FAILURE_TTL_SECONDS * 1_000,
          lockedUntil: 0,
          disabled: false,
          activeSessionWarnings: 0,
          activeSessionWarningsExpireAt: now + FAILURE_TTL_SECONDS * 1_000,
          activeSessionWarningStrikes: 0,
          activeSessionLockedUntil: 0,
        };

  state.failures += 1;
  attempts.set(key, state);

  if (state.failures >= 6) {
    state.disabled = true;
    state.lockedUntil = 0;
    return buildDisabledBlock();
  }

  const lockSeconds = LOCK_STEPS.get(state.failures);
  if (lockSeconds) {
    state.lockedUntil = now + lockSeconds * 1_000;
    return buildLockBlock(lockSeconds);
  }

  return null;
}

function recordMemoryActiveSessionWarning(key: string): LoginAttemptBlock | null {
  const now = Date.now();
  const attempts = getMemoryAttempts();
  const current = attempts.get(key);
  const state =
    current && current.activeSessionWarningsExpireAt > now
      ? current
      : {
          failures: 0,
          failuresExpireAt: now + FAILURE_TTL_SECONDS * 1_000,
          lockedUntil: 0,
          disabled: false,
          activeSessionWarnings: 0,
          activeSessionWarningsExpireAt: now + FAILURE_TTL_SECONDS * 1_000,
          activeSessionWarningStrikes: 0,
          activeSessionLockedUntil: 0,
        };

  state.activeSessionWarnings += 1;
  attempts.set(key, state);

  if (state.activeSessionWarnings < 5) {
    return null;
  }

  state.activeSessionWarnings = 0;
  state.activeSessionWarningStrikes += 1;

  if (state.activeSessionWarningStrikes >= 3) {
    state.disabled = true;
    state.activeSessionLockedUntil = 0;
    return buildDisabledBlock();
  }

  state.activeSessionLockedUntil = now + 60_000;
  return buildActiveSessionWarningLockBlock(60);
}

function resetMemoryLoginFailures(key: string): void {
  const state = getMemoryAttempts().get(key);
  if (state) {
    state.failures = 0;
    state.lockedUntil = 0;
    state.activeSessionWarnings = 0;
    state.activeSessionWarningStrikes = 0;
    state.activeSessionLockedUntil = 0;
    state.failuresExpireAt = Date.now() + FAILURE_TTL_SECONDS * 1_000;
    state.activeSessionWarningsExpireAt = Date.now() + FAILURE_TTL_SECONDS * 1_000;
  }
}
