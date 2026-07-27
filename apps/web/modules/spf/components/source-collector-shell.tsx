/*
TUJUAN: wrapper halaman source agar heading, filter reference, notice, dan collector konsisten.

IMPORT
"use client"; SourceCollector; readonly SpfSource/SpfPagination/SourceQuery types.

KENAPA IMPORT INI DIPERLUKAN
Client boundary dibutuhkan untuk event; SourceCollector mereuse table/selection; readonly types
membuat shell hanya meneruskan snapshot server dan tidak mengubahnya.

PROPS: Readonly<{ rows:readonly SpfSource[]; meta:SpfPagination; state:SourceQuery }>
KODE: section+h1+description tentang snapshot; warning bahwa COLLECT tidak mengubah SMS_DB;
render SourceCollector; aria-live notice untuk hasil inserted/ignored.

KENAPA KODE INI: warning menjelaskan konsekuensi sebelum aksi; aria-live menyampaikan hasil
async kepada screen reader tanpa memindahkan focus.

SECURITY: halaman server sudah ADMIN-only, tetapi mutation denial 403 tetap ditampilkan aman.
DATA: jangan menyimpan selection lintas refresh; source yang sudah collected hilang dari hasil.

SELESAI JIKA: admin paham konsekuensi collect dan hasil partial terlihat jelas.
*/
