import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { RedisSessionStore, type WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.003",
  fullName: "Rifki Arischandra",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["PROFILE_VIEW", "view_all_units"],
  roleProfile: {
    roleLevel: 200,
    scopeBasis: "OWN_DIVISION",
    webEnabled: true,
    mobileEnabled: false,
    approvalRank: 1,
    notes: "legacy",
  },
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: ["SM-08.005"],
  },
};

describe("RedisSessionStore", () => {
  test("normalizes MIS payload when storing a fresh session", async () => {
    let savedSession: string | null = null;

    const store = new RedisSessionStore(
      async () =>
        ({
          async set(_key: string, value: string) {
            savedSession = value;
          },
        }) as never,
      {
        SESSION_TTL_SECONDS: 3600,
        DB_PASS: "test-secret",
      } as never,
    );

    await store.createSession({
      user: sampleUser,
      refreshToken: "refresh-1",
      mobileSessionKey: "session:SM-03.003",
      deviceId: "web-device-1",
    });

    const parsedSession = JSON.parse(savedSession ?? "{}") as WebSession;
    expect(parsedSession.user.permissions).toContain("REPORT_VIEW");
    expect(parsedSession.user.scope.canViewAllUnits).toBe(true);
    expect(parsedSession.user.roleProfile?.scopeBasis).toBe("GLOBAL");
  });

  test("normalizes MIS payload when reading an older session", async () => {
    const rawSession: WebSession = {
      sessionId: "session-1",
      sessionKey: "session:SM-03.003:session-1",
      employeeId: "SM-03.003",
      refreshToken: "refresh-1",
      mobileSessionKey: "session:SM-03.003",
      deviceId: "web-device-1",
      user: sampleUser,
      createdAt: "2026-05-18T12:00:00.000Z",
    };

    const store = new RedisSessionStore(
      async () =>
        ({
          async get() {
            return JSON.stringify(rawSession);
          },
        }) as never,
      {
        SESSION_TTL_SECONDS: 3600,
        DB_PASS: "test-secret",
      } as never,
    );

    const session = await store.getSessionFromRequest(
      new Request("http://localhost/api/auth/me", {
        headers: {
          cookie: "sm_session=session:SM-03.003:session-1",
        },
      }),
    );

    expect(session?.user.permissions).toContain("WAREHOUSE_READY");
    expect(session?.user.permissions).toContain("TASK_SUBMIT");
    expect(session?.user.scope.canViewAllUnits).toBe(true);
    expect(session?.user.roleProfile?.scopeBasis).toBe("GLOBAL");
  });
});
