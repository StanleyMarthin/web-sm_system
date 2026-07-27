/*
TUJUAN: orchestration filter, create dialog, notice, dan ItemList.

IMPORT
"use client"; useState; ItemList; ItemForm dari ./forms/item-form;
readonly SpfItem/SpfPagination/ItemListQuery types; SpfRole.

KENAPA IMPORT INI DIPERLUKAN
State mengontrol dialog/notice saja; ItemList memiliki table behavior; ItemForm memiliki
validasi mutation; types dan role mencegah shell menebak response atau permission.

PROPS: rows, meta, state, role, optional period references/car references dari server.
KODE: render heading/filter form; submit filter menulis URL melalui ItemList helper;
ADMIN-only Create membuka dialog ItemForm CREATE; notice role=status; render ItemList.

KENAPA KODE INI: shell menyatukan user journey tanpa mengambil alih fetching. URL dipakai
untuk filter karena bookmark/back/forward bekerja tanpa state library.

PENTING
- Referensi dropdown datang dari response/bootstrap existing, bukan hardcode atau fetch per field.
- Bila endpoint belum menyediakan referensi kendaraan, gunakan input number terlabel dulu.
- Shell tidak menyimpan duplikat rows; router.refresh menjadi sinkronisasi tunggal.

SELESAI JIKA: create, filter, sort, pagination dan empty/error feedback tersambung.
*/
