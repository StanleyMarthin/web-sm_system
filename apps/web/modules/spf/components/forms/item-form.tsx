/*
IMPORT: "use client"; useForm; zodResolver; useTransition; useRouter;
item schemas/types; mutateSpf.
KENAPA IMPORT INI DIPERLUKAN: React Hook Form existing mengelola field/error; resolver memakai
schema boundary; transition memberi pending; router refresh; mutateSpf menyembunyikan upstream.
PROPS: mode CREATE|UPDATE, optional readonly item, callbacks.
KODE: CREATE maps numeric car ID after schema parsing; UPDATE compares trimmed form values
against initial item and sends changed fields only. Empty UPDATE is blocked client-side.
KENAPA KODE INI: input HTML berupa string sehingga angka harus diparse; delta update mencegah
overwrite field concurrent; no-op tidak membuang rate limit.
LOGIC: Reuse React Hook Form + shared Zod contract.
CREATE requires positive car_id, description 1..5000, work_type 1..100.
UPDATE sends only changed description/work_type, never actor or role.
Pending state prevents duplicate mutation; show safe field/server errors.
SELESAI JIKA: CREATE/UPDATE tervalidasi, actor tidak terkirim, dirty/no-op benar, focus error benar.
*/
