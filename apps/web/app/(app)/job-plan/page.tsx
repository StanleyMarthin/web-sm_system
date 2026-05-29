import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { JobPlanMode } from "@smsystem/contracts/job-plan";
import {
  buildJobPlanGridQueryString,
  fetchJobPlanGrid,
} from "@/shared/api/job-plan";
import { JobPlanShell } from "@/modules/job-plan/components/job-plan-shell";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface JobPlanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveRequestedMode(
  searchParams: Record<string, string | string[] | undefined>,
): JobPlanMode {
  const value = searchParams.mode;
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "normal" || raw === "overtime" || raw === "all") {
    return raw;
  }

  return "all";
}

async function JobPlanPageContent({ searchParams }: JobPlanPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const requestedMode = resolveRequestedMode(resolvedSearchParams);

  if (requestedMode === "all") {
    const [normalResult, overtimeResult] = await Promise.all([
      fetchJobPlanGrid(cookieHeader, resolvedSearchParams, "normal"),
      fetchJobPlanGrid(cookieHeader, resolvedSearchParams, "overtime"),
    ]);

    const status = normalResult.status === 200 ? overtimeResult.status : normalResult.status;
    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!normalResult.payload || !overtimeResult.payload) {
      return (
        <ModuleUnavailableState
          module="Job Plan"
          title="Job plan belum bisa dimuat"
          message="Data job plan belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    const queryString = buildJobPlanGridQueryString(resolvedSearchParams, "all");
    const exportHref = `/api/job-plan/export${queryString ? `?${queryString}` : ""}`;

    return (
      <JobPlanShell
        title="Job Plan"
        description="Satu halaman job plan untuk melihat semua, memfilter normal atau lembur, lalu mengelola approval dan beban kerja."
        mode="all"
        rows={normalResult.payload.data}
        meta={normalResult.payload.meta}
        state={{
          ...normalResult.payload.query,
          mode: "all",
        }}
        references={normalResult.payload.references}
        summary={{
          totalHours:
            normalResult.payload.summary.totalHours + overtimeResult.payload.summary.totalHours,
          pendingCount:
            normalResult.payload.summary.pendingCount + overtimeResult.payload.summary.pendingCount,
          approvedCount:
            normalResult.payload.summary.approvedCount + overtimeResult.payload.summary.approvedCount,
          overtimeCount:
            normalResult.payload.summary.overtimeCount + overtimeResult.payload.summary.overtimeCount,
        }}
        exportHref={exportHref}
        allSections={{
          normal: {
            rows: normalResult.payload.data,
            meta: normalResult.payload.meta,
          },
          overtime: {
            rows: overtimeResult.payload.data,
            meta: overtimeResult.payload.meta,
          },
        }}
      />
    );
  }

  const { payload, status } = await fetchJobPlanGrid(
    cookieHeader,
    resolvedSearchParams,
    requestedMode,
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
        module="Job Plan"
        title="Job plan belum bisa dimuat"
        message="Data job plan belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const queryString = buildJobPlanGridQueryString(resolvedSearchParams, requestedMode);
  const exportHref = `/api/job-plan/export${queryString ? `?${queryString}` : ""}`;

  return (
    <JobPlanShell
      title="Job Plan"
      description="Satu halaman job plan untuk melihat semua, memfilter normal atau lembur, lalu mengelola approval dan beban kerja."
      mode={payload.query.mode}
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      exportHref={exportHref}
    />
  );
}


export default function JobPlanPage(props: JobPlanPageProps) {
  return <JobPlanPageContent {...props} />;
}
