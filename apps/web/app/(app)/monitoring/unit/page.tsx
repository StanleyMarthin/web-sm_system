import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchMonitoringUnit } from "@/shared/api/monitoring";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const MonitoringUnitShell = dynamic(
  () =>
    import("@/modules/monitoring/components/Monitoring-unit-shell").then(
      (mod) => mod.MonitoringUnitShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat monitoring unit" />,
  },
);

interface MonitoringUnitPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveSpan(searchParams: Record<string, string | string[] | undefined>): "daily" | "weekly" {
  return searchParams.span === "weekly" ? "weekly" : "daily";
}

function resolveDate(searchParams: Record<string, string | string[] | undefined>): string {
  const value = searchParams.date;
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export default async function MonitoringUnitPage({
  searchParams,
}: MonitoringUnitPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeSpan = resolveSpan(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchMonitoringUnit(
    cookieHeader,
    resolvedSearchParams,
  );

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Job Monitoring"
        title="Monitoring per unit belum bisa dimuat"
        message="Data ringkasan per unit belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <MonitoringUnitShell
      date={payload.date ?? resolveDate(resolvedSearchParams)}
      dateTo={payload.dateTo ?? ""}
      activeSpan={activeSpan}
      rows={payload.data}
    />
  );
}
