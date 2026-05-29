import { redirect } from "next/navigation";
import { buildPlanningWorkspaceHref } from "@/shared/planning/workspace";

interface WeeklyPlanningPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function WeeklyPlanningPageContent({ searchParams }: WeeklyPlanningPageProps) {
  const resolvedSearchParams = await searchParams;
  return redirect(buildPlanningWorkspaceHref(resolvedSearchParams));
}


export default function WeeklyPlanningPage(props: WeeklyPlanningPageProps) {
  return <WeeklyPlanningPageContent {...props} />;
}
