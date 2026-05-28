import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchMonitoringDivision } from "@/shared/api/monitoring";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const MonitoringDivisionShell = dynamic(
  () =>
    import("@/modules/monitoring/components/monitoring-division-shell").then(
      (mod) => mod.MonitoringDivisionShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat monitoring divisi" />,
  },
);

interface MonitoringDivisionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveMode(searchParams: Record<string, string | string[] | undefined>): "all" | "normal" | "overtime" {
  if (searchParams.mode === "all") {
    return "all";
  }

  return searchParams.mode === "overtime" ? "overtime" : "normal";
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

export default async function MonitoringDivisionPage({
  searchParams,
}: MonitoringDivisionPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeMode = resolveMode(resolvedSearchParams);
  const activeSpan = resolveSpan(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchMonitoringDivision(
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
        title="Monitoring per divisi belum bisa dimuat"
        message="Data ringkasan per divisi belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <MonitoringDivisionShell
      date={payload.date ?? resolveDate(resolvedSearchParams)}
      dateTo={payload.dateTo}
      activeMode={activeMode}
      activeSpan={activeSpan}
      rows={payload.data}
    />
  );
}
