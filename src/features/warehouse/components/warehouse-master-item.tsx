"use client";

// ============================================================
// Warehouse Master Item — Kelola item & alias
// ============================================================

import { useState } from "react";
import useSWR from "swr";
import { getMasterItems } from "@/features/warehouse/services/warehouse-service";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loader2, Search, Tag } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { canOperateWarehouse } from "@/features/warehouse/services/warehouse-access";
import type { WhtMasterItem, WhtItemCategory } from "@/types";

function categoryBadge(cat: WhtItemCategory) {
  const map: Record<WhtItemCategory, string> = {
    TOOLS:      "bg-blue-500/10 text-blue-400",
    BAHAN:      "bg-amber-500/10 text-amber-400",
    SPARE_PART: "bg-purple-500/10 text-purple-400",
    CONSUMABLE: "bg-white/[0.06] text-white/40",
  };
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", map[cat])}>
      {cat.replace("_", " ")}
    </span>
  );
}

const CATEGORY_FILTERS: { label: string; value: WhtItemCategory | "ALL" }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Tools", value: "TOOLS" },
  { label: "Bahan", value: "BAHAN" },
  { label: "Spare Part", value: "SPARE_PART" },
  { label: "Consumable", value: "CONSUMABLE" },
];

const COLUMNS: DataTableColumn<WhtMasterItem>[] = [
  {
    key: "code", label: "Kode SKU",
    render: (r) => (
      <span className="font-mono text-[10px] text-white/30">{r.itemCode ?? "—"}</span>
    ),
  },
  {
    key: "name", label: "Nama Standar / Baku", sortable: true,
    sortValue: (r) => r.itemName,
    render: (r) => (
      <div>
        <p className="text-[12px] text-white/80 font-medium">{r.itemName}</p>
        {r.description && (
          <p className="text-[10px] text-white/25 truncate max-w-[220px]">{r.description}</p>
        )}
      </div>
    ),
    editable: true,
  },
  {
    key: "category", label: "Kategori", sortable: true,
    sortValue: (r) => r.itemCategory,
    render: (r) => categoryBadge(r.itemCategory),
  },
  {
    key: "uom", label: "Satuan (UOM)",
    render: (r) => <span className="text-[11px] text-white/40">{r.uom ?? "—"}</span>,
    editable: true,
  },
  {
    key: "aliases", label: "Dikenal Sebagai (Alias)",
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.aliases.slice(0, 3).map((a) => (
          <span key={a.id} className="flex items-center gap-0.5 text-[9px] bg-white/[0.04] border border-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">
            <Tag className="w-2.5 h-2.5" />
            {a.alias}
          </span>
        ))}
        {r.aliasCount > 3 && (
          <span className="text-[9px] text-white/25">+{r.aliasCount - 3}</span>
        )}
      </div>
    ),
  },
  {
    key: "usage", label: "Total Dipakai", align: "right", sortable: true,
    sortValue: (r) => r.usageCount ?? 0,
    render: (r) => (
      <span className="text-sm text-white/40 tabular-nums">{r.usageCount ?? 0}×</span>
    ),
  },
  {
    key: "status", label: "Status Master",
    render: (r) => (
      <Badge
        className={cn(
          "border-0 text-[10px]",
          r.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-white/30"
        )}
      >
        {r.isActive ? "Aktif" : "Nonaktif"}
      </Badge>
    ),
  },
];

export function WarehouseMasterItem() {
  const [catFilter, setCatFilter] = useState<WhtItemCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error } = useSWR(
    user ? ["wht-master-items", catFilter, search, user.userId] : null,
    () => getMasterItems({
      userId: user!.userId,
      search,
      category: catFilter === "ALL" ? undefined : catFilter,
    }),
    { revalidateOnFocus: false }
  );

  if (!canOperateWarehouse(user?.role)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Master Item
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
          Master Item
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          Pencarian master item aktif berdasarkan nama barang
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] text-white/55">
        API yang aktif saat ini hanya mendukung pencarian item. CRUD master item penuh belum tersedia dari backend web gudang.
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ketik nama item untuk mencari..."
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white/75 outline-none focus:border-amber-500/40"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCatFilter(f.value)}
            className={cn(
              "px-4 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all",
              catFilter === f.value
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
        <p className="text-red-400/70 text-center py-10">Gagal memuat master item.</p>
      ) : !search.trim() ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-12 text-center text-sm text-white/35">
          Mulai ketik nama item untuk menampilkan hasil pencarian master item.
        </div>
      ) : (
        <DataTable
          data={data ?? []}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          searchable
          searchPlaceholder="Cari nama item, kode, alias..."
          searchFn={(r, q) =>
            r.itemName.toLowerCase().includes(q) ||
            (r.itemCode ?? "").toLowerCase().includes(q) ||
            r.aliases.some((a) => a.alias.toLowerCase().includes(q))
          }
          emptyMessage="Tidak ada item yang cocok dengan kata kunci ini."
        />
      )}
    </div>
  );
}
