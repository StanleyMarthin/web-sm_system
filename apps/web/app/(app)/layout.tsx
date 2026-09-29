import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/shared/layouts/app-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { buildNavigation } from "@/shared/navigation/modules";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user, errorCode } = await fetchCurrentUser(cookieHeader);

  if (!user) {
    if (errorCode === "SESSION_REPLACED") {
      redirect("/login?reason=session-replaced");
    }

    redirect("/login");
  }

  return (
    <AppShell user={user} navigation={buildNavigation(user.permissions, user.roleName)}>
      {children}
    </AppShell>
  );
}
