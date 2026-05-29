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

export function buildUserScope(input: BuildUserScopeInput): AuthScope {
  const managedDivisionIds = [...new Set(input.managedDivisionIds)].sort(
    (left, right) => left - right,
  );
  const managedUnitIds = [...new Set(input.managedUnitIds)].sort();
  const scopeBasis = input.roleProfile?.scopeBasis ?? "OWN_DIVISION";
  const ownDivisionIds = input.divisionId !== null ? [input.divisionId] : [];
  const seedDivisionIds =
    scopeBasis === "OWN_DIVISION" || scopeBasis === "SELF_ONLY"
      ? ownDivisionIds
      : [...ownDivisionIds, ...managedDivisionIds];
  const divisionIds = collectDescendants(input.divisions, seedDivisionIds);
  const canViewAllUnits =
    hasPermission(input.permissions, input.viewAllUnitsPermission) ||
    scopeBasis === "GLOBAL";
  const canViewAssignedUnits =
    !canViewAllUnits &&
    (hasPermission(input.permissions, input.viewAssignedUnitsPermission) ||
      scopeBasis !== "SELF_ONLY");

  return {
    canViewAllUnits,
    canViewAssignedUnits,
    divisionIds,
    managedDivisionIds,
    unitIds: managedUnitIds,
  };
}
