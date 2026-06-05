import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchPlanningSplRecommendations } from "@/shared/api/work-control";
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

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  const next = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  next.setUTCDate(next.getUTCDate() + amount);
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
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
  const weekEndDate = addDays(workspace.weekStartDate, 6);
  const { payload, status } = await fetchPlanningSplRecommendations(cookieHeader, {
    periodStart: workspace.weekStartDate,
    periodEnd: weekEndDate,
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
        title="SPL belum bisa dimuat"
        message="Rekomendasi SPL dari planning minggu ini belum bisa dibaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <PlanningSplShell
      asOfDate={asOfDate ?? workspace.asOfDate}
      weekStartDate={workspace.weekStartDate}
      rows={payload.data}
    />
  );
}
