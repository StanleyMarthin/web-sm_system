import { describe, expect, test } from "bun:test";
import { DefaultSessionSynchronizer } from "./session-synchronizer";
import type { AuthContextRepository } from "@/repositories/auth-context/auth-context.repo";
import type { SessionStore, WebSession } from "./session.service";
import type { SmLoginAdapter } from "./sm-login.adapter";

const user = {
  employeeId: "SM-08.001",
  fullName: "Teknisi",
  email: null,
  photoUrl: null,
  roleId: 1,
  roleName: "teknisi",
  divisionId: 8,
  divisionName: "Interior",
  grade: null,
  permissions: ["view_units"],
  roleProfile: null,
  scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [8], managedDivisionIds: [8], unitIds: [] },
};

const activeSession = {
  sessionKey: "session:SM-08.001:web",
} as WebSession;

describe("DefaultSessionSynchronizer", () => {
  test("refreshes mobile and web session from the committed user context", async () => {
    const mobileCalls: string[][] = [];
    const webCalls: string[] = [];
    const synchronizer = new DefaultSessionSynchronizer(
      {
        async loginWeb() { throw new Error("not used"); },
        async refresh() { throw new Error("not used"); },
        async syncEmployeeSessions(ids) { mobileCalls.push([...ids]); },
        async invalidateEmployeeSessions() { throw new Error("not used"); },
      } satisfies SmLoginAdapter,
      { async findByEmployeeId() { return user; } } satisfies AuthContextRepository,
      {
        async createSession() { throw new Error("not used"); },
        async getSessionFromRequest() { return null; },
        async getActiveSessionByEmployeeId() { return activeSession; },
        async updateSessionUser(sessionKey) { webCalls.push(sessionKey); },
        async deleteSessionByKey() {},
        async deleteActiveSessionByEmployeeId() {},
        buildLoginCookies() { return []; },
        buildLogoutCookies() { return []; },
      } satisfies SessionStore,
    );

    await synchronizer.sync(["sm-08.001", "SM-08.001"]);

    expect(mobileCalls).toEqual([["SM-08.001"]]);
    expect(webCalls).toEqual(["session:SM-08.001:web"]);
  });

  test("removes both session types when invalidated", async () => {
    const mobileCalls: string[][] = [];
    const removed: string[] = [];
    const synchronizer = new DefaultSessionSynchronizer(
      {
        async loginWeb() { throw new Error("not used"); },
        async refresh() { throw new Error("not used"); },
        async syncEmployeeSessions() { throw new Error("not used"); },
        async invalidateEmployeeSessions(ids) { mobileCalls.push([...ids]); },
      } satisfies SmLoginAdapter,
      { async findByEmployeeId() { return null; } } satisfies AuthContextRepository,
      {
        async createSession() { throw new Error("not used"); },
        async getSessionFromRequest() { return null; },
        async getActiveSessionByEmployeeId() { return null; },
        async deleteSessionByKey() {},
        async deleteActiveSessionByEmployeeId(employeeId) { removed.push(employeeId); },
        buildLoginCookies() { return []; },
        buildLogoutCookies() { return []; },
      } satisfies SessionStore,
    );

    await synchronizer.invalidate(["SM-08.001"]);

    expect(mobileCalls).toEqual([["SM-08.001"]]);
    expect(removed).toEqual(["SM-08.001"]);
  });
});
