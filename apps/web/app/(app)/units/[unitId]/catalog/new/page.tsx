import { permissionCodes } from "@smsystem/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UnitCatalogCreatePage } from "@/modules/units/components/unit-catalog-create-page";
import { fetchUnitDetail } from "@/shared/api/units/units";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface UnitCatalogNewPageProps {
  params: Promise<{ unitId: string }>;
}

async function UnitCatalogNewPageContent({ params }: UnitCatalogNewPageProps) {
  const { unitId } = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchUnitDetail(cookieHeader, unitId),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || !user) {
    redirect("/login");
  }

  if (status === 403 || !user.permissions.includes(permissionCodes.unitCatalogManage)) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Catalog Unit"
        title="Catalog unit belum bisa dimuat"
        message={`Data untuk unit ${unitId} belum terbaca saat ini. Coba muat ulang beberapa saat lagi.`}
        backHref={`/units/${encodeURIComponent(unitId)}?tab=catalog`}
        backLabel="Kembali ke Catalog"
      />
    );
  }

  return (
    <UnitCatalogCreatePage
      unitId={payload.data.unit.unitId}
      unitName={payload.data.unit.unitName}
    />
  );
}

export default function UnitCatalogNewPage(props: UnitCatalogNewPageProps) {
  return <UnitCatalogNewPageContent {...props} />;
}
