import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchMonitoringNoStart,
  fetchMonitoringNoSubmit,
  fetchMonitoringToday,
} from "@/shared/api/monitoring";
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

export default async function MonitoringPage({
  searchParams,
}: MonitoringPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeMode = resolveMode(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const [{ payload, status }, noStartResponse, noSubmitResponse, { user }] =
    await Promise.all([
      fetchMonitoringToday(cookieHeader, resolvedSearchParams),
      fetchMonitoringNoStart(cookieHeader, resolvedSearchParams),
      fetchMonitoringNoSubmit(cookieHeader, resolvedSearchParams),
      fetchCurrentUser(cookieHeader),
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
    />
  );
}
