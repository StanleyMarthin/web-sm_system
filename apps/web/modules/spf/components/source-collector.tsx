/*
IMPORT: "use client"; useMemo/useState/useTransition; useRouter/useSearchParams;
SmartDataGrid; mutateSpf; source types.
KENAPA IMPORT INI DIPERLUKAN: memo menghitung selectable IDs; state menyimpan Set copy;
transition mencegah submit ganda; URL menjaga filter shareable; grid reuse; mutateSpf menuju BFF.
PROPS: readonly rows/meta/state. KODE: `setSelected(prev => { const next=new Set(prev); ...;
return next; })`; header checkbox selects only visible rows up to 200; collect sends array.
KENAPA KODE INI: Set memudahkan membership; copy sesuai immutability React; visible-only mencegah
ID tersembunyi ikut terkirim; 200 menyamai batas backend.
Filter submit updates URL, resets page and selection. Never select unseen pages implicitly.
LOGIC: Render SMS_DB rows, filters, pagination, and immutable current-page selection.
Copy Set on toggle; cap at 200 IDs. COLLECT is ADMIN-only and single-flight.
After success show inserted/ignored counts, clear selection, router.refresh().
Keyboard selection and bulk-action status must be announced accessibly.
SELESAI JIKA: selection immutable <=200, tidak lintas halaman, collect single-flight, hasil jelas.
*/
