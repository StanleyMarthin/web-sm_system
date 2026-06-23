# SM System

Monorepo fullstack untuk aplikasi operasional workshop.

## Stack

- `apps/web`: Next.js frontend.
- `apps/api`: Bun API backend.
- `packages/contracts`: schema dan DTO shared.
- `packages/permissions`: permission code shared.
- `packages/config`: shared TypeScript config.

## Struktur Utama

```text
apps/
  api/      Bun API runtime
  web/      Next.js web runtime
packages/
  config/
  contracts/
  permissions/
```

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat env lokal dari sample:

```bash
cp .env.example .env.local
```

3. Isi value `.env.local` sesuai database, Redis, auth service, dan storage lokal yang dipakai.

4. Jalankan API:

```bash
npm run dev:api
```

5. Jalankan web di terminal lain:

```bash
npm run dev:web
```

Default:
- Web: `http://localhost:3000`
- API: sesuai `API_HOST` dan `API_PORT` di `.env.local`

## Typecheck

```bash
npm run typecheck --workspace @smsystem/api
npx tsc --noEmit -p apps/web/tsconfig.json
```

## Env

File env yang boleh dicommit hanya sample tanpa value:

- `.env.example`
- `.env.local.example`

File env nyata tidak boleh dicommit.

## Catatan Maintainance

- Runtime source ada di `apps/` dan `packages/`.
- Jangan push file lokal seperti `.env.local`, `node_modules/`, `.next/`, script scratch, test, atau catatan implementasi.
- Perubahan kontrak API sebaiknya dimulai dari `packages/contracts`, lalu update `apps/api` dan `apps/web`.
