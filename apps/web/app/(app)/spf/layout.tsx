/*
IMPORT YANG DIGUNAKAN
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";

KENAPA IMPORT INI DIPERLUKAN
- `headers`: cookie session hanya aman dibaca pada Server Component; tidak dikirim ulang ke browser.
- `redirect`: menghentikan render sebelum data SPF terbuka untuk user tanpa akses.
- `requireAdminSession`: satu sumber identitas/role terverifikasi; mencegah setiap page membuat auth sendiri.

STRUKTUR KODE
export default async function SpfLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");
  if (!session.spfRole) redirect("/forbidden");
  return children;
}

KENAPA KODE INI DITULIS
Guard diletakkan di layout karena semua route SPF melewatinya. Satu guard lebih kecil dan aman
daripada mengulang pemeriksaan di setiap page; page tetap menangani 401/403 dari API karena
session dapat kedaluwarsa setelah layout selesai dirender.

PENJELASAN
- Layout `(app)` di atasnya sudah merender AppShell; jangan render shell kedua.
- Fungsi ini hanya guard tambahan untuk role SPF.
- `requireAdminSession` harus memakai session server, bukan header buatan browser.

LOGIC — protected SPF layout
1. Server Component calls existing fetchCurrentUser(cookieHeader).
2. Missing session -> redirect /login; unknown SPF role -> /forbidden.
3. Map verified session role to ADMIN | APPROVER | PUBLISHER.
4. Render existing AppShell and SPF navigation; never trust role from browser.

PSEUDOCODE
session = requireAdminSession(cookies)
if !session -> redirect('/login')
if !SPF_ROLES.includes(session.role) -> redirect('/forbidden')
return AppShell(buildSpfNavigation(session.role), children)

SELESAI JIKA: unauthenticated -> login, user tanpa role -> forbidden, role valid dapat children.
*/
