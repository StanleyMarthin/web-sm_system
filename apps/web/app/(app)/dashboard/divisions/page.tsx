import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchDivisionManagement } from "@/shared/api/divisions";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const DivisionManagementShell = dynamic(
  () =>
    import("@/modules/divisions/components/division-management-shell").then(
      (mod) => mod.DivisionManagementShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat divisi management" />,
  },
);

async function DivisionsPageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchDivisionManagement(cookieHeader);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="User Management"
        title="Divisi management belum bisa dimuat"
        message="Data divisi belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const divisions = payload.data.divisions;

  return (
    <div className="space-y-4">
      <div className="border border-white/5 bg-card px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">
          User Management
        </p>
        <h1 className="mt-0.5 text-[14px] font-mono text-foreground">Divisi Management</h1>
        <p className="mt-1 text-[11px] text-foreground/40">
          Kelola ringkasan divisi, master jobdesc per divisi, dan jobdesc umum.
        </p>
      </div>

      <DivisionManagementShell
        divisions={divisions}
        generalJobTypes={payload.data.generalJobTypes}
      />
    </div>
  );
}

export default function DivisionsPage() {
  return <DivisionsPageContent />;
}
