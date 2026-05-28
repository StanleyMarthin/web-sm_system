import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchPrCritical,
  fetchPrGrid,
} from "@/shared/api/pr";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const PrListShell = dynamic(
  () => import("@/modules/pr/components/pr-list-shell").then((mod) => mod.PrListShell),
  {
    loading: () => <PageDataSkeleton title="Memuat purchase request" />,
  },
);

interface PrPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function PrPageContent({ searchParams }: PrPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, criticalResponse, { user }] = await Promise.all([
    fetchPrGrid(cookieHeader, resolvedSearchParams),
    fetchPrCritical(cookieHeader),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="PR"
        title="Daftar permintaan pembelian belum bisa dimuat"
        message="Data PR atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <PrListShell
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      criticalRows={criticalResponse.payload ?? []}
      canCreate={user.permissions.includes(permissionCodes.prCreate)}
    />
  );
}


export default function PrPage(props: PrPageProps) {
  return <PrPageContent {...props} />;
}
