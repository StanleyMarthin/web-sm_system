/*
IMPORT YANG DIGUNAKAN
import { z } from "zod";

KENAPA IMPORT INI DIPERLUKAN
`zod` sudah dipakai proyek dan memberi runtime validation, bukan TypeScript-only safety.
Request berasal dari URL/form dan response berasal dari service eksternal; keduanya tetap
`unknown` saat runtime, jadi harus diparse sebelum dipercaya.

URUTAN KODE
1. Buat helper positiveId, pagination, trimmedString agar pesan Indonesia konsisten.
2. Buat `sourceRequestSchema`, `itemRequestSchema`, `periodRequestSchema` memakai
   z.discriminatedUnion("mode", [...]) PERSIS batas backend.
3. Export `requestSchemas = { source, item, period } as const`.
4. Export `type SpfResource = keyof typeof requestSchemas` dan semua request via z.infer.
5. Definisikan schema response dari data nyata backend: item, media, period, source,
   pagination, success envelope, error envelope. Unknown response field boleh strip,
   field wajib tidak boleh dibuat optional hanya agar parsing lolos.

KENAPA URUTAN INI
Primitive reusable mencegah batas berbeda antar mode; discriminated union membuat `mode`
menentukan field yang legal; `z.infer` menghapus type duplikat; response schema menangkap
contract drift dekat boundary, bukan menjadi undefined jauh di komponen.

CONTOH BENTUK
const listItemRequestSchema = z.object({ mode:z.literal("LIST"), period_id:positiveId.optional(),
  car_id:positiveId.optional(), sort:z.enum(ALLOWED_ITEM_SORTS).optional(),
  order:z.enum(["ASC","DESC","asc","desc"]).optional(), ...pagination.shape });
export type ItemRequest = z.infer<typeof itemRequestSchema>;

CATATAN: verifikasi contoh JSON aktual dari endpoint sebelum mengunci response schema.
IMPLEMENTATION CONTRACT — use already-installed Zod; infer TS types from schemas.

source modes: SMS_DB | COLLECT
item modes: LIST | DETAIL | CREATE | UPDATE | DELETE | UPLOAD_MEDIA | DELETE_MEDIA
period modes: LIST | DETAIL | CREATE | UPDATE | SUBMIT | APPROVE | REJECT |
              PUBLISH | UNPUBLISH | EXPORT

Mirror backend bounds exactly:
- IDs positive integers; limit 1..100; offset >= 0; source_ids 1..200.
- description <= 5000; work_type <= 100; title <= 255; reason <= 2000.
- order ASC/DESC only; sort must also use FE allowlist.
- Validate response envelope at boundary; invalid payload -> INVALID_RESPONSE.

Do not duplicate handwritten request types beside Zod schemas.

SELESAI JIKA: setiap mode punya test valid+invalid dan compile memaksa switch exhaustive.
*/
