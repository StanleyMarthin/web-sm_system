import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfItems } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const ItemListShell = dynamic(
  () =>
    import("@/modules/spf/components/item-list-shell").then(
      (m) => m.ItemListShell,
    ),
  { loading: () => <PageDataSkeleton title="Memuat daftar item SPF" /> },
);

// ─── Query parser ─────────────────────────────────────────────────────────────
// Menolak key asing dan nilai invalid; menggunakan safe defaults.
const ALLOWED_ITEM_SORTS = ["created_at", "updated_at", "car_id"] as const;
type ItemSort = (typeof ALLOWED_ITEM_SORTS)[number];

function parseItemListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): {
  limit: number;
  offset: number;
  car_id?: string;
  period_id?: string;
  sort?: ItemSort;
  order?: "ASC" | "DESC";
} {
  const rawPage = searchParams["page"];
  const page =
    typeof rawPage === "string" && /^\d+$/.test(rawPage)
      ? Math.max(1, Number.parseInt(rawPage, 10))
      : 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  const rawCarId = searchParams["car_id"];
  const car_id =
    typeof rawCarId === "string" && rawCarId.trim()
      ? rawCarId.trim()
      : undefined;

  const rawPeriodId = searchParams["period_id"];
  const period_id =
    typeof rawPeriodId === "string" && rawPeriodId.trim()
      ? rawPeriodId.trim()
      : undefined;

  const rawSort = searchParams["sort"];
  const sort =
    typeof rawSort === "string" &&
    ALLOWED_ITEM_SORTS.includes(rawSort as ItemSort)
      ? (rawSort as ItemSort)
      : undefined;

  const rawOrder = searchParams["order"];
  const order =
    rawOrder === "ASC" || rawOrder === "DESC" ? rawOrder : undefined;

  return { limit, offset, car_id, period_id, sort, order };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ItemsPage({ searchParams }: Props) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  const query = parseItemListQuery(await searchParams);
  const result = await fetchSpfItems(cookieHeader, query);

  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");

  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF"
        title="Daftar item tidak tersedia"
        message="Server tidak dapat dijangkau atau terjadi kesalahan. Coba muat ulang halaman."
        backHref="/dashboard"
        backLabel="Ke Dashboard"
      />
    );
  }

  return (
    <ItemListShell
      rows={result.payload.items}
      meta={result.payload.meta}
      role={session.role}
    />
  );
}
