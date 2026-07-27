/*
TUJUAN: menyusun summary, item periode, edit, export, dan workflow dalam satu layar.

IMPORT
"use client"; useState; Link; PeriodForm dari ./forms/period-form;
PeriodWorkflowActions; ItemList; SpfPeriod/SpfItem/SpfRole types; existing StatusBadge.

KENAPA IMPORT INI DIPERLUKAN
State hanya untuk dialog; Link untuk breadcrumb App Router; form/workflow/list mereuse unit
tervalidasi; types menjaga snapshot konsisten; StatusBadge menjaga visual status existing.

PROPS
Readonly<{ period: SpfPeriod; items: readonly SpfItem[]; role: SpfRole; editable: boolean }>

URUTAN JSX
1. Breadcrumb `/spf/periods` dan h1 title.
2. StatusBadge, description sebagai text, creator/created/updated/rejection reason.
3. Action bar: edit hanya ADMIN+editable; Export sesuai response capability;
   PeriodWorkflowActions menerima id/status/role.
4. ItemList mode embedded tanpa pagination URL bila detail sudah membawa semua item;
   bila backend paginate, gunakan meta dan namespace query `item_page`.
5. Edit dialog berisi PeriodForm UPDATE.

KENAPA KODE INI: identitas dan status tampil sebelum aksi, lalu items setelah konteks periode.
Satu shell mencegah summary, items, dan workflow mengambil snapshot berbeda.

ERROR/EDGE: empty items punya state; timestamp pakai shared formatter; export gagal tampil safe alert.
Jangan hitung `editable` sendiri jika backend dapat mengirim capability.

SELESAI JIKA: semua informasi periode dan aksi workflow tersedia tanpa child fetch ganda.
*/
