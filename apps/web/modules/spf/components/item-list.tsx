/*
IMPORT: "use client"; Link; router/searchParams; SmartDataGrid/StatusBadge;
mutateSpf; readonly Item/Role types; existing confirmation alert.
KENAPA IMPORT INI DIPERLUKAN: navigation/URL state memakai API Next; grid/badge mereuse UI;
mutateSpf satu boundary; readonly types cegah mutation props; confirmation melindungi delete.
PROPS: rows/meta/state/role. KODE: fixed columns, URL filter updater, named delete dialog.
DELETE sends only `{mode:"DELETE",item_id}`. Button disabled pending; success refreshes.
KENAPA KODE INI: payload minimum tidak membawa actor; pending mencegah duplicate; refresh
menjadikan backend source of truth.
LOGIC: Presentational server-paginated list using existing SmartDataGrid.
Filters write period_id/car_id/sort/order to URL; sort comes from fixed allowlist.
ADMIN receives create/edit/delete links; other roles read-only.
Delete requires named confirmation and waits for server success before refresh.
SELESAI JIKA: columns typed, filter/sort/page via URL, delete aman, semua role teruji.
*/
