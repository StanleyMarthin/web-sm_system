"use client";

// ============================================================
// Warehouse Stock Card — Kartu Stok Spare Part
// ============================================================

import { useState, useMemo } from "react";
import useSWR from "swr";
import { getStockCards } from "@/features/warehouse/services/warehouse-service";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loader2, Tag, Image as ImageIcon, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { canOperateWarehouse } from "@/features/warehouse/services/warehouse-access";
import type { WhtStockCard, WhtStockCardStatus } from "@/types";

function stockStatusBadge(status: WhtStockCardStatus) {
  const map: Record<WhtStockCardStatus, { label: string; cls: string }> = {
    IN_STORAGE: { label: "Di Gudang",    cls: "bg-blue-500/10 text-blue-400" },
    RETRIEVED:  { label: "Diambil",      cls: "bg-amber-500/10 text-amber-400" },
    INSTALLED:  { label: "Terpasang",    cls: "bg-emerald-500/10 text-emerald-400" },
    LOST:       { label: "Hilang/Rusak", cls: "bg-red-500/10 text-red-400" },
  };
  const { label, cls } = map[status];
  return <Badge className={`${cls} border-0 text-[10px]`}>{label}</Badge>;
}

const STATUS_FILTERS: { label: string; value: WhtStockCardStatus | "ALL" }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Di Gudang", value: "IN_STORAGE" },
  { label: "Diambil", value: "RETRIEVED" },
  { label: "Terpasang", value: "INSTALLED" },
  { label: "Hilang", value: "LOST" },
];

export function WarehouseStockCard() {
  const [statusFilter, setStatusFilter] = useState<WhtStockCardStatus | "ALL">("ALL");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const COLUMNS = useMemo<DataTableColumn<WhtStockCard>[]>(() => [
    {
      key: "entry", label: "No. Urut",
      render: (r) => <span className="text-[10px] text-white/25 tabular-nums">#{r.entryNo}</span>,
    },
    {
      key: "photo", label: "Foto", align: "center",
      render: (r) => (
        <div 
          className={cn(
            "w-7 h-7 mx-auto rounded overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center transition-colors",
            r.photoUrls && r.photoUrls.length > 0 ? "cursor-pointer hover:border-amber-500/50" : ""
          )}
          onDoubleClick={() => {
            if (r.photoUrls && r.photoUrls.length > 0) {
              setPreviewImage(r.photoUrls[0]);
            }
          }}
          title={r.photoUrls && r.photoUrls.length > 0 ? "Klik ganda untuk memperbesar" : ""}
        >
          {r.photoUrls && r.photoUrls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photoUrls[0]} alt="Thumb" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-white/20" />
          )}
        </div>
      ),
    },
    {
      key: "part", label: "Nama Spare Part", sortable: true,
      sortValue: (r) => r.partName,
      render: (r) => (
        <div>
          <p className="text-[12px] text-white/80 font-medium">{r.partName}</p>
          <p className="text-[10px] text-white/30 font-mono">{r.partCode ?? "—"}</p>
        </div>
      ),
      editable: true,
    },
    {
      key: "condition", label: "Kondisi Part",
      render: (r) => (
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full",
          r.conditionType === "BARU" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-white/40"
        )}>
          {r.conditionType}
        </span>
      ),
    },
    {
      key: "unit_section", label: "Unit & Bagian", sortable: true,
      sortValue: (r) => r.carName,
      render: (r) => (
        <div>
          <p className="text-[11px] text-white/50">{r.carName}</p>
          <p className="text-[10px] text-white/30">{r.panelSection ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "qty", label: "Kuantitas", align: "right",
      render: (r) => (
        <span className="text-sm text-white/60 tabular-nums">{r.qty} {r.uom ?? ""}</span>
      ),
      editable: true,
    },
    {
      key: "location", label: "Posisi Simpan",
      render: (r) => (
        <span className="text-[10px] font-mono text-white/40">{r.locationLabel ?? "—"}</span>
      ),
      editable: true,
    },
    {
      key: "dateIn", label: "Tgl. Masuk", sortable: true,
      sortValue: (r) => r.dateIn,
      render: (r) => <span className="text-[11px] text-white/40 tabular-nums">{r.dateIn}</span>,
    },
    {
      key: "status", label: "Status", sortable: true,
      sortValue: (r) => r.status,
      render: (r) => stockStatusBadge(r.status),
    },
    {
      key: "labeled", label: "",
      render: (r) =>
        r.isLabeled ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400/60">
            <Tag className="w-3 h-3" />
            Label
          </span>
        ) : null,
    },
  ], []);

  const { data, isLoading, error } = useSWR(
    user ? ["wht-stock-card", statusFilter, user.userId] : null,
    () => getStockCards({
      userId: user!.userId,
      status: statusFilter === "ALL" ? undefined : statusFilter
    }),
    { revalidateOnFocus: false }
  );

  if (!canOperateWarehouse(user?.role)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Stock Card
        </h2>
        <p className="mt-3 text-sm text-white/45">
          Halaman ini hanya dipakai petugas gudang dan admin sistem/MIS.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Stock Card
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          Monitoring kartu stok spare part per unit
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] text-white/55">
        Data stock card sudah bisa dipantau dari web. Input manual dan edit stock card penuh masih menunggu endpoint admin khusus.
      </div>

      {/* Filter Bar */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-4 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all",
              statusFilter === f.value
                ? "bg-amber-500/15 text-amber-400"
                : "text-white/30 hover:text-white/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500/40" />
        </div>
      ) : error ? (
        <p className="text-red-400/70 text-center py-10">Gagal memuat stock card.</p>
      ) : (
        <DataTable
          data={data ?? []}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          searchable
          searchPlaceholder="Cari nama part, kode, unit..."
          searchFn={(r, q) =>
            r.partName.toLowerCase().includes(q) ||
            r.carName.toLowerCase().includes(q) ||
            (r.partCode ?? "").toLowerCase().includes(q)
          }
          emptyMessage="Tidak ada stock card."
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-white/[0.08] shadow-2xl" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
