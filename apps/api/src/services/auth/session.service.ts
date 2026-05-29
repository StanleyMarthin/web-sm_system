import { randomUUID } from "node:crypto";
import type { AuthUser } from "@smsystem/contracts/auth";
import { createClient, type RedisClientType } from "redis";
import { getApiEnv, type ApiEnv } from "@/config/env";
import {
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
      mobileSessionKey: input.mobileSessionKey,
      deviceId: input.deviceId,
      user: normalizedUser,
      createdAt,
    };

    const client = await this.clientFactory();
    await client.set(sessionKey, JSON.stringify(session), {
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
    return [
      buildSessionCookie(session.sessionKey, this.env),
      buildRefreshCookie(session.refreshToken, this.env),
      buildDeviceCookie(session.deviceId, this.env),
    ];
  }

  buildLogoutCookies(): string[] {
    return [
      buildExpiredCookie("sm_session", this.env),
      buildExpiredCookie("sm_refresh", this.env),
    ];
  }
}
