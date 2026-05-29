"use client";

import type { PlanRecommendation } from "@smsystem/contracts/calendar";
import Link from "next/link";

interface PlanRecommendationPanelProps {
  recommendation: PlanRecommendation | null;
}

function formatHours(value: number): string {
  return `${value.toFixed(2)} jam`;
}

function trimDayName(dayName: string): string {
  return dayName.slice(0, 3);
}

export function PlanRecommendationPanel({
  recommendation,
}: PlanRecommendationPanelProps) {
  if (!recommendation) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
        <h2 className="text-lg font-light text-white">Saran Distribusi Minggu Ini</h2>
      </section>
    );
  }

  const overtimeScheduleSummary = recommendation.divisions
    .map((division) => {
      const activeDays = division.schedule
        .filter((row) => row.extraHoursRecommended > 0)
        .map((row) => `${trimDayName(row.dayName)} ${row.extraHoursRecommended.toFixed(0)}j`);
      if (activeDays.length === 0) {
        return null;
      }

      return `${division.divisionName}: ${activeDays.join(" • ")}`;
    })
    .filter((row): row is string => Boolean(row));
  const focusUnits = recommendation.units.filter((unit) => unit.recommendedHours > 0).slice(0, 4);
  const totalFocusedUnits = recommendation.units.filter((unit) => unit.recommendedHours > 0).length;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light text-white">Saran kerja minggu ini</h2>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300/70">Fokus utama</p>
          <p className="mt-1">
            {recommendation.summary.bottleneckDivisionName ?? "Belum ada bottleneck minggu ini"}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-3 py-3">Ringkasan</th>
              <th className="px-3 py-3 text-right">Nilai</th>
              <th className="px-3 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Target mingguan</td>
              <td className="px-3 py-3 text-right">{formatHours(recommendation.summary.targetHours)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Jam normal efektif</td>
              <td className="px-3 py-3 text-right">{formatHours(recommendation.summary.effectiveNormalHours)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Tambahan jam minimum</td>
              <td className="px-3 py-3 text-right">{formatHours(recommendation.summary.additionalOvertimeHours)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Jam yang belum tertutup</td>
              <td className="px-3 py-3 text-right">{formatHours(recommendation.summary.uncoveredHours)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm uppercase tracking-[0.14em] text-white/45">
                Unit yang disarankan dikerjakan
              </h3>
            </div>
            <Link
              href="/units"
              className="inline-flex items-center rounded-full border border-white/[0.12] px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              Buka Units
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <tr>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3">Target</th>
                  <th className="px-3 py-3 text-right">Jam dorong</th>
                  <th className="px-3 py-3 text-right">Sisa</th>
                  <th className="px-3 py-3">Divisi fokus</th>
                  <th className="px-3 py-3">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {focusUnits.length > 0 ? (
                  focusUnits.map((unit) => (
                    <tr key={unit.carId} className="border-t border-white/[0.06]">
                      <td className="px-3 py-3">
                        <p className="text-white">{unit.unitName}</p>
                        <p className="mt-1 text-xs text-white/35">
                          {unit.customerName ?? "Customer belum diisi"}
                        </p>
                      </td>
                      <td className="px-3 py-3">{unit.targetDeliveryDate ?? "-"}</td>
                      <td className="px-3 py-3 text-right">{formatHours(unit.recommendedHours)}</td>
                      <td className={`px-3 py-3 text-right ${unit.uncoveredHours > 0 ? "text-rose-200" : "text-emerald-200"}`}>
                        {formatHours(unit.uncoveredHours)}
                      </td>
                      <td className="px-3 py-3">
                        {unit.divisions
                          .filter((division) => division.recommendedHours > 0 || division.isFocus)
                          .map((division) => `${division.divisionName} ${formatHours(division.recommendedHours)}`)
                          .join(" • ") || "-"}
                      </td>
                      <td className="px-3 py-3 text-white/55">{unit.focusReason}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/[0.06]">
                    <td colSpan={6} className="px-3 py-4 text-sm text-white/50">
                      Belum ada unit yang perlu ditonjolkan minggu ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalFocusedUnits > focusUnits.length ? null : null}
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/45">
              Saran per divisi
            </h3>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <tr>
                  <th className="px-3 py-3">Divisi</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Jam dikejar</th>
                  <th className="px-3 py-3 text-right">Jam normal</th>
                  <th className="px-3 py-3 text-right">Jam tambahan siap</th>
                  <th className="px-3 py-3 text-right">Tambahan disarankan</th>
                  <th className="px-3 py-3 text-right">Masih kurang</th>
                  <th className="px-3 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {recommendation.divisions.map((division) => (
                  <tr key={division.divisionId} className="border-t border-white/[0.06]">
                    <td className="px-3 py-3">
                      <p className="text-white">{division.divisionName}</p>
                      <p className="mt-1 text-xs text-white/35">
                        {division.lockedUnitCount > 0
                          ? `${division.lockedUnitCount} unit sedang dipegang`
                          : "Belum ada unit yang sedang dipegang"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                          division.uncoveredHours > 0
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                            : division.additionalOvertimeHours > 0
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        }`}
                      >
                        {division.uncoveredHours > 0
                          ? "Masih kurang"
                          : division.additionalOvertimeHours > 0
                            ? "Perlu jam tambahan"
                            : "Cukup"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">{formatHours(division.targetHours)}</td>
                    <td className="px-3 py-3 text-right">{formatHours(division.effectiveNormalHours)}</td>
                    <td className="px-3 py-3 text-right">{formatHours(division.scheduledOvertimeHours)}</td>
                    <td className="px-3 py-3 text-right text-amber-100">{formatHours(division.additionalOvertimeHours)}</td>
                    <td className={`px-3 py-3 text-right ${division.uncoveredHours > 0 ? "text-rose-200" : "text-emerald-200"}`}>
                      {formatHours(division.uncoveredHours)}
                    </td>
                    <td className="px-3 py-3 text-white/55">
                      {division.schedule.filter((row) => row.extraHoursRecommended > 0).length > 0
                        ? division.schedule
                            .filter((row) => row.extraHoursRecommended > 0)
                            .map((row) => `${trimDayName(row.dayName)} ${row.extraHoursRecommended.toFixed(0)}j`)
                            .join(" • ")
                        : "Belum perlu tambahan jam baru"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <tr>
                  <th className="px-3 py-3">Ringkasan tambahan jam</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/[0.06]">
                  <td className="px-3 py-3 text-white/55">
                    {overtimeScheduleSummary.length > 0
                      ? overtimeScheduleSummary.join(" | ")
                      : "Target minggu ini masih bisa dikejar tanpa tambahan jam baru."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
