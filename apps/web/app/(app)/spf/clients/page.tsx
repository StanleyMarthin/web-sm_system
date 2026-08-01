import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfClients } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { ClientListShell } from "@/modules/spf/components/clients/client-list-shell";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseQuery(searchParams: Record<string, string | string[] | undefined>) {
  const rawPage = typeof searchParams.page === "string" ? searchParams.page : "1";
  const rawLimit = typeof searchParams.limit === "string" ? searchParams.limit : "25";
  const page = /^\d+$/.test(rawPage) ? Math.max(1, Number.parseInt(rawPage, 10)) : 1;
  const limit = /^\d+$/.test(rawLimit) ? Math.min(100, Math.max(1, Number.parseInt(rawLimit, 10))) : 25;
  return {
    search: typeof searchParams.search === "string" ? searchParams.search : undefined,
    limit,
    offset: (page - 1) * limit,
  };
}

export default async function SpfClientsPage({ searchParams }: Props) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");

  const result = await fetchSpfClients(cookieHeader, parseQuery(await searchParams));
  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Client"
        title="Data client tidak tersedia"
        message="Endpoint client SPF belum tersedia atau server tidak dapat dijangkau."
        backHref="/spf/periods"
        backLabel="Ke Periode SPF"
      />
    );
  }

  return <ClientListShell rows={result.payload.clients} meta={result.payload.meta} />;
}
