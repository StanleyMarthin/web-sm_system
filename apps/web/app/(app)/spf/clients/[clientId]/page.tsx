import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfClientDetail } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { ClientDetailShell } from "@/modules/spf/components/clients/client-detail-shell";

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function SpfClientDetailPage({ params }: Props) {
  const { clientId } = await params;
  if (!clientId || clientId.length > 120 || !/^[\w.\-]+$/u.test(clientId)) notFound();

  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");

  const result = await fetchSpfClientDetail(cookieHeader, clientId);
  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (result.status === 404) notFound();
  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Client"
        title="Detail client tidak tersedia"
        message="Endpoint detail client SPF belum tersedia atau server tidak dapat dijangkau."
        backHref="/spf/clients"
        backLabel="Ke Client SPF"
      />
    );
  }

  return (
    <ClientDetailShell
      client={result.payload.client}
      vehicles={result.payload.vehicles}
      timeline={result.payload.timeline}
      reports={result.payload.reports}
    />
  );
}
