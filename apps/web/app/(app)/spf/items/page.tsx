/*
IMPORT YANG DIGUNAKAN
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchSpfItems, parseItemListQuery } from "@/shared/api/spf";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";
const ItemListShell = dynamic(() => import("@/modules/spf/components/item-list-shell")
  .then(module => module.ItemListShell), { loading: () => <PageDataSkeleton title="Memuat item SPF" /> });

KENAPA IMPORT INI DIPERLUKAN
- `dynamic` + skeleton: JS tabel/form dimuat saat perlu dengan feedback stabil.
- `headers`: cookie hanya dipakai server-side.
- `redirect`: auth failure tidak disamakan dengan API unavailable.
- `fetchSpfItems`: menyatukan request envelope dan response validation.
- `parseItemListQuery`: URL eksternal tidak pernah langsung menjadi body backend.
- `ItemListShell`: menyatukan filter, dialog create, notice, dan list.

KENAPA KODE INI: URL menjadi state filter/pagination agar refresh, bookmark, back/forward bekerja;
server tetap mengambil data sehingga client tidak membuat waterfall sesudah hydration.

STRUKTUR KODE: sama dengan `dashboard/users/page.tsx` — resolve searchParams,
ambil cookie, panggil fetchSpfItems, redirect 401/403, unavailable state saat payload null,
lalu render dynamic ItemListShell dengan rows/meta/state/role. Jangan fetch ulang saat mount.

QUERY: page, period_id, car_id, sort, order. Parser mengabaikan key asing dan nilai invalid.
LOGIC — item list
- Filters: period_id and car_id; sort uses explicit allowlist; server pagination 25.
- ADMIN can create/edit/delete/upload/delete media when backend permits; others read-only.
- Confirm destructive actions; no optimistic delete.
- Upload must validate allowed MIME and effective Base64 size below backend JSON limit.

PSEUDOCODE
query = itemQuerySchema.safeParse(searchParams) ?? safeDefaults
result = spfApi.item({ mode: 'LIST', ...query })
render existing SmartDataGrid + filters + pagination
mutation success -> router.refresh(); 409 -> refresh + stale-state message

SELESAI JIKA: filter tersimpan di URL, back/forward bekerja, pagination tetap server-side.
*/
