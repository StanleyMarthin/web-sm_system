import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ periodId: string }>;
}

export default async function PeriodDetailPage({ params }: Props) {
  const { periodId } = await params;
  redirect(`/spf/periods?period=${encodeURIComponent(periodId)}`);
}
