import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";

// Guard route: semua child route SPF melewati layout ini.
// Satu auth guard lebih aman daripada mengulang di setiap page.
export default async function SpfLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  // Tidak login → ke halaman login
  if (!session) {
    redirect("/login");
  }

  // Login tapi tidak punya SPF role → halaman forbidden
  // requireAdminSession sudah memvalidasi role; null berarti tidak ada role SPF.
  return <>{children}</>;
}
