import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchJobPlanGrid } from "@/shared/api/job-plan/job-plan";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { JobPlanPlannerShell } from "@/modules/job-plan/components/job-plan-planner-shell";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const JobActualShell = dynamic(
  () => import("@/modules/job-plan/components/job-actual-shell").then((mod) => mod.JobActualShell),
  { loading: () => <PageDataSkeleton title="Memuat Job Actual" rows={8} /> },
);

interface JobActualPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveSingleSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.[0] ?? null;
}

async function JobActualPageContent({ searchParams }: JobActualPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const supplemental = resolveSingleSearchParam(resolvedSearchParams.supplemental) === "1";
  const requestedDate = resolveSingleSearchParam(resolvedSearchParams.date);

  const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
    fetchJobPlanGrid(cookieHeader, resolvedSearchParams, "normal"),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || userStatus === 401) redirect("/login");
  if (status === 403 || userStatus === 403) redirect("/forbidden");

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Job Actual"
        title="Job Actual belum bisa dimuat"
        message="Data referensi pekerjaan belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  if (supplemental) {
    return <JobPlanPlannerShell
      userId={user.employeeId}
      canCreate={user.permissions.some((code) => code === permissionCodes.createTask || code === permissionCodes.taskExecute || code === permissionCodes.taskSubmit)}
      canApprove={user.permissions.includes(permissionCodes.reviewTask)}
      supplemental
      ownRequestsOnly={!user.permissions.includes(permissionCodes.createTask)}
      initialCoreId={null}
      initialDate={requestedDate}
      initialMode="planner"
      initialWorkMode="all"
      initialDraftRows={payload.data.filter((row) => row.status === "DRAFT")}
      defaultDivisionName={!user.scope.canViewAllUnits ? user.divisionName : null}
      countdowns={payload.references.countdowns}
      employees={payload.references.employees}
      divisions={payload.references.divisions}
      panels={payload.references.panels}
      jobTypes={payload.references.jobTypes}
    />;
  }

  return (
    <JobActualShell
      userId={user.employeeId}
      canInput={user.permissions.includes(permissionCodes.taskCheckpoint)}
      canRequestJobdesc={user.permissions.some((code) => code === permissionCodes.createTask || code === permissionCodes.taskExecute || code === permissionCodes.taskSubmit)}
      canMonitor={user.permissions.includes(permissionCodes.taskCheckpoint)}
      canValidate={user.permissions.includes(permissionCodes.qcSubmit) || user.permissions.includes(permissionCodes.qcValidate)}
      initialDate={requestedDate}
      countdowns={payload.references.countdowns}
      employees={payload.references.employees}
      actualRows={payload.data}
    />
  );
}

export default function JobActualPage(props: JobActualPageProps) {
  return <JobActualPageContent {...props} />;
}
