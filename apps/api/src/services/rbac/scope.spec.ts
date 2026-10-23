import { describe, expect, it } from "bun:test";
import { buildUserScope } from "./scope";

describe("buildUserScope", () => {
  it("caps assigned divisions and units with the role preset", () => {
    const scope = buildUserScope({
      divisionId: null,
      divisions: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 12, parentId: null },
      ],
      managedDivisionIds: [10, 12],
      managedUnitIds: ["UNIT-A", "UNIT-B"],
      permissions: [],
      viewAllUnitsPermission: "view_all_units",
      viewAssignedUnitsPermission: "view_assigned_units",
      roleProfile: {
        roleLevel: 100,
        scopeBasis: "ASSIGNED_DIVISIONS",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: null,
        notes: null,
        scopePreset: {
          divisionMode: "ASSIGNED_DIVISIONS",
          divisionIds: [12],
          unitMode: "ASSIGNED_UNITS",
          unitIds: ["UNIT-A"],
        },
      },
    });

    expect(scope.divisionIds).toEqual([12]);
    expect(scope.managedDivisionIds).toEqual([12]);
    expect(scope.unitIds).toEqual(["UNIT-A"]);
  });

  it("does not let a global unit permission bypass a limited role preset", () => {
    const scope = buildUserScope({
      divisionId: 10,
      divisions: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
      ],
      managedDivisionIds: [10, 11],
      managedUnitIds: ["UNIT-A", "UNIT-B"],
      permissions: ["view_all_units"],
      viewAllUnitsPermission: "view_all_units",
      viewAssignedUnitsPermission: "view_assigned_units",
      roleProfile: {
        roleLevel: 100,
        scopeBasis: "ASSIGNED_DIVISIONS",
        webEnabled: true,
        mobileEnabled: true,
        approvalRank: null,
        notes: null,
        scopePreset: {
          divisionMode: "ASSIGNED_DIVISIONS",
          divisionIds: [10],
          unitMode: "NONE",
          unitIds: [],
        },
      },
    });

    expect(scope.canViewAllUnits).toBe(false);
    expect(scope.canViewAssignedUnits).toBe(true);
    expect(scope.divisionIds).toEqual([10, 11]);
    expect(scope.unitIds).toEqual([]);
  });
});
