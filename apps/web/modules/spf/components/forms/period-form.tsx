/*
IMPORT: "use client"; useForm; zodResolver; useTransition; useRouter;
period form schema/type from spf-contracts; mutateSpf; existing sweet alert primitives.
KENAPA IMPORT INI DIPERLUKAN: form+resolver menyatukan input/validation; transition memberi
pending; router refresh snapshot; schema mencegah drift; mutateSpf memakai BFF; alert reuse UI.
PROPS: mode CREATE|UPDATE, optional readonly period, onClose/onSuccess/onError.
KODE: defaultValues from props; handleSubmit -> build exact request -> startTransition ->
await mutateSpf("period", request) -> error callback OR success+close+router.refresh.
KENAPA KODE INI: default props mendukung create/update tanpa form kedua; exact request membuang
UI-only field; dialog hanya tutup setelah success agar input tidak hilang saat error.
Do not send unchanged undefined fields in UPDATE. Native label/input/textarea first.
LOGIC: Reuse React Hook Form + Zod resolver for CREATE/UPDATE period.
Fields: title <=255, optional description <=5000, optional positive item IDs.
Disable submit while pending; keep user input on recoverable error; error summary
links to invalid fields. Success closes dialog and calls router.refresh().
SELESAI JIKA: create/update memakai schema bersama, no-op update ditolak, input bertahan saat error.
*/
