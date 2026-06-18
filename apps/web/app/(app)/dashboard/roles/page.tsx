import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchPermissions,
  fetchRoleReferences,
  fetchRoles,
} from "@/shared/api/roles";
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
        module="Phase 4"
        title="Role matrix belum bisa dimuat"
        message="Data role atau permission belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const roles = rolesPayload.data.roles;
  const activeRoleId = roles[0]?.id ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-app-accent-ink/70">
          Phase 4
        </p>
        <h1 className="mt-3 text-2xl font-light text-foreground">Pengaturan Role</h1>
        <p className="mt-2 text-sm text-foreground/45">
          Atur role, tingkatan approval, lingkup divisi atau unit, dan checklist akses Web serta Mobile dari satu tempat.
        </p>
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
