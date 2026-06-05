import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchPlanningEvaluation } from "@/shared/api/planning";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const PlanningEvaluationShell = dynamic(
  () =>
    import("@/modules/planning/components/planning-evaluation-shell").then(
      (mod) => mod.PlanningEvaluationShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat Review Plan" />,
  },
);

interface PlanningEvaluationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveMode(searchParams: Record<string, string | string[] | undefined>): "all" | "normal" | "overtime" {
  if (searchParams.mode === "all") {
    return "all";
  }

  return searchParams.mode === "overtime" ? "overtime" : "normal";
}

function resolveSpan(searchParams: Record<string, string | string[] | undefined>): "daily" | "weekly" {
  return searchParams.span === "weekly" ? "weekly" : "daily";
}

function resolveDate(searchParams: Record<string, string | string[] | undefined>): string {
  const value = searchParams.date;
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

async function PlanningEvaluationPageContent({ searchParams }: PlanningEvaluationPageProps) {
  const resolvedSearchParams = await searchParams;
  if (typeof resolvedSearchParams.date !== "string" || !resolvedSearchParams.date.trim()) {
    redirect(`/planning/evaluation?date=${resolveDate(resolvedSearchParams)}`);
  }
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const activeMode = resolveMode(resolvedSearchParams);
  const activeSpan = resolveSpan(resolvedSearchParams);
  const { payload, status } = await fetchPlanningEvaluation(cookieHeader, resolvedSearchParams);

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
        title="Review Plan belum bisa dimuat"
        message="Perbandingan baseline, revisi, dan aktual belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <PlanningEvaluationShell
      date={payload.data.date ?? resolveDate(resolvedSearchParams)}
      dateTo={payload.data.dateTo}
      activeMode={activeMode}
      activeSpan={activeSpan}
      summary={payload.data.summary}
      rows={payload.data.divisions}
    />
  );
}

export default function PlanningEvaluationPage(props: PlanningEvaluationPageProps) {
  return <PlanningEvaluationPageContent {...props} />;
}
