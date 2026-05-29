"use client";

import type {
  DivisionCapacitySummary,
  WeeklyGapResult,
} from "@smsystem/contracts/calendar";

interface PlanGapBarProps {
  gap: WeeklyGapResult;
  capacity: DivisionCapacitySummary[];
  labourRate: number | null;
}

function sumBy<T>(rows: T[], picker: (row: T) => number): number {
  return Number(rows.reduce((total, row) => total + picker(row), 0).toFixed(2));
}

function toPercent(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / maxValue) * 100));
}

function formatHours(value: number): string {
  return `${value.toFixed(2)} jam`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PlanGapBar({ gap, capacity, labourRate }: PlanGapBarProps) {
  const totalNormal = sumBy(capacity, (row) => row.normalCapacityHours);
  const totalOvertime = sumBy(capacity, (row) => row.overtimeCapacityHours);
  const totalAbsence = sumBy(capacity, (row) => row.absenceLostHours);
  const totalNet = gap.totalNetCapacity;
  const target = gap.targetHours;
  const deficit = gap.deficit;
  const maxScale = Math.max(target, totalNormal + totalOvertime, totalNet, 1);
  const projectedIncome = labourRate ? totalNet * labourRate : null;

  const normalPct = toPercent(totalNormal, maxScale);
  const overtimePct = toPercent(totalOvertime, maxScale);
  const absencePct = toPercent(totalAbsence, maxScale);
  const targetPct = toPercent(target, maxScale);
  const netPct = toPercent(totalNet, maxScale);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <h2 className="text-lg font-light text-white">Ringkasan tenaga kerja minggu ini</h2>

      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Kapasitas Normal + Lembur</span>
            <span>{formatHours(totalNormal + totalOvertime)}</span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-black/30">
            <div className="absolute left-0 top-0 h-full bg-white/15" style={{ width: `${normalPct}%` }} />
            <div
              className="absolute top-0 h-full bg-emerald-500/65"
              style={{ left: `${normalPct}%`, width: `${overtimePct}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Jam hilang karena absensi</span>
            <span>-{formatHours(totalAbsence)}</span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-black/30">
            <div className="h-full bg-rose-500/70" style={{ width: `${absencePct}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Jam siap kerja vs target</span>
            <span>{formatHours(totalNet)} / {formatHours(target)}</span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-black/30">
            <div
              className={`h-full ${deficit > 0 ? "bg-rose-500/80" : "bg-emerald-500/80"}`}
              style={{ width: `${netPct}%` }}
            />
            <div
              className="absolute bottom-0 top-0 w-[2px] bg-white/80"
              style={{ left: `${targetPct}%` }}
            />
          </div>
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
              <td className="px-3 py-3">Jam siap kerja</td>
              <td className="px-3 py-3 text-right">{formatHours(totalNet)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Target mingguan</td>
              <td className="px-3 py-3 text-right">{formatHours(target)}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Selisih</td>
              <td className="px-3 py-3 text-right">
                {deficit > 0 ? `Kurang ${formatHours(deficit)}` : `Surplus ${formatHours(Math.abs(deficit))}`}
              </td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Proyeksi pendapatan</td>
              <td className="px-3 py-3 text-right">{projectedIncome !== null ? formatCurrency(projectedIncome) : "Belum diisi"}</td>
              <td className="px-3 py-3 text-white/45" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-3 py-3">Divisi</th>
              <th className="px-3 py-3 text-right">Tim aktif</th>
              <th className="px-3 py-3 text-right">Jam normal</th>
              <th className="px-3 py-3 text-right">Jam tambahan</th>
              <th className="px-3 py-3 text-right">Jam hilang</th>
              <th className="px-3 py-3 text-right">Jam bersih</th>
              <th className="px-3 py-3 text-right">Teralokasi</th>
            </tr>
          </thead>
          <tbody>
            {capacity.map((row) => (
              <tr key={row.divisionId} className="border-t border-white/[0.06]">
                <td className="px-3 py-3">{row.divisionName}</td>
                <td className="px-3 py-3 text-right">{row.memberCountActive}</td>
                <td className="px-3 py-3 text-right">{formatHours(row.normalCapacityHours)}</td>
                <td className="px-3 py-3 text-right">{formatHours(row.overtimeCapacityHours)}</td>
                <td className="px-3 py-3 text-right">{formatHours(row.absenceLostHours)}</td>
                <td className="px-3 py-3 text-right">{formatHours(row.netCapacityHours)}</td>
                <td className="px-3 py-3 text-right">{formatHours(row.allocatedHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
