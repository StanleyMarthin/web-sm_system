import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { reportTypeSchema } from "@smsystem/contracts/reports";
import { ReportsShell } from "@/modules/reports/components/reports-shell";
import { fetchReportGrid } from "@/shared/api/reports";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface ReportsPageProps {
  params: Promise<{
    reportType: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsTypePage({
  params,
  searchParams,
}: ReportsPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const reportType = reportTypeSchema.safeParse(resolvedParams.reportType);

  if (!reportType.success) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
    fetchReportGrid(cookieHeader, reportType.data, resolvedSearchParams),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || userStatus === 401) {
    redirect("/login");
  }

  if (status === 403 || userStatus === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Reports"
        title="Laporan belum bisa dimuat"
        message="Data laporan atau sesi aktif belum terbaca saat ini."
      />
    );
  }

  return (
    <ReportsShell
      activeType={reportType.data}
      canExport={user.permissions.includes(permissionCodes.reportExport)}
      rows={payload.data}
      meta={payload.meta}
      query={payload.query}
      definition={payload.definition}
      summary={payload.summary}
    />
  );
}
