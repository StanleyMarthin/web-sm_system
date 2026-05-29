import { redirect } from "next/navigation";

interface QaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function QaPageContent({ searchParams }: QaPageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      params.append(key, item);
    }
  }

  return redirect(params.size > 0 ? `/qc/dashboard?${params.toString()}` : "/qc/dashboard");
}


export default function QaPage(props: QaPageProps) {
  return <QaPageContent {...props} />;
}
