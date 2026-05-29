import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SpkListShell } from "@/modules/spk/components/spk-list-shell";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchSpkGrid,
} from "@/shared/api/spk";

interface SpkPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function SpkUnavailableState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">SPK</p>
        <h1 className="mt-3 text-2xl font-light text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/45">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-white/65 hover:text-white"
          >
            Ke Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}

async function SpkPageContent({ searchParams }: SpkPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }] = await Promise.all([
    fetchSpkGrid(cookieHeader, resolvedSearchParams),
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
      <SpkUnavailableState
        title="SPK belum bisa dimuat"
        message="Layanan SPK sedang belum siap atau sesi Anda belum terbaca. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <SpkListShell
      rows={payload.data}
      meta={payload.meta}
      state={payload.query}
      summary={payload.summary}
    />
  );
}


export default function SpkPage(props: SpkPageProps) {
  return <SpkPageContent {...props} />;
}
