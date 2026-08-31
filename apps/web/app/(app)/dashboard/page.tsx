import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { CalendarDayOverride } from "@smsystem/contracts/calendar";
import { DashboardShell } from "@/modules/dashboard/components/dashboard-shell";
import { fetchCalendarDayOverrides } from "@/shared/api/calendar";
import { fetchDashboardSummary } from "@/shared/api/dashboard";
import { fetchIssueGrid } from "@/shared/api/issues";
import { fetchJobPlanGrid } from "@/shared/api/job-plan";
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

function buildIssueSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  filters: {
    divisionId?: string;
    unitId?: string;
  },
) {
  const filterTokens = [
    ...(Array.isArray(searchParams.filter)
      ? searchParams.filter
      : searchParams.filter
        ? [searchParams.filter]
        : []),
  ];

  if (filters.divisionId) filterTokens.push(`divisionId:eq:${filters.divisionId}`);
  if (filters.unitId) filterTokens.push(`carId:eq:${filters.unitId}`);

  return {
    page: "1",
    limit: "100",
    sortBy: "createdAt",
    sortDirection: "desc",
    filter: filterTokens,
  };
}

function buildJobPlanSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  filters: {
    date?: string;
    divisionId?: string;
  },
) {
  const filterTokens = [
    ...(Array.isArray(searchParams.filter)
      ? searchParams.filter
      : searchParams.filter
        ? [searchParams.filter]
        : []),
  ];

  if (filters.divisionId) filterTokens.push(`divisionId:eq:${filters.divisionId}`);

  const date = filters.date && filters.date !== "all" ? filters.date : undefined;

  return {
    page: "1",
    limit: "100",
    sortBy: "taskDate",
    sortDirection: "asc",
    window: "daily",
    ...(date ? { date } : {}),
    filter: filterTokens,
  };
}

type DashboardSummaryData = NonNullable<
  Awaited<ReturnType<typeof fetchDashboardSummary>>["payload"]
>["data"];
type CurrentUserData = Awaited<ReturnType<typeof fetchCurrentUser>>["user"];
type PlanningResult = Awaited<ReturnType<typeof fetchPlanningWorkspaceSummary>>;
type QcGridResult = Awaited<ReturnType<typeof fetchQcQueue>>;
type IssueGridResult = Awaited<ReturnType<typeof fetchIssueGrid>>;
type JobPlanGridResult = Awaited<ReturnType<typeof fetchJobPlanGrid>>;
type DashboardFilters = Parameters<typeof DashboardShell>[0]["filters"];

async function DashboardDeferredShell({
  summary,
  currentUser,
  filters,
  planningPromise,
  qcQueuePromise,
  qcReworkPromise,
  issueGridPromise,
  normalJobPlanPromise,
  overtimeJobPlanPromise,
  holidayOverrides,
}: {
  summary: DashboardSummaryData;
  currentUser: CurrentUserData;
  filters: DashboardFilters;
  planningPromise: Promise<PlanningResult>;
  qcQueuePromise: Promise<QcGridResult>;
  qcReworkPromise: Promise<QcGridResult>;
  issueGridPromise: Promise<IssueGridResult>;
  normalJobPlanPromise: Promise<JobPlanGridResult>;
  overtimeJobPlanPromise: Promise<JobPlanGridResult>;
  holidayOverrides: CalendarDayOverride[];
}) {
  const [
    planningResult,
    qcQueueResult,
    qcReworkResult,
    issueGridResult,
    normalJobPlanResult,
    overtimeJobPlanResult,
  ] = await Promise.all([
    planningPromise,
    qcQueuePromise,
    qcReworkPromise,
    issueGridPromise,
    normalJobPlanPromise,
    overtimeJobPlanPromise,
  ]);

  return (
    <DashboardShell
      summary={summary}
      currentUser={currentUser}
      filters={filters}
      planning={planningResult.payload?.data ?? null}
      qcQueue={qcQueueResult.payload?.data ?? []}
      qcRework={qcReworkResult.payload?.data ?? []}
      issueLogRows={issueGridResult.payload?.data ?? []}
      jobPlanRows={[
        ...(normalJobPlanResult.payload?.data ?? []),
        ...(overtimeJobPlanResult.payload?.data ?? []),
      ]}
      holidayOverrides={holidayOverrides}
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
  const summaryFilters = {
    ...filters,
    date: filters.date === "all" ? undefined : filters.date,
  };

  const qcSearchParams = {
    ...sp,
    page: "1",
    limit: "200",
  };
  const issueSearchParams = buildIssueSearchParams(sp, filters);
  const jobPlanSearchParams = buildJobPlanSearchParams(sp, filters);

  const [
    { payload, status },
    { user },
    { payload: holidayPayload },
  ] = await Promise.all([
    fetchDashboardSummary(cookieHeader, summaryFilters),
    fetchCurrentUser(cookieHeader),
    fetchCalendarDayOverrides(cookieHeader, {
      startDate: `${new Date().getFullYear() - 1}-01-01`,
      endDate: `${new Date().getFullYear() + 1}-12-31`,
    }),
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

  const planningPromise = fetchPlanningWorkspaceSummary(cookieHeader, {
    ...sp,
    ...(summaryFilters.date ? { asOfDate: summaryFilters.date } : {}),
  });
  const qcQueuePromise = fetchQcQueue(cookieHeader, qcSearchParams);
  const qcReworkPromise = fetchQcRework(cookieHeader, qcSearchParams);
  const issueGridPromise = fetchIssueGrid(cookieHeader, issueSearchParams);
  const normalJobPlanPromise = fetchJobPlanGrid(cookieHeader, jobPlanSearchParams, "normal");
  const overtimeJobPlanPromise = fetchJobPlanGrid(cookieHeader, jobPlanSearchParams, "overtime");
  const holidayOverrides = holidayPayload?.data ?? [];

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
          issueLogRows={[]}
          jobPlanRows={[]}
          holidayOverrides={holidayOverrides}
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
        issueGridPromise={issueGridPromise}
        normalJobPlanPromise={normalJobPlanPromise}
        overtimeJobPlanPromise={overtimeJobPlanPromise}
        holidayOverrides={holidayOverrides}
      />
    </Suspense>
  );
}


export default function DashboardPage(props: DashboardPageProps) {
  return <DashboardPageContent {...props} />;
}
