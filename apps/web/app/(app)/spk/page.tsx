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

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
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
      <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-app-accent-ink/70">SPK</p>
        <h1 className="mt-3 text-2xl font-light text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-foreground/45">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-foreground/65 hover:text-foreground"
          >
            Ke Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary"
          >
            Ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function SpkPage({ searchParams }: SpkPageProps) {
  const resolvedSearchParams = await searchParams;
  if (typeof resolvedSearchParams.date !== "string" || !resolvedSearchParams.date.trim()) {
    redirect(`/spk?date=${getTodayIsoDate()}`);
  }
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
