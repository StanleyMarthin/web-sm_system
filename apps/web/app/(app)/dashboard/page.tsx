import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/modules/dashboard/components/dashboard-shell";
import { fetchDashboardSummary } from "@/shared/api/dashboard";
import { fetchPlanningWorkspaceSummary } from "@/shared/api/planning";
import { fetchQcQueue, fetchQcRework } from "@/shared/api/qc";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type DashboardSummaryData = NonNullable<
  Awaited<ReturnType<typeof fetchDashboardSummary>>["payload"]
>["data"];
type CurrentUserData = Awaited<ReturnType<typeof fetchCurrentUser>>["user"];
type PlanningResult = Awaited<ReturnType<typeof fetchPlanningWorkspaceSummary>>;
type QcGridResult = Awaited<ReturnType<typeof fetchQcQueue>>;
type DashboardFilters = Parameters<typeof DashboardShell>[0]["filters"];

async function DashboardDeferredShell({
  summary,
  currentUser,
  filters,
  planningPromise,
  qcQueuePromise,
  qcReworkPromise,
}: {
  summary: DashboardSummaryData;
  currentUser: CurrentUserData;
  filters: DashboardFilters;
  planningPromise: Promise<PlanningResult>;
  qcQueuePromise: Promise<QcGridResult>;
  qcReworkPromise: Promise<QcGridResult>;
}) {
  const [planningResult, qcQueueResult, qcReworkResult] = await Promise.all([
    planningPromise,
    qcQueuePromise,
    qcReworkPromise,
  ]);

  return (
    <DashboardShell
      summary={summary}
      currentUser={currentUser}
      filters={filters}
      planning={planningResult.payload?.data ?? null}
      qcQueue={qcQueueResult.payload?.data ?? []}
      qcRework={qcReworkResult.payload?.data ?? []}
    />
  );
}

async function DashboardPageContent({ searchParams }: DashboardPageProps) {
  const requestHeaders = await headers();
  const cookieHeader   = requestHeaders.get("cookie") ?? "";
  const sp             = await searchParams;

  const filters = {
    date:       getString(sp.date),
    dateFrom:   getString(sp.dateFrom),
    dateTo:     getString(sp.dateTo),
    divisionId: getString(sp.divisionId),
    unitId:     getString(sp.unitId),
  };

  const qcSearchParams = {
    ...sp,
    page: "1",
    limit: "200",
  };

  const [
    { payload, status },
    { user },
  ] = await Promise.all([
    fetchDashboardSummary(cookieHeader, filters),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 403) redirect("/forbidden");
  if (status === 401) redirect("/login");

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Dashboard"
        title="Ringkasan kerja belum bisa dimuat"
        message="Data utama dashboard belum berhasil dibaca. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const planningPromise = fetchPlanningWorkspaceSummary(cookieHeader, sp);
  const qcQueuePromise = fetchQcQueue(cookieHeader, qcSearchParams);
  const qcReworkPromise = fetchQcRework(cookieHeader, qcSearchParams);

  return (
    <Suspense
      fallback={
        <DashboardShell
          summary={payload.data}
          currentUser={user}
          filters={filters}
          planning={null}
          qcQueue={[]}
          qcRework={[]}
          isDeferredLoading
        />
      }
    >
      <DashboardDeferredShell
        summary={payload.data}
        currentUser={user}
        filters={filters}
        planningPromise={planningPromise}
        qcQueuePromise={qcQueuePromise}
        qcReworkPromise={qcReworkPromise}
      />
    </Suspense>
  );
}


export default function DashboardPage(props: DashboardPageProps) {
  return <DashboardPageContent {...props} />;
}
