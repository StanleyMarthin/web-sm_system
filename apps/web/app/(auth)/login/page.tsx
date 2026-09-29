import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginShell } from "@/modules/auth/components/login-shell";
import { fetchCurrentUser } from "@/shared/auth/server";

async function LoginPageContent({
  sessionMessage,
}: {
  sessionMessage?: string;
}) {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user } = await fetchCurrentUser(cookieHeader);

  if (user) {
    redirect("/dashboard");
  }

  return <LoginShell sessionMessage={sessionMessage} />;
}


export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const sessionMessage =
    params?.reason === "session-replaced"
      ? "Anda login di tempat lain."
      : undefined;

  return <LoginPageContent sessionMessage={sessionMessage} />;
}
