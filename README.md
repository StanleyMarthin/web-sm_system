# SM System (Monorepo)

SM System adalah workspace web ERP untuk operasional workshop, dengan pemisahan jelas antara frontend (`apps/web`), API (`apps/api`), dan shared package.

## Arsitektur Singkat

```text
Browser
-> Next.js Web (`apps/web`)
-> Bun API (`apps/api`)
-> MySQL + Redis + layanan auth (`sm_login`)
```

## Struktur Path dan Fungsi

### Root

- `apps/`: aplikasi runtime aktif.
- `packages/`: kode bersama lintas aplikasi.
- `progress/`: log progres implementasi per phase + hardening.
- `SYSTEM_MAP_WEB.md`: peta sistem utama (source-of-truth teknis).
- `PLAN_REFACTOR_WEBAPP_NEXTJS_BUN_SM_MIS.md`: rencana refactor final.
- `Dockerfile`, `docker-compose.yml`: jalur container build/run.

### `apps/web` (Next.js App Router)

- `apps/web/app/`: route page/layout.
- `apps/web/modules/`: UI shell per domain bisnis (units, countdown, spk, wo, pr, vendor, warehouse, reports, dll).
  - `apps/web/modules/units/components/bom-tracker-tab.tsx`: interactive BOM node canvas untuk Unit Workspace (`Unit -> Category -> Section -> Panel/Part`), termasuk pan/zoom/fullscreen, posisi node tersimpan per unit di `localStorage`, dan CRUD Master Panel kontekstual via sidebar kanan.
- `apps/web/shared/api/`: client API per modul + parser query/response.
- `apps/web/shared/auth/`: helper auth/session web.
- `apps/web/shared/datagrid/`: SmartDataGrid server-side.
- `apps/web/shared/navigation/`: konfigurasi menu berbasis permission.
- `apps/web/shared/layouts/`: kerangka layout aplikasi.
- `apps/web/proxy.ts`: guard request di sisi web.

### `apps/api` (Bun API)

- `apps/api/src/index.ts`: bootstrap server.
- `apps/api/src/app.ts`: router dispatcher endpoint API.
- `apps/api/src/routes/`: handler endpoint per modul.
- `apps/api/src/services/`: business logic per modul.
- `apps/api/src/repositories/`: query DB + mapping data.
- `apps/api/src/middleware/`: auth, permission, error, dan guard lain.
- `apps/api/src/config/env.ts`: parsing/validasi environment API.
- `apps/api/src/db/`: helper DB + migration SQL.
- `apps/api/tests/`: test API/service/query.

### Shared Packages

- `packages/contracts/src/`: kontrak schema/DTO (Zod + type inference) lintas web/API.
- `packages/permissions/src/index.ts`: katalog permission code dan helper permission check.
- `packages/config/`: baseline konfigurasi TypeScript lintas workspace.

## Menjalankan Project Lokal

1. Install dependency

```bash
npm install
```

2. Jalankan helper startup

```bash
./start-dev.sh start local
```

Mode `local` adalah jalur yang paling aman untuk testing cepat di mesin ini karena:
- MySQL memakai socket lokal `/var/run/mysqld/mysqld.sock`
- Redis dev akan dinyalakan otomatis jika belum ada
- Web dipaksa ke API lokal, jadi tidak tersambung diam-diam ke endpoint publik lama

URL default helper:
- Web: `http://127.0.0.1:3103/login`
- API: `http://127.0.0.1:3203`

Perintah lain:

```bash
./start-dev.sh status
./start-dev.sh logs
./start-dev.sh stop
```

Jika perlu memakai data MySQL/Redis VPS untuk debug:

```bash
./start-dev.sh start tunnel
```

Mode `tunnel` akan membuka SSH tunnel ke VPS lalu menjalankan API + web dengan port lokal yang sama.

## Quality Check

```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
bun test apps/api/tests
```

## Guardrail RBAC/EBAC

- Tidak boleh hardcode role untuk akses fitur.
- Akses harus lewat kombinasi permission + scope (`canViewAllUnits`, division/unit scope).
- Gunakan katalog dari `@smsystem/permissions`.
- Semua endpoint write action wajib melewati guard permission server-side.
