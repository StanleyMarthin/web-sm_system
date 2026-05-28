import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchWeeklyPlan } from "@/shared/api/planning";
import { resolvePlanningWorkspaceState } from "@/shared/planning/workspace";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const PlanningSplShell = dynamic(
  () =>
    import("@/modules/planning/components/planning-spl-shell").then(
      (mod) => mod.PlanningSplShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat SPL planning" />,
  },
);

interface PlanningSplPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlanningSplPage({
  searchParams,
}: PlanningSplPageProps) {
  const resolvedSearchParams = await searchParams;
  const asOfDate = typeof resolvedSearchParams.date === "string"
    ? resolvedSearchParams.date
    : undefined;
  const workspace = resolvePlanningWorkspaceState(
    {
      asOfDate,
      weekStart: typeof resolvedSearchParams.weekStart === "string"
        ? resolvedSearchParams.weekStart
        : undefined,
    },
  );
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchWeeklyPlan(cookieHeader, workspace.weekStartDate);

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
        title="SPL belum bisa dimuat"
        message="Baseline lembur minggu ini belum bisa dibaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <PlanningSplShell
      asOfDate={asOfDate ?? workspace.asOfDate}
      weekStartDate={workspace.weekStartDate}
      plan={payload.data.plan}
      rows={payload.data.overtime}
    />
  );
}
