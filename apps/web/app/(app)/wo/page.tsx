import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchWoGrid,
  fetchWoUrgent,
} from "@/shared/api/wo";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const WoListShell = dynamic(
  () => import("@/modules/wo/components/wo-list-shell").then((mod) => mod.WoListShell),
  {
    loading: () => <PageDataSkeleton title="Memuat work order" />,
  },
);

interface WoPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function WoPageContent({ searchParams }: WoPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { payload: urgentPayload }, { user }] = await Promise.all([
    fetchWoGrid(cookieHeader, resolvedSearchParams),
    fetchWoUrgent(cookieHeader),
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
        title="Daftar work order belum bisa dimuat"
        message="Data WO atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <WoListShell
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      urgentRows={urgentPayload ?? []}
      canCreate={user.permissions.includes(permissionCodes.woCreate)}
    />
  );
}


export default function WoPage(props: WoPageProps) {
  return <WoPageContent {...props} />;
}
