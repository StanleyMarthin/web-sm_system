import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfItemDetail, getSpfBffOrigin } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { ItemDetailShell } from "@/modules/spf/components/item-detail-shell";

interface Props {
  params: Promise<{ itemId: string }>;
}

export default async function ItemDetailPage({ params }: Props) {
  const { itemId } = await params;

  // Validasi ID sebelum menyentuh backend — menolak input buruk cepat.
  const id = itemId.trim();
  if (!id || id.length > 100) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");

  const result = await fetchSpfItemDetail(cookieHeader, id, getSpfBffOrigin());

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

  // Item yang sudah ada di periode workflow tidak bisa diedit lagi.
  // Backend tetap menjadi penjaga akhir setiap mode.
  const editable = session.access.canAdmin && item.period_id === null;

  return (
    <ItemDetailShell
      item={item}
      media={media}
      access={session.access}
      editable={editable}
    />
  );
}
