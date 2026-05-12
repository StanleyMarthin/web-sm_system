"use client";
import useSWR from "swr";
import { Archive, Download, Loader2, PackageCheck, ShieldAlert, Truck } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { canViewWarehouseReports } from "@/features/warehouse/services/warehouse-access";
import { getStockCards, getTransactions } from "@/features/warehouse/services/warehouse-service";
import type { WhtStockCard, WhtTransaction } from "@/types";

function exportRows(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{title}</p>
        <span className="text-white/40">{icon}</span>
      </div>
      <p className="mt-4 text-4xl font-light text-white/90 tabular-nums" style={SERIF_STYLE}>
        {value}
      </p>
      <p className="mt-2 text-[11px] text-white/35">{subtitle}</p>
    </div>
  );
}

export function WarehouseReports() {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error } = useSWR(
    user && canViewWarehouseReports(user.role) ? ["warehouse-reports", user.userId] : null,
    async () => {
      const [transactions, stockCards] = await Promise.all([
        getTransactions({ userId: user!.userId, limit: 400 }),
        getStockCards({ userId: user!.userId }),
      ]);
      return { transactions, stockCards };
    },
    { revalidateOnFocus: false },
  );

  if (!canViewWarehouseReports(user?.role)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Laporan Gudang
        </h2>
        <p className="mt-3 text-sm text-white/45">
          Halaman laporan hanya tersedia untuk admin sistem dan MIS.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500/50" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="py-16 text-center text-sm text-red-400/70">Gagal memuat laporan gudang.</p>;
  }

  const { transactions, stockCards } = data;
  const overdue = transactions.filter((item) => (item.daysOverdue ?? 0) > 0);
  const ready = transactions.filter((item) => item.itemStatus === "READY");
  const released = transactions.filter((item) => item.itemStatus === "RELEASED");
  const stored = transactions.filter((item) => item.itemStatus === "STORED");

  const byCategory = transactions.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.itemCategory] = (accumulator[item.itemCategory] ?? 0) + 1;
    return accumulator;
  }, {});

  function exportTransactions() {
    exportRows(
      "warehouse-transactions-report",
      ["No Ref", "Barang", "Kategori", "Peminta", "Divisi", "Approval", "Status", "Tanggal Request", "Deadline"],
      transactions.map((item) => [
        item.id,
        item.itemName,
        item.itemCategory,
        item.requester,
        item.division,
        item.approvalStatus,
        item.itemStatus,
        item.requestDate,
        item.deadlineDate ?? "",
      ]),
    );
  }

  function exportOverdue() {
    exportRows(
      "warehouse-overdue-report",
      ["No Ref", "Barang", "Peminta", "Divisi", "Unit", "Deadline", "Hari Overdue"],
      overdue.map((item) => [
        item.id,
        item.itemName,
        item.requester,
        item.division,
        item.unitName ?? "",
        item.deadlineDate ?? "",
        String(item.daysOverdue ?? 0),
      ]),
    );
  }

  function exportStockCards() {
    exportRows(
      "warehouse-stock-card-report",
      ["Entry", "Part", "Kode", "Unit", "Lokasi", "Qty", "Status", "Tanggal Masuk"],
      stockCards.map((item: WhtStockCard) => [
        String(item.entryNo),
        item.partName,
        item.partCode ?? "",
        item.carName,
        item.locationLabel ?? item.locationDetail ?? "",
        String(item.qty),
        item.status,
        item.dateIn,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
            Laporan Gudang
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
            Ringkasan transaksi dan stok dari API gudang aktif
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportTransactions}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 transition-colors hover:text-white/85"
          >
            <Download className="h-3.5 w-3.5" />
            Export Transaksi
          </button>
          <button
            onClick={exportOverdue}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400 transition-colors hover:bg-red-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export Overdue
          </button>
          <button
            onClick={exportStockCards}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export Stock Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Ready" value={ready.length} subtitle="Menunggu diserahkan ke lapangan" icon={<PackageCheck className="h-4 w-4" />} />
        <SummaryCard title="Di Lapangan" value={released.length} subtitle="Barang masih dibawa atau dipakai" icon={<Truck className="h-4 w-4" />} />
        <SummaryCard title="Overdue" value={overdue.length} subtitle="Perlu tindak lanjut pengembalian" icon={<ShieldAlert className="h-4 w-4" />} />
        <SummaryCard title="Tersimpan" value={stored.length} subtitle="Sudah tercatat masuk atau kembali" icon={<Archive className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 xl:col-span-5">
          <h3 className="text-sm font-medium text-white/85">Distribusi Kategori</h3>
          <p className="mt-1 text-[11px] text-white/35">Sebaran transaksi berdasarkan kategori barang.</p>
          <div className="mt-4 space-y-3">
            {Object.entries(byCategory).map(([category, total]) => (
              <div key={category} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3">
                <p className="text-sm text-white/70">{category.replace("_", " ")}</p>
                <p className="text-sm tabular-nums text-white/90">{total}</p>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && (
              <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-white/35">
                Belum ada data kategori.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 xl:col-span-7">
          <h3 className="text-sm font-medium text-white/85">Daftar Overdue</h3>
          <p className="mt-1 text-[11px] text-white/35">Prioritas penagihan atau pengembalian barang dari lapangan.</p>

          {overdue.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-white/35">
              Tidak ada overdue saat ini.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-left">
                <thead className="border-b border-white/[0.06] bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/35">Barang</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/35">Peminta</th>
                    <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/35">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((item: WhtTransaction) => (
                    <tr key={item.id} className="border-b border-white/[0.05] last:border-b-0">
                      <td className="px-4 py-3 text-sm text-white/80">{item.itemName}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white/65">{item.requester}</p>
                        <p className="text-[10px] text-white/30">{item.division}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-red-400">+{item.daysOverdue ?? 0} hari</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
