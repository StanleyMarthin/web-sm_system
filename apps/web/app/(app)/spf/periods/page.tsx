/*
IMPORT YANG DIGUNAKAN
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchSpfPeriods } from "@/shared/api/spf";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

KENAPA IMPORT INI DIPERLUKAN
- `dynamic`: menunda JS interaktif tabel/dialog; initial data tetap di server.
- `headers`: meneruskan cookie ke helper server tanpa mengekspos token.
- `redirect`: memisahkan kegagalan auth dari kegagalan layanan.
- `fetchSpfPeriods`: page tidak mengetahui URL/header/format mentah backend.
- `PageDataSkeleton`: feedback loading konsisten dengan halaman lain.
- `ModuleUnavailableState`: 5xx/network error punya fallback aman dan reusable.

STRUKTUR KODE
const PeriodListShell = dynamic(() => import("@/modules/spf/components/period-list-shell")
  .then(module => module.PeriodListShell), { loading: () => <PageDataSkeleton title="Memuat periode SPF" /> });

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default async function PeriodsPage({ searchParams }: Props) {
  const query = parsePeriodListQuery(await searchParams); // invalid -> safe defaults
  const cookie = (await headers()).get("cookie") ?? "";
  const result = await fetchSpfPeriods(cookie, query);
  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (!result.payload) return <ModuleUnavailableState module="SPF" ... />;
  return <PeriodListShell {...result.payload.data} state={query} role={result.role} />;
}

PENJELASAN: data awal tetap server-side seperti halaman users existing; client hanya interaksi.
KENAPA STRUKTUR INI: server fetch mengurangi request waterfall dan mencegah flash data tanpa izin;
shell menerima snapshot typed sehingga interaksi client tidak menduplikasi source of truth.
LOGIC — period list
- Parse page as positive integer; use limit 25 and offset (page - 1) * 25.
- Server-fetch period { mode: 'LIST' }; redirect 401/403, safe retry state otherwise.
- Show title, status, creator, timestamps, and detail link.
- Show Create only to ADMIN. API remains final authorization authority.

PSEUDOCODE
session = requireAdminSession()
query = safePagination(searchParams)
result = spfServerApi.period({ mode: 'LIST', ...query }, session)
return PeriodList(result.rows, result.total, session.role)

SELESAI JIKA: URL adalah sumber pagination, refresh aman, empty/error/loading tersedia.
*/
