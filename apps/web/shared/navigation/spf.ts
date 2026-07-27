/*
IMPORT YANG DIGUNAKAN 
import type { SpfRole } from "@/shared/auth/admin-session";
import type { NavigationItem } from "@/shared/navigation/modules";

KENAPA IMPORT INI DIPERLUKAN
- `SpfRole`: filter menu hanya menerima role workflow valid, bukan arbitrary string.
- `NavigationItem`: hasil cocok langsung dengan AppShell existing; tidak membuat tipe sidebar baru.

STRUKTUR KODE
const items = [...] satisfies readonly NavigationItem[];
export function buildSpfNavigation(role: SpfRole): NavigationItem[] {
  return items.filter(item => item.id !== "spf-sources" || role === "ADMIN").map(item => ({...item}));
}

KENAPA KODE INI
Array constant menjadi katalog tunggal; filter menghasilkan array baru agar tidak memutasi
navigation global antar request. Source disembunyikan untuk non-ADMIN sebagai UX saja.

Lebih baik tambahkan grup SPF ke `shared/navigation/modules.ts` existing daripada membuat
sidebar kedua. File ini hanya menampung definisi/mapping bila modules.ts menjadi terlalu padat.
NAVIGATION
All SPF roles: Periods -> /spf/periods; Items -> /spf/items.
ADMIN only: Collect source -> /spf/sources.

Return a newly filtered array; do not mutate navigation constants.
Navigation visibility is UX only, never authorization.
*/
