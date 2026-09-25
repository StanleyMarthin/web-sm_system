import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import type { AuthUser } from "@smsystem/contracts/auth";
import { encodeGridFilterToken, type GridFilter } from "@smsystem/contracts/grid";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchMonitoringNoStart,
  fetchMonitoringNoSubmit,
  fetchMonitoringToday,
} from "@/shared/api/monitoring/monitoring";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const MonitoringShell = dynamic(
  () =>
    import("@/modules/monitoring/components/monitoring-shell").then(
      (mod) => mod.MonitoringShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat monitoring" />,
  },
);

interface MonitoringPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveMode(searchParams: Record<string, string | string[] | undefined>): "all" | "normal" | "overtime" {
  const value = searchParams.mode;
  if (value === "all") {
    return "all";
  }
  if (value === "overtime") {
    return "overtime";
  }

  return "normal";
}

function filterToken(filter: GridFilter) {
  return encodeGridFilterToken(filter);
}

function roleDefaultFilters(user: AuthUser): GridFilter[] {
  if (user.scope.canViewAllUnits) return [];
  const role = user.roleName.toUpperCase();
  if (role.includes("KP") && user.scope.unitIds[0]) {
    return [{ field: "carId", operator: "eq", value: user.scope.unitIds[0] }];
  }
  const divisionId = user.scope.divisionIds[0] ?? user.divisionId;
  if ((role.includes("KD") || role.includes("QA")) && divisionId !== null && divisionId !== undefined) {
    return [{ field: "divisionId", operator: "eq", value: String(divisionId) }];
  }
  return [];
}

function hasExplicitSmartFilter(searchParams: Record<string, string | string[] | undefined>) {
  return Boolean(searchParams.smartView || searchParams.filter);
}

function applyDefaultScopeRedirect(
  searchParams: Record<string, string | string[] | undefined>,
  user: AuthUser,
) {
  if (hasExplicitSmartFilter(searchParams)) return null;
  const defaults = roleDefaultFilters(user);
  if (defaults.length === 0) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else for (const item of value ?? []) params.append(key, item);
  }
  params.set("smartView", "scope");
  params.delete("filter");
  for (const filter of defaults) params.append("filter", filterToken(filter));
  params.set("page", "1");
  return `/monitoring?${params.toString()}`;
}

export default async function MonitoringPage({
  searchParams,
}: MonitoringPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeMode = resolveMode(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const { user, status: userStatus } = await fetchCurrentUser(cookieHeader);
  if (userStatus === 401) redirect("/login");
  if (userStatus === 403) redirect("/forbidden");
  if (!user) redirect("/login");

  const defaultRedirect = applyDefaultScopeRedirect(resolvedSearchParams, user);
  if (defaultRedirect) redirect(defaultRedirect);

  const [{ payload, status }, noStartResponse, noSubmitResponse] = await Promise.all([
    fetchMonitoringToday(cookieHeader, resolvedSearchParams),
    fetchMonitoringNoStart(cookieHeader, resolvedSearchParams),
    fetchMonitoringNoSubmit(cookieHeader, resolvedSearchParams),
  ]);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Job Monitoring"
        title="Job monitoring belum bisa dimuat"
        message="Data monitoring normal atau lembur belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <MonitoringShell
      activeMode={activeMode}
      title="Job Monitoring"
      description="Pantau hasil kerja harian dan lembur dari actual execution pada tanggal terpilih."
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      noStartRows={noStartResponse.payload?.data ?? []}
      noSubmitRows={noSubmitResponse.payload?.data ?? []}
      user={user}
    />
  );
}
