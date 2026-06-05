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
      <div className="rounded-md border border-white/5 bg-[#111114] p-6">
        <p className="text-[12px] uppercase tracking-[0.2em] text-amber-500/70">SPK</p>
        <h1 className="mt-3 text-[13px] font-semibold text-white">Detail SPK belum bisa dimuat</h1>
        <p className="mt-2 text-[12px] text-white/40">
          Data untuk nomor <span className="text-white/80">{spkId}</span> belum bisa dibaca saat
          ini. Coba muat ulang beberapa saat lagi.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/spk"
            className="inline-flex items-center gap-2 rounded border border-white/10 px-4 py-2 text-[12px] text-white/80 hover:text-white"
          >
            Kembali ke Daftar
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded bg-amber-500 px-4 py-2 text-[12px] font-semibold text-[#0a0a0c] hover:bg-amber-400"
          >
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function SpkDetailPage({ params }: SpkDetailPageProps) {
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

