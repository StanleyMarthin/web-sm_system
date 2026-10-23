import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchPermissions,
  fetchRoleReferences,
  fetchRoles,
} from "@/shared/api/roles/roles";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const RoleMatrixShell = dynamic(
  () =>
    import("@/modules/roles/components/role-matrix-shell").then(
      (mod) => mod.RoleMatrixShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat role matrix" />,
  },
);

async function RolesPageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [
    { user },
    { payload: rolesPayload, status: rolesStatus },
    { payload: permissionsPayload, status: permissionsStatus },
    { payload: referencesPayload, status: referencesStatus },
  ] =
    await Promise.all([
      fetchCurrentUser(cookieHeader),
      fetchRoles(cookieHeader),
      fetchPermissions(cookieHeader),
      fetchRoleReferences(cookieHeader),
    ]);

  if (!user) {
    redirect("/login");
  }

  if (rolesStatus === 403 || permissionsStatus === 403 || referencesStatus === 403) {
    redirect("/forbidden");
  }

  if (!rolesPayload || !permissionsPayload || !referencesPayload) {
    return (
      <ModuleUnavailableState
        module="Role Matrix"
        title="Role matrix belum bisa dimuat"
        message="Data role atau permission belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const roles = rolesPayload.data.roles;
  const activeRoleId = roles[0]?.id ?? 0;

  return (
    <div className="space-y-3">
      <div className="border border-border bg-card px-3 py-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Administrasi</p>
        <h1 className="mt-0.5 text-base font-semibold text-foreground">Role Matrix</h1>
      </div>

      <RoleMatrixShell
        roles={roles}
        permissions={permissionsPayload.data.permissions}
        references={referencesPayload.data}
        activeRoleId={activeRoleId}
        activePermissionIds={[]}
      />
    </div>
  );
}


export default function RolesPage() {
  return <RolesPageContent />;
}
