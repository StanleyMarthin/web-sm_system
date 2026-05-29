import { redirect } from "next/navigation";

interface JobPlanOvertimePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobPlanOvertimePage({
  searchParams,
}: JobPlanOvertimePageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  params.set("mode", "overtime");
  redirect(`/job-plan?${params.toString()}`);
}
