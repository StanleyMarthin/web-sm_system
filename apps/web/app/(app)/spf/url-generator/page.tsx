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

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SpfUrlGeneratorPage({ searchParams }: Props) {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const ownerNameParam = typeof resolvedParams["owner_name"] === "string" ? resolvedParams["owner_name"] : "";
  const periodIdParam = typeof resolvedParams["period_id"] === "string" ? resolvedParams["period_id"] : "";

  return (
    <UrlGeneratorShell
      initialOwnerName={ownerNameParam}
      initialPeriodId={periodIdParam}
    />
  );
}
