import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { JobPlanMode } from "@smsystem/contracts/job-plan";
import { permissionCodes } from "@smsystem/permissions";
import {
  buildJobPlanGridQueryString,
  fetchJobPlanGrid,
} from "@/shared/api/job-plan";
import { fetchCurrentUser } from "@/shared/auth/server";
import { JobPlanShell } from "@/modules/job-plan/components/job-plan-shell";
import { JobPlanV2PlannerShell } from "@/modules/job-plan-v2/components/job-plan-v2-planner-shell";
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

function resolveSingleSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.[0] ?? null;
}

async function JobPlanPageContent({ searchParams }: JobPlanPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const requestedV2 = resolveSingleSearchParam(resolvedSearchParams.v2) === "1";
  const coreId = resolveSingleSearchParam(resolvedSearchParams.coreId);
  const requestedDate = resolveSingleSearchParam(resolvedSearchParams.date);
  const requestedModeParam = resolveSingleSearchParam(resolvedSearchParams.mode);

  if (requestedV2 || coreId) {
    const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
      fetchJobPlanGrid(cookieHeader, resolvedSearchParams, "normal"),
      fetchCurrentUser(cookieHeader),
    ]);

    if (status === 401 || userStatus === 401) redirect("/login");
    if (status === 403 || userStatus === 403) redirect("/forbidden");

    if (!payload || !user) {
      return (
        <ModuleUnavailableState
          module="Job Plan V2"
          title="Job Plan V2 belum bisa dimuat"
          message="Referensi planner belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <JobPlanV2PlannerShell
        userId={user.employeeId}
        canCreate={user.permissions.includes(permissionCodes.updatePlan)}
        initialCoreId={coreId}
        initialDate={requestedDate}
        initialMode={requestedModeParam}
        countdowns={payload.references.countdowns}
        employees={payload.references.employees}
      />
    );
  }

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
