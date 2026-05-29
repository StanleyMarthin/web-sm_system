import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { permissionCodes } from "@smsystem/permissions";
import { SpkDetailShell } from "@/modules/spk/components/spk-detail-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchSpkDetail } from "@/shared/api/spk";

interface SpkDetailPageProps {
  params: Promise<{
    spkId: string;
  }>;
}

function SpkUnavailableState({
  spkId,
}: {
  spkId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">SPK</p>
        <h1 className="mt-3 text-2xl font-light text-white">Detail SPK belum bisa dimuat</h1>
        <p className="mt-2 text-sm text-white/45">
          Data untuk nomor <span className="text-white/75">{spkId}</span> belum bisa dibaca saat
          ini. Coba muat ulang beberapa saat lagi.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/spk"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-white/65 hover:text-white"
          >
            Kembali ke Daftar
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

async function SpkDetailPageContent({ params }: SpkDetailPageProps) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchSpkDetail(cookieHeader, resolvedParams.spkId),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user) {
    return <SpkUnavailableState spkId={resolvedParams.spkId} />;
  }

  const approvalRank = user.roleProfile?.approvalRank ?? 0;
  const hasPlannerAccess = user.permissions.includes(permissionCodes.updatePlan);

  return (
    <SpkDetailShell
      header={payload.data.header}
      details={payload.data.details}
      canStart={hasPlannerAccess && approvalRank >= 1}
      canEditBreakdown={hasPlannerAccess && approvalRank >= 3}
    />
  );
}


export default function SpkDetailPage(props: SpkDetailPageProps) {
  return <SpkDetailPageContent {...props} />;
}
