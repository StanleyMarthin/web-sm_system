import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchJobPlanGrid } from "@/shared/api/job-plan";
import { fetchCurrentUser } from "@/shared/auth/server";
import { JobPlanPlannerShell } from "@/modules/job-plan/components/job-plan-planner-shell";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface JobPlanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveSingleSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.[0] ?? null;
}

async function JobPlanPageContent({ searchParams }: JobPlanPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const coreId = resolveSingleSearchParam(resolvedSearchParams.coreId);
  const requestedDate = resolveSingleSearchParam(resolvedSearchParams.date);
  const requestedModeParam = resolveSingleSearchParam(resolvedSearchParams.mode);

  const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
    fetchJobPlanGrid(cookieHeader, resolvedSearchParams, "normal"),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || userStatus === 401) redirect("/login");
  if (status === 403 || userStatus === 403) redirect("/forbidden");

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Rencana Pekerjaan"
        title="Rencana pekerjaan belum bisa dimuat"
        message="Data rencana belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <JobPlanPlannerShell
      userId={user.employeeId}
      canCreate={user.permissions.includes(permissionCodes.updatePlan)}
      canApprove={user.permissions.includes(permissionCodes.reviewTask)}
      initialCoreId={coreId}
      initialDate={requestedDate}
      initialMode={requestedModeParam}
      countdowns={payload.references.countdowns}
      employees={payload.references.employees}
      divisions={payload.references.divisions}
      panels={payload.references.panels}
      jobTypes={payload.references.jobTypes}
    />
  );
}


export default function JobPlanPage(props: JobPlanPageProps) {
  return <JobPlanPageContent {...props} />;
}
