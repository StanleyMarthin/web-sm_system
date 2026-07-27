/*
TUJUAN: layar detail item dan media.

IMPORT
"use client"; useState; Link; ItemForm dari ./forms/item-form; ItemMedia;
readonly SpfItem/SpfMedia/SpfRole; existing StatusBadge/formatters/confirmation.

KENAPA IMPORT INI DIPERLUKAN
State untuk edit/confirm; Link/router untuk breadcrumb dan redirect; ItemForm/ItemMedia
memusatkan aturan form/file; UI shared menjaga format dan confirmation konsisten.

PROPS: Readonly<{ item:SpfItem; media:readonly SpfMedia[]; role:SpfRole; editable:boolean }>
KODE: breadcrumb -> metadata card -> escaped description -> ItemMedia -> ADMIN action bar.
Edit dialog memakai ItemForm UPDATE. Delete item memakai confirmation, mutateSpf DELETE,
kemudian router.replace('/spf/items') setelah sukses; jangan kembali ke detail yang sudah hilang.

KENAPA KODE INI: replace mencegah Back menuju resource terhapus; escaped text mencegah XSS;
capability backend dipakai karena status dapat berubah oleh actor lain.

EDGE: period link hanya bila period_id ada; unknown work type tetap tampil text;
media kosong punya state; error delete 409 refresh detail.

SELESAI JIKA: edit/delete/media tersambung, read-only role tidak melihat mutation controls.
*/
