/*
IMPORT YANG DIGUNAKAN
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchSpfSources } from "@/shared/api/spf";
const SourceCollectorShell = dynamic(() => import("@/modules/spf/components/source-collector-shell")
  .then(module => module.SourceCollectorShell));

KENAPA IMPORT INI DIPERLUKAN
- `dynamic`: selection/table hanya menjadi client JS pada halaman collector.
- `headers`: meneruskan session aman ke BFF.
- `redirect`: source SMS hanya boleh dibuka ADMIN.
- `fetchSpfSources`: parser query, request mode, dan envelope berada di boundary tunggal.
- `SourceCollectorShell`: heading/warning/result dan table mempunyai satu orchestration owner.

KENAPA KODE INI: role diperiksa sebelum query untuk menghindari data source bocor; backend tetap
memeriksa role lagi karena visibility UI bukan authorization.

STRUKTUR KODE: require role ADMIN sebelum fetch; parse car_id/work_type/page;
fetch mode SMS_DB dengan cookie; mapping status standar; render SourceCollectorShell dynamic.
Role selain ADMIN langsung forbidden, bukan sekadar menyembunyikan tombol.
LOGIC — SMS source collector, ADMIN only
- Fetch { mode: 'SMS_DB' } with car/work-type filters and server pagination.
- Keep immutable selection for current page, maximum 200 IDs.
- Send one { mode: 'COLLECT', source_ids }; disable duplicate submission.
- Display inserted/ignored result, clear selection, refresh source and item data.

PSEUDOCODE
nextSelection = new Set(previousSelection)
assert nextSelection.size <= 200
await spfApi.source({ mode: 'COLLECT', source_ids: [...nextSelection] })

SELESAI JIKA: batas 200 tampil sebelum submit dan hasil partial/ignored dapat dipahami user.
*/
