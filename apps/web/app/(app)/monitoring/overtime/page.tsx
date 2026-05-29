import { redirect } from "next/navigation";

interface MonitoringOvertimeRedirectPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function toSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      params.append(key, item);
    }
  }

  return params;
}

export default async function MonitoringOvertimeRedirectPage({
  searchParams,
}: MonitoringOvertimeRedirectPageProps) {
  const params = toSearchParams(await searchParams);
  params.set("mode", "overtime");
  redirect(`/monitoring?${params.toString()}`);
}
