import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfPeriods, getSpfBffOrigin } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

// Dynamic import: JS tabel/dialog dimuat saat perlu; data awal tetap di server.
const PeriodListShell = dynamic(
  () =>
    import("@/modules/spf/components/period-list-shell").then(
      (m) => m.PeriodListShell,
    ),
  { loading: () => <PageDataSkeleton title="Memuat daftar periode SPF" /> },
);

// ─── Query parser ─────────────────────────────────────────────────────────────
// Menolak key asing dan nilai invalid; menggunakan safe defaults.
function parsePeriodListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): { limit: number; offset: number } {
  const rawPage = searchParams["page"];
  const page =
    typeof rawPage === "string" && /^\d+$/.test(rawPage)
      ? Math.max(1, Number.parseInt(rawPage, 10))
      : 1;
  const limit = 25;
  const offset = (page - 1) * limit;
  return { limit, offset };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PeriodsPage({ searchParams }: Props) {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  const query = parsePeriodListQuery(await searchParams);
  const result = await fetchSpfPeriods(cookieHeader, query, getSpfBffOrigin());

  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");

  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF"
        title="Daftar periode tidak tersedia"
        message="Server SPF tidak dapat dijangkau atau terjadi kesalahan. Coba muat ulang halaman."
        backHref="/dashboard"
        backLabel="Ke Dashboard"
      />
    );
  }

  return (
    <PeriodListShell
      rows={result.payload.periods}
      meta={result.payload.meta}
      access={session.access}
    />
  );
}
