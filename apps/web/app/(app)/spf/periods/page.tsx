import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfPeriods } from "@/shared/api/spf";
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
): {
  car_id?: string;
  year?: string;
  date_start?: string;
  date_end?: string;
  workflow_status?: "DRAFT" | "WAITING_APPROVAL" | "APPROVED" | "PUBLISHED" | "REJECTED";
  search?: string;
  limit: number;
  offset: number;
  page: number;
} {
  const first = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value.trim() : undefined;
  };
  const rawPage = searchParams["page"];
  const page =
    typeof rawPage === "string" && /^\d+$/.test(rawPage)
      ? Math.max(1, Number.parseInt(rawPage, 10))
      : 1;
  const rawLimit = first("limit");
  const limit = rawLimit && /^\d+$/.test(rawLimit) ? Math.min(100, Math.max(1, Number.parseInt(rawLimit, 10))) : 25;
  const offset = (page - 1) * limit;
  const status = first("workflow_status");
  const workflow_status =
    status === "DRAFT" || status === "WAITING_APPROVAL" || status === "APPROVED" || status === "PUBLISHED" || status === "REJECTED"
      ? status
      : undefined;
  return {
    car_id: first("car_id") || undefined,
    year: first("tahun") || first("year") || undefined,
    date_start: first("date_start") || undefined,
    date_end: first("date_end") || undefined,
    workflow_status,
    search: first("search") || undefined,
    limit,
    offset,
    page,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PeriodsPage({ searchParams }: Props) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  const query = parsePeriodListQuery(await searchParams);
  const result = await fetchSpfPeriods(cookieHeader, query);

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
      role={session.role}
    />
  );
}
