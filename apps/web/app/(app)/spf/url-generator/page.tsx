import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const UrlGeneratorShell = dynamic(
  () =>
    import("@/modules/spf/components/url-generator-shell").then(
      (m) => m.UrlGeneratorShell,
    ),
  { loading: () => <PageDataSkeleton title="Memuat Portal URL Generator" /> },
);

export default async function SpfUrlGeneratorPage() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  return <UrlGeneratorShell />;
}
