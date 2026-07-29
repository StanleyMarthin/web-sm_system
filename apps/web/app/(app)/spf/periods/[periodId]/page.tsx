import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { fetchSpfPeriodDetail } from "@/shared/api/spf";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

// PeriodDetailShell mengimplementasikan UI — diimport langsung karena sudah ada
// breadcrumb dan snapshot tunggal yang dibagi ke summary, items, dan workflow.
// Belum bisa dynamic import karena shell memerlukan typed snapshot dari server.
import { PeriodDetailShell } from "@/modules/spf/components/period-detail-shell";

interface Props {
  params: Promise<{ periodId: string }>;
}

export default async function PeriodDetailPage({ params }: Props) {
  const { periodId } = await params;

  // Validasi ID sebelum menyentuh backend
  const id = Number(periodId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    notFound();
  }

  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");

  const result = await fetchSpfPeriodDetail(cookieHeader, id);

  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (result.status === 404) notFound();

  if (!result.payload) {
    return (
      <ModuleUnavailableState
        module="SPF · Periode"
        title="Detail periode tidak tersedia"
        message="Server tidak dapat diakses atau terjadi kesalahan saat memuat data."
        backHref="/spf/periods"
        backLabel="Kembali ke Daftar Periode"
      />
    );
  }

  // `editable` ditentukan dari status periode — backend tetap menjadi penjaga akhir.
  // Status DRAFT dan REJECTED masih bisa diedit ADMIN.
  const { period, items } = result.payload;
  const editable =
    session.role === "ADMIN" &&
    (period.status === "DRAFT" || period.status === "REJECTED");

  return (
    <PeriodDetailShell
      period={period}
      items={items}
      role={session.role}
      editable={editable}
    />
  );
}
