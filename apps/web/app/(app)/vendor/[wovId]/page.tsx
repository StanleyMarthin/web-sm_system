import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { VendorDetailShell } from "@/modules/vendor/components/vendor-detail-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchVendorDetail } from "@/shared/api/vendor";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface VendorDetailPageProps {
  params: Promise<{
    wovId: string;
  }>;
}

async function VendorDetailPageContent({ params }: VendorDetailPageProps) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchVendorDetail(cookieHeader, resolvedParams.wovId),
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
        module="WOV"
        title="Detail work order vendor belum bisa dimuat"
        message={`Data WOV ${resolvedParams.wovId} atau sesi aktif belum terbaca saat ini.`}
        backHref="/vendor"
        backLabel="Kembali ke Daftar WOV"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return (
    <VendorDetailShell
      ticket={payload.data.ticket}
      canApprove={user.permissions.includes(permissionCodes.vendorApprove)}
      canUpdateStatus={user.permissions.includes(permissionCodes.vendorUpdateStatus)}
      canReceive={user.permissions.includes(permissionCodes.vendorReceive)}
    />
  );
}


export default function VendorDetailPage(props: VendorDetailPageProps) {
  return <VendorDetailPageContent {...props} />;
}
