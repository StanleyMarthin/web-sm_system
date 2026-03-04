# 📘 SM System — Developer Guide

> **Panduan lengkap untuk programmer junior.**
> Baca dokumen ini dari awal sampai akhir sebelum mulai menulis kode.

---

## Daftar Isi

1. [Ringkasan Proyek](#1-ringkasan-proyek)
2. [Tech Stack](#2-tech-stack)
3. [Cara Menjalankan Proyek](#3-cara-menjalankan-proyek)
4. [Struktur Direktori](#4-struktur-direktori)
5. [Alur Data (Request → Response)](#5-alur-data-request--response)
6. [Pola Arsitektur & Konvensi](#6-pola-arsitektur--konvensi)
7. [Panduan Menambah Fitur Baru](#7-panduan-menambah-fitur-baru)
8. [RBAC (Role-Based Access Control)](#8-rbac-role-based-access-control)
9. [Aturan Main (Coding Guidelines)](#9-aturan-main-coding-guidelines)
10. [Hasil Audit Kode & Rekomendasi Pembersihan](#10-hasil-audit-kode--rekomendasi-pembersihan)

---

## 1. Ringkasan Proyek

**SM System** (Service Management System) adalah aplikasi web untuk manajemen operasional servis/maintenance kendaraan atau alat berat. Aplikasi ini mencakup:

| Modul | Fungsi |
|-------|--------|
| **Monitoring** | Pantau pekerjaan mekanik secara real-time |
| **Planning** | Rencanakan jadwal pekerjaan servis |
| **Work Order** | Buat, setujui, dan kelola work order |
| **Task Execution** | Eksekusi tugas harian mekanik |
| **KPI** | Dashboard indikator performa |
| **QC** | Quality Control / inspeksi kualitas |
| **Unit Progress** | Lacak progress per unit kendaraan |

Setiap role user (`pm`, `advisor`, `kd`, `mechanic`) memiliki akses dan menu yang berbeda sesuai konfigurasi RBAC.

---

## 2. Tech Stack

| Kategori | Teknologi | Kenapa Dipakai |
|----------|-----------|----------------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework dengan file-based routing |
| **UI Library** | React 19 | Library utama untuk membangun UI |
| **Bahasa** | TypeScript 5 | JavaScript + tipe statis → lebih aman, lebih mudah di-debug |
| **Styling** | Tailwind CSS 4 | Utility-first CSS, cepat dan konsisten |
| **Komponen UI** | shadcn/ui (Radix UI) | Komponen UI yang accessible dan customizable |
| **State Management** | Zustand | State management ringan (pengganti Redux) |
| **Data Fetching** | SWR | Stale-while-revalidate, caching, dan polling otomatis |
| **Icons** | Lucide React | Icon set modern dan konsisten |

---

## 3. Cara Menjalankan Proyek

```bash
# 1. Clone repositori (jika belum)
git clone <repo-url>
cd smsystem

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev

# 4. Buka di browser
# http://localhost:3000
```

### Script yang Tersedia

| Script | Perintah | Fungsi |
|--------|----------|--------|
| Dev | `npm run dev` | Jalankan server development (hot reload) |
| Build | `npm run build` | Build untuk production |
| Start | `npm run start` | Jalankan result build production |
| Lint | `npm run lint` | Cek kualitas kode dengan ESLint |

---

## 4. Struktur Direktori

```
smsystem/
├── public/                     # File statis (gambar, favicon, dll.)
├── src/
│   ├── app/                    # 🔵 ROUTING (Next.js App Router)
│   │   ├── globals.css         #    Theme & variabel CSS global
│   │   ├── layout.tsx          #    Root layout (font, metadata, <html>)
│   │   ├── page.tsx            #    Halaman "/" → redirect ke /login
│   │   ├── login/
│   │   │   └── page.tsx        #    Halaman login
│   │   └── dashboard/
│   │       ├── layout.tsx      #    Layout dashboard (sidebar + topbar + auth guard)
│   │       ├── page.tsx        #    Halaman overview dashboard
│   │       ├── monitoring/
│   │       ├── planning/
│   │       ├── work-orders/
│   │       ├── tasks/
│   │       ├── kpi/
│   │       ├── qc/
│   │       └── unit-progress/
│   │
│   ├── features/               # 🟢 FITUR (Business Logic per modul)
│   │   ├── auth/               #    Autentikasi
│   │   │   ├── components/     #    Komponen UI (LoginForm, AuthGuard)
│   │   │   ├── services/       #    Panggilan API (login, logout)
│   │   │   └── stores/         #    Zustand store (session)
│   │   ├── dashboard/
│   │   │   ├── components/     #    Sidebar, TopBar, MobileNav, Overview
│   │   │   └── lib/            #    Helper (nav items, dsb.)
│   │   ├── monitoring/
│   │   │   ├── components/     #    UI komponen monitoring
│   │   │   ├── hooks/          #    Custom hooks (useMonitoringData)
│   │   │   ├── services/       #    API calls monitoring
│   │   │   └── stores/         #    Zustand store monitoring
│   │   ├── planning/
│   │   │   ├── components/
│   │   │   └── services/
│   │   ├── work-order/
│   │   │   ├── components/
│   │   │   └── services/
│   │   ├── task-execution/
│   │   │   └── components/
│   │   ├── kpi/
│   │   │   └── components/
│   │   ├── qc/
│   │   │   └── components/
│   │   └── unit-progress/
│   │       └── components/
│   │
│   ├── components/             # 🟡 SHARED UI COMPONENTS
│   │   └── ui/                 #    Komponen shadcn/ui (Button, Badge, Table, dll.)
│   │
│   ├── config/                 # ⚙️ KONFIGURASI
│   │   ├── env.ts              #    Environment variables (API URL)
│   │   └── rbac.ts             #    Role-based permissions
│   │
│   ├── lib/                    # 🔧 UTILITY & DATA
│   │   ├── utils.ts            #    Helper functions (cn untuk class merging)
│   │   └── dummy-data.ts       #    Data dummy untuk development
│   │
│   └── types/                  # 📝 TYPE DEFINITIONS
│       ├── api.ts              #    Semua interface & type (dari API contract)
│       └── index.ts            #    Barrel export (re-export api.ts)
```

### Penjelasan Setiap Folder

#### `src/app/` — Routing Layer
**Aturan: Jangan taruh logika bisnis di sini.**

Folder ini mengikuti konvensi Next.js App Router. Setiap folder = satu route URL:
- `src/app/dashboard/monitoring/page.tsx` → URL `/dashboard/monitoring`

File `page.tsx` di sini seharusnya **tipis** (thin) — hanya import dan render komponen client dari `features/`.

```tsx
// ✅ Contoh yang benar — page.tsx tipis
import { MonitoringPageClient } from "@/features/monitoring/components/monitoring-page-client";

export default function MonitoringPage() {
  return <MonitoringPageClient />;
}
```

```tsx
// ❌ Contoh yang salah — logika bisnis di page.tsx
export default function MonitoringPage() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch('/api/...').then(...) }, []);
  return <div>{/* render data */}</div>;
}
```

#### `src/features/` — Business Logic Layer
**Ini jantung aplikasi.** Setiap fitur di-organisir mandiri (self-contained):

| Sub-folder | Isi | Contoh |
|------------|-----|--------|
| `components/` | Komponen React khusus fitur ini | `MonitoringPageClient`, `JobMonitorCard` |
| `services/` | Fungsi async untuk call API | `getMonitoringJobs()`, `getWorkOrders()` |
| `stores/` | Zustand store (state global per fitur) | `useMonitoringStore` |
| `hooks/` | Custom React hooks | `useMonitoringData` |
| `lib/` | Helper/utility khusus fitur | `getNavItems()` |

#### `src/components/ui/` — Shared UI Library
Komponen **generic & reusable** dari shadcn/ui. Tidak boleh mengandung logika bisnis.

Contoh: `Badge`, `Table`, `Sheet`, `Separator`.

> **Aturan:** Untuk menambah komponen shadcn baru, gunakan CLI:
> ```bash
> npx shadcn@latest add <nama-komponen>
> ```

#### `src/config/` — Konfigurasi Aplikasi
- **`env.ts`** — URL API dan variabel environment
- **`rbac.ts`** — Permission matrix per role

#### `src/lib/` — Shared Utilities
- **`utils.ts`** — Fungsi helper yang dipakai di mana-mana (seperti `cn()` untuk class merging)
- **`dummy-data.ts`** — Data palsu untuk development (akan diganti API asli)

#### `src/types/` — Type Definitions
Satu sumber kebenaran (*single source of truth*) untuk semua interface dan type. Import dari `@/types`:

```tsx
import type { AuthUser, MonitoringJob } from "@/types";
```

---

## 5. Alur Data (Request → Response)

### 5.1 Alur Navigasi & Auth

```
User buka "/" 
  → page.tsx redirect ke "/login"
  → LoginForm muncul
  → User isi employeeId + password
  → loginService() dipanggil (simulasi API)
  → Sukses → useAuthStore.login(user, token)
  → Data tersimpan di localStorage (persist)
  → Redirect ke "/dashboard"
  → AuthGuard cek isAuthenticated dari store
    → Jika false → redirect ke "/login"  
    → Jika true  → render dashboard layout (Sidebar + TopBar + children)
```

### 5.2 Alur Data pada Halaman Fitur

Untuk fitur dengan API calls (Monitoring, Planning, Work Orders):

```
┌──────────────────────────────────────────────────────────────────┐
│  Route (src/app/)                                                │
│  page.tsx  ──imports──▸  PageClient (src/features/*/components/) │
│                             │                                    │
│                             ▼                                    │
│                    Custom Hook / SWR                             │
│                    (src/features/*/hooks/)                        │
│                             │                                    │
│                             ▼                                    │
│                    Service Function                              │
│                    (src/features/*/services/)                     │
│                             │                                    │
│                             ▼                                    │
│                    Dummy Data / Real API                         │
│                    (src/lib/dummy-data.ts)                        │
│                             │                                    │
│                             ▼                                    │
│                    Zustand Store (opsional)                      │
│                    (src/features/*/stores/)                       │
│                             │                                    │
│                             ▼                                    │
│                    React Component renders data                  │
└──────────────────────────────────────────────────────────────────┘
```

**Penjelasan langkah per langkah (contoh: Monitoring):**

1. **Route page** (`src/app/dashboard/monitoring/page.tsx`) → render `<MonitoringPageClient />`
2. **PageClient** component memanggil custom hook `useMonitoringData()`
3. **Custom hook** menggunakan SWR + service function `getMonitoringJobs()`
4. **Service** mengambil data dari `dummy-data.ts` (nanti diganti `fetch()` ke API)
5. **Data** disimpan di Zustand store (`useMonitoringStore`)
6. **PageClient** mengambil data dari store via selector → render UI

### 5.3 Pola Data Fetching yang Dipakai

| Pola | Dipakai Di | Kapan Pakai |
|------|-----------|-------------|
| **Zustand + SWR + Service** | Monitoring | Data kompleks, perlu store terpisah, polling |
| **SWR langsung + Service** | Planning, Work Orders | Data sederhana, caching SWR sudah cukup |
| **Import dummy langsung** | KPI, QC, Unit Progress | Sementara, belum ada API |

> **Target Akhir:** Semua fitur harus menggunakan pola **SWR + Service**. Pola "import dummy langsung" hanya untuk tahap development awal.

---

## 6. Pola Arsitektur & Konvensi

### 6.1 Feature-Sliced Architecture

Proyek ini menggunakan arsitektur **feature-sliced** — setiap fitur mandiri dan punya folder sendiri. Ini mencegah "spaghetti imports" di mana file A dari fitur X mengimport file B dari fitur Y secara bebas.

**Aturan import:**

```
✅ features/monitoring/ → import dari lib/, types/, components/ui/
✅ features/monitoring/ → import dari features/monitoring/ (internal)
✅ app/                  → import dari features/

❌ features/monitoring/ → import dari features/planning/ (cross-feature)
❌ features/monitoring/ → import dari app/ (reverse dependency)
```

Jika dua fitur butuh kode yang sama → pindahkan kode itu ke `src/lib/` atau `src/components/`.

### 6.2 Server Component vs Client Component

Next.js App Router membedakan **Server Component** (default) dan **Client Component** (`"use client"`).

| Tipe | Sebaiknya Dipakai Untuk |
|------|------------------------|
| **Server Component** | `page.tsx`, `layout.tsx` — rendering statis, SEO, data fetching server-side |
| **Client Component** | Form, interaksi user, state management, hooks |

```tsx
// page.tsx (Server Component) — TANPA "use client"
import { MonitoringPageClient } from "@/features/monitoring/components/monitoring-page-client";

export default function MonitoringPage() {
  return <MonitoringPageClient />;
}
```

```tsx
// monitoring-page-client.tsx (Client Component) — DENGAN "use client"
"use client";

import { useMonitoringData } from "../hooks/use-monitoring-data";

export function MonitoringPageClient() {
  const { data } = useMonitoringData();
  return <div>...</div>;
}
```

### 6.3 Naming Conventions

| Item | Konvensi | Contoh |
|------|----------|--------|
| **Folder fitur** | `kebab-case` | `work-order/`, `task-execution/` |
| **File komponen** | `kebab-case.tsx` | `monitoring-page-client.tsx` |
| **Komponen React** | `PascalCase` | `MonitoringPageClient` |
| **Hooks** | `camelCase`, prefix `use` | `useMonitoringData` |
| **Service functions** | `camelCase`, prefix verb | `getWorkOrders`, `submitWorkOrder` |
| **Store hooks** | `camelCase`, prefix `use` | `useAuthStore`, `useMonitoringStore` |
| **Types/Interfaces** | `PascalCase` | `MonitoringJob`, `AuthUser` |
| **Constants** | `UPPER_SNAKE_CASE` | `MONITORING_JOBS`, `PLAN_JOBS` |

---

## 7. Panduan Menambah Fitur Baru

Misalnya kamu ingin menambah fitur **"Inventory"**. Ikuti langkah-langkah berikut:

### Langkah 1: Buat Folder Fitur

```
src/features/inventory/
├── components/
│   └── inventory-page-client.tsx
├── services/
│   └── inventory-service.ts
├── hooks/                        # (opsional, jika butuh custom hook)
│   └── use-inventory-data.ts
└── stores/                       # (opsional, jika butuh global state)
    └── inventory-store.ts
```

### Langkah 2: Buat Type Definitions

Tambahkan type baru di `src/types/api.ts`:

```tsx
// ---- Inventory ----
export interface InventoryItem {
  id: string;
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
}
```

### Langkah 3: Buat Service

```tsx
// src/features/inventory/services/inventory-service.ts

import type { InventoryItem } from "@/types";

export async function getInventoryItems(): Promise<InventoryItem[]> {
  // Ganti ini dengan API call asli nanti
  const response = await fetch("/api/inventory");
  return response.json();
}
```

### Langkah 4: Buat Client Component

```tsx
// src/features/inventory/components/inventory-page-client.tsx
"use client";

import useSWR from "swr";
import { getInventoryItems } from "../services/inventory-service";

export function InventoryPageClient() {
  const { data, error, isLoading } = useSWR("inventory-items", getInventoryItems);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h1>Inventory</h1>
      {/* render data */}
    </div>
  );
}
```

### Langkah 5: Buat Route Page

```tsx
// src/app/dashboard/inventory/page.tsx
import { Suspense } from "react";
import { InventoryPageClient } from "@/features/inventory/components/inventory-page-client";

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InventoryPageClient />
    </Suspense>
  );
}
```

### Langkah 6: Tambahkan ke Navigasi

Edit `src/features/dashboard/lib/nav-items.tsx`, tambahkan item baru:

```tsx
{
  label: "Inventory",
  href: "/dashboard/inventory",
  icon: <Package className="w-4 h-4" />,
  permission: Permission.VIEW_INVENTORY,  // Buat permission baru di rbac.ts
}
```

### Langkah 7: Tambah Permission di RBAC

Edit `src/config/rbac.ts`:

```tsx
// Tambah permission baru
export const Permission = {
  // ...existing permissions
  VIEW_INVENTORY: "VIEW_INVENTORY",
  MANAGE_INVENTORY: "MANAGE_INVENTORY",
} as const;

// Tambah ke role yang sesuai
const rolePermissions: Record<UserRole, PermissionKey[]> = {
  pm: [..., Permission.VIEW_INVENTORY],
  kd: [..., Permission.VIEW_INVENTORY, Permission.MANAGE_INVENTORY],
  // ...
};
```

### Checklist Sebelum Push

- [ ] Type baru sudah ditambah di `src/types/api.ts`
- [ ] Service function menggunakan type yang benar
- [ ] Client component menggunakan `"use client"` directive
- [ ] Route page tipis (hanya import + render)
- [ ] Permission ditambah di `rbac.ts`
- [ ] Nav item ditambah di `nav-items.tsx`
- [ ] Tidak ada import lintas fitur (cross-feature)

---

## 8. RBAC (Role-Based Access Control)

### Role yang Tersedia

| Role | Singkatan | Akses Utama |
|------|-----------|-------------|
| `pm` | Plant Manager | View semua + approve WO level PM |
| `advisor` | Service Advisor | View semua + approve WO level Advisor |
| `kd` | Kepala Divisi | Full access + manage planning, QC |
| `mechanic` | Mekanik | Task execution + view planning & WO |

### Cara Kerja RBAC

1. **Permission didefinisikan** di `src/config/rbac.ts`
2. **Nav items difilter** berdasarkan permission user di `src/features/dashboard/lib/nav-items.tsx`
3. **Menu yang muncul** di Sidebar/MobileNav berbeda-beda per role

### Cara Cek Permission di Kode

```tsx
import { hasPermission, Permission } from "@/config/rbac";
import { useAuthStore } from "@/features/auth/stores/auth-store";

function MyComponent() {
  const user = useAuthStore((s) => s.user);

  if (user && hasPermission(user.role, Permission.MANAGE_PLANNING)) {
    // Tampilkan tombol edit
  }
}
```

---

## 9. Aturan Main (Coding Guidelines)

### 9.1 Prinsip Utama

| Prinsip | Penjelasan |
|---------|-----------|
| **DRY** (Don't Repeat Yourself) | Jika kode yang sama ditulis 2x, ekstrak ke fungsi/komponen terpisah |
| **Single Responsibility** | Satu file = satu tanggung jawab. Jangan campur service + UI. |
| **Composition over Inheritance** | Gunakan komposisi komponen React, bukan class inheritance |
| **Explicit over Implicit** | Lebih baik kode yang jelas dibaca daripada kode yang "pintar" tapi susah dipahami |

### 9.2 Aturan Import

```tsx
// ✅ Urutan import yang benar (pisahkan dengan baris kosong):

// 1. Library eksternal
import { useState, useEffect } from "react";
import useSWR from "swr";

// 2. Internal absolute path (@/)
import type { MonitoringJob } from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// 3. Relative path (dari fitur yang sama)
import { JobMonitorCard } from "./job-monitor-card";
import { useMonitoringData } from "../hooks/use-monitoring-data";
```

### 9.3 Aturan TypeScript

```tsx
// ✅ Selalu gunakan `type` import untuk type-only imports
import type { AuthUser } from "@/types";

// ✅ Selalu beri type pada props
interface JobCardProps {
  job: MonitoringJob;
  onStatusChange: (id: string, status: string) => void;
}

// ✅ Gunakan `interface` untuk object shapes, `type` untuk unions/intersections
type Status = "active" | "inactive";
interface User {
  id: string;
  name: string;
}

// ❌ Jangan gunakan `any`
function handleData(data: any) { ... }  // ← JANGAN

// ✅ Gunakan `unknown` jika type belum jelas
function handleData(data: unknown) { ... }
```

### 9.4 Aturan Komponen React

```tsx
// ✅ Gunakan named export (bukan default) untuk komponen fitur
export function MonitoringPageClient() { ... }

// ✅ Gunakan `function` declaration untuk komponen
export function MyComponent() { ... }

// ❌ Hindari anonymous arrow function untuk komponen utama
export default () => { ... }

// ✅ Pecah komponen besar (>150 baris) menjadi sub-komponen
// Contoh: MonitoringPageClient → JobMonitorCard + MonitoringSummary + FilterBar
```

### 9.5 Aturan State Management

```tsx
// Zustand — gunakan SELECTOR (jangan destructure seluruh store)

// ✅ BENAR — hanya subscribe ke field yang dibutuhkan
const user = useAuthStore((state) => state.user);

// ❌ SALAH — subscribe ke semua field (re-render berlebihan)
const { user, token, isAuthenticated } = useAuthStore();
```

### 9.6 Aturan CSS / Tailwind

```tsx
// ✅ Gunakan `cn()` untuk conditional class merging
import { cn } from "@/lib/utils";

<div className={cn(
  "rounded-xl border",     // base classes
  isActive && "bg-blue-500", // conditional
  className                   // override dari parent
)} />

// ✅ Styling yang dipakai berulang → buat shared class di globals.css atau komponen terpisah
// ❌ Jangan copy-paste className panjang ke 5+ tempat berbeda
```

### 9.7 Aturan Penamaan

```tsx
// File → kebab-case
"monitoring-page-client.tsx"    // ✅
"MonitoringPageClient.tsx"      // ❌

// Komponen → PascalCase
export function MonitoringPageClient() { }  // ✅
export function monitoringPageClient() { }  // ❌

// Hook → prefix "use"
function useMonitoringData() { }  // ✅
function monitoringData() { }     // ❌

// Service → prefix verb
function getWorkOrders() { }     // ✅
function fetchWorkOrders() { }   // ✅ (boleh juga)
function workOrderService() { }  // ❌ (tidak jelas aksinya)

// Type → PascalCase
type MonitoringJobStatus = "TO_DO" | "IN_PROGRESS" | "DONE";  // ✅
```

### 9.8 Aturan Git Commit

Gunakan format [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(monitoring): add real-time polling for job status
fix(auth): handle expired token redirect
refactor(planning): extract shared card component
chore: remove unused UI components
docs: update developer guide
```

---

## 10. Hasil Audit Kode & Rekomendasi Pembersihan

> **Bagian ini didedikasikan untuk hasil analisis dead code, DRY violations, dan inkonsistensi.**
> Gunakan sebagai referensi saat cleanup sprint.

### 10.1 File Mati (Dead Files) — HAPUS

File-file berikut **tidak diimport di mana pun** dan aman untuk dihapus:

| # | File | Alasan |
|---|------|--------|
| 1 | `src/components/ui/avatar.tsx` | Tidak diimport oleh file manapun |
| 2 | `src/components/ui/button.tsx` | Satu-satunya consumer (`dialog.tsx`) juga dead file |
| 3 | `src/components/ui/card.tsx` | Tidak diimport oleh file manapun |
| 4 | `src/components/ui/dialog.tsx` | Tidak diimport oleh file manapun |
| 5 | `src/components/ui/dropdown-menu.tsx` | Tidak diimport oleh file manapun |
| 6 | `src/components/ui/input.tsx` | Login form pakai raw `<input>`, komponen ini tidak dipakai |
| 7 | `src/components/ui/label.tsx` | Login form pakai raw `<label>`, komponen ini tidak dipakai |
| 8 | `src/components/ui/progress.tsx` | Diimport di `dashboard-overview.tsx` tapi tidak pernah dirender |
| 9 | `src/components/ui/select.tsx` | Tidak diimport oleh file manapun |
| 10 | `src/components/ui/sonner.tsx` | Tidak diimport, dan `ThemeProvider` (next-themes) belum di-setup |
| 11 | `src/components/ui/tabs.tsx` | Tidak diimport oleh file manapun |
| 12 | `src/features/dashboard/components/index.ts` | Barrel file, tapi semua consumer import langsung dari file spesifik |

> **Catatan:** Jangan hapus `button.tsx`, `input.tsx`, `label.tsx` jika kamu berencana memakainya dalam waktu dekat (misalnya refactor login form). Jika iya, sebaiknya **tandai** saja dan langsung refactor login form untuk memakainya.

### 10.2 Ekspor Mati (Dead Exports) — BERSIHKAN

Fungsi/type berikut diekspor tapi tidak pernah diimpor:

| File | Dead Export | Rekomendasi |
|------|------------|-------------|
| `src/config/rbac.ts` | `getPermissions()` | Hapus, atau simpan jika dibutuhkan nanti |
| `src/features/auth/services/auth-service.ts` | `logoutService()` | **Pakai** di sidebar/mobile-nav saat logout (saat ini logout langsung clear store) |
| `src/features/monitoring/stores/monitoring-store.ts` | `selectAllJobs`, `selectJobById` | Hapus yang tidak dibutuhkan |
| `src/features/monitoring/services/monitoring-service.ts` | `updateJobCheckpoints`, `addUrgentJob` | Simpan untuk fitur masa depan, beri komentar `// TODO: belum dipakai` |
| `src/features/planning/services/planning-service.ts` | `getMechanicOptions`, `getAvailableCoreJobs`, `createPlanJob`, `deletePlanJob` | Simpan untuk fitur masa depan |
| `src/features/work-order/services/work-order-service.ts` | `submitWorkOrder`, `approveWorkOrderAdvisor`, `approveWorkOrderPM`, `rejectWorkOrder` | Simpan untuk fitur masa depan |
| `src/lib/dummy-data.ts` | `DIVISIONS`, `EMPLOYEES` | Hapus jika tidak dibutuhkan |
| `src/types/api.ts` | `LoginResponse`, `RefreshResponse`, `ApiListResponse`, `ApiErrorResponse`, `Panel` | Simpan `LoginResponse`, `ApiErrorResponse` → akan dipakai saat integrasi API |

### 10.3 Import Mati (Unused Imports) — HAPUS

| File | Unused Import |
|------|---------------|
| `src/features/dashboard/components/dashboard-overview.tsx` | `Progress` dari `@/components/ui/progress` |
| `src/features/monitoring/components/monitoring-page-client.tsx` | `Badge` dari `@/components/ui/badge` |

### 10.4 Dependency NPM Tidak Terpakai

| Package | Status |
|---------|--------|
| `date-fns` | **Tidak diimport di mana pun.** Hapus: `npm uninstall date-fns` |
| `next-themes` | Diinstall tapi `ThemeProvider` belum di-setup. `sonner.tsx` panggil `useTheme()` tapi file itu sendiri dead code. Putuskan: setup theme atau hapus package. |

### 10.5 Pelanggaran DRY — REFACTOR

#### 🔴 Prioritas Tinggi

**1. Konstanta `serif` font — Diduplikasi di 10+ file**

```tsx
// Kode yang sama di 10 file berbeda:
const serif = "'Georgia', 'Times New Roman', serif";
```

**Solusi:** Buat `src/lib/constants.ts`:
```tsx
export const FONT_SERIF = "'Georgia', 'Times New Roman', serif";
```
Lalu import di mana diperlukan. Atau lebih baik, definisikan sebagai Tailwind custom font di `globals.css`.

**2. Dark Card Wrapper — className diulang 15+ kali**

```tsx
className="rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
```

**Solusi:** Buat komponen `DarkCard`:
```tsx
// src/components/ui/dark-card.tsx
export function DarkCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors", className)}>
      {children}
    </div>
  );
}
```

**3. Progress Bar Custom — Diduplikasi 5+ kali**

**Solusi:** Buat komponen `AmberProgressBar` atau customize `Progress` dari shadcn.

**4. Suspense Fallback — Diduplikasi 4 kali**

**Solusi:** Buat komponen `PageLoader`:
```tsx
// src/components/ui/page-loader.tsx
import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
```

#### 🟡 Prioritas Sedang

**5. StatCard / Tile Pattern — Diduplikasi 4 kali**

Pola "icon + angka besar + label uppercase" muncul di dashboard-overview, monitoring-summary, unit-progress, kpi.

**Solusi:** Buat komponen shared `StatTile`.

**6. GaugeCard — Diduplikasi 2 kali**

Kode hampir identik di `dashboard-overview.tsx` dan `kpi-page-client.tsx`.

**Solusi:** Ekstrak ke `src/components/ui/gauge-card.tsx`.

**7. Page Header Pattern — Diduplikasi di setiap halaman fitur**

**Solusi:** Buat komponen `PageHeader`:
```tsx
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) { ... }
```

**8. Initials Computation + Logout Handler — Diduplikasi di Sidebar & MobileNav**

**Solusi:** Buat custom hook `useUserSession()`:
```tsx
export function useUserSession() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const initials = user?.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "";

  const handleLogout = () => { logout(); router.push("/login"); };

  return { user, initials, handleLogout };
}
```

### 10.6 Inkonsistensi yang Perlu Diseragamkan

| Issue | Detail | Rekomendasi |
|-------|--------|-------------|
| **Suspense tidak konsisten** | 4 page pakai `<Suspense>`, 4 tidak | Seragamkan: semua page fitur pakai `<Suspense>` |
| **Data fetching 3 pola** | Zustand+SWR, SWR langsung, import dummy | Target: semua pakai SWR+Service, Zustand opsional |
| **Penamaan folder vs route** | `work-order/` vs `work-orders/`, `task-execution/` vs `tasks/` | Seragamkan, pilih salah satu konvensi |
| **Bahasa di type values** | `"PROSES"` (ID) vs `"IN_PROGRESS"` (EN) | Pilih satu bahasa untuk semua enum/status values |
| **Login pakai raw HTML** | `<input>` / `<button>` bukannya shadcn | Refactor pakai `Input`, `Button`, `Label` dari shadcn |
| **`"use client"` di store** | `monitoring-store.ts` pakai `"use client"` | Hapus — Zustand store bersifat isomorphic |
| **Barrel file tidak terpakai** | `features/dashboard/components/index.ts` | Hapus, atau pakai secara konsisten di semua import |
| **Monitoring data hardcoded tanggal** | `taskDate: "2026-02-27"` → data hilang setelah tanggal itu | Buat data relatif ke `new Date()` |
| **MonitoringSummary abaikan `toDo`** | Props dikirim tapi tidak di-render | Tambahkan ke tiles array atau hapus dari props |
| **Tidak ada error boundary** | Tidak ada `error.tsx` di route segments | Tambah `error.tsx` minimal di `/dashboard` |
| **Tidak ada middleware auth** | Auth hanya client-side (AuthGuard) | Tambah `middleware.ts` untuk server-side protection |

### 10.7 Ringkasan Prioritas Cleanup

```
📌 HARUS SEGERA (sebelum lanjut develop):
├── Hapus unused imports (Progress di dashboard-overview, Badge di monitoring-page)
├── Ekstrak konstanta serif → src/lib/constants.ts
├── Buat komponen shared: DarkCard, PageLoader, PageHeader
└── Hapus dead UI files jika tidak akan dipakai

⚡ SEGERA (sprint berikutnya):
├── Seragamkan data fetching pattern (SWR + Service untuk semua fitur)
├── Seragamkan Suspense wrapper di semua page
├── Refactor login form pakai shadcn components
├── Tambah error.tsx boundary
└── Buat custom hook useUserSession()

📋 BACKLOG (saat ada waktu):
├── Tambah middleware.ts untuk server-side auth
├── Setup ThemeProvider (next-themes) atau hapus package
├── Seragamkan bahasa di type enum values
├── Seragamkan penamaan folder fitur vs route
└── Hapus npm dependency `date-fns` jika tidak dibutuhkan
```

---

## Lampiran: Akun Dummy untuk Testing

> Lihat `src/lib/dummy-data.ts` → bagian `USERS` untuk daftar akun test.
> Setiap role memiliki akun tersendiri. Password default bisa dilihat di `auth-service.ts`.

---

*Terakhir diperbarui: Februari 2026*
*Dibuat oleh: Tim Engineering SM System*
