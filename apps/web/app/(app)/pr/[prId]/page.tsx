import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { PrDetailShell } from "@/modules/pr/components/pr-detail-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchPrDetail } from "@/shared/api/pr";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface PrDetailPageProps {
  params: Promise<{
    prId: string;
  }>;
}

async function PrDetailPageContent({ params }: PrDetailPageProps) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchPrDetail(cookieHeader, resolvedParams.prId),
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
        title="Detail permintaan pembelian belum bisa dimuat"
        message={`Data PR ${resolvedParams.prId} atau sesi aktif belum terbaca saat ini.`}
        backHref="/pr"
        backLabel="Kembali ke Daftar PR"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return (
    <PrDetailShell
      header={payload.data.header}
      items={payload.data.items}
      canApprove={user.permissions.includes(permissionCodes.prApprove)}
      canOrder={user.permissions.includes(permissionCodes.prOrder)}
      canReceive={user.permissions.includes(permissionCodes.prReceive)}
    />
  );
}


export default function PrDetailPage(props: PrDetailPageProps) {
  return <PrDetailPageContent {...props} />;
}
