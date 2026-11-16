import { SYSTEM_SUPERADMIN_EMPLOYEE_ID, type AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import {
  normalizeReservedAuthUser,
} from "@/services/rbac/reserved-role";

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

describe("reserved system superadmin normalization", () => {
  test("preserves MIS permissions without granting system superadmin access", () => {
    const normalizedUser = normalizeReservedAuthUser(sampleUser);

    expect(normalizedUser).toEqual(sampleUser);
    expect(normalizedUser.scope.canViewAllUnits).toBe(false);
    expect(normalizedUser.roleProfile?.scopeBasis).toBe("OWN_DIVISION");
  });

  test("grants system superadmin access only to the reserved employee identity", () => {
    const normalizedUser = normalizeReservedAuthUser({
      ...sampleUser,
      employeeId: SYSTEM_SUPERADMIN_EMPLOYEE_ID,
      roleName: "teknisi",
      divisionName: "MECHANIC",
      grade: "TEKNISI",
    });

    expect(normalizedUser.permissions).toContain("REPORT_VIEW");
    expect(normalizedUser.permissions).toContain("TASK_SUBMIT");
    expect(normalizedUser.permissions).toContain("WAREHOUSE_READY");
    expect(normalizedUser.roleProfile).toMatchObject({
      roleLevel: 900,
      scopeBasis: "GLOBAL",
      webEnabled: true,
      mobileEnabled: true,
      approvalRank: 9,
    });
    expect(normalizedUser.scope.canViewAllUnits).toBe(true);
    expect(normalizedUser.scope.canViewAssignedUnits).toBe(true);
    expect(sampleUser.permissions).toEqual(["PROFILE_VIEW", "view_all_units"]);
    expect(sampleUser.scope.canViewAllUnits).toBe(false);
  });

  test("preserves advisor scope and permissions from the authorization context", () => {
    const advisorUser: AuthUser = {
      ...sampleUser,
      roleName: "advisor",
      grade: "ADV",
      divisionName: "ADVISOR",
      roleProfile: {
        ...sampleUser.roleProfile!,
        scopeBasis: "GLOBAL",
      },
      scope: {
        ...sampleUser.scope,
        canViewAllUnits: true,
        canViewAssignedUnits: true,
        divisionIds: [3, 7, 17, 18],
        managedDivisionIds: [7, 17, 18],
      },
    };
    const normalizedUser = normalizeReservedAuthUser(advisorUser);

    expect(normalizedUser).toEqual(advisorUser);
  });

  test("keeps kepala produksi on its assigned-unit scope", () => {
    const kepalaProduksiUser = normalizeReservedAuthUser({
      ...sampleUser,
      roleName: "kepala_produksi",
      grade: "KP",
      divisionName: "INTERIOR",
      roleProfile: {
        ...sampleUser.roleProfile!,
        scopeBasis: "ASSIGNED_UNITS",
      },
      scope: {
        ...sampleUser.scope,
        canViewAllUnits: false,
        canViewAssignedUnits: true,
        divisionIds: [12],
        managedDivisionIds: [12],
      },
    });

    expect(kepalaProduksiUser.roleProfile?.scopeBasis).toBe("ASSIGNED_UNITS");
    expect(kepalaProduksiUser.scope.canViewAllUnits).toBe(false);
    expect(kepalaProduksiUser.scope.canViewAssignedUnits).toBe(true);
  });

  test("does not grant system superadmin access based on MIS division or grade", () => {
    const misDivisionUser: AuthUser = {
      ...sampleUser,
      roleName: "ketua_divisi",
      grade: "MIS",
      divisionName: "MANAGEMENT INFORMATION SYSTEM",
      permissions: ["PROFILE_VIEW"],
      roleProfile: {
        ...sampleUser.roleProfile!,
        scopeBasis: "ASSIGNED_DIVISIONS",
      },
      scope: {
        ...sampleUser.scope,
        canViewAllUnits: false,
        canViewAssignedUnits: true,
        divisionIds: [3],
        managedDivisionIds: [3],
      },
    };
    const normalizedUser = normalizeReservedAuthUser(misDivisionUser);

    expect(normalizedUser).toEqual(misDivisionUser);
    expect(normalizedUser.permissions).toEqual(["PROFILE_VIEW"]);
    expect(normalizedUser.scope.canViewAllUnits).toBe(false);
    expect(normalizedUser.roleProfile?.scopeBasis).toBe("ASSIGNED_DIVISIONS");
  });
});
