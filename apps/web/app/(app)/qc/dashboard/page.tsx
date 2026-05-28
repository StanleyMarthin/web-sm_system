import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { QaDashboardFilterBar } from "@/modules/qa/components/qa-filter-bars";
import { fetchQaPortal } from "@/shared/api/qa";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const QaDashboardShell = dynamic(
  () =>
    import("@/modules/qa/components/qa-dashboard-shell").then(
      (mod) => mod.QaDashboardShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat dashboard QA" rows={6} columns={4} />,
  },
);

interface QaDashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthToRange(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/u.test(month) ? month : currentMonth();
  const start = `${safeMonth}-01`;
  const end = new Date(`${safeMonth}-01T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return {
    month: safeMonth,
    dateFrom: start,
    dateTo: end.toISOString().slice(0, 10),
  };
}

function buildApiParams(input: Record<string, string | string[] | undefined>) {
  const divisionId = firstParam(input.divisionId) ?? "";
  const range = monthToRange(firstParam(input.month) ?? currentMonth());
  const filter = [`dateFrom:eq:${range.dateFrom}`, `dateTo:eq:${range.dateTo}`];
  if (divisionId) filter.push(`divisionId:eq:${divisionId}`);

  return {
    page: "1",
    limit: "25",
    sortBy: "inspectionDate",
    sortDirection: "desc",
    filter,
  };
}

async function QaDashboardPageContent({ searchParams }: QaDashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const divisionId = firstParam(resolvedSearchParams.divisionId) ?? "";
  const range = monthToRange(firstParam(resolvedSearchParams.month) ?? currentMonth());
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
    fetchQaPortal(cookieHeader, buildApiParams(resolvedSearchParams)),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || userStatus === 401) redirect("/login");
  if (status === 403 || userStatus === 403) redirect("/forbidden");

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="QA"
        title="Dashboard QA belum bisa dimuat"
        message="Data analitik QA atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <div className="space-y-5">
      <QaDashboardFilterBar
        title="Dashboard Analitik"
        references={payload.references}
        divisionId={divisionId}
        month={range.month}
      />
      <QaDashboardShell dashboard={payload.dashboard} />
    </div>
  );
}


export default function QaDashboardPage(props: QaDashboardPageProps) {
  return <QaDashboardPageContent {...props} />;
}
