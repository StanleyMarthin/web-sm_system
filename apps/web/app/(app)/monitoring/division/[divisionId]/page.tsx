import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MonitoringDivisionDetailShell } from "@/modules/monitoring/components/monitoring-division-detail-shell";
import { fetchMonitoringDivisionDetail } from "@/shared/api/monitoring";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface MonitoringDivisionDetailPageProps {
  params: Promise<{
    divisionId: string;
  }>;
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

export default async function MonitoringDivisionDetailPage({
  params,
  searchParams,
}: MonitoringDivisionDetailPageProps) {
  const [{ divisionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const activeMode = resolveMode(resolvedSearchParams);
  const activeSpan = resolveSpan(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchMonitoringDivisionDetail(
    divisionId,
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
        title="Detail divisi belum bisa dimuat"
        message="Ringkasan unit dan anggota pada divisi ini belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <MonitoringDivisionDetailShell
      divisionId={payload.divisionId}
      divisionName={payload.divisionName}
      date={payload.date ?? resolveDate(resolvedSearchParams)}
      dateTo={payload.dateTo}
      activeMode={activeMode}
      activeSpan={activeSpan}
      summary={payload.summary}
      units={payload.units}
      members={payload.members}
    />
  );
}
