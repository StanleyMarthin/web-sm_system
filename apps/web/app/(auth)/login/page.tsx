import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginShell } from "@/modules/auth/components/login-shell";
import { fetchCurrentUser } from "@/shared/auth/server";

async function LoginPageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user } = await fetchCurrentUser(cookieHeader);

  if (user) {
    redirect("/dashboard");
  }

  return <LoginShell />;
}


export default function LoginPage() {
  return <LoginPageContent />;
}
