import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { fetchMonitoringEmployee } from "@/shared/api/monitoring";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const MonitoringEmployeeShell = dynamic(
  () =>
    import("@/modules/monitoring/components/monitoring-employee-shell").then(
      (mod) => mod.MonitoringEmployeeShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat monitoring karyawan" rows={8} />,
  },
);

interface MonitoringEmployeePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function MonitoringEmployeePageContent({ searchParams }: MonitoringEmployeePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const { payload, status } = await fetchMonitoringEmployee(
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
        module="Monitoring Karyawan"
        title="Monitoring karyawan belum bisa dimuat"
        message="Data timesheet karyawan tidak dapat diakses saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <MonitoringEmployeeShell
      date={payload.date}
      dateTo={payload.dateTo}
      activeSpan={payload.span}
      rows={payload.data}
    />
  );
}


export default function MonitoringEmployeePage(props: MonitoringEmployeePageProps) {
  return <MonitoringEmployeePageContent {...props} />;
}
