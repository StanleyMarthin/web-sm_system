import { DEVICE_COOKIE_NAME, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser, LoginRequest } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import { SmLoginAdapterError } from "@/services/auth/sm-login.adapter";

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

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-03.004:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    async login() {
      return {
        user: sampleUser,
        cookies: [
          `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
          `${REFRESH_COOKIE_NAME}=refresh-1`,
          `${DEVICE_COOKIE_NAME}=web-device-1`,
        ],
      };
    },
    async logout() {
      return [`${SESSION_COOKIE_NAME}=; Max-Age=0`, `${REFRESH_COOKIE_NAME}=; Max-Age=0`];
    },
    async refresh() {
      return {
        user: sampleUser,
        cookies: [`${SESSION_COOKIE_NAME}=session:SM-03.004:session-2`],
      };
    },
    async getCurrentSession() {
      return sampleSession;
    },
    async getCurrentUser() {
      return sampleUser;
    },
    async getCurrentPermissions() {
      return sampleUser.permissions;
    },
    ...overrides,
  };
}

describe("API auth and dashboard routes", () => {
  test("sets auth cookies on login success", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          employeeId: sampleUser.employeeId,
          password: "secret",
          force: false,
        } satisfies LoginRequest),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.user.employeeId).toBe(sampleUser.employeeId);
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
  });

  test("blocks /api/auth/me when session is invalid", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentUser() {
          return null;
        },
      }),
    });

    const response = await fetchHandler(new Request("http://localhost/api/auth/me"));
    expect(response.status).toBe(401);
  });

  test("counts active-session warnings returned by upstream login", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async login() {
          throw new SmLoginAdapterError(
            "Akun ini sedang login di perangkat Web lain.",
            409,
            "ACTIVE_SESSION_EXISTS",
            {},
          );
        },
      }),
    });

    let response: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetchHandler(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            employeeId: "SM-77.777",
            password: "secret",
            force: false,
          } satisfies LoginRequest),
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    }

    const body = await response?.json();
    expect(response?.status).toBe(429);
    expect(body.errorCode).toBe("ACTIVE_SESSION_CANCEL_LIMITED");
    expect(body.data.retryAfterSeconds).toBe(60);
  });

  test("protects dashboard bootstrap endpoint with permissions", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [],
            },
          };
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/dashboard/bootstrap"),
    );

    expect(response.status).toBe(403);
  });
});
