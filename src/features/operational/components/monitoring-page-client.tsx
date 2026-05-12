"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, RefreshCcw, X } from "lucide-react";

import { DarkCard } from "@/components/ui/dark-card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  getOperationalMonitoringCars,
  type MonitoringCarRow,
} from "@/features/operational/services/monitoring-service";

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatHours(value: number): string {
  return `${value.toFixed(1)} jam`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function daysToDelivery(value: string | null | undefined): number | null {
  if (!value) return null;
  const delivery = new Date(`${value}T00:00:00`);
  if (Number.isNaN(delivery.getTime())) return null;

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((delivery.getTime() - current.getTime()) / 86_400_000);
}

function deliveryLabel(value: string | null | undefined): string {
  const days = daysToDelivery(value);
  if (days == null) return "DL belum diisi";
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "DL hari ini";
  return `${days} hari lagi`;
}

function estimatedWeeksLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1)} minggu`;
}

function projectionText(car: MonitoringCarRow): { safe: boolean; message: string } | null {
  const days = daysToDelivery(car.deliveryDate);
  if (days == null || car.weeklyWorkHours <= 0) return null;
  const estimatedDays = Math.round(car.estimatedWeeks * 7);
  const safe = estimatedDays <= days;
  return {
    safe,
    message: safe
      ? "Estimasi saat ini masih masuk target DL."
      : "Estimasi saat ini melewati DL, perlu tambah kapasitas atau penyesuaian target.",
  };
}

function HeaderMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "danger";
}) {
  const toneClass = {
    default: "border-white/[0.06] bg-white/[0.03] text-white/75",
    accent: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  } satisfies Record<string, string>;

  return (
    <DarkCard className={cn("p-4", toneClass[tone])}>
      <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-light tracking-tight tabular-nums" style={SERIF_STYLE}>
        {value}
      </p>
    </DarkCard>
  );
}

function DetailModal({
  car,
  onClose,
}: {
  car: MonitoringCarRow;
  onClose: () => void;
}) {
  const projection = projectionText(car);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Weekly Report</p>
            <h3 className="mt-2 text-xl font-medium text-white/90" style={SERIF_STYLE}>
              {car.unitName}
            </h3>
            <p className="mt-2 text-sm text-white/45">{car.ownerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/45 transition hover:border-white/20 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-84px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Deadline</p>
              <p className="mt-3 text-lg font-medium text-white/85">{formatDateLabel(car.deliveryDate)}</p>
              <p className="mt-1 text-xs text-white/40">{deliveryLabel(car.deliveryDate)}</p>
            </DarkCard>
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Sisa Jam Total</p>
              <p className="mt-3 text-lg font-medium text-white/85">{formatHours(car.remainingWorkHours)}</p>
            </DarkCard>
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Jam Minggu Ini</p>
              <p className="mt-3 text-lg font-medium text-white/85">{formatHours(car.weeklyWorkHours)}</p>
            </DarkCard>
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Progress Unit</p>
              <p className="mt-3 text-lg font-medium text-amber-200">{formatPercent(car.avgProgressPercentage)}</p>
            </DarkCard>
          </div>

          {projection ? (
            <div
              className={cn(
                "mt-4 rounded-xl border px-4 py-3 text-sm",
                projection.safe
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-100",
              )}
            >
              {projection.message}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white/90">Progress per Divisi</h4>
                <p className="mt-1 text-xs text-white/40">Ringkasan mingguan dan estimasi selesai per divisi.</p>
              </div>
              <a
                href={`/dashboard/countdown?carId=${encodeURIComponent(car.carId)}`}
                className="inline-flex items-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-500/15"
              >
                Buka di Countdown
              </a>
            </div>

            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                  <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Divisi</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Jam Minggu Ini</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Sisa Jam</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Target Total</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Est. Minggu</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {car.divisions.map((division) => {
                  const estimatedWeeks = division.weeklyWorkHours > 0
                    ? division.remainingHours / division.weeklyWorkHours
                    : 0;
                  return (
                    <TableRow key={division.divisionId} className="border-white/[0.06] hover:bg-white/[0.03]">
                      <TableCell className="text-sm text-white/80">{division.divisionName}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-white/70">
                        {formatHours(division.weeklyWorkHours)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-white/70">
                        {formatHours(division.remainingHours)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-white/55">
                        {formatHours(division.totalTargetHours)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-white/55">
                        {estimatedWeeksLabel(estimatedWeeks)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-amber-200">
                        {formatPercent(division.progressPercentage)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-white/[0.06] bg-amber-500/10 hover:bg-amber-500/10">
                  <TableCell className="font-semibold text-amber-100">TOTAL</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-100">
                    {formatHours(car.weeklyWorkHours)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-100">
                    {formatHours(car.remainingWorkHours)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-100">
                    {formatHours(car.divisions.reduce((sum, division) => sum + division.totalTargetHours, 0))}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-100">
                    {estimatedWeeksLabel(car.estimatedWeeks)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-100">
                    {formatPercent(car.avgProgressPercentage)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonitoringPageClient() {
  const user = useAuthStore((state) => state.user);
  const [selectedCar, setSelectedCar] = useState<MonitoringCarRow | null>(null);

  const {
    data: cars = [],
    isLoading,
    mutate,
  } = useSWR(
    user ? ["op-monitoring", user.userId] : null,
    () => getOperationalMonitoringCars(user!.userId),
    { revalidateOnFocus: false },
  );

  const columns = useMemo<DataTableColumn<MonitoringCarRow>[]>(() => [
    {
      key: "unit",
      label: "Unit",
      sortable: true,
      sortValue: (row) => row.unitName,
      render: (row) => (
        <div>
          <p className="text-[12px] font-medium text-white/85">{row.unitName}</p>
          <p className="text-[10px] text-white/35">{row.ownerName}</p>
        </div>
      ),
    },
    {
      key: "delivery",
      label: "Deadline",
      sortable: true,
      sortValue: (row) => daysToDelivery(row.deliveryDate) ?? 99999,
      render: (row) => (
        <div>
          <p className="text-[12px] text-white/80">{formatDateLabel(row.deliveryDate)}</p>
          <p className={cn("text-[10px]", (daysToDelivery(row.deliveryDate) ?? 0) < 0 ? "text-rose-300" : "text-white/35")}>
            {deliveryLabel(row.deliveryDate)}
          </p>
        </div>
      ),
    },
    {
      key: "remaining",
      label: "Sisa Jam",
      align: "right",
      sortable: true,
      sortValue: (row) => row.remainingWorkHours,
      render: (row) => <span className="text-sm tabular-nums text-white/80">{formatHours(row.remainingWorkHours)}</span>,
    },
    {
      key: "weekly",
      label: "Jam Minggu Ini",
      align: "right",
      sortable: true,
      sortValue: (row) => row.weeklyWorkHours,
      render: (row) => <span className="text-sm tabular-nums text-white/70">{formatHours(row.weeklyWorkHours)}</span>,
    },
    {
      key: "estimate",
      label: "Est. Selesai",
      align: "right",
      sortable: true,
      sortValue: (row) => row.estimatedWeeks,
      render: (row) => <span className="text-sm tabular-nums text-white/70">{estimatedWeeksLabel(row.estimatedWeeks)}</span>,
    },
    {
      key: "progress",
      label: "Progress",
      align: "right",
      sortable: true,
      sortValue: (row) => row.avgProgressPercentage,
      render: (row) => <span className="text-sm tabular-nums text-amber-200">{formatPercent(row.avgProgressPercentage)}</span>,
    },
    {
      key: "divisions",
      label: "Divisi",
      render: (row) => (
        <span className="text-[11px] text-white/50">
          {row.divisions.length} divisi
        </span>
      ),
    },
    {
      key: "detail",
      label: "",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedCar(row)}
          className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] text-white/60 transition hover:border-amber-500/30 hover:text-amber-200"
        >
          Detail
        </button>
      ),
    },
  ], []);

  const totalRemainingHours = cars.reduce((sum, car) => sum + car.remainingWorkHours, 0);
  const averageProgress = cars.length > 0
    ? cars.reduce((sum, car) => sum + car.avgProgressPercentage, 0) / cars.length
    : 0;
  const overdueUnits = cars.filter((car) => {
    const days = daysToDelivery(car.deliveryDate);
    return days != null && days < 0;
  }).length;
  const criticalUnits = cars.filter((car) => {
    const days = daysToDelivery(car.deliveryDate);
    return days != null && days >= 0 && days <= 7;
  }).length;

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-light tracking-wide text-white/90" style={SERIF_STYLE}>
            Monitoring Unit
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/30">
            Referensi planning dan progress unit berbasis countdown.
          </p>
        </div>

        <button
          type="button"
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition hover:border-white/[0.14] hover:text-white"
        >
          <RefreshCcw className="h-4 w-4 text-white/45" />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HeaderMetric label="Unit Terlihat" value={String(cars.length)} />
        <HeaderMetric label="Rata-rata Progress" value={formatPercent(averageProgress)} tone="accent" />
        <HeaderMetric label="Overdue" value={String(overdueUnits)} tone={overdueUnits > 0 ? "danger" : "default"} />
        <HeaderMetric label="Sisa Jam Total" value={formatHours(totalRemainingHours)} />
      </div>

      {criticalUnits > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {criticalUnits} unit mendekati deadline dalam 7 hari ke depan.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500/40" />
        </div>
      ) : (
        <DataTable
          data={cars}
          columns={columns}
          rowKey={(row) => row.carId}
          searchable
          searchPlaceholder="Cari unit, owner, atau divisi..."
          searchFn={(row, query) => {
            const haystack = [
              row.unitName,
              row.ownerName,
              ...row.divisions.map((division) => division.divisionName),
            ].join(" ").toLowerCase();
            return haystack.includes(query);
          }}
          emptyMessage="Belum ada data monitoring unit."
        />
      )}

      {selectedCar ? (
        <DetailModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
        />
      ) : null}
    </div>
  );
}
