/*
IMPORT YANG DIGUNAKAN
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchSpfItemDetail } from "@/shared/api/spf";
import { ItemDetailShell } from "@/modules/spf/components/item-detail-shell";

KENAPA IMPORT INI DIPERLUKAN
- `headers`: session server fetch.
- `notFound`/`redirect`: status HTTP/navigation tepat untuk missing/auth.
- `fetchSpfItemDetail`: validasi envelope dan error mapping tidak diulang.
- `ItemDetailShell`: detail, edit, delete, dan media berbagi snapshot yang sama.

STRUKTUR KODE: validasi Number.isSafeInteger(id) && id > 0, fetch dengan cookie,
mapping 401/403/404 seperti detail periode, lalu render readonly metadata.
Render ItemDetailShell sekali dengan item/media/role/editable dari response.
KENAPA: validasi ID sebelum fetch menolak input buruk lebih cepat; capability backend mencegah
UI menebak apakah item masih boleh diubah setelah masuk periode workflow.
LOGIC — item detail
- Validate positive integer ID; mode DETAIL; translate 404 to notFound().
- Render description as escaped text, never dangerouslySetInnerHTML.
- Media URL comes from backend; never infer public bucket path.
- ADMIN receives edit/delete/upload controls only when item is editable.
- Forms start from latest server values and show field errors plus error summary.

SELESAI JIKA: description escaped, broken media punya fallback, 404 tidak bocorkan detail DB.
*/
