import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchVendorGrid } from "@/shared/api/vendor";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const VendorListShell = dynamic(
  () =>
    import("@/modules/vendor/components/vendor-list-shell").then(
      (mod) => mod.VendorListShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat work order vendor" />,
  },
);

interface VendorPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function VendorPageContent({ searchParams }: VendorPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchVendorGrid(cookieHeader, resolvedSearchParams),
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
        title="Daftar work order vendor belum bisa dimuat"
        message="Data work order vendor atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <VendorListShell
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      canCreate={user.permissions.includes(permissionCodes.vendorCreate)}
    />
  );
}


export default function VendorPage(props: VendorPageProps) {
  return <VendorPageContent {...props} />;
}
