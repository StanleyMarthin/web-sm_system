import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import {
  RESERVED_SUPERADMIN_PROFILE,
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

describe("reserved MIS normalization", () => {
  test("expands MIS into full access payload", () => {
    const normalizedUser = normalizeReservedAuthUser(sampleUser);

    expect(normalizedUser.permissions).toContain("REPORT_VIEW");
    expect(normalizedUser.permissions).toContain("TASK_SUBMIT");
    expect(normalizedUser.permissions).toContain("WAREHOUSE_READY");
    expect(normalizedUser.roleProfile).toEqual(RESERVED_SUPERADMIN_PROFILE);
    expect(normalizedUser.scope.canViewAllUnits).toBe(true);
    expect(normalizedUser.scope.canViewAssignedUnits).toBe(true);
  });

  test("normalizes advisor into managed division scope", () => {
    const advisorUser = normalizeReservedAuthUser({
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
    });

    expect(advisorUser.permissions).toContain(permissionCodes.qcView);
    expect(advisorUser.permissions).toContain(permissionCodes.qcValidate);
    expect(advisorUser.roleProfile?.scopeBasis).toBe("ASSIGNED_DIVISIONS");
    expect(advisorUser.scope.canViewAllUnits).toBe(false);
    expect(advisorUser.scope.canViewAssignedUnits).toBe(true);
    expect(advisorUser.scope.divisionIds).toEqual([7, 17, 18]);
  });

  test("expands kepala produksi into global division scope", () => {
    const kepalaProduksiUser = normalizeReservedAuthUser({
      ...sampleUser,
      roleName: "kepala_produksi",
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

    expect(kepalaProduksiUser.roleProfile?.scopeBasis).toBe("GLOBAL");
    expect(kepalaProduksiUser.scope.canViewAllUnits).toBe(true);
    expect(kepalaProduksiUser.scope.canViewAssignedUnits).toBe(true);
  });

  test("expands MIS division user into full access even with another role name", () => {
    const misDivisionUser = normalizeReservedAuthUser({
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
    });

    expect(misDivisionUser.permissions).toContain("REPORT_VIEW");
    expect(misDivisionUser.roleProfile).toEqual(RESERVED_SUPERADMIN_PROFILE);
    expect(misDivisionUser.scope.canViewAllUnits).toBe(true);
    expect(misDivisionUser.scope.canViewAssignedUnits).toBe(true);
  });
});
