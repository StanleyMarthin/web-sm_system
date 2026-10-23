import { describe, expect, it } from "bun:test";

import type { AuthUser } from "@smsystem/contracts/auth";
import { normalizeReservedAuthUser } from "./reserved-role";

const baseUser: AuthUser = {
  employeeId: "SM-11.003",
  fullName: "Test User",
  email: null,
  roleId: 1,
  roleName: "MIS Manager",
  divisionId: 1,
  divisionName: "Management Information System",
  grade: "MIS",
  permissions: [],
  roleProfile: null,
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

describe("normalizeReservedAuthUser", () => {
  it("does not elevate access from role, division, or grade names", () => {
    expect(normalizeReservedAuthUser(baseUser)).toEqual(baseUser);
  });

  it("grants the system superadmin policy only to SM-03.004", () => {
    const user = normalizeReservedAuthUser({
      ...baseUser,
      employeeId: "sm-03.004",
    });

    expect(user.scope.canViewAllUnits).toBe(true);
    expect(user.permissions.length > 0).toBe(true);
  });
});
