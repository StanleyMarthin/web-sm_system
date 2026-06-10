import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { AuthUser } from "@smsystem/contracts/auth";
import { createClient, type RedisClientType } from "redis";
import { getApiEnv, type ApiEnv } from "@/config/env";
import {
  buildCsrfCookie,
  buildDeviceCookie,
  buildExpiredCookie,
  buildRefreshCookie,
  buildSessionCookie,
  getCookie,
} from "@/http/cookies";
import { getRedisClient } from "@/redis/client";
import { normalizeReservedAuthUser } from "@/services/rbac/reserved-role";

export interface WebSession {
  sessionId: string;
  sessionKey: string;
  employeeId: string;
  refreshToken: string;
  csrfToken?: string;
  mobileSessionKey: string;
  deviceId: string;
  user: AuthUser;
  createdAt: string;
}

interface CreateSessionInput {
  user: AuthUser;
  refreshToken: string;
  mobileSessionKey: string;
  deviceId: string;
}

export interface SessionStore {
  createSession(input: CreateSessionInput): Promise<WebSession>;
  getSessionFromRequest(request: Request): Promise<WebSession | null>;
  deleteSessionByKey(sessionKey: string): Promise<void>;
  buildLoginCookies(session: WebSession): string[];
  buildLogoutCookies(): string[];
}

function getSessionCookieValue(request: Request): string | null {
  return getCookie(request, "sm_session");
}

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function getRefreshTokenEncryptionKey(env: ApiEnv): Buffer {
  const keyMaterial = env.REFRESH_TOKEN_ENCRYPTION_KEY ?? env.DB_PASS;
  return createHash("sha256").update(keyMaterial).digest();
}

function encryptRefreshToken(refreshToken: string, env: ApiEnv): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getRefreshTokenEncryptionKey(env), iv);
  const ciphertext = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptRefreshToken(refreshToken: string, env: ApiEnv): string {
  const [version, iv, authTag, ciphertext] = refreshToken.split(".");
  if (version !== "v1" || !iv || !authTag || !ciphertext) {
    return refreshToken;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getRefreshTokenEncryptionKey(env),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async createSession(input: CreateSessionInput): Promise<WebSession> {
    const normalizedUser = normalizeReservedAuthUser(input.user);
    const sessionId = randomUUID();
    const sessionKey = `session:${input.user.employeeId}:${sessionId}`;
    const createdAt = new Date().toISOString();
    const session: WebSession = {
      sessionId,
      sessionKey,
      employeeId: normalizedUser.employeeId,
      refreshToken: input.refreshToken,
      csrfToken: createCsrfToken(),
      mobileSessionKey: input.mobileSessionKey,
      deviceId: input.deviceId,
      user: normalizedUser,
      createdAt,
    };

    const storedSession: WebSession = {
      ...session,
      refreshToken: encryptRefreshToken(session.refreshToken, this.env),
    };

    const client = await this.clientFactory();
    await client.set(sessionKey, JSON.stringify(storedSession), {
      expiration: {
        type: "EX",
        value: this.env.SESSION_TTL_SECONDS,
      },
    });

    return session;
  }

  async getSessionFromRequest(request: Request): Promise<WebSession | null> {
    const sessionKey = getSessionCookieValue(request);
    if (!sessionKey) {
      return null;
    }

    const client = await this.clientFactory();
    const rawSession = await client.get(sessionKey);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as WebSession;
    if (!session?.sessionKey || !session.user?.employeeId) {
      return null;
    }

    return {
      ...session,
      refreshToken: decryptRefreshToken(session.refreshToken, this.env),
      user: normalizeReservedAuthUser(session.user),
    };
  }

  async deleteSessionByKey(sessionKey: string): Promise<void> {
    if (!sessionKey) {
      return;
    }

    const client = await this.clientFactory();
    await client.del(sessionKey);
  }

  buildLoginCookies(session: WebSession): string[] {
    const csrfToken = session.csrfToken ?? createCsrfToken();

    return [
      buildSessionCookie(session.sessionKey, this.env),
      buildRefreshCookie(session.refreshToken, this.env),
      buildDeviceCookie(session.deviceId, this.env),
      buildCsrfCookie(csrfToken, this.env),
    ];
  }

  buildLogoutCookies(): string[] {
    return [
      buildExpiredCookie("sm_session", this.env),
      buildExpiredCookie("sm_refresh", this.env),
      buildExpiredCookie("sm_device_id", this.env),
      buildExpiredCookie("sm_csrf", this.env),
    ];
  }
}
