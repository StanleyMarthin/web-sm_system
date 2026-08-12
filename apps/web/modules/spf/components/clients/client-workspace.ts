import type { UnitBoardRow, UnitClient, UnitClientUnit } from "@smsystem/contracts/unit";
import type { SpfClient } from "@/shared/api/spf-contracts";

export type ClientWorkspaceRow = SpfClient & { portalConfigured: boolean };

export function clientWorkspaceCapabilities(capabilities: {
  canAdmin: boolean;
  canApprove: boolean;
  canPublish: boolean;
}) {
  return {
    canOpen: capabilities.canAdmin || capabilities.canPublish,
    canEditClient: capabilities.canAdmin,
    canManageAccess: capabilities.canAdmin || capabilities.canPublish,
    canGenerateUrl: capabilities.canPublish,
    canPreview: capabilities.canAdmin,
  } as const;
}

const clientKey = (value: string) => value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("id-ID");

export function findClientProfile(name: string, profiles: readonly SpfClient[]) {
  const key = clientKey(name);
  const matches = profiles.filter((profile) => clientKey(profile.display_name) === key);
  return matches.length === 1 ? matches[0] : undefined;
}

export function unitClientsFromBoard(units: readonly UnitBoardRow[]): UnitClient[] {
  const grouped = new Map<string, UnitClient>();
  for (const unit of units) {
    const name = unit.customerName?.trim().replace(/\s+/gu, " ");
    if (!name) continue;
    const key = clientKey(name);
    const current = grouped.get(key);
    grouped.set(key, { name: current?.name ?? name, unitCount: (current?.unitCount ?? 0) + 1 });
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

export function clientUnitsFromBoard(name: string, units: readonly UnitBoardRow[]): UnitClientUnit[] {
  const key = clientKey(name);
  return units
    .filter((unit) => unit.customerName && clientKey(unit.customerName) === key)
    .map((unit) => ({ unitId: unit.unitId, unitName: unit.unitName, status: unit.status }));
}

export function buildClientWorkspaceRows(
  clients: readonly UnitClient[],
  profiles: readonly SpfClient[],
): ClientWorkspaceRow[] {
  const profilesByName = new Map<string, SpfClient | null>();
  for (const profile of profiles) {
    const key = clientKey(profile.display_name);
    profilesByName.set(key, profilesByName.has(key) ? null : profile);
  }
  const grouped = new Map<string, { name: string; unitCount: number }>();
  for (const client of clients) {
    const name = client.name.trim().replace(/\s+/gu, " ");
    const key = clientKey(name);
    const current = grouped.get(key);
    grouped.set(key, { name: current?.name ?? name, unitCount: (current?.unitCount ?? 0) + client.unitCount });
  }

  return [...grouped.entries()]
    .map(([key, group]) => {
      const profile = profilesByName.get(key) ?? undefined;
      return {
        ...(profile ?? {
          id: `unit-${encodeURIComponent(key)}`,
          client_id: `unit-${encodeURIComponent(key)}`,
          display_name: group.name,
          status: "NOT_CONFIGURED",
          updated_at: "",
          timeline: [],
          reports: [],
        }),
        display_name: group.name,
        unit_count: group.unitCount,
        vehicles: profile?.vehicles ?? [],
        portalConfigured: Boolean(profile),
      } satisfies ClientWorkspaceRow;
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "id-ID"));
}
