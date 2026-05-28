import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import {
  buildUserGridQueryString,
  fetchUserGrid,
} from "@/shared/api/users";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const UserManagementShell = dynamic(
  () =>
    import("@/modules/users/components/user-management-shell").then(
      (mod) => mod.UserManagementShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat user management" />,
  },
);

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function UsersPageContent({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchUserGrid(
    cookieHeader,
    resolvedSearchParams,
  );

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Phase 4"
        title="User management belum bisa dimuat"
        message="Data pengguna belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const exportHref = `/api/users/export${
    buildUserGridQueryString(resolvedSearchParams)
      ? `?${buildUserGridQueryString(resolvedSearchParams)}`
      : ""
  }`;

  return (
    <div className="space-y-3">
      <div className="sr-only">
        <h1>Kelola Pengguna</h1>
        <p>
          Kelola akun, role, dan lingkup kerja pengguna sesuai divisi atau unit yang
          memang mereka pegang.
        </p>
      </div>

      <UserManagementShell
        rows={payload.data}
        meta={payload.meta}
        state={payload.query}
        references={payload.references}
        exportHref={exportHref}
      />
    </div>
  );
}


export default function UsersPage(props: UsersPageProps) {
  return <UsersPageContent {...props} />;
}
