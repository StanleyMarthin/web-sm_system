import { permissionCodes } from "@smsystem/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UnitWorkspaceShell } from "@/modules/units/components/unit-workspace-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchUnitBom, fetchUnitDetail, fetchUnitPanels, fetchUnitWorkspace } from "@/shared/api/units";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

const unitCatalogPermissions = new Set<string>([
  permissionCodes.unitCatalogView,
  permissionCodes.unitCatalogSurvey,
  permissionCodes.unitCatalogManage,
  permissionCodes.unitCatalogCreateJobdesc,
]);

interface UnitDetailPageProps {
  params: Promise<{ unitId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function resolveSingleSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.[0] ?? null;
}

async function UnitDetailPageContent({ params, searchParams }: UnitDetailPageProps) {
  const { unitId } = await params;
  const resolvedSearchParams = await searchParams;
  const activeTab = resolveSingleSearchParam(resolvedSearchParams?.tab);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [
    { payload: detailPayload, status: detailStatus },
    { payload: workspacePayload, status: workspaceStatus },
    { payload: bomPayload, status: bomStatus },
    { payload: masterPanelPayload, status: masterPanelStatus },
    { user },
  ] =
    await Promise.all([
      fetchUnitDetail(cookieHeader, unitId),
      fetchUnitWorkspace(cookieHeader, unitId),
      fetchUnitBom(cookieHeader, unitId),
      activeTab === "master-panel"
        ? fetchUnitPanels(cookieHeader, unitId)
        : Promise.resolve({ payload: null, status: 200 }),
      fetchCurrentUser(cookieHeader),
    ]);

  if (detailStatus === 401 || workspaceStatus === 401 || bomStatus === 401 || masterPanelStatus === 401) {
    redirect("/login");
  }

  if (detailStatus === 403 || workspaceStatus === 403 || bomStatus === 403 || masterPanelStatus === 403) {
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
        masterPanels={masterPanelPayload?.data ?? null}
        canManagePhotos={Boolean(user?.permissions.includes(permissionCodes.galleryPhotoManage))}
        canDownloadPhotos={Boolean(user?.permissions.includes(permissionCodes.galleryDownload))}
        canManagePanels={Boolean(user?.permissions.includes(permissionCodes.unitPanelManage))}
        canManageCatalog={Boolean(user?.permissions.includes(permissionCodes.unitCatalogManage))}
        canUseCatalog={Boolean(
          user?.permissions.some((permission) => unitCatalogPermissions.has(permission)),
        )}
      />
    </div>
  );
}


export default function UnitDetailPage(props: UnitDetailPageProps) {
  return <UnitDetailPageContent {...props} />;
}
