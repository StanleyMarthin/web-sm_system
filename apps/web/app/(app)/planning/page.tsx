import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarSettingsShell } from "@/modules/settings/components/calendar-settings-shell";
import { WeeklyPlanShell } from "@/modules/planning/components/weekly-plan-shell";
import { fetchPlanningWorkspaceSummary } from "@/shared/api/planning";
import { resolvePlanningWorkspaceState } from "@/shared/planning/workspace";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface PlanningWorkspacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlanningWorkspacePage({
  searchParams,
}: PlanningWorkspacePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const workspace = resolvePlanningWorkspaceState(resolvedSearchParams);

  const { payload, status } = await fetchPlanningWorkspaceSummary(cookieHeader, {
    ...resolvedSearchParams,
    asOfDate: workspace.asOfDate,
    startDate: workspace.startDate,
    endDate: workspace.endDate,
    includeOvertime: workspace.includeOvertime ? "true" : undefined,
    weekStart: workspace.weekStartDate,
  });

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Planning"
        title="Halaman planning belum bisa dimuat"
        message="Data kalender kerja, ETA, atau simulasi target mingguan belum siap saat ini."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="sr-only">
        <h1>Planning &amp; ETA</h1>
        <p>
          Halaman ini dipakai untuk melihat apakah target serah unit minggu ini masih
          aman, divisi mana yang perlu didorong, dan berapa tambahan jam kerja yang
          paling masuk akal.
        </p>
      </div>

      <CalendarSettingsShell
        weeklyConfigs={payload.data.weeklyConfigs}
        workingDays={payload.data.workingDays}
        riskRows={payload.data.deliveryRisk.rows}
        riskMeta={payload.data.deliveryRisk.meta}
        riskState={payload.data.deliveryRisk.query}
        riskSummary={payload.data.deliveryRisk.summary}
        divisionOptions={payload.data.divisionOptions}
        canManage={payload.data.canManage}
        showHero={false}
      />

      <WeeklyPlanShell
        weekStartDate={payload.data.weekStartDate}
        data={payload.data.weeklyPlan}
        canManage={payload.data.canManage}
        title="Arah kerja minggu ini"
        description=""
      />
    </div>
  );
}
