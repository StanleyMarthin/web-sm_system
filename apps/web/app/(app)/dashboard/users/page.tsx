import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchUserGrid } from "@/shared/api/users/users";
import { fetchCurrentUser } from "@/shared/auth/server";
import { canViewUserRoles } from "@/modules/users/user-visibility";
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
  const [{ user, status: userStatus }, { payload, status }] = await Promise.all([
    fetchCurrentUser(cookieHeader),
    fetchUserGrid(cookieHeader, {
      ...resolvedSearchParams,
      limit: "100",
      page: "1",
    }),
  ]);

  if (userStatus === 401 || status === 401 || !user) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Pengguna"
        title="User management belum bisa dimuat"
        message="Data pengguna belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const remainingPages = await Promise.all(
    Array.from({ length: payload.meta.totalPages - 1 }, (_, index) =>
      fetchUserGrid(cookieHeader, { ...resolvedSearchParams, limit: "100", page: String(index + 2) }),
    ),
  );
  if (remainingPages.some((page) => !page.payload)) {
    return <ModuleUnavailableState module="Pengguna" title="User management belum bisa dimuat" message="Data pengguna belum terbaca seluruhnya. Coba muat ulang beberapa saat lagi." />;
  }

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
        rows={[...payload.data, ...remainingPages.flatMap((page) => page.payload?.data ?? [])]}
        references={payload.references}
        showRoleColumn={canViewUserRoles(user.roleName)}
      />
    </div>
  );
}


export default function UsersPage(props: UsersPageProps) {
  return <UsersPageContent {...props} />;
}
