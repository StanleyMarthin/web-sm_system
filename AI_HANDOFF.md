# AI_HANDOFF — SMSYSTEM Engineering Handoff

> **Milestone: SMSYSTEM Production Foundation v1.0**
> Status: **READY FOR PRODUCTION OBSERVATION**
> Tanggal: 2026-09-25 · Branch: `main` · Commit terakhir: `95a905a`
> Dokumen ini titik masuk untuk sesi berikutnya. Arsip sesi lama ada di bagian bawah.

## 1. Milestone status

| Area | Status | Bukti |
|---|---|---|
| Struktur contracts | ✅ | `packages/contracts/src/<domain>/` (26 folder), `exports` = single source of truth |
| API hardening | ✅ | fetch/R2/MySQL/Redis timeout, error boundary global + `requestId` |
| Redis resilient | ✅ | fail-fast (bounded reconnect, `disableOfflineQueue`, `socketTimeout`) |
| Database protected | ✅ | `MAX_EXECUTION_TIME=5000`, `queueLimit` berbatas, slow query warning |
| Job Plan reference hierarchy | ✅ Production Ready | `GET /api/job-plan/options/:kind` + cache Redis + lazy loading |
| Observability P0 | ✅ | logger JSON, requestId end-to-end, access log, slow query, process hooks |
| Observability P1/P2 | ⏳ backlog | lihat bagian 4 |

## 2. Completed foundation

| Commit | Isi |
|---|---|
| `1d19f9e` | `apps/api/src/{services,routes,repositories}` dikelompokkan per domain |
| `eb21aa8` | permission gate dashboard dikembalikan (`PROFILE_VIEW`) |
| `20e06cd` | Redis fail-fast saat tidak reachable |
| `412aae2` | timeout dependency eksternal, error boundary, Job Plan transaction/scope fix |
| `f635dfa` | `packages/contracts/src` dikelompokkan; tsconfig wildcard dihapus |
| `81ec66e` | Job Plan reference hierarchy (endpoint + Redis cache + lazy loading) |
| `05ccd4c` | `apps/web/shared/api` dikelompokkan per domain |
| `95a905a` | Observability foundation (P0) |

## 3. Architecture decisions

1. **Resolusi module**: `package.json exports` di `@smsystem/contracts` adalah satu-satunya sumber resolusi. Mapping wildcard `@smsystem/contracts/*` di tsconfig api/web sudah dihapus; jangan dihidupkan kembali.
2. **Layout folder**: satu folder per domain di `services/`, `routes/`, `repositories/`, `contracts/`, dan `apps/web/shared/api`. Import selalu lewat alias (`@/...`), bukan path relatif antar folder.
3. **Dependency eksternal wajib punya timeout**: HTTP keluar lewat `fetchWithTimeout`, S3/R2 lewat `getR2Client` (connect 3s / request 15s), MySQL `connectTimeout` 1s + `MAX_EXECUTION_TIME` 5s, Redis `connectTimeout` 1s + `socketTimeout` 3s.
4. **Redis tidak boleh menggantung**: `disableOfflineQueue` + `reconnectStrategy` berbatas; konsumer non-kritis wajib fallback (contoh: draft/reference Job Plan jalan tanpa Redis).
5. **Request context**: `AsyncLocalStorage` (`observability/context.ts`) membawa `requestId` ke route, service, dan repository tanpa mengubah signature fungsi. Header `x-request-id` diterima dari client dan selalu dikembalikan.
6. **Logging**: semua kode baru memakai `observability/logger.ts` (JSON satu baris), bukan `console.*`. Level diatur `LOG_LEVEL`; default `info`, otomatis `error` saat test. Nilai sensitif (password/token/cookie/authorization/secret/session) diredaksi otomatis; access log hanya mencatat `pathname` tanpa query string.
7. **Query lambat**: instrumen ada di satu titik (`instrumentMySqlPool`), mencakup pool dan koneksi transaksi. Warning muncul jika ≥1000 ms, dengan `queryName` = verb + tabel (tanpa nilai kolom).
8. **Error boundary**: error tak tertangani → log terstruktur + response 500 JSON berisi `requestId` (tidak membocorkan stack ke client).
9. **Repository hygiene**: `.gitignore` memakai `packages/*/dist` (bukan `packages`), menambahkan `*.scratch.ts`, dan mengecualikan `AI_HANDOFF.md`. Test api (`apps/api/tests`) dan `*.test.ts` di web tidak di-track — verifikasi lewat hook pre-push.

## 4. Backlog

**P1**

- Metrics: API latency, error rate, DB query duration, Redis availability, external dependency latency.
- API Sentry: centralized error reporting untuk API (web sudah punya Sentry).
- Ready/live probe separation: `/readyz` (DB+Redis) vs `/livez` (proses).
- nginx latency log: tambahkan `$request_time`, `$upstream_response_time`, `$upstream_status` ke `log_format`.

**P2**

- OTEL tracing untuk API.
- Alerting (uptime `/readyz`, 5xx rate, p95 latency).
- Log aggregation container + rotasi log nginx.
- Dashboard operasional.

**Backlog Job Plan (jangan dikerjakan tanpa evidence)**

1. Cache key options masih per `employeeId` — evaluasi scope-based key.
2. Optimasi query `jobdesc` — tunggu database performance audit + evidence slow query produksi.
3. `optionCache` frontend tanpa TTL — evaluasi saat audit frontend caching (server cache sudah punya TTL).

## 5. Engineering rules

1. Commit kecil dan terpisah per concern; Conventional Commits (`feat|fix|refactor|test|chore|docs`).
2. Jangan memakai `--no-verify`. Hook pre-push menjalankan API test + web build; kalau gagal, perbaiki akarnya.
3. Verifikasi minimal sebelum push: `bun test apps/api`, `npm run build:web`, `npm run lint`, `cd apps/api && npm run typecheck`.
4. Perubahan schema/API lintas app harus lewat `@smsystem/contracts` + subpath di `exports`.
5. Jangan pernah mencatat data sensitif ke log (kredensial, token, cookie, isi body) — pakai logger dan biarkan redaksi bekerja.
6. Stdlib dan pola yang sudah ada lebih dulu; hindari dependency baru untuk hal yang bisa diselesaikan beberapa baris.
7. Setiap bug fix harus menyentuh akar masalah (satu perbaikan di fungsi bersama), bukan tambalan per pemanggil.
8. Kalau ada kerjaan besar yang belum selesai, jangan campur ke commit fitur — pisahkan atau simpan sebagai backlog di dokumen ini.

---

---

# Arsip — sesi sebelumnya (2026-08-03)

# AI_HANDOFF — Recovery Audit SPF (DeepSeek session recovery)

> Status: **AUDIT SELESAI — BELUM ADA IMPLEMENTASI**
> Tanggal: 2026-08-03
> Branch aktif: `recovery/spf-flow-antigravity` (smsystem)
> Server DB mati; validasi runtime tidak dapat dijalankan.

## 1. Tujuan

Memulihkan konteks sesi Codex yang terputus (usage limit, provider DeepSeek) tanpa
mengulang dari nol, lalu melanjutkan perbaikan modul SPF sesuai flow bisnis:

`sms_db (sm_work_ledger + dokumentasi) → periode SPF → snapshot/items+media → kurasi admin → approval/publish → client portal (owner-oriented)`

Prinsip yang dipakai:

- Dua file SQL adalah sumber struktur database (server mati):
  - `/home/sahrulr/Documents/SM-MIS/be_sms/sms_client-sms_client-202607201325.sql`
  - `/home/sahrulr/Documents/SM-MIS/be_sms/struktursms_db-sms_db-202606150830.sql`
- Tidak ada perintah destruktif git; tidak ada commit sampai diminta.
- Tidak ada isi `cookies.txt` yang ditampilkan atau dicommit.

## 2. Hasil audit — struktur aktual (diverifikasi dari SQL)

### Database klien `sms_client` (7 tabel)

| Tabel | Peran | Kolom kunci |
|---|---|---|
| `sm_client_access` | owner/unit/access/URL token | `id, access_code (hash), url_verifying (hash token), token_expires_at, token_used_at, owner_name, owner_slug, car_id, is_active` — UNIQUE(`car_id`), INDEX(`owner_slug`) |
| `sm_periode_progress` | periode SPF | `id, date_start, date_end, summary, workflow_status ENUM('DRAFT','WAITING_APPROVAL','APPROVED','REJECTED','PUBLISHED'), status ENUM('on_progress','pending','done'), progress, approval_notes, rejection_reason, published_by/at, unpublished_by/at, unpublish_reason, is_published` — **TIDAK ada kolom `car_id`** |
| `sm_admin` | item snapshot/curation | `id, car_id, source_type ENUM('SMS_DB','EXCEL','MANUAL'), source_id, jobdesc_actual_id, original_description, customer_description, work_status ENUM('PENDING','ON_PROGRESS','DONE'), progress, notes, display_order, panel_id, periode_id, is_released` — UNIQUE(`source_type`,`source_id`), CHECK MANUAL→source_id NULL |
| `sm_admin_gallery` | media snapshot | `id, admin_id (FK sm_admin), car_id, periode_id, media_url, storage_key, type_media ENUM('photo','video'), caption, display_order` |
| `sm_car_client` | relasi unit-periode | `id, car_id, periode_id, progress_status, progress` |
| `sm_client_timeline`, `sm_client_progress_timeline` | timeline | `workflow_status` enum sama dengan periode |

### Database `sms_db`

- `sm_work_ledger` (sumber pekerjaan lapangan): `id, actual_id, plan_id, countdown_id, car_id, division_id, work_date, progress_percent, progress_notes, task_status ENUM('ON_PROGRESS','DONE'), submitted_at, is_locked`.
- `sm_work_ledger_photos`: `ledger_id, photo_type ENUM('BEFORE','PROCESS','AFTER','DEFECT'), photo_url, caption, taken_at`.
- `sm_work_ledger_issues`, `sm_jobdesc_plan`, `sm_jobdesc_countdown`, `master_job_types` dsb.

### Verifikasi status/enum aktual

- Workflow periode: `DRAFT → WAITING_APPROVAL → APPROVED → PUBLISHED` (+ `REJECTED`). ✅ sesuai requirement.
- `sm_admin.work_status`: `PENDING | ON_PROGRESS | DONE`.
- `sm_admin.source_type`: `SMS_DB | EXCEL | MANUAL` (bukan `SYSTEM`).
- `sm_admin_gallery.type_media`: `photo | video` (bukan `PHOTO/VIDEO` uppercase).
- Kolom timestamp: `create_at/update_at` (bukan `created_at/updated_at`) di tabel lama.

## 3. Arsitektur aktual (3 repo)

```
Admin Web (smsystem apps/web)
  ├─ app/(app)/spf/*            → halaman sources/items/periods/clients/url-generator
  ├─ app/api/spf/[resource]     → BFF (source|item|period|client) → backend /api/spf/*
  ├─ app/api/spf/generate-url   → BFF khusus → backend /api/generate_url
  └─ shared/api/spf-contracts.ts, spf.ts
        │  cookie smsession + CSRF
        ▼
Backend SPF (sm_webclient/backend-sm-spf, Express+Bun, port 3001)
  ├─ /api/spf/{source,item,period,client}   (adminAuth + CSRF + permission)
  ├─ /api/generate_url                       (SPF_PUBLISH)
  ├─ /api/portal_verification, /api/login, /api/portal_logout
  ├─ /api/portal/vehicles                     (portal session cookie)
  ├─ /api/admin/access-codes, /api/admin/upload-media, /api/admin/sync-progress
  └─ clientDb = sms_client, smsDb = sms_db
        │
        ▼
Client Portal (sm_webclient/frontend-sm-spf, Svelte)
  └─ verify token → login access code → portal/vehicles → dashboard (semua unit owner)
```

## 4. Temuan KRITIS — mismatch schema backend vs SQL

Seluruh working tree `backend-sm-spf` (perubahan belum commit, ~25 file) ditulis ulang
terhadap schema **hipotetis** yang TIDAK ada di kedua SQL dump maupun `sm_schema.sql`:

- `sm_portal_accounts` (dipakai portal.repository, url-generator, portal-auth, access-code, spf.repository)
- `sm_portal_account_cars` (dipakai spf.repository, url-generator, portal-vehicle-profile)
- `sm_progress_items` / `sm_progress_periods` / `sm_progress_media`
- Kolom baru: `access_code_hash`, `portal_token_hash`, `spf_status`, `exclusion_reason`, `documentation_checked`, `divisi`, `pic`, `work_date`, `panel_name`, `media_type`, `hidden`, `created_at/updated_at`, `car_id` di periode.

Bukti:

1. `grep CREATE TABLE` kedua SQL dump → hanya 7 tabel lama; dump `sms_client-isi-...20260730` juga 7 tabel lama.
2. `sm_schema.sql` (rev.3, canonical) → hanya tabel lama.
3. Satu-satunya migration yang ada: `src/modules/access-code/migration.sql` (membuat `sm_access_code`).
4. `git log --all -S "sm_progress_items"` di backend-sm-spf → kosong; schema baru tidak pernah dicommit/dimigrasi.
5. `backend-sm-spf/sql/spf.sql` (committed) menandai ini sendiri: *"[CRITICAL CONTRACT] … Data write/read saat ini tidak dijamin bertemu. Pilih tabel canonical atau compatibility view, lalu migrasikan atomik."*
6. Script debug untracked `generate-url.ts` malah menulis ke `sm_client_access` (tabel LAMA) + Redis — indikasi backend baru tidak jalan terhadap DB aktual.

**Dampak:** backend working tree saat ini tidak dapat berjalan terhadap database yang
terverifikasi dari SQL. Ini kemungkinan besar akar dari debugging login/vehicles di sesi
sebelumnya (`patch-auth.sh`, `patch-login.sh`, `patch-vehicles-log.sh`).

VPS (16.79.196.4 dan 108.136.189.225) tidak bisa dijangkau — server mati — sehingga versi
ter-deploy tidak bisa diverifikasi.

## 5. Keputusan schema & API

### API contract (dipertahankan — sesuai requirement)

Arah sesi sebelumnya sudah benar dan **dipertahankan**:

- URL generator owner-oriented: `account_id | owner_slug`, tanpa `period_id`. URL memberi akses seluruh unit owner. ✅ requirement 6, 7.
- URL tidak sekali pakai: token hash tetap valid sampai digenerate ulang (replace). ✅ requirement 12.
- Portal auth 3 lapis: URL token → recognition cookie + CSRF → login access code → portal session cookie. ✅ requirement 13.
- `/api/portal/vehicles` memakai session cookie; owner tidak diambil dari query. ✅ requirement 14.
- Client LIST/DETAIL + SET/RESET access code di `/spf/client`. ✅ requirement 8, 11.
- Item create/update memakai `customer_description`, `work_status`, `progress`, `display_order`, `spf_status`. ✅ requirement 10.
- Workflow action memakai mode `SUBMIT/APPROVE/REJECT/PUBLISH/UNPUBLISH` dengan `reason` untuk REJECT/UNPUBLISH. ✅ requirement 15.

### Keputusan schema (belum dieksekusi — menunggu konfirmasi)

**Rekomendasi: samakan backend dengan schema aktual dari SQL** (bukan menebak):

| Konsep | Schema hipotetis (working tree) | Schema aktual (SQL) |
|---|---|---|
| Owner/access/token | `sm_portal_accounts` + `sm_portal_account_cars` | `sm_client_access` (baris per car, `owner_slug` sebagai identitas owner) |
| Periode | `sm_progress_periods` (ada `car_id`) | `sm_periode_progress` (car di-derive dari item/`sm_car_client`) |
| Item | `sm_progress_items` | `sm_admin` |
| Media | `sm_progress_media` | `sm_admin_gallery` |
| Access code | `sm_access_code` (ada migration) atau `access_code_hash` | `sm_client_access.access_code` (hash) — satu hash sama untuk semua baris owner |
| Token URL | `portal_token_hash` | `sm_client_access.url_verifying` (hash, tidak dikonsumsi) |
| Curation include/exclude | `spf_status` | `sm_admin.is_released` |
| Manual vs sms_db | `source_type SYSTEM/MANUAL` | `source_type SMS_DB/EXCEL/MANUAL` (mapping di API boundary) |

Alternatif yang TIDAK direkomendasikan: mempertahankan schema baru + menulis migration
baru — bertentangan dengan instruksi "jangan menebak nama tabel yang dapat diverifikasi
dari file SQL" dan tidak ada basis bukti bahwa prod sudah dimigrasi.

## 5A. Keputusan Schema FINAL (disetujui user, 2026-08-03)

**Prinsip:** TIDAK ada tabel baru. Hentikan seluruh ketergantungan terhadap:
`sm_portal_accounts`, `sm_portal_account_cars`, `sm_progress_periods`,
`sm_progress_items`, `sm_progress_media`, `sm_access_code`.

Tabel canonical yang dipakai:

| Konsep | Tabel |
|---|---|
| Owner/unit/access/token | `sm_client_access` (baris per unit; `owner_slug` = identitas owner) |
| Relasi unit ↔ periode | `sm_car_client` (**canonical**, bukan header periode) |
| Periode + workflow | `sm_periode_progress` |
| Item SPF (snapshot + manual + kurasi) | `sm_admin` |
| Media SPF (snapshot + manual) | `sm_admin_gallery` |
| Sumber pekerjaan lapangan | `sms_db.sm_work_ledger` + `sm_work_ledger_photos` (read-only) |

### Keputusan kolom (additive saja)

1. **`sm_periode_progress.car_id` → JANGAN ditambahkan.**
   `sm_car_client` adalah relasi canonical unit↔periode. Saat periode dibuat, backend
   WAJIB membuat row `sm_car_client` pada transaksi yang sama, meskipun periode belum
   punya item. Konsekuensi: query periode per unit memakai JOIN `sm_car_client`;
   `sm_admin.car_id` bukan satu-satunya sumber identitas unit periode.

2. **`sm_admin_gallery.hidden` → DISETUJUI.**
   ```sql
   ALTER TABLE sm_admin_gallery
     ADD COLUMN hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER display_order,
     ADD KEY idx_sm_admin_gallery_hidden (admin_id, hidden);
   ```
   Aturan: `hidden=0` media boleh tampil; `hidden=1` media tidak tampil ke client;
   admin tetap melihat semua media; portal hanya membaca `hidden=0`.

3. **`sm_admin_gallery.source_type` → DISETUJUI.**
   ```sql
   ALTER TABLE sm_admin_gallery
     ADD COLUMN source_type ENUM('SMS_DB','MANUAL')
     NOT NULL DEFAULT 'MANUAL'
     AFTER admin_id;
   ```
   Aturan: media salinan `sm_work_ledger_photos` = `SMS_DB`; media upload SPF = `MANUAL`;
   media manual boleh di item SMS_DB maupun MANUAL; jangan menentukan source media
   hanya dari `sm_admin.source_type`.

### Flow canonical

```
sms_db.sm_work_ledger
  → snapshot item ke sms_client.sm_admin
  → snapshot dokumentasi ke sms_client.sm_admin_gallery
  → kurasi item dan media
  → approval/publish
  → portal client
```

Relasi:

```
sm_client_access.owner_slug → seluruh row aktif owner_slug sama → seluruh car_id owner
sm_car_client.car_id → sm_car_client.periode_id → sm_periode_progress.id
sm_admin.periode_id → sm_periode_progress.id
sm_admin_gallery.admin_id → sm_admin.id
```

### Migration

- ALTER TABLE di atas **belum dijalankan** dan tidak akan dijalankan sampai diminta.
- Lokasi file migration direkomendasikan: lihat §14.

## 6. Kategorisasi perubahan sebelumnya

### Benar dan dipertahankan (smsystem web, sudah commit + diff kecil)

- URL generator tanpa periode; akses owner-based.
- Payload item/period diketik (`ItemRequest`, `PeriodRequest`) tanpa `as any`.
- `z.coerce` → `valueAsNumber` di item form; schema zod konsisten.
- `spf-contracts.ts`: SET_ACCESS_CODE min 4; generateUrl tanpa period.
- Frontend portal: session cookie HttpOnly, tidak simpan access code di browser, striping token dari URL.
- Backend: cookie AES-256-GCM + `periodId`-like context (di sini `linkId`), CSRF `timingSafeEqual`, access code argon2id upgrade-on-login, rate limit.

### Benar tetapi belum lengkap

- `POST /api/portal/data` (PERIOD_LIST/PERIOD_DETAIL) belum ada — portal saat ini membaca via `/portal/vehicles` satu query; requirement "seluruh riwayat SPF unit" sudah terpenuhi via timeline/gallery gabungan, tapi endpoint data per-periode belum eksis.
- Release items saat publish (`releasePeriodItems` return 0) — portal read tidak memfilter `is_released` pada schema baru; di schema aktual wajib filter `is_released=1` + `workflow_status='PUBLISHED'`.
- Period `car_id` invariant (schema aktual tidak punya kolom; harus diverifikasi via item/car_client).

### Bertentangan dengan flow bisnis / sumber struktur

- Seluruh repository layer yang memakai `sm_portal_accounts`/`sm_progress_*` (lihat §4).
- `sm_admin_gallery.type_media` ditulis sebagai `'PHOTO'/'VIDEO'` — enum aktual lowercase `photo/video`.
- `source_type 'SYSTEM'` tidak ada di DB — aktual `SMS_DB`.
- `createPeriod` memakai `buildPeriodId` + menghitung sequence per bulan per car — format ID `CAR-YYYY-MM-NNN` cocok dengan data seed (`PORSCHE930_ADRIAN-2026-06-004`), tapi harus memakai kolom aktual (`create_at` dsb).

### Debugging sementara (jangan dicommit; harus dihapus/dibersihkan)

- `patch-auth.sh`, `patch-login.sh`, `patch-vehicles-log.sh` — patch debug logging di VPS.
- `generate-url.ts` — script one-off **berisi kredensial DB/Redis hardcoded** (tidak ditampilkan di sini).
- `app.ts` backend: middleware `[DEBUG /api/login]` mencetak cookie + CSRF header — **security issue** (audit report sebelumnya sudah menandai ini CRITICAL; masih ada di working tree).
- `cookies.txt` — berisi material session; jangan pernah dicommit.

### Potensi security issue

1. Debug log cookie/CSRF di `backend-sm-spf/src/app.ts` (`/api/login`).
2. `generate-url.ts` berisi kredensial plaintext (file untracked).
3. `cookies.txt` (untracked, jangan commit).
4. `portal-session.ts` middleware mengecek Redis session hash `session:<hash>`; fallback aman, tapi Redis key tidak pernah dihapus saat logout (minor).
5. BFF `/api/spf/[resource]` mengembalikan status upstream apa adanya tanpa logging — bukan vuln, catatan saja.

## 7. File yang berubah (saat audit)

### smsystem (branch `recovery/spf-flow-antigravity`)

Tracked modified:

- `apps/web/app/(app)/spf/url-generator/page.tsx`
- `apps/web/modules/spf/components/clients/client-detail-shell.tsx`
- `apps/web/modules/spf/components/forms/item-form.tsx`
- `apps/web/modules/spf/components/item-list.tsx`
- `apps/web/modules/spf/components/period-workflow-actions.tsx`
- `apps/web/modules/spf/components/url-generator-shell.tsx`
- `apps/web/modules/spf/components/vehicle-combobox.tsx`
- `apps/web/shared/api/spf-contracts.ts`
- `apps/web/shared/api/spf.ts`

Untracked (jangan commit): `cookies.txt`, `generate-url.ts`, `patch-auth.sh`, `patch-login.sh`, `patch-vehicles-log.sh`

### backend-sm-spf (branch `main`, uncommitted)

`src/middleware/admin-auth.ts`, `portal-session.ts`, `access-code/*`, `admin-sync/*`,
`portal-auth/*`, `portal-vehicles/*`, `portal/*` (portal-link.store.ts dihapus),
`spf/*` (repository/route/service), `url-generator/*`, tests terkait; untracked:
`tests/spf-period-id.test.ts`, `tests/url-generator-repository.test.ts`.

### frontend-sm-spf (branch `main`, uncommitted)

`src/App.svelte`, `src/lib/Dashboard.svelte`, `src/lib/adapter.ts`, `src/lib/api.ts`, `src/lib/types.ts`.

## 8. Completed / In progress / Remaining

- [x] Audit git (status, diff, log, untracked) ketiga repo
- [x] Baca seluruh file tracked yang berubah + file untracked (tanpa mencetak secret)
- [x] Petakan backend/frontend/BFF/kontrak SPF
- [x] Bandingkan source code dengan kedua SQL dump + `sm_schema.sql`
- [x] Kategorisasi perubahan sebelumnya
- [x] **Konfirmasi keputusan schema** — A: realign ke schema existing; tanpa tabel baru (lihat §5A)
- [x] M1: migration additive dibuat & ditempatkan di `backend-sm-spf/sql/migrations/` — **BELUM dijalankan**
- [x] M2: realignment repository backend selesai (schema canonical, tanpa tabel fiktif)
- [x] M3: kontrak API web ↔ backend disinkronkan
- [x] M4: admin web diselesaikan (URL generator, form item, kurasi, media, wizard periode)
- [x] M5: client portal diverifikasi selaras (owner-based session; tidak ada perubahan tambahan)
- [x] M6: debug log & file sensitif dibersihkan; `.gitignore` diperbarui
- [x] M7: validasi offline selesai (backend test+build, web lint+build, portal check+build)
- [x] M8: scan referensi fiktif & log sensitif bersih; review diff selesai

## 15. Hasil Implementasi M1–M8 (final, 2026-08-03)

### M1 — Migration

- File: `backend-sm-spf/sql/migrations/20260803_add_spf_gallery_curation_columns.sql`
- Isi: `sm_admin_gallery.source_type ENUM('SMS_DB','MANUAL')`, `hidden TINYINT(1) DEFAULT 0`,
  index `idx_sm_admin_gallery_hidden (admin_id, hidden)`; guard `information_schema` +
  `PREPARE/EXECUTE` (MySQL 8.0 tidak mendukung `ADD COLUMN IF NOT EXISTS`); idempotent;
  tanpa backfill (historical tetap default MANUAL — keputusan klasifikasi terpisah).
- **BELUM dijalankan.** Hash source=dest terverifikasi; file sementara di root sm_webclient dihapus.
- `.gitignore` backend diubah: `sql` → `sql/*` + `!sql/migrations/` agar migration terlacak Git.

### M2 — Backend realignment (selesai)

- Semua query `sm_portal_accounts` / `sm_portal_account_cars` / `sm_progress_*` / `sm_access_code`
  dihapus dari source backend (scan M8: 0 referensi executable).
- `sm_client_access`: owner/unit/access-code/url-token; `sm_car_client`: relasi unit↔periode
  (wajib dibuat saat create periode); `sm_periode_progress` + `sm_admin` + `sm_admin_gallery`.
- Access code per owner: hash sama untuk seluruh baris aktif owner; verifikasi DISTINCT LIMIT 2
  (inkonsistensi → ditolak); CAS update.
- URL token owner-based, reusable, regenerate mengganti hash di seluruh baris.
- Collect: snapshot ledger → `sm_admin` (SMS_DB) + `sm_work_ledger_photos` → `sm_admin_gallery`
  (SMS_DB, hidden 0), unattached; period create menerima `source_ids` + `item_ids` dalam satu tx.
- Kurasi: `is_released` (INCLUDE/EXCLUDE), `display_order`, `customer_description`; media `hidden`.
- Publish: PUBLISHED + is_published=1, tanpa mengubah kurasi; Unpublish: DRAFT + is_published=0 +
  reset metadata + `unpublish_reason` wajib.
- Portal read: hanya PUBLISHED + is_published=1 + is_released=1 + hidden=0, owner dari session cookie.
- Enum boundary: API `SYSTEM` ↔ DB `SMS_DB`; media lowercase.
- Modul `access-code` (sm_access_code) dihapus total.
- Upload media: satu transport (JSON base64 via `/spf/item` UPLOAD_MEDIA).

### M3 — Kontrak API (selesai)

- Backend zod ↔ web `spf-contracts.ts`: COLLECT tanpa period_id; period CREATE/UPDATE pakai
  `source_ids` (bukan `source_keys`); item CREATE/UPDATE tanpa `panel_name/divisi/pic/work_date/
  exclusion_reason/documentation_checked`; UPLOAD_MEDIA JSON base64; DELETE_MEDIA/HIDE_MEDIA
  tanpa item_id; mode `REORDER`, period `DELETE`, client `UPDATE/ATTACH/DETACH/GENERATE_URL`
  dihapus (tidak dipakai UI); BFF limit upload 35 MB.

### M4 — Admin web (selesai)

- URL generator owner-oriented (account_id/owner_slug), set/reset access code, copy URL.
- Wizard periode: source_ids + item_ids, tanpa source_keys/save_as/year yang tidak didukung.
- Item form: field tanpa kolom dihapus; UPDATE tidak mengirim period_id/panel.
- Kurasi item: include/exclude via spf_status → is_released; media upload base64; hide/show media.

### M5 — Client portal (selesai, tanpa perubahan tambahan)

- Working tree sudah owner-based (session cookie, `/portal/vehicles`, semua unit owner);
  `svelte-check` 0 error; `vite build` sukses.

### M6 — Security cleanup (selesai)

- `app.ts`: debug middleware log cookie/CSRF dihapus.
- File sensitif untracked dihapus: `cookies.txt`, `generate-url.ts`, `patch-auth.sh`,
  `patch-login.sh`, `patch-vehicles-log.sh` (backup ada di `/home/sahrulr/Documents/SM-MIS/spf-recovery-backup`).
- smsystem `.gitignore` + pola sensitif (minimal `cookies.txt`).
- Scan `console.*/cookie/csrf/authorization` backend: hanya validasi/forward legit, tanpa log secret.

### M7 — Validasi offline (selesai)

- Backend: `bun test` 48 pass / 0 fail; `bun build src/index.ts` sukses (597 modules).
  TypeScript CLI tidak tersedia (typescript bukan devDependency, offline) — `next build` type-check
  admin web dan `svelte-check` portal menutupi validasi tipe.
- Admin web: `npm run lint:web` pass; `npm run build:web` pass (type-check + Next build;
  butuh jaringan untuk Google Fonts — gagal hanya saat sandbox offline, bukan error kode).
- Portal: `npm run check` pass (0 error), `npm run build` pass.
- Error SPF yang ditemukan & diperbaiki: type `mutateSpf` reset access code; tipe mime upload;
  shape mock DB di test.

### M8 — Final review (selesai)

- `rg` tabel fiktif di 3 repo: 0 referensi executable (hanya komentar penjelas di admin-sync).
- `rg` log sensitif backend: bersih.
- Tidak ada file untracked sensitif tersisa di smsystem; migration terlihat di git backend (`?? sql/`).
- **Belum commit / push.**

### Remaining blockers (di luar offline)

- Menjalankan migration `20260803_add_spf_gallery_curation_columns.sql` saat DB aktif.
- Smoke test end-to-end dengan DB (login portal, collect, publish, portal read).
- Klasifikasi historical `sm_admin_gallery.source_type` berdasarkan data aktual.
- Commit/push setelah review user.

## 9. Known issues (daftar temuan integrasi web ↔ backend)

1. **Schema mismatch** (lihat §4) — blocker utama.
2. Period CREATE/UPDATE: web kirim `source_keys[{source_type,source_id}]`, backend terima `source_ids[]`.
3. Item `REORDER` ada di kontrak web, tidak ada di backend.
4. Period `DELETE` ada di kontrak web, tidak ada di backend.
5. `UPLOAD_MEDIA`: web `uploadSpfItemMedia` POST multipart ke `/api/spf/media/upload` (tidak ada route); backend terima JSON base64 `file_data` di `/spf/item` mode `UPLOAD_MEDIA`; route `/admin/upload-media` hanya base64.
6. `HIDE_MEDIA` tidak punya kolom `hidden` di schema aktual.
7. `spf_status`/`exclusion_reason`/`documentation_checked`/`divisi`/`pic`/`work_date`/`panel_name` tidak punya kolom di schema aktual — perlu mapping ke kolom yang ada atau drop.
8. Client `UPDATE/ATTACH_VEHICLE/DETACH_VEHICLE/GENERATE_URL` ada di kontrak web, tidak di backend (backend hanya LIST/DETAIL/SET/RESET_ACCESS_CODE).
9. `releasePeriodItems` no-op → portal read di schema aktual WAJIB filter `is_released=1` (atau publish set `is_released=1` untuk item INCLUDED).
10. `findActiveCredential` mengharuskan tepat 1 baris per owner — di schema aktual ada 1 baris per car; harus dedupe per `owner_slug` (DISTINCT) atau samakan hash semua baris.

## 10. Command yang dijalankan (semua read-only)

```bash
git status --short && git diff --stat && git log --oneline -10 && git ls-files --others --exclude-standard
git branch -a
git -C ~/Documents/sm_webclient/backend-sm-spf status --short && git branch --show-current && git log --oneline -8
git -C ~/Documents/sm_webclient/frontend-sm-spf status --short && git branch --show-current
grep -nE "CREATE TABLE" kedua SQL dump
sed -n '25,330p' sms_client dump (definisi tabel + seed)
sed -n '1170,1300p' struktursms_db dump (ledger + photos)
cat backend-sm-spf/src/**/*.ts (seluruh modul)
cat frontend-sm-spf/src/lib/*.ts dan *.svelte
cat apps/web/shared/api/spf-contracts.ts, spf.ts, BFF routes, komponen SPF
ssh (read-only, timeout) ke 16.79.196.4 dan 108.136.189.225 — keduanya tidak terjangkau
```

## 11. Hasil validasi

- Server DB **mati** → tidak ada validasi runtime/SQL yang dijalankan.
- Typecheck/lint/build **belum** dijalankan (akan dijalankan setelah implementasi; script: backend `bun test` + `bunx tsc --noEmit`; smsystem `npm run lint:web`, `npm run build:web`).

## 12. Next exact action

1. Keputusan schema FINAL sudah ditetapkan (lihat §5A) — tidak ada tabel baru.
2. Next: mulai M1 (siapkan file migration additive, tanpa menjalankan) → M2 (realign backend).
3. Urutan milestone lengkap di §13; lokasi migration di §14.

## 13. Rencana Implementasi Bertahap (milestone)

Urutan kerja, dipisahkan per area. Setiap milestone diakhiri update AI_HANDOFF.md.

### M1 — Perubahan database additive

- **Status: SELESAI (2026-08-03).** File migration dibuat:
  `/home/sahrulr/Documents/sm_webclient/20260803_add_spf_gallery_curation_columns.sql`
  (guard `information_schema` + `PREPARE/EXECUTE`; idempotent; MySQL 8.0.4x tidak
  mendukung `ADD COLUMN IF NOT EXISTS`).
- **Migration BELUM dijalankan**; hanya disimpan + didokumentasikan.
- Keputusan klasifikasi **historical `source_type` BELUM dilakukan** — baris lama
  sementara memakai default `MANUAL`; klasifikasi SMS_DB/MANUAL per data aktual
  diputuskan terpisah.
- Opsional (perlu konfirmasi): sinkronkan `sm_schema.sql` untuk fresh install
  (tambah kolom di CREATE TABLE `sm_admin_gallery`; tanpa tabel baru).
- Verifikasi: review DDL terhadap dump SQL (kolom/tipe/index konsisten).

> **M2 BELUM dimulai.** Tidak ada perubahan source code backend/admin web/portal
> yang dilakukan pada milestone ini.

### M2 — Realignment repository backend (backend-sm-spf)

- Ganti semua query `sm_portal_accounts`/`sm_portal_account_cars` →
  `sm_client_access` (owner = `owner_slug`, unit = `car_id`, hash di `access_code`
  dan `url_verifying`).
- Ganti `sm_progress_periods` → `sm_periode_progress`; `sm_progress_items` →
  `sm_admin`; `sm_progress_media` → `sm_admin_gallery`.
- Hentikan pemakaian `sm_access_code` → `sm_client_access.access_code`.
- Access code per owner: SET/RESET menulis hash yang sama ke semua baris aktif owner
  dalam satu transaksi; login verifikasi DISTINCT per owner.
- URL token reusable: `url_verifying` di-update semua baris owner saat generate;
  tanpa konsumsi token; verifikasi dengan `owner_slug` + hash.
- Create periode: transaksi = insert `sm_periode_progress` + insert `sm_car_client`
  (WAJIB, walau periode kosong) + attach `sm_admin.periode_id` + media link.
- Curation: `spf_status INCLUDED/EXCLUDED` → `sm_admin.is_released`;
  `display_order`; `customer_description`; media `hidden`.
- Publish: set `workflow_status=PUBLISHED`, `is_published=1`, `published_by/at`,
  `is_released=1` item; Unpublish: DRAFT + reset metadata + `unpublish_reason`.
- Portal read: JOIN `sm_car_client`/`sm_admin`/`sm_periode_progress`/`sm_admin_gallery`,
  filter `workflow_status='PUBLISHED'` (+`is_published=1`), `is_released=1`,
  `hidden=0`, owner dari session cookie.
- Enum mapping: `SYSTEM`→`SMS_DB`; `PHOTO/VIDEO`→`photo/video`;
  timestamp `create_at/update_at`.
- Drop kolom imajiner: `divisi`, `pic`, `work_date`, `panel_name`,
  `exclusion_reason`, `documentation_checked` (kecuali `panel_name` via JOIN
  `master_panels`/`countdown.section_name`).
- Media upload: satu jalur transport (JSON base64 di `/spf/item` UPLOAD_MEDIA,
  atau multipart — dipilih satu; `hidden` diisi 0, `source_type='MANUAL'`).
- Hapus `sm_access_code` migration file bila tidak dipakai lagi (di M6).

### M3 — Sinkronisasi kontrak API (web ↔ backend)

- `spf-contracts.ts` (smsystem) ↔ zod backend `spf.route.ts`:
  - Period CREATE/UPDATE: `source_keys` → `source_ids` (atau backend terima keduanya).
  - Hapus mode yang tidak ada di backend: item `REORDER`, period `DELETE`,
    client `UPDATE/ATTACH_VEHICLE/DETACH_VEHICLE/GENERATE_URL` (atau implement di backend).
  - `UPLOAD_MEDIA`: samakan field/transport.
  - `HIDE_MEDIA` → kolom `hidden`.
  - Hapus `exclusion_reason`/`documentation_checked`/`divisi`/`pic`/`work_date` dari
    request/response schema bila diputuskan tidak dipakai.
- Pastikan `generate-url` BFF route tetap (sudah ada: `app/api/spf/generate-url/route.ts`
  → backend `/api/generate_url`).

### M4 — Perubahan admin web (smsystem apps/web)

- `url-generator-shell.tsx`: sudah owner-based; sesuaikan jika response berubah
  (hilangkan `expiry` bila tidak ada).
- `item-form.tsx`/`item-list.tsx`: hapus field yang tidak punya kolom
  (`divisi`, `pic`, `work_date` bila ada di form); `spf_status` ↔ `is_released`.
- `period-workflow-actions.tsx`: sudah memakai `reason` untuk REJECT/UNPUBLISH — verifikasi.
- `client-detail-shell.tsx`: sesuaikan dengan respons client baru (owner_slug-based).
- `spf.ts`/`spf-contracts.ts`: ikut M3.

### M5 — Perubahan client portal (frontend-sm-spf)

- Verifikasi `api.ts`/`App.svelte` terhadap endpoint yang sudah di-realign
  (`portal_verification`, `login`, `portal/vehicles`).
- Pastikan media `hidden` tidak tampil (backend filter; FE tidak perlu tahu).
- Riwayat periode: tampilan timeline/gallery sudah period-aware — verifikasi
  `period_id`/`period_label`.

### M6 — Penghapusan debug & secret

- Hapus middleware debug `/api/login` (log cookie + CSRF) di
  `backend-sm-spf/src/app.ts`.
- Hapus/arsipkan file untracked: `generate-url.ts` (kredensial hardcoded),
  `patch-auth.sh`, `patch-login.sh`, `patch-vehicles-log.sh`, `cookies.txt`
  (tidak dicommit; konfirmasi penghapusan file ke user).
- Hapus `src/modules/access-code/migration.sql` bila `sm_access_code` tidak dipakai.
- Scan ulang `console.log`/`console.error` yang membocorkan material session.

### M7 — Validasi offline

- Backend: `bun test` (unit pure; tes DB gagal karena server mati — dipisahkan),
  `bunx tsc --noEmit` di backend-sm-spf.
- Admin web: `npm run lint:web`; `npm run build:web` (Next.js menulis `.next` —
  perlu izin/escalation).
- Portal: `npm run check` di frontend-sm-spf (Svelte).
- Catat: validasi runtime/DB tidak bisa dijalankan (server mati).

### M8 — Review akhir

- Review diff SPF; cek kontrak web↔backend konsisten; update AI_HANDOFF.md;
- Tampilkan `git status --short` + `git diff --stat`.
- **Tidak commit** sampai diminta user.

## 14. Lokasi File Migration yang Direkomendasikan

File migration existing yang ditemukan:

| File | Jenis | Cocok untuk ALTER gallery? |
|---|---|---|
| `backend-sm-spf/src/modules/access-code/migration.sql` | CREATE `sm_access_code` | ❌ tabel berbeda & tabelnya dihentikan |
| `backend-sm-spf/sql/*.sql` (portal/spf/timeline/url-generator) | query guide komentar | ❌ bukan executable migration |
| `sm_webclient/20260715_fix_cross_database_reference_types.sql` | script ALTER bertanggal | ⚠️ pola penamaan benar, tapi scope beda (panel/jobdesc) |
| `sm_webclient/sm_schema.sql` | DDL fresh install | ⚠️ untuk DB baru, bukan migration DB existing |

**Rekomendasi:** tidak ada file existing yang tepat untuk ditempeli (mencampur kolom
gallery ke `20260715_*` akan mengaburkan scope). Gunakan file baru dengan konvensi
nama yang sudah ada:

```
/home/sahrulr/Documents/sm_webclient/20260803_add_spf_gallery_curation_columns.sql
```

Isi (sesuai §5A, TIDAK dijalankan):

```sql
-- Dijalankan manual setelah persetujuan; additive, tidak merusak data existing.
ALTER TABLE sm_admin_gallery
  ADD COLUMN source_type ENUM('SMS_DB','MANUAL') NOT NULL DEFAULT 'MANUAL' AFTER admin_id;

ALTER TABLE sm_admin_gallery
  ADD COLUMN hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER display_order,
  ADD KEY idx_sm_admin_gallery_hidden (admin_id, hidden);
```

Opsional menyusul: perbarui `sm_schema.sql` (fresh install) dengan dua kolom yang sama.

## 16. LOCAL REWRITE — schema produksi (final)

- Canonical: `sm_portal_accounts` (url_token_hash, access_code_hash), `sm_portal_account_cars`, `sm_progress_periods` (id `YYYY-MM-NNN`), `sm_progress_items` (is_included, exclusion_reason), `sm_progress_media` (source_media_id, is_visible), `sm_timelines`/`sm_timeline_media`.
- Backend HEAD (origin main b32c7d1) sudah memuat implementasi schema produksi; deltas lokal: spf.repository insertMedia (process.env R2 + NULL source_media_id), hapus portal-link.store + test lama, test baru schema-prod.
- Migration: TIDAK diperlukan (semua kolom visibility/source/order/token sudah ada di live). Migration salah target sudah dibuang; tidak direkonstruksi.
- Dead code dihapus: access-code module, portal-link.store (setelah tidak ada import), test lama portal-link-context.
- Validasi: backend 35/35 test + build exit 0; admin lint+build exit 0; portal check+build exit 0; diff --check 0; scan old-schema bersih; secret scan bersih.
- Remaining: staging DB dari backup produksi, integration/smoke, deploy — BELUM dijalankan (dilarang pada tahap ini).
