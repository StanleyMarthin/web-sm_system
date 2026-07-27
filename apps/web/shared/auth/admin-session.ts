/*
IMPORT YANG DIGUNAKAN
import "server-only";
import { cache } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { fetchCurrentUser } from "@/shared/auth/server";

KENAPA IMPORT INI DIPERLUKAN
- `server-only`: mencegah session adapter masuk bundle browser.
- `cache`: layout dan page pada render sama tidak memanggil `/auth/me` dua kali.
- `AuthUser`: adapter tetap cocok dengan kontrak login existing.
- `fetchCurrentUser`: reuse validasi cookie/session yang sudah dipercaya; tidak membuat login kedua.

STRUKTUR KODE
const roles = ["ADMIN","APPROVER","PUBLISHER"] as const;
export type SpfRole = typeof roles[number];
export type AdminSession = Readonly<{ employeeId:string; role:SpfRole; user:AuthUser }>;
export const requireAdminSession = cache(async (cookieHeader:string): Promise<AdminSession|null> => {
  const { user } = await fetchCurrentUser(cookieHeader);
  if (!user) return null;
  const employeeId = derive from verified AuthUser field;
  const role = map existing permission/role from server response; // explicit map, no guessing
  if (!employeeId || !role) return null/forbidden result;
  return { employeeId, role, user };
});

KENAPA ADAPTER INI ADA
Auth existing mengenal user/permission umum, sedangkan SPF memerlukan tiga role workflow.
Adapter menerjemahkan claim terverifikasi sekali. Ini bukan authorization akhir—backend tetap
memeriksa setiap mode—tetapi mencegah UI dan BFF membuat mapping role berbeda.

PENTING: cek bentuk AuthUser nyata. Jika session belum membawa role SPF, backend smsystem
harus menambah claim/permission terverifikasi; jangan sementara membaca query/header browser.
SERVER-ONLY ADAPTER
AdminSession = Readonly<{ employeeId: string; role: 'ADMIN'|'APPROVER'|'PUBLISHER'; user: AuthUser }>

requireAdminSession reads the existing signed/verified smsystem session. employeeId and
role must never come from request body, query, localStorage, or browser-controlled headers.
No fallback to ADMIN: unknown/missing role is 403 and logged server-side without secrets.
Reuse existing shared/auth/server.ts rather than creating a second login flow.

SELESAI JIKA: cache satu request/render dan forged role tidak dapat mengubah hasil.
*/
