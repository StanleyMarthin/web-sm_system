import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfItemDetail } from "@/shared/api/spf";
import { fetchCountdownBoard } from "@/shared/api/countdown";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { ItemDetailShell } from "@/modules/spf/components/item-detail-shell";

interface Props {
  params: Promise<{ itemId: string }>;
}

export default async function ItemDetailPage({ params }: Props) {
  const { itemId } = await params;

  // Validasi ID: UUID atau slug string, max 100 karakter
  if (!itemId || itemId.length > 100 || !/^[\w.\-]+$/u.test(itemId)) {
    notFound();
  }

  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");

  const result = await fetchSpfItemDetail(cookieHeader, itemId);

  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (result.status === 404) notFound();

  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Item"
        title="Detail item tidak tersedia"
        message="Server tidak dapat diakses atau terjadi kesalahan saat memuat data."
        backHref="/spf/items"
        backLabel="Kembali ke Daftar Item"
      />
    );
  }

  const { item, media } = result.payload;
  const historyResult = item.panel_name
    ? await fetchCountdownBoard(cookieHeader, {
        unitId: item.car_id,
        filter: `sectionName:eq:${item.panel_name}`,
        limit: "100",
        page: "1",
        sortBy: "updatedAt",
        sortDirection: "desc",
      })
    : { payload: null, status: 200 };

  // Item yang sudah ada di periode workflow tidak bisa diedit lagi.
  // Backend tetap menjadi penjaga akhir setiap mode.
  const editable = session.canAdmin && item.period_id === null;

  return (
    <ItemDetailShell
      item={item}
      media={media}
      history={historyResult.payload?.data ?? []}
      canAdmin={session.canAdmin}
      editable={editable}
    />
  );
}
