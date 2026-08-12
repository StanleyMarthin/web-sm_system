import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function SpfClientDetailPage({ params }: Props) {
  const { clientId } = await params;
  redirect(`/spf/clients?client=${encodeURIComponent(clientId)}`);
}
