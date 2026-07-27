/*
IMPORT: "use client"; Link from next/link; useRouter/useSearchParams from next/navigation;
SmartDataGrid and StatusBadge from shared/datagrid; Period types from spf-contracts.
KENAPA IMPORT INI DIPERLUKAN: client directive untuk event; Link untuk navigation native;
router/searchParams menjadikan URL state; grid/badge mereuse behavior existing; types menjaga columns.
PROPS: readonly rows, total, limit, offset, role.
KODE: derive page; clone URLSearchParams on filter/page; router.push(`?${params}`);
define columns once outside component; cell detail uses Link; empty state is semantic text.
KENAPA KODE INI: clone params menjaga immutability; columns di luar component stabil tiap render;
Link mempertahankan navigation semantics Next.
LOGIC: Presentational table using existing SmartDataGrid and StatusBadge.
Input is readonly rows, total, page, role; this component never fetches data.
Pagination updates URL search params so Server Component remains data owner.
Expose detail links and Create button only for ADMIN.
Accessibility: caption/sr-only heading, labelled pagination, visible focus.
SELESAI: no fetch/useEffect, stable row key, mobile overflow handled.
*/
