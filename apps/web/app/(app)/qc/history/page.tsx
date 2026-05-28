import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { QaHistoryFilterBar } from "@/modules/qa/components/qa-filter-bars";
import { fetchQaPortal } from "@/shared/api/qa";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const QaWorkspaceShell = dynamic(
  () =>
    import("@/modules/qa/components/qa-workspace-shell").then(
      (mod) => mod.QaWorkspaceShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat riwayat QA" rows={10} />,
  },
);

interface QaHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allParams(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function filterField(token: string) {
  return token.split(":")[0]?.trim() ?? "";
}

function buildApiParams(input: Record<string, string | string[] | undefined>) {
  const divisionId = firstParam(input.divisionId) ?? "";
  const dateFrom = firstParam(input.dateFrom) ?? "";
  const dateTo = firstParam(input.dateTo) ?? "";
  const reservedFilterFields = new Set(["divisionId", "dateFrom", "dateTo"]);
  const filter = allParams(input.filter).filter((token) => !reservedFilterFields.has(filterField(token)));

  if (divisionId) filter.push(`divisionId:eq:${divisionId}`);
  if (dateFrom) filter.push(`dateFrom:eq:${dateFrom}`);
  if (dateTo) filter.push(`dateTo:eq:${dateTo}`);

  return {
    ...input,
    sortBy: firstParam(input.sortBy) ?? "inspectionDate",
    sortDirection: firstParam(input.sortDirection) ?? "desc",
    filter,
  };
}

async function QaHistoryContent({ searchParams }: QaHistoryPageProps) {
  const resolvedSearchParams = await searchParams;

  // Set default filter to only show "TIDAK_LOLOS" if no params are present
  if (Object.keys(resolvedSearchParams).length === 0) {
    redirect("/qc/history?filter=resultStatus%3Aeq%3ATIDAK_LOLOS");
  }

  const divisionId = firstParam(resolvedSearchParams.divisionId) ?? "";
  const dateFrom = firstParam(resolvedSearchParams.dateFrom) ?? "";
  const dateTo = firstParam(resolvedSearchParams.dateTo) ?? "";
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
        title="Riwayat QA belum bisa dimuat"
        message="Data inspeksi QA atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <div className="space-y-5">
      <QaHistoryFilterBar
        title="Riwayat Inspeksi"
        references={payload.references}
        divisionId={divisionId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
      <QaWorkspaceShell
        rows={payload.data}
        meta={payload.meta}
        state={payload.query}
        references={payload.references}
        canEdit={user.permissions.includes(permissionCodes.qcValidate)}
      />
    </div>
  );
}

export default function QaHistoryPage(props: QaHistoryPageProps) {
  return <QaHistoryContent {...props} />;
}
