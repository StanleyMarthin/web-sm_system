import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { WoDetailShell } from "@/modules/wo/components/wo-detail-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchWoDetail } from "@/shared/api/wo";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface WoDetailPageProps {
  params: Promise<{
    woId: string;
  }>;
}

async function WoDetailPageContent({ params }: WoDetailPageProps) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchWoDetail(cookieHeader, resolvedParams.woId),
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
        module="WO"
        title="Detail work order belum bisa dimuat"
        message={`Data WO ${resolvedParams.woId} atau sesi aktif belum terbaca saat ini.`}
        backHref="/wo"
        backLabel="Kembali ke Daftar WO"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return (
    <WoDetailShell
      ticket={payload.data.ticket}
      linkedCountdowns={payload.data.linkedCountdowns}
      canApprove={user.permissions.includes(permissionCodes.woApprove)}
      canReject={user.permissions.includes(permissionCodes.woReject)}
    />
  );
}


export default function WoDetailPage(props: WoDetailPageProps) {
  return <WoDetailPageContent {...props} />;
}
