import { redirect } from "next/navigation";
import { buildPlanningWorkspaceHref } from "@/shared/planning/workspace";

interface CalendarSettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CalendarSettingsPage({
  searchParams,
}: CalendarSettingsPageProps) {
  const resolvedSearchParams = await searchParams;
  redirect(buildPlanningWorkspaceHref(resolvedSearchParams));
}
