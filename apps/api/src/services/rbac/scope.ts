import type { RoleProfile } from "@smsystem/contracts/rbac";
import { hasPermission } from "@smsystem/permissions";
import type { AuthScope } from "@smsystem/contracts/auth";

interface DivisionNode {
  id: number;
  parentId: number | null;
}

interface BuildUserScopeInput {
  divisionId: number | null;
  divisions: DivisionNode[];
  managedDivisionIds: number[];
  managedUnitIds: string[];
  permissions: string[];
  viewAllUnitsPermission: string;
  viewAssignedUnitsPermission: string;
  roleProfile?: RoleProfile | null;
}

function collectDescendants(
  divisions: DivisionNode[],
  rootDivisionIds: number[],
): number[] {
  const childrenByParent = new Map<number, number[]>();
  for (const division of divisions) {
    if (division.parentId === null) {
      continue;
    }

    const currentChildren = childrenByParent.get(division.parentId) ?? [];
    currentChildren.push(division.id);
    childrenByParent.set(division.parentId, currentChildren);
  }

  const visited = new Set<number>();
  const stack = [...rootDivisionIds];

  while (stack.length > 0) {
    const currentDivisionId = stack.pop();
    if (currentDivisionId === undefined || visited.has(currentDivisionId)) {
      continue;
    }

    visited.add(currentDivisionId);
    for (const childDivisionId of childrenByParent.get(currentDivisionId) ?? []) {
      stack.push(childDivisionId);
    }
  }

  return [...visited].sort((left, right) => left - right);
}

function capDivisionScope(
  divisions: DivisionNode[],
  ownDivisionIds: number[],
  divisionIds: number[],
  roleProfile: RoleProfile | null | undefined,
): number[] {
  const preset = roleProfile?.scopePreset;
  switch (preset?.divisionMode) {
    case "NONE":
      return [];
    case "OWN_DIVISION":
      return collectDescendants(divisions, ownDivisionIds);
    case "ASSIGNED_DIVISIONS": {
      const permittedIds = new Set(collectDescendants(divisions, preset.divisionIds));
      return divisionIds.filter((divisionId) => permittedIds.has(divisionId));
    }
    default:
      return divisionIds;
  }
}

function capUnitScope(
  unitIds: string[],
  roleProfile: RoleProfile | null | undefined,
): string[] {
  const preset = roleProfile?.scopePreset;
  switch (preset?.unitMode) {
    case "NONE":
      return [];
    case "ASSIGNED_UNITS": {
      const permittedIds = new Set(preset.unitIds);
      return unitIds.filter((unitId) => permittedIds.has(unitId));
    }
    default:
      return unitIds;
  }
}

export function buildUserScope(input: BuildUserScopeInput): AuthScope {
  const managedDivisionIds = [...new Set(input.managedDivisionIds)].sort(
    (left, right) => left - right,
  );
  const managedUnitIds = [...new Set(input.managedUnitIds)].sort();
  const scopeBasis = input.roleProfile?.scopeBasis ?? "OWN_DIVISION";
  const ownDivisionIds = input.divisionId !== null ? [input.divisionId] : [];
  const seedDivisionIds =
    scopeBasis === "ASSIGNED_UNITS"
      ? []
      : scopeBasis === "OWN_DIVISION" || scopeBasis === "SELF_ONLY"
      ? ownDivisionIds
      : [...ownDivisionIds, ...managedDivisionIds];
  const divisionIds = capDivisionScope(
    input.divisions,
    ownDivisionIds,
    collectDescendants(input.divisions, seedDivisionIds),
    input.roleProfile,
  );
  const hasLimitedPreset =
    input.roleProfile?.scopePreset !== undefined &&
    input.roleProfile.scopePreset.divisionMode !== "GLOBAL" &&
    input.roleProfile.scopePreset.unitMode !== "GLOBAL";
  const hasNoScopePreset =
    input.roleProfile?.scopePreset?.divisionMode === "NONE" &&
    input.roleProfile.scopePreset.unitMode === "NONE";
  const canViewAllUnits =
    !hasLimitedPreset &&
    (hasPermission(input.permissions, input.viewAllUnitsPermission) ||
      scopeBasis === "GLOBAL");
  const canViewAssignedUnits =
    !canViewAllUnits &&
    !hasNoScopePreset &&
    (hasPermission(input.permissions, input.viewAssignedUnitsPermission) ||
      scopeBasis !== "SELF_ONLY");

  return {
    canViewAllUnits,
    canViewAssignedUnits,
    divisionIds,
    managedDivisionIds: managedDivisionIds.filter((divisionId) =>
      divisionIds.includes(divisionId),
    ),
    unitIds: capUnitScope(managedUnitIds, input.roleProfile),
  };
}
