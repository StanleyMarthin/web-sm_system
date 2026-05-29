import type { GridFilter } from "@smsystem/contracts/grid";
import type { WebSession } from "@/services/auth/session.service";

interface QueryWithFilters {
  filters: GridFilter[];
}

interface ScopedDivisionDefaults {
  divisionId: number;
  divisionName: string | null;
}

function hasSingleOwnDivisionScope(session: WebSession): boolean {
  const ownDivisionId = session.user.divisionId;
  if (ownDivisionId === null) {
    return false;
  }

  const { divisionIds } = session.user.scope;
  return divisionIds.length === 1 && divisionIds[0] === ownDivisionId;
}

export function resolveScopedDefaultDivision(
  session: WebSession,
): ScopedDivisionDefaults | null {
  if (session.user.scope.canViewAllUnits || session.user.divisionId === null) {
    return null;
  }

  const scopeBasis = session.user.roleProfile?.scopeBasis;
  if (scopeBasis && scopeBasis !== "OWN_DIVISION") {
    return null;
  }

  if (!scopeBasis && !hasSingleOwnDivisionScope(session)) {
    return null;
  }

  const divisionName = session.user.divisionName.trim();
  return {
    divisionId: session.user.divisionId,
    divisionName: divisionName || null,
  };
}

function addDefaultFilter<T extends QueryWithFilters>(
  query: T,
  field: string,
  value: string | null | undefined,
  skipIfFields: string[],
): T {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return query;
  }

  if (query.filters.some((filter) => skipIfFields.includes(filter.field))) {
    return query;
  }

  return {
    ...query,
    filters: [
      ...query.filters,
      {
        field,
        operator: "eq",
        value: normalizedValue,
      },
    ],
  };
}

export function applyDefaultDivisionIdFilter<T extends QueryWithFilters>(
  session: WebSession,
  query: T,
  field = "divisionId",
): T {
  const defaults = resolveScopedDefaultDivision(session);
  if (!defaults) {
    return query;
  }

  return addDefaultFilter(
    query,
    field,
    String(defaults.divisionId),
    [field],
  );
}

export function applyDefaultDivisionNameFilter<T extends QueryWithFilters>(
  session: WebSession,
  query: T,
  field = "divisionName",
): T {
  const defaults = resolveScopedDefaultDivision(session);
  if (!defaults?.divisionName) {
    return query;
  }

  return addDefaultFilter(
    query,
    field,
    defaults.divisionName,
    [field],
  );
}

export function applyDefaultWoDivisionFilter<T extends QueryWithFilters>(
  session: WebSession,
  query: T,
): T {
  const defaults = resolveScopedDefaultDivision(session);
  if (!defaults) {
    return query;
  }

  return addDefaultFilter(
    query,
    "fromDivisionId",
    String(defaults.divisionId),
    ["fromDivisionId", "toDivisionId"],
  );
}
