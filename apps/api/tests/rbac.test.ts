import { describe, expect, test } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { buildUserScope } from "@/services/rbac/scope";

describe("buildUserScope", () => {
  test("collects own and managed division descendants for assigned scope", () => {
    const scope = buildUserScope({
      divisionId: 10,
      divisions: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 12, parentId: 11 },
        { id: 20, parentId: null },
      ],
      managedDivisionIds: [20],
      managedUnitIds: ["CAR-2", "CAR-1", "CAR-1"],
      permissions: [permissionCodes.viewAssignedUnits],
      viewAllUnitsPermission: permissionCodes.viewAllUnits,
      viewAssignedUnitsPermission: permissionCodes.viewAssignedUnits,
      roleProfile: {
        roleLevel: 200,
        scopeBasis: "ASSIGNED_DIVISIONS",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: 2,
        notes: null,
      },
    });

    expect(scope.canViewAllUnits).toBe(false);
    expect(scope.canViewAssignedUnits).toBe(true);
    expect(scope.divisionIds).toEqual([10, 11, 12, 20]);
    expect(scope.managedDivisionIds).toEqual([20]);
    expect(scope.unitIds).toEqual(["CAR-1", "CAR-2"]);
  });

  test("marks global scope when the all-units permission exists", () => {
    const scope = buildUserScope({
      divisionId: 3,
      divisions: [{ id: 3, parentId: null }],
      managedDivisionIds: [],
      managedUnitIds: ["CAR-1"],
      permissions: [permissionCodes.viewAllUnits],
      viewAllUnitsPermission: permissionCodes.viewAllUnits,
      viewAssignedUnitsPermission: permissionCodes.viewAssignedUnits,
      roleProfile: {
        roleLevel: 900,
        scopeBasis: "GLOBAL",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: 9,
        notes: "Global admin",
      },
    });

    expect(scope.canViewAllUnits).toBe(true);
    expect(scope.divisionIds).toEqual([3]);
    expect(scope.unitIds).toEqual(["CAR-1"]);
  });
});
