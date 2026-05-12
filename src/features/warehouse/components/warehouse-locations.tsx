"use client";

// ============================================================
// Warehouse Lokasi Rak — Manajemen lokasi penyimpanan
// ============================================================

import { useState } from "react";
import useSWR from "swr";
import { getLocations } from "@/features/warehouse/services/warehouse-service";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, Warehouse, Wrench, Truck } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { canOperateWarehouse } from "@/features/warehouse/services/warehouse-access";
import type { WhtLocation, WhtLocationType } from "@/types";

const TYPE_FILTERS: { label: string; value: WhtLocationType | "ALL"; icon: React.ReactNode }[] = [
  { label: "Semua", value: "ALL", icon: null },
  { label: "Gudang", value: "GUDANG", icon: <Warehouse className="w-3 h-3" /> },
  { label: "Workshop", value: "WORKSHOP", icon: <Wrench className="w-3 h-3" /> },
  { label: "Unit", value: "UNIT", icon: <Truck className="w-3 h-3" /> },
];

function typeIcon(type: WhtLocationType) {
  const map = {
    GUDANG:   <Warehouse className="w-4 h-4 text-amber-500/40" />,
    WORKSHOP: <Wrench className="w-4 h-4 text-blue-500/40" />,
    UNIT:     <Truck className="w-4 h-4 text-emerald-500/40" />,
  };
  return map[type];
}

function typeColor(type: WhtLocationType) {
  return {
    GUDANG:   "border-amber-500/20 bg-amber-500/5",
    WORKSHOP: "border-blue-500/20 bg-blue-500/5",
    UNIT:     "border-emerald-500/20 bg-emerald-500/5",
  }[type];
}

function LocationCard({ loc }: { loc: WhtLocation }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-3 transition-all",
        typeColor(loc.locationType),
        !loc.isActive && "opacity-40"
      )}
    >
      <div className="flex items-center justify-between">
        {typeIcon(loc.locationType)}
        <span className={cn(
          "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
          loc.isActive ? "text-emerald-400 bg-emerald-500/10" : "text-white/25 bg-white/[0.04]"
        )}>
          {loc.isActive ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      <div>
        <p className="text-[13px] text-white/80 font-medium font-mono">{loc.label}</p>
        <div className="flex gap-2 mt-1 text-[10px] text-white/30">
          {loc.zone && <span>Zone {loc.zone}</span>}
          {loc.rack && <span>Rak {loc.rack}</span>}
          {loc.shelf && <span>Rak {loc.shelf}</span>}
          {!loc.zone && !loc.rack && (
            <span className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {loc.locationType}
            </span>
          )}
        </div>
      </div>

      {loc.stockCount !== undefined && (
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Stok</p>
          <p className="text-sm text-white/60 tabular-nums font-medium">{loc.stockCount}</p>
        </div>
      )}
    </div>
  );
}

export function WarehouseLocations() {
  const [typeFilter, setTypeFilter] = useState<WhtLocationType | "ALL">("ALL");
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error } = useSWR(
    user ? ["wht-locations", typeFilter, user.userId] : null,
    () => getLocations({
      type: typeFilter === "ALL" ? undefined : typeFilter
    }),
    { revalidateOnFocus: false }
  );

  const totalStock = data?.reduce((sum, l) => sum + (l.stockCount ?? 0), 0) ?? 0;

  if (!canOperateWarehouse(user?.role)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Lokasi Rak
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
          Lokasi Rak
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {data?.length ?? 0} lokasi · {totalStock} item total
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] text-white/55">
        Data lokasi rak sudah bisa dipakai untuk proses gudang. Penambahan dan edit lokasi penuh masih menunggu endpoint admin.
      </div>

      {/* Type Filter */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all",
              typeFilter === f.value
                ? "bg-amber-500/15 text-amber-400"
                : "text-white/30 hover:text-white/50"
            )}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500/40" />
        </div>
      ) : error ? (
        <p className="text-red-400/70 text-center py-10">Gagal memuat lokasi.</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {(data ?? []).map((loc) => (
            <LocationCard key={loc.id} loc={loc} />
          ))}
        </div>
      )}
    </div>
  );
}
