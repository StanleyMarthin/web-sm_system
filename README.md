# SMSYSTEM

Monorepo aplikasi operasional workshop: web Next.js, API Bun, kontrak bersama,
dan permission/RBAC. Source mobile Flutter serta mesin Job Plan/Tasks Python
berada di project terpisah.

## Menjalankan di lokal

Siapkan Node.js **20.9+**, npm **9+**, Bun **1.4+**, dan Docker dengan Compose v2.
Jalankan dari root repository, dengan Docker dalam keadaan aktif:

```bash
npm ci
npm run local:setup
npm run local:start
```

Buka **http://127.0.0.1:13000**, lalu login:

- Username / Employee ID: **admin**
- Password awal: **admin**

Nama login `admin` terhubung ke identitas administrator sistem `SM-03.004`,
dengan nama tampilan `admin` dan role `mis`. Password disimpan sebagai hash
bcrypt. Session dan pemeriksaan permission tetap menggunakan alur aplikasi.

`local:setup` membuat MySQL dan Redis dalam container terpisah, menginisialisasi
schema kosong, lalu membuat satu akun awal beserta divisi MIS, role, profile,
dan permission. Tidak ada data pelanggan, unit, pekerjaan, aktual, akun produksi,
backup, maupun tabel tracking migrasi lama yang disalin.

Setup dapat dijalankan ulang: akun, perubahan password, serta data lokal yang
sudah ada dipertahankan. Volume database tidak dihapus otomatis ketika setup gagal.

| Layanan | Alamat lokal |
| --- | --- |
| Web | http://127.0.0.1:13000 |
| API | http://127.0.0.1:3203 |
| Login lokal | http://127.0.0.1:13805 |
| MySQL | 127.0.0.1:13306 |
| Redis | 127.0.0.1:16379 |

Database lokal meliputi `sms_db`, `sms_purchase`, `sms_warehouse`, `sms_log`, dan
`sms_client`. Container memakai volume `smsystem-local_mysql` serta
`smsystem-local_redis`. Port hanya diikat ke loopback. Credential koneksi yang
dihasilkan tersimpan di `.dev/local`, dengan permission file terbatas.

Peluncur lokal memberi konfigurasi eksplisit untuk database, Redis, login, dan
storage, sehingga tidak memakai credential development pribadi yang mungkin
ada pada `.env`. File environment root/aplikasi yang sudah ada tidak ditimpa.
Akun `admin/admin` ini hanya untuk lokal; jangan membuka layanan ini ke publik.

### Menghentikan dan menjalankan kembali

Tekan **Ctrl+C** pada terminal `local:start` untuk menghentikan web/API/login,
lalu hentikan container database:

```bash
npm run local:stop
```

Volume tetap tersimpan. Untuk melanjutkan, jalankan kembali `local:setup` dan
`local:start`. Jika port sudah dipakai aplikasi lain, hentikan proses lokal yang
bersangkutan atau sesuaikan konfigurasi secara sengaja; setup tidak menghentikannya.

### Layanan terpisah

Mesin canonical Job Plan/Tasks Python dan backend SPF tidak dibundel di repo ini.
Operasi modul terkait memerlukan layanan tersebut, dengan endpoint lokal yang
disiapkan pada port **13803**, **13806**, dan **13003**. Bootstrap tidak membuat
simulasi atau logic pekerjaan kedua. Upload memerlukan konfigurasi storage
lokal/development tambahan. Data master operasional dapat diisi dari aplikasi.

Snapshot `tools/local/schema.sql` berisi DDL saja. Perubahan schema berikutnya
harus diperbarui secara eksplisit; setup tidak mereset volume yang sudah diisi.

## Struktur source dan pengujian

| Folder | Tanggung jawab |
| --- | --- |
| `apps/api/src` | Route HTTP, service bisnis, repository dan unit test di dekat implementasi |
| `apps/api/tests` | Pengujian route/kontrak API dengan dependency sintetis |
| `apps/web/modules` | UI dan helper per fitur beserta tesnya |
| `apps/web/shared` | API client, auth, navigasi, komponen bersama dan tesnya |
| `packages/contracts` | Schema payload dan normalisasi status bersama |
| `packages/permissions` | Permission, scope dan kebijakan RBAC bersama |
| `packages/config` | Konfigurasi TypeScript bersama |
| `tools/local` | Bootstrap schema kosong, login lokal dan pengujian kontraknya |

```bash
npm test                 # Seluruh suite web/API/shared dan bootstrap lokal
npm run test:unit        # Tes dekat source API, web dan shared packages
npm run test:api         # Suite route/kontrak API
npm run test:local       # Batas lokal serta kontrak login/refresh
npm run typecheck       # TypeScript API, web dan bootstrap lokal
npm run lint            # ESLint web
bun --no-env-file test --isolate ./path/to/file.spec.ts
```

Tes memakai isolasi per file untuk mencegah mock atau variabel global bocor.
Jangan memuat environment produksi untuk menjalankan tes. Dua tes konektivitas
hanya aktif saat `RUN_CONNECTIVITY_TESTS=1` diberikan secara eksplisit; gunakan
lingkungan disposable untuk probe tersebut. Tes SQL dengan fake pool memeriksa
pembuatan query dan guard, bukan membuktikan eksekusi pada MySQL sesungguhnya.

### Aturan bisnis yang diuji

- **Job Plan:** runtime canonical menjadi penulis operasional; data historis SQL
  tetap bisa dibaca. Draft dipertahankan sampai submit berhasil. Tes planner
  mencakup jadwal, target harian dan identitas retry.
- **Monitoring:** scope pemeriksa dan riwayat sesi mengikuti eksekusi pekerja.
  Input monitoring tidak menghidupkan atau menghentikan timer pekerja.
- **QC:** pemeriksaan KD dibedakan dari keputusan akhir QA. Rework memakai
  Countdown yang sama dan masuk draft Job Plan; hanya kekurangan waktu yang
  ditambahkan. Retry tidak membuat rework ganda; kegagalan penyimpanan rollback.
- **RBAC:** matriks role memerlukan role MIS dan permission `user.manage`.
  Identitas superadmin diuji terpisah. Akses modul serta aksi per baris mengikuti
  permission database dan scope sesi.
- **Unit/panel:** unit HOLD menolak pekerjaan baru. Item child menggunakan
  hubungan parent yang sudah ada. Normalisasi status tidak menciptakan bukti
  penyelesaian, monitoring atau QC.
- **Bootstrap:** koneksi terisolasi, password hash, refresh terikat device,
  rotasi token, dan autentikasi endpoint sinkronisasi sesi lokal.

Untuk tes baru, gunakan nama yang menjelaskan pemicu dan hasil yang diharapkan.
Letakkan fixture dekat suite pemakainya dan gunakan dependency injection untuk
menghindari database, Redis, HTTP maupun push sungguhan pada unit test default.

## Batas repository

README ini adalah dokumentasi yang dikirim ke Git. Markdown lain, prompt,
konfigurasi asisten, credential, dump SQL, workspace migrasi, skrip percobaan,
serta artefak build tetap lokal dan diabaikan Git. Migrasi aplikasi yang sudah
tracked tetap merupakan source. `package-lock.json` dipakai Docker/npm ci;
`bun.lock` tersedia untuk pengembangan Bun.

Unit test yang lulus tidak berarti seluruh layanan eksternal, browser, perangkat
fisik, atau deployment produksi sudah diverifikasi.
