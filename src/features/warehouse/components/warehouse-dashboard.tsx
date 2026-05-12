"use client";

import useSWR from "swr";
import { AlertTriangle, Archive, ClipboardCheck, Loader2, PackageCheck, Truck } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getWarehouseDashboard } from "@/features/warehouse/services/warehouse-service";
import { isWarehouseApproverOnly } from "@/features/warehouse/services/warehouse-access";
import type { WhtApprovalStatus, WhtTransaction } from "@/types";

function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  tone = "default",
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "default" | "alert" | "accent";
}) {
  const toneClass =
    tone === "alert"
      ? "border-red-500/25 bg-red-500/8"
      : tone === "accent"
        ? "border-amber-500/25 bg-amber-500/8"
        : "border-white/[0.08] bg-white/[0.02]";

  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{title}</p>
        <span className="text-white/45">{icon}</span>
      </div>
      <p className="mt-4 text-4xl font-light text-white/90 tabular-nums tracking-tight" style={SERIF_STYLE}>
        {value}
      </p>
      <p className="mt-2 text-[11px] text-white/35">{subtitle}</p>
    </div>
  );
}

function approvalBadge(status: WhtApprovalStatus) {
  const labelMap: Record<WhtApprovalStatus, string> = {
    PENDING_KD: "Menunggu KD",
    PENDING_KEPALA_GUDANG: "Menunggu Kepala Gudang",
    PENDING_PPIC: "Menunggu PPIC",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  const toneMap: Record<WhtApprovalStatus, string> = {
    PENDING_KD: "bg-amber-500/10 text-amber-400",
    PENDING_KEPALA_GUDANG: "bg-orange-500/10 text-orange-400",
    PENDING_PPIC: "bg-violet-500/10 text-violet-400",
    APPROVED: "bg-emerald-500/10 text-emerald-400",
    REJECTED: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${toneMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function RecentRow({ item }: { item: WhtTransaction }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-white/85 font-medium truncate">{item.itemName}</p>
        <p className="mt-1 text-[11px] text-white/45">
          {item.requester} · {item.division}
          {item.unitName ? ` · ${item.unitName}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {approvalBadge(item.approvalStatus)}
        <p className="mt-2 text-[10px] text-white/35">{formatDate(item.requestDate)}</p>
      </div>
    </div>
  );
}

export function WarehouseDashboard() {
  const user = useAuthStore((state) => state.user);
  const approverOnly = isWarehouseApproverOnly(user?.role);

  const { data, isLoading, error } = useSWR(
    user ? ["warehouse-dashboard", user.userId] : null,
    () => getWarehouseDashboard({ userId: user!.userId }),
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500/50" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="py-16 text-center text-sm text-red-400/70">Gagal memuat dashboard gudang.</p>;
  }

  const stageSummary = [
    { label: "Menunggu KD", value: data.summary.pendingKd },
    { label: "Menunggu Kepala Gudang", value: data.summary.pendingKepalaGudang },
    { label: "Menunggu PPIC", value: data.summary.pendingPpic },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Dashboard Gudang
        </h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
          Ringkasan operasional dan persetujuan gudang
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <DashboardCard
          title="Menunggu Persetujuan"
          value={data.summary.pendingApproval}
          subtitle="Request belum final approval"
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="accent"
        />
        <DashboardCard
          title={approverOnly ? "Tahap Saya" : "Siap Diambil"}
          value={
            approverOnly
              ? user?.role === "kepala_gudang"
                ? data.summary.pendingKepalaGudang
                : user?.role === "ppic" || user?.role === "ppc" || user?.role === "manager_gudang"
                  ? data.summary.pendingPpic
                  : data.summary.pendingKd
              : data.summary.readyToPickup
          }
          subtitle={
            approverOnly
              ? "Item yang menunggu aksi sesuai peran Anda"
              : "Barang sudah siap diserahkan ke lapangan"
          }
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <DashboardCard
          title={approverOnly ? "Total Aktivitas" : "Di Lapangan"}
          value={approverOnly ? data.recentTransactions.length : data.summary.releasedInField}
          subtitle={
            approverOnly
              ? "Data terbaru yang Anda bisa pantau"
              : "Barang sedang dibawa / dipakai di lapangan"
          }
          icon={<Truck className="h-4 w-4" />}
        />
        <DashboardCard
          title={approverOnly ? "Overdue" : "Tersimpan"}
          value={approverOnly ? data.summary.overdueReturn : data.summary.storedToday}
          subtitle={
            approverOnly
              ? "Barang lapangan yang lewat batas pengembalian"
              : "Transaksi sudah kembali atau masuk gudang"
          }
          icon={approverOnly ? <AlertTriangle className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          tone={data.summary.overdueReturn > 0 ? "alert" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 space-y-6">
          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white/85">
                  {approverOnly ? "Perlu Persetujuan" : "Aktivitas Terbaru"}
                </h3>
                <p className="mt-1 text-[11px] text-white/35">
                  {approverOnly
                    ? "Daftar request yang masuk ke scope approval Anda."
                    : "10 transaksi terakhir dari modul gudang."}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                {approverOnly ? data.summary.pendingApproval : data.recentTransactions.length} item
              </span>
            </div>

            <div className="space-y-3">
              {(approverOnly ? data.recentTransactions.filter((item) => item.approvalStatus.startsWith("PENDING_")) : data.recentTransactions)
                .slice(0, 10)
                .map((item) => (
                  <RecentRow key={item.id} item={item} />
                ))}
              {((approverOnly ? data.recentTransactions.filter((item) => item.approvalStatus.startsWith("PENDING_")) : data.recentTransactions).length === 0) && (
                <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-white/35">
                  Tidak ada aktivitas yang perlu ditampilkan.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white/85">Overdue Pengembalian</h3>
              <p className="mt-1 text-[11px] text-white/35">
                Barang yang masih berstatus di lapangan dan sudah melewati target pengembalian.
              </p>
            </div>

            {data.overdueItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-white/35">
                Tidak ada overdue saat ini.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <table className="w-full text-left">
                  <thead className="border-b border-white/[0.06] bg-white/[0.03]">
                    <tr>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/35">Barang</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/35">Peminta</th>
                      <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/35">Terlambat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdueItems.map((item) => (
                      <tr key={item.id} className="border-b border-white/[0.05] last:border-b-0">
                        <td className="px-4 py-3 text-sm text-white/80">{item.itemName}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-white/65">{item.requester}</p>
                          <p className="text-[10px] text-white/30">{item.division}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-red-400">
                          +{item.daysOverdue} hari
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white/85">Distribusi Tahap Approval</h3>
              <p className="mt-1 text-[11px] text-white/35">
                Jumlah request aktif di setiap tahap persetujuan.
              </p>
            </div>

            <div className="space-y-3">
              {stageSummary.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-white/60">{item.label}</span>
                    <span className="tabular-nums text-white/85">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05]">
                    <div
                      className="h-2 rounded-full bg-amber-500/60"
                      style={{
                        width: `${data.summary.pendingApproval === 0 ? 0 : (item.value / data.summary.pendingApproval) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white/85">Permintaan per Divisi</h3>
              <p className="mt-1 text-[11px] text-white/35">
                Divisi dengan request pending terbanyak pada scope yang Anda lihat.
              </p>
            </div>

            {data.pendingByDivision.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-white/35">
                Tidak ada pending aktif.
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingByDivision.map((item) => (
                  <div key={`${item.divisionId}-${item.divisionName}`} className="rounded-lg border border-white/[0.06] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/75">{item.divisionName}</p>
                      <p className="text-sm tabular-nums text-white/90">{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
