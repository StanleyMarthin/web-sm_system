import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlanningCalendarView } from "@/modules/planning/components/planning-calendar-view";
import { PlanningWorkControlPage } from "@/modules/planning/components/work-control/planning-work-control-page";
import { fetchPlanningWorkspaceSummary } from "@/shared/api/planning";
import { resolvePlanningWorkspaceState } from "@/shared/planning/workspace";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface PlanningWorkspacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type PlanningTab = "work-control" | "calendar";

function resolveTab(searchParams: Record<string, string | string[] | undefined>): PlanningTab {
  const tab = searchParams["tab"];
  const resolved = Array.isArray(tab) ? tab[0] : tab;
  if (resolved === "calendar") {
    return "calendar";
  }
  return "work-control";
}

export default async function PlanningWorkspacePage({
  searchParams,
}: PlanningWorkspacePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const workspace = resolvePlanningWorkspaceState(resolvedSearchParams);
  const activeTab = resolveTab(resolvedSearchParams);

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
        message="Data planning, ETA unit, atau kalender kerja belum siap saat ini."
      />
    );
  }

  const tabs: { id: PlanningTab; label: string }[] = [
    { id: "work-control", label: "Adaptive Planner" },
    { id: "calendar", label: "Kalender Kerja" },
  ];
  const activeWeeklyConfig = payload.data.weeklyConfigs.find(
    (config) => config.weekStartDate === payload.data.weekStartDate,
  );
  const workingDayNumbers = Array.from(
    new Set(
      payload.data.workingDays.days
        .filter((day) => day.isWorkingDay)
        .map((day) => new Date(`${day.date}T00:00:00.000Z`).getUTCDay()),
    ),
  );

  return (
    <div className="space-y-4">
      <div className="sr-only">
        <h1>Planning Work Control</h1>
        <p>
          Tentukan unit prioritas, cek kapasitas kerja divisi, lalu rilis SPK dan SPL dengan
          mudah. Dirancang untuk PM/KP bengkel restorasi.
        </p>
      </div>

      <section className="border border-white/5 bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/30">
            Planning
          </p>
          <h1 className="text-[13px] font-mono text-foreground/80">
            Planning & ETA
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const href = tab.id === "work-control" ? "/planning" : `/planning?tab=${tab.id}`;
            return (
              <a
                key={tab.id}
                href={href}
                className={[
                  "inline-flex h-8 items-center border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "border-primary/30 bg-primary/[0.08] text-app-accent-ink"
                    : "border-white/10 text-foreground/40 hover:bg-white/[0.04] hover:text-foreground hover:border-white/30",
                ].join(" ")}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </section>

      {/* Tab content */}
      {activeTab === "work-control" && (
        <PlanningWorkControlPage
          weekStartDate={payload.data.weekStartDate}
          canManage={payload.data.canManage}
          qcBufferDays={activeWeeklyConfig?.qcBufferDays ?? 0}
          workingDayNumbers={workingDayNumbers}
        />
      )}

      {activeTab === "calendar" && (
        <PlanningCalendarView
          weeklyConfigs={payload.data.weeklyConfigs}
          workingDays={payload.data.workingDays}
          deliveryRiskRows={payload.data.deliveryRisk.rows}
          canManage={payload.data.canManage}
        />
      )}

      {/* End tab content */}

    </div>
  );
}
