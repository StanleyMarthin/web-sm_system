import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfClientDetail, fetchSpfClients } from "@/shared/api/spf";
import type { SpfClient } from "@/shared/api/spf-contracts";
import { fetchUnitBoard, fetchUnitClients } from "@/shared/api/units";
import type { UnitBoardRow } from "@smsystem/contracts/unit";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { ClientListShell } from "@/modules/spf/components/clients/client-list-shell";
import { ClientDetailShell } from "@/modules/spf/components/clients/client-detail-shell";
import { buildClientWorkspaceRows, clientUnitsFromBoard, clientWorkspaceCapabilities, findClientProfile, unitClientsFromBoard } from "@/modules/spf/components/clients/client-workspace";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseQuery(searchParams: Record<string, string | string[] | undefined>) {
  const rawPage = typeof searchParams.page === "string" ? searchParams.page : "1";
  const rawLimit = typeof searchParams.limit === "string" ? searchParams.limit : "25";
  const page = /^\d+$/.test(rawPage) ? Math.max(1, Number.parseInt(rawPage, 10)) : 1;
  const limit = /^\d+$/.test(rawLimit) ? Math.min(100, Math.max(1, Number.parseInt(rawLimit, 10))) : 25;
  return {
    search: typeof searchParams.search === "string" ? searchParams.search : undefined,
    limit,
    offset: (page - 1) * limit,
  };
}

async function fetchAllSpfClientProfiles(cookieHeader: string) {
  let profiles: SpfClient[] = [];
  let offset = 0;
  while (true) {
    const result = await fetchSpfClients(cookieHeader, { limit: 100, offset });
    if (!result.payload) return { profiles: null, status: result.status };
    profiles = [...profiles, ...result.payload.clients];
    if (!result.payload.meta.hasNextPage || result.payload.clients.length === 0) return { profiles, status: result.status };
    offset += result.payload.clients.length;
  }
}

async function fetchAllUnitRows(cookieHeader: string, search?: string) {
  let rows: UnitBoardRow[] = [];
  let page = 1;
  while (true) {
    const result = await fetchUnitBoard(cookieHeader, {
      search: search?.slice(0, 100),
      limit: "100",
      page: String(page),
      sortBy: "customerName",
      sortDirection: "asc",
    });
    if (!result.payload) return { rows: null, status: result.status };
    rows = [...rows, ...result.payload.data];
    if (!result.payload.meta.hasNext || result.payload.data.length === 0) return { rows, status: result.status };
    page += 1;
  }
}

async function fetchUnitClientSource(cookieHeader: string, query: { search?: string; selected?: string }) {
  const result = await fetchUnitClients(cookieHeader, query);
  if (result.payload || result.status === 401 || result.status === 403) return result;

  const fallback = await fetchAllUnitRows(cookieHeader, query.search ?? query.selected);
  if (!fallback.rows) return { payload: null, status: fallback.status };
  const units = query.selected ? clientUnitsFromBoard(query.selected, fallback.rows) : [];
  return {
    payload: {
      clients: unitClientsFromBoard(fallback.rows),
      selectedClient: query.selected && units.length > 0 ? { name: query.selected, units } : null,
    },
    status: fallback.status,
  };
}

export default async function SpfClientsPage({ searchParams }: Props) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");
  const capabilities = clientWorkspaceCapabilities(session);
  if (!capabilities.canOpen) redirect("/spf/periods");

  const params = await searchParams;
  const selectedName = typeof params.clientName === "string" ? params.clientName.trim().slice(0, 255) : "";
  if (selectedName) {
    const [unitClient, profileList] = await Promise.all([
      fetchUnitClientSource(cookieHeader, { selected: selectedName }),
      fetchSpfClients(cookieHeader, { search: selectedName, limit: 100, offset: 0 }),
    ]);
    const selectedClient = unitClient.payload?.selectedClient;
    if (!selectedClient) notFound();
    const profile = findClientProfile(selectedName, profileList.payload?.clients ?? []);
    const detail = profile ? await fetchSpfClientDetail(cookieHeader, profile.id) : null;
    if (detail?.status === 401) redirect("/login");
    if (detail?.status === 403) redirect("/forbidden");
    const profileVehicles = new Map((detail?.payload?.vehicles ?? []).map((vehicle) => [vehicle.car_id, vehicle]));
    const vehicles = selectedClient.units.map((unit, index) => ({
      car_id: unit.unitId,
      car_name: unit.unitName,
      display_name: unit.unitName,
      source_type: "SYSTEM" as const,
      visible: unit.status.toLowerCase() !== "done",
      display_order: index,
      last_period_update: profileVehicles.get(unit.unitId)?.last_period_update ?? null,
      updated_at: profileVehicles.get(unit.unitId)?.updated_at ?? null,
    }));
    const client = detail?.payload?.client ?? { id: `unit-${encodeURIComponent(selectedName)}`, client_id: `unit-${encodeURIComponent(selectedName)}`, display_name: selectedName, unit_count: vehicles.length, status: "NOT_CONFIGURED", updated_at: "", vehicles, timeline: [], reports: [] };
    return <ClientDetailShell client={client} vehicles={vehicles} portalConfigured={Boolean(detail?.payload)} canEditClient={capabilities.canEditClient} canManageAccess={capabilities.canManageAccess} canGenerateUrl={capabilities.canGenerateUrl} canPreview={capabilities.canPreview} />;
  }
  const selected = typeof params.client === "string" ? params.client : "";
  if (selected) {
    if (selected.length > 120 || !/^[\w.\-]+$/u.test(selected)) notFound();
    const detail = await fetchSpfClientDetail(cookieHeader, selected);
    if (detail.status === 401) redirect("/login");
    if (detail.status === 403) redirect("/forbidden");
    if (detail.status === 404) notFound();
    if (!detail.payload) return <ModuleUnavailableState module="SPF · Client" title="Detail client tidak tersedia" message="Data client belum bisa dimuat. Coba lagi beberapa saat." />;
    redirect(`/spf/clients?clientName=${encodeURIComponent(detail.payload.client.display_name)}`);
  }

  const query = parseQuery(params);
  const [profiles, units] = await Promise.all([
    fetchAllSpfClientProfiles(cookieHeader),
    fetchUnitClientSource(cookieHeader, { search: query.search }),
  ]);
  if (profiles.status === 401 || units.status === 401) redirect("/login");
  if (units.status === 403) redirect("/forbidden");
  if (!units.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Client"
        title="Data client tidak tersedia"
        message="Data client dari modul Unit belum dapat dimuat."
        backHref="/spf/periods"
        backLabel="Ke Periode SPF"
      />
    );
  }

  const rows = buildClientWorkspaceRows(units.payload.clients, profiles.profiles ?? []);
  return <ClientListShell rows={rows} totalUnits={units.payload.clients.reduce((total, client) => total + client.unitCount, 0)} canPreview={capabilities.canPreview} canCreate={capabilities.canEditClient} />;
}
