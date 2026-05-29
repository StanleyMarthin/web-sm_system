import type { AuthUser } from "@smsystem/contracts/auth";
import type { GridFilter } from "@smsystem/contracts/grid";
import { describe, expect, test } from "bun:test";
import {
  applyDefaultDivisionIdFilter,
  applyDefaultDivisionNameFilter,
  applyDefaultWoDivisionFilter,
} from "@/services/grid/division-default";
import type { WebSession } from "@/services/auth/session.service";

function buildSession(overrides: Partial<AuthUser>): WebSession {
  const user: AuthUser = {
    employeeId: "SM-17.001",
    fullName: "Ruhiat",
    email: null,
    roleId: 17,
    roleName: "ketua_divisi",
    divisionId: 12,
    divisionName: "INTERIOR",
    grade: "KD",
    permissions: ["WO_VIEW"],
    roleProfile: {
      roleLevel: 170,
      scopeBasis: "OWN_DIVISION",
      webEnabled: true,
      mobileEnabled: true,
      approvalRank: 2,
      notes: null,
    },
    scope: {
      canViewAllUnits: false,
      canViewAssignedUnits: true,
      divisionIds: [12],
      managedDivisionIds: [12],
      unitIds: [],
    },
    ...overrides,
  };

  return {
    sessionId: "session-1",
    sessionKey: "session:SM-17.001:session-1",
    employeeId: user.employeeId,
    refreshToken: "refresh-1",
    mobileSessionKey: "session:SM-17.001",
    deviceId: "device-1",
    user,
    createdAt: "2026-05-20T00:00:00.000Z",
  };
}

function buildQuery(filters: GridFilter[] = []) {
  return {
    page: 1,
    limit: 25,
    search: "",
    sortBy: "createdAt",
    sortDirection: "desc" as const,
    view: null,
    filters,
  };
}

describe("division default filter helper", () => {
  test("injects divisionId for own-division scope when missing", () => {
    const session = buildSession({});
    const query = buildQuery();

    const normalized = applyDefaultDivisionIdFilter(session, query);

    expect(normalized.filters).toEqual([
      {
        field: "divisionId",
        operator: "eq",
        value: "12",
      },
    ]);
  });

  test("does not override existing divisionId filter", () => {
    const session = buildSession({});
    const query = buildQuery([
      {
        field: "divisionId",
        operator: "eq",
        value: "29",
      },
    ]);

    const normalized = applyDefaultDivisionIdFilter(session, query);

    expect(normalized.filters).toEqual(query.filters);
  });

  test("skips default for global scope", () => {
    const session = buildSession({
      scope: {
        canViewAllUnits: true,
        canViewAssignedUnits: true,
        divisionIds: [12],
        managedDivisionIds: [12],
        unitIds: [],
      },
      roleProfile: {
        roleLevel: 900,
        scopeBasis: "GLOBAL",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: 9,
        notes: null,
      },
    });

    const normalized = applyDefaultDivisionIdFilter(session, buildQuery());
    expect(normalized.filters).toEqual([]);
  });

  test("fallback still injects when role profile missing and scope is single own division", () => {
    const session = buildSession({
      roleProfile: null,
      scope: {
        canViewAllUnits: false,
        canViewAssignedUnits: true,
        divisionIds: [12],
        managedDivisionIds: [12],
        unitIds: [],
      },
    });

    const normalized = applyDefaultDivisionIdFilter(session, buildQuery());
    expect(normalized.filters[0]?.field).toBe("divisionId");
    expect(normalized.filters[0]?.value).toBe("12");
  });

  test("injects divisionName when requested", () => {
    const session = buildSession({});

    const normalized = applyDefaultDivisionNameFilter(session, buildQuery());
    expect(normalized.filters).toEqual([
      {
        field: "divisionName",
        operator: "eq",
        value: "INTERIOR",
      },
    ]);
  });

  test("WO default uses fromDivisionId and respects existing division filters", () => {
    const session = buildSession({});
    const normalized = applyDefaultWoDivisionFilter(session, buildQuery());
    expect(normalized.filters).toEqual([
      {
        field: "fromDivisionId",
        operator: "eq",
        value: "12",
      },
    ]);

    const withToDivision = buildQuery([
      {
        field: "toDivisionId",
        operator: "eq",
        value: "13",
      },
    ]);
    const untouched = applyDefaultWoDivisionFilter(session, withToDivision);
    expect(untouched.filters).toEqual(withToDivision.filters);
  });
});
