import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfSources, getSpfBffOrigin } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

// JS tabel selection hanya dimuat saat perlu.
const SourceCollectorShell = dynamic(
  () =>
    import("@/modules/spf/components/source-collector-shell").then(
      (m) => m.SourceCollectorShell,
    ),
  { loading: () => <PageDataSkeleton title="Memuat source SMS" /> },
);

// ─── Query parser ─────────────────────────────────────────────────────────────
function parseSourceQuery(
  searchParams: Record<string, string | string[] | undefined>,
): { limit: number; offset: number; car_id?: string } {
  const rawPage = searchParams["page"];
  const page =
    typeof rawPage === "string" && /^\d+$/.test(rawPage)
      ? Math.max(1, Number.parseInt(rawPage, 10))
      : 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  const rawCarId = searchParams["car_id"];
  const car_id =
    typeof rawCarId === "string" && rawCarId.trim().length <= 100
      ? rawCarId.trim()
      : undefined;

  return { limit, offset, car_id };
}

// ─── Page (ADMIN only) ────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SourcesPage({ searchParams }: Props) {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  // Sources hanya bisa dilihat ADMIN — bukan sekadar menyembunyikan tombol.
  if (!session.access.canAdmin) redirect("/forbidden");

  const query = parseSourceQuery(await searchParams);
  const result = await fetchSpfSources(cookieHeader, query, getSpfBffOrigin());

  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");

  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Source"
        title="Data source SMS tidak tersedia"
        message="Server tidak dapat dijangkau atau terjadi kesalahan. Coba muat ulang halaman."
        backHref="/spf/items"
        backLabel="Ke Daftar Item"
      />
    );
  }

  return (
    <SourceCollectorShell
      sources={result.payload.sources}
      meta={result.payload.meta}
    />
  );
}
