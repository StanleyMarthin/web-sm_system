import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchIssueGrid,
  fetchUrgentIssues,
} from "@/shared/api/issues";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const IssuesShell = dynamic(
  () => import("@/modules/issues/components/issues-shell").then((mod) => mod.IssuesShell),
  {
    loading: () => <PageDataSkeleton title="Memuat issue log" />,
  },
);

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function IssuesPageContent({ searchParams }: IssuesPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, urgentResponse, { user }] = await Promise.all([
    fetchIssueGrid(cookieHeader, resolvedSearchParams),
    fetchUrgentIssues(cookieHeader),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user || payload.storageReady === false) {
    return (
      <ModuleUnavailableState
        module="Issue"
        title="Daftar issue belum bisa dimuat"
        message={
          payload?.storageReady === false
            ? "Pencatatan issue belum disiapkan di server ini, jadi daftar issue belum bisa dipakai."
            : "Data issue atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        }
      />
    );
  }

  return (
    <IssuesShell
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      references={payload.references}
      summary={payload.summary}
      urgentRows={urgentResponse.payload ?? []}
      canCreate={user.permissions.includes(permissionCodes.qcSubmit)}
    />
  );
}


export default function IssuesPage(props: IssuesPageProps) {
  return <IssuesPageContent {...props} />;
}
