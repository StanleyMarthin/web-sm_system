import { DEVICE_COOKIE_NAME, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser, LoginRequest } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { DefaultAuthService } from "@/services/auth/auth.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { AuthContextRepository } from "@/repositories/auth-context.repo";
import type { SessionStore, WebSession } from "@/services/auth/session.service";
import type { SmLoginAdapter } from "@/services/auth/sm-login.adapter";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["PROFILE_VIEW", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, WebSession>();

  async createSession(input: {
    user: AuthUser;
    refreshToken: string;
    mobileSessionKey: string;
    deviceId: string;
  }): Promise<WebSession> {
    const session: WebSession = {
      sessionId: "session-1",
      sessionKey: `session:${input.user.employeeId}:session-1`,
      employeeId: input.user.employeeId,
      refreshToken: input.refreshToken,
      mobileSessionKey: input.mobileSessionKey,
      deviceId: input.deviceId,
      user: input.user,
      createdAt: "2026-05-13T00:00:00.000Z",
    };

    this.sessions.set(session.sessionKey, session);
    return session;
  }

  async getSessionFromRequest(request: Request): Promise<WebSession | null> {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));

    if (!sessionCookie) {
      return null;
    }

    const sessionKey = decodeURIComponent(sessionCookie.split("=").slice(1).join("="));
    return this.sessions.get(sessionKey) ?? null;
  }

  async deleteSessionByKey(sessionKey: string): Promise<void> {
    this.sessions.delete(sessionKey);
  }

  buildLoginCookies(session: WebSession): string[] {
    return [
      `${SESSION_COOKIE_NAME}=${session.sessionKey}`,
      `${REFRESH_COOKIE_NAME}=${session.refreshToken}`,
      `${DEVICE_COOKIE_NAME}=${session.deviceId}`,
    ];
  }

  buildLogoutCookies(): string[] {
    return [`${SESSION_COOKIE_NAME}=; Max-Age=0`, `${REFRESH_COOKIE_NAME}=; Max-Age=0`];
  }
}

describe("DefaultAuthService", () => {
  test("creates a web session after login and writes an audit entry", async () => {
    const sessionStore = new InMemorySessionStore();
    const auditEntries: string[] = [];

    const authService = new DefaultAuthService(
      {
        async loginWeb() {
          return {
            employeeId: sampleUser.employeeId,
            mobileSessionKey: "session:SM-03.004",
            refreshToken: "refresh-1",
          };
        },
        async refresh() {
          throw new Error("Not used");
        },
      } satisfies SmLoginAdapter,
      {
        async findByEmployeeId() {
          return sampleUser;
        },
      } satisfies AuthContextRepository,
      sessionStore,
      {
        async log(entry) {
          auditEntries.push(entry.action);
        },
      } satisfies AuditService,
    );

    const result = await authService.login(
      new Request("http://localhost/api/auth/login", {
        headers: {
          cookie: `${DEVICE_COOKIE_NAME}=web-device-1`,
        },
      }),
      {
        employeeId: sampleUser.employeeId,
        password: "secret",
        force: false,
      } satisfies LoginRequest,
    );

    expect(result.user.employeeId).toBe(sampleUser.employeeId);
    expect(result.cookies.join(";")).toContain(SESSION_COOKIE_NAME);
    expect(sessionStore.sessions.size).toBe(1);
    expect(auditEntries).toEqual(["auth.login"]);
  });

  test("deletes the current session and writes logout audit", async () => {
    const sessionStore = new InMemorySessionStore();
    const auditEntries: string[] = [];

    const existingSession = await sessionStore.createSession({
      user: sampleUser,
      refreshToken: "refresh-1",
      mobileSessionKey: "session:SM-03.004",
      deviceId: "web-device-1",
    });

    const authService = new DefaultAuthService(
      {
        async loginWeb() {
          throw new Error("Not used");
        },
        async refresh() {
          throw new Error("Not used");
        },
      } satisfies SmLoginAdapter,
      {
        async findByEmployeeId() {
          return sampleUser;
        },
      } satisfies AuthContextRepository,
      sessionStore,
      {
        async log(entry) {
          auditEntries.push(entry.action);
        },
      } satisfies AuditService,
    );

    const cookies = await authService.logout(
      new Request("http://localhost/api/auth/logout", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(existingSession.sessionKey)}`,
        },
      }),
    );

    expect(sessionStore.sessions.size).toBe(0);
    expect(cookies.join(";")).toContain("Max-Age=0");
    expect(auditEntries).toEqual(["auth.logout"]);
  });

  test("throws when refresh is requested without a refresh cookie", async () => {
    const authService = new DefaultAuthService(
      {
        async loginWeb() {
          throw new Error("Not used");
        },
        async refresh() {
          throw new Error("Not used");
        },
      } satisfies SmLoginAdapter,
      {
        async findByEmployeeId() {
          return sampleUser;
        },
      } satisfies AuthContextRepository,
      new InMemorySessionStore(),
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    try {
      await authService.refresh(new Request("http://localhost/api/auth/refresh"));
      throw new Error("Expected refresh to fail");
    } catch (error) {
      expect((error as Error).message).toBe("REFRESH_TOKEN_REQUIRED");
    }
  });
});
