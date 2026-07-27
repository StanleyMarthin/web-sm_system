/*
TUJUAN: client orchestration untuk halaman daftar periode. Page server hanya fetch data.

IMPORT YANG DIGUNAKAN
"use client";
import { useState } from "react";
import type { SpfPeriod, SpfPagination } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { PeriodList } from "./period-list";
import { PeriodForm } from "./forms/period-form";

KENAPA IMPORT INI DIPERLUKAN
- `useState`: state dialog/notice lokal; global store tidak diperlukan.
- contract/role types: props mengikuti boundary dan tidak dimutasi.
- `PeriodList`: presentation/pagination tidak bercampur orchestration.
- `PeriodForm`: create logic tidak diduplikasi dalam shell.

PROPS
Readonly<{ rows: readonly SpfPeriod[]; meta: SpfPagination; role: SpfRole }>

STRUKTUR IMPLEMENTASI
export function PeriodListShell(props) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string|null>(null);
  return <section aria-labelledby="spf-period-title"> ...
    heading + description + ADMIN-only create button
    notice with role=status
    <PeriodList ... />
    dialog open={isCreateOpen}; inside <PeriodForm mode="CREATE" ... />
  </section>;
}

KENAPA KODE INI: shell membagi tanggung jawab end-to-end—page fetch, list menampilkan,
form mutation. State lokal cukup karena data authoritative kembali lewat router.refresh().

PENJELASAN
- Shell memiliki state dialog/toast saja; rows tetap readonly dari server.
- Gunakan dialog/alert existing bila tersedia; jangan buat modal framework baru.
- Close mengembalikan focus ke tombol Create. Escape menutup bila tidak pending.

SELESAI JIKA: create sukses refresh list, error menjaga input, role non-ADMIN tak punya trigger.
*/
