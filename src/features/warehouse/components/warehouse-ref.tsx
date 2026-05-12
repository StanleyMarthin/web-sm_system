"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Building2, Car, Loader2, MapPin, Users } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { canManageWarehouseReference } from "@/features/warehouse/services/warehouse-access";
import { getLocations, getTransactions } from "@/features/warehouse/services/warehouse-service";

function RefCard({
  icon,
  label,
  count,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <span className="text-white/45">{icon}</span>
        <span className="text-3xl font-light text-white/90 tabular-nums" style={SERIF_STYLE}>
          {count}
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-white/80">{label}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">{description}</p>
    </div>
  );
}

export function WarehouseRef() {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error } = useSWR(
    user && canManageWarehouseReference(user.role) ? ["warehouse-ref", user.userId] : null,
    async () => {
      const [transactions, locations] = await Promise.all([
        getTransactions({ userId: user!.userId, limit: 400 }),
        getLocations({ isActive: true }),
      ]);
      return { transactions, locations };
    },
    { revalidateOnFocus: false },
  );

  const stats = useMemo(() => {
    const transactions = data?.transactions ?? [];
    const locations = data?.locations ?? [];
    return {
      units: new Set(transactions.map((item) => item.carId).filter(Boolean)).size,
      divisions: new Set(transactions.map((item) => item.divisionId).filter(Boolean)).size,
      requesters: new Set(transactions.map((item) => item.employeeId).filter(Boolean)).size,
      locations: locations.length,
    };
  }, [data]);

  if (!canManageWarehouseReference(user?.role)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Referensi Gudang
        </h2>
        <p className="mt-3 text-sm text-white/45">
          Halaman referensi hanya dipakai petugas gudang dan admin sistem/MIS.
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
    return <p className="py-16 text-center text-sm text-red-400/70">Gagal memuat referensi gudang.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Referensi Gudang
        </h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
          Ringkasan data referensi yang sudah muncul di transaksi gudang
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] text-white/55">
        API referensi unit, divisi, dan karyawan khusus web belum tersedia. Halaman ini memakai referensi runtime dari data transaksi dan lokasi aktif.
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <RefCard
          icon={<Car className="h-5 w-5" />}
          label="Unit"
          count={stats.units}
          description="Jumlah unit yang sudah muncul pada transaksi gudang."
        />
        <RefCard
          icon={<Building2 className="h-5 w-5" />}
          label="Divisi"
          count={stats.divisions}
          description="Jumlah divisi yang sudah tercatat di data transaksi."
        />
        <RefCard
          icon={<Users className="h-5 w-5" />}
          label="Peminta"
          count={stats.requesters}
          description="Jumlah requester unik yang muncul dalam histori transaksi."
        />
        <RefCard
          icon={<MapPin className="h-5 w-5" />}
          label="Lokasi Aktif"
          count={stats.locations}
          description="Jumlah lokasi rak aktif dari endpoint storage locations."
        />
      </div>
    </div>
  );
}
