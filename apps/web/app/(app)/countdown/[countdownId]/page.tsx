import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { CountdownDetailShell } from "@/modules/countdown/components/countdown-detail-shell";
import { fetchCountdownDetail } from "@/shared/api/countdown";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface CountdownDetailPageProps {
  params: Promise<{ countdownId: string }>;
}

async function CountdownDetailPageContent({ params }: CountdownDetailPageProps) {
  const { countdownId } = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user } = await fetchCurrentUser(cookieHeader);
  const canManagePlan = user?.permissions.includes(permissionCodes.updatePlan) ?? false;
  const canInputActual = user?.permissions.includes(permissionCodes.listCarProgress) ?? false;
  const { payload, status } = await fetchCountdownDetail(cookieHeader, countdownId);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Countdown"
        title="Detail countdown belum bisa dimuat"
        message={`Data countdown ${countdownId} belum terbaca saat ini. Coba muat ulang beberapa saat lagi.`}
        backHref="/countdown"
        backLabel="Kembali ke Daftar"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return (
    <CountdownDetailShell
      countdown={payload.data.countdown}
      currentUserId={user?.employeeId ?? ""}
      canRequestRevision={payload.canRequestRevision}
      canApproveRevision={payload.canApproveRevision}
      canApproveMoRevision={payload.canApproveMoRevision}
      canManagePlan={canManagePlan}
      canInputActual={canInputActual}
    />
  );
}


export default function CountdownDetailPage(props: CountdownDetailPageProps) {
  return <CountdownDetailPageContent {...props} />;
}
