import { permissionCodes } from "@smsystem/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UnitWorkspaceShell } from "@/modules/units/components/unit-workspace-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchUnitBom, fetchUnitDetail, fetchUnitWorkspace } from "@/shared/api/units";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface UnitDetailPageProps {
  params: Promise<{ unitId: string }>;
}

async function UnitDetailPageContent({ params }: UnitDetailPageProps) {
  const { unitId } = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [
    { payload: detailPayload, status: detailStatus },
    { payload: workspacePayload, status: workspaceStatus },
    { payload: bomPayload, status: bomStatus },
    { user },
  ] =
    await Promise.all([
      fetchUnitDetail(cookieHeader, unitId),
      fetchUnitWorkspace(cookieHeader, unitId),
      fetchUnitBom(cookieHeader, unitId),
      fetchCurrentUser(cookieHeader),
    ]);

  if (detailStatus === 401 || workspaceStatus === 401 || bomStatus === 401) {
    redirect("/login");
  }

  if (detailStatus === 403 || workspaceStatus === 403 || bomStatus === 403) {
    redirect("/forbidden");
  }

  if (!detailPayload || !workspacePayload) {
    return (
      <ModuleUnavailableState
        module="Unit Workspace"
        title="Workspace unit belum bisa dimuat"
        message={`Data untuk unit ${unitId} belum terbaca saat ini. Coba muat ulang beberapa saat lagi.`}
        backHref="/units"
        backLabel="Kembali ke Unit Board"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return (
    <div className="space-y-6">
      <UnitWorkspaceShell
        unit={detailPayload.data.unit}
        workspace={workspacePayload.data}
        bom={bomPayload?.data ?? null}
        canManagePhotos={Boolean(user?.permissions.includes(permissionCodes.galleryPhotoManage))}
        canDownloadPhotos={Boolean(user?.permissions.includes(permissionCodes.galleryDownload))}
      />
    </div>
  );
}


export default function UnitDetailPage(props: UnitDetailPageProps) {
  return <UnitDetailPageContent {...props} />;
}
