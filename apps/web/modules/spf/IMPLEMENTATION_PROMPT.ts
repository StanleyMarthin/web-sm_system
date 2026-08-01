/*
Saya sudah buatkan guide dari struktur code smsystem untuk FE Admin SPF.
Isinya sudah mencakup gambaran logic, pseudocode, import yang dibutuhkan, alasan
pemakaiannya, alur API, role, dan workflow. Tinggal lanjutkan comment pada setiap
file menjadi kode yang bisa dijalankan.

Mapping folder dan filenya seperti ini:

`apps/web/app/(app)/spf/`
Berisi halaman Admin SPF. Di sini ada halaman source, daftar/detail item, dan
daftar/detail periode. Folder ini fokus menerima parameter URL, mengambil data,
menangani redirect login/forbidden/not-found, lalu meneruskan data ke module SPF.

`apps/web/app/api/spf/[resource]/route.ts`
Berfungsi sebagai penghubung aman antara browser dan backend SPF. API key admin
dipasang di server melalui file ini, jadi tidak boleh dikirim atau disimpan di browser.

`apps/web/modules/spf/components/`
Berisi tampilan dan interaksi utama SPF. File `*-shell.tsx` menyusun satu halaman,
sedangkan file seperti `item-list.tsx`, `item-media.tsx`, `period-list.tsx`,
`period-workflow-actions.tsx`, dan `source-collector.tsx` menangani bagian UI masing-masing.

`apps/web/modules/spf/components/forms/`
Berisi form item dan periode. Validasi input, pending submit, pesan error, serta
request create/update dikerjakan di folder ini.

`apps/web/shared/api/spf-contracts.ts`
Berisi schema dan type request/response SPF. File ini menjadi acuan bentuk data agar
page, component, BFF, dan backend memakai kontrak yang sama.

`apps/web/shared/api/spf.ts`
Berisi fungsi untuk mengambil dan mengubah data SPF. Semua pemanggilan API dari page
atau component diarahkan lewat file ini supaya error handling dan parsing tidak berulang.

`apps/web/shared/api/spf.test.ts`
Berisi panduan test untuk kontrak, query, API client, auth, dan error response.

`apps/web/shared/auth/admin-session.ts`
Berfungsi membaca session smsystem dan menentukan role SPF: ADMIN, APPROVER, atau
PUBLISHER. Role dan employee ID harus berasal dari session server, bukan input browser.

`apps/web/shared/navigation/spf.ts`
Berisi mapping menu SPF sesuai role. ADMIN mendapat menu collect source, sedangkan
menu item dan periode mengikuti akses yang sudah ditentukan.

Alur besarnya:
session smsystem -> halaman SPF -> API helper -> BFF Next.js -> backend SPF -> database.
Untuk perubahan data, response backend dikembalikan ke component lalu halaman di-refresh
agar data terbaru tetap berasal dari server.

Kerjakan dari shared contract dan API terlebih dahulu, lanjut ke form/component, lalu
hubungkan ke page. Gunakan component dan library yang sudah ada di smsystem; tidak perlu
membuat design system, state manager, atau wrapper API baru.
*/
