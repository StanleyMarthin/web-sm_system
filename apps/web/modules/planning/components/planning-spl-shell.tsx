"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PlanningSplRecommendation } from "@/shared/api/work-control";
import { ActionButton, CompactInput, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";

interface PlanningSplShellProps {
  asOfDate: string;
  weekStartDate: string;
  rows: PlanningSplRecommendation[];
}

function addDaysIso(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split("-").map((value) => Number.parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatHours(value: number): string {
  return `${value.toFixed(1)}j`;
}

function formatDisplayDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function PlanningSplShell({
  asOfDate,
  weekStartDate,
  rows,
}: PlanningSplShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const weekEndDate = addDaysIso(weekStartDate, 6);
  const totalShortageHours = rows.reduce((sum, row) => sum + row.shortageHours, 0);
  const totalRecommendedHours = rows.reduce((sum, row) => sum + row.recommendedOvertimeHours, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.unitCount, 0);
  const totalTargets = rows.reduce((sum, row) => sum + row.targetCount, 0);

  function pushReferenceDate(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", value);
    nextParams.delete("weekStart");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function openLinkedSpk() {
    router.push(`/spk?date=${weekStartDate}`);
  }

  function openLinkedPlanning() {
    router.push(`/planning?date=${asOfDate}`);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard label="Planning" className="space-y-2">
          <PageHeader
            title="Rekomendasi SPL Planning"
            eyebrow="Tersambung dari target planning yang dirilis"
          />
          <p className="max-w-2xl text-[12px] leading-5 text-white/45">
            Halaman ini membaca kekurangan jam dari target planning yang sudah dirilis ke SPK.
            Jadi angka di sini, SPK, ETA unit, dan review plan sekarang memakai alur sumber yang sama.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={openLinkedPlanning}>
              Buka Planning
            </ActionButton>
            <ActionButton onClick={openLinkedSpk}>
              Buka SPK
            </ActionButton>
            <div className="w-40">
              <CompactInput
                type="date"
                value={asOfDate}
                onChange={(event) => pushReferenceDate(event.target.value)}
              />
            </div>
            <span className="border border-white/5 bg-[#0a0a0c] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
              {formatDisplayDate(weekStartDate)} s.d. {formatDisplayDate(weekEndDate)}
            </span>
            <span className="border border-white/5 bg-[#0a0a0c] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
              Basis: planning_targets + overtime_recommendations
            </span>
          </div>
        </SectionCard>

        <SectionCard label="Ringkasan" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MetricBar
              items={[
                { label: "Jam Kurang", value: formatHours(totalShortageHours), tone: totalShortageHours > 0 ? "warn" : "muted" },
                { label: "Jam Direkomendasikan", value: formatHours(totalRecommendedHours), tone: totalRecommendedHours > 0 ? "warn" : "muted" },
                { label: "Unit Terdampak", value: totalUnits, tone: "muted" },
                { label: "Target Terdampak", value: totalTargets, tone: "muted" },
              ]}
            />
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </ActionButton>
          </div>
        </SectionCard>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/[0.03] px-4 py-2 text-[11px] font-mono text-amber-400">
        SPL di sini adalah kebutuhan tambahan jam dari target planning yang melebihi kapasitas normal,
        bukan bundle lembur mingguan manual dari modul planning lama.
      </div>

      <SectionCard label="Per Divisi & Target Planning" count={rows.length}>
        <div className="flex flex-wrap items-center justify-between gap-2 border border-white/[0.05] bg-[#0a0a0c] px-3 py-2">
          <p className="text-[12px] text-white/50">
            Semua rekomendasi di bawah ini berasal dari target planning yang sudah dirilis ke SPK minggu
            <span className="ml-1 font-mono text-white/70">{weekStartDate}</span>.
          </p>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
            Linked to release target
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] text-white/70">
            <thead className="sticky top-0 z-10 bg-[#111114]">
              <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Jam Kurang</th>
                <th className="px-3 py-2 text-right">Rekomendasi SPL</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Target</th>
                <th className="px-3 py-2">Rentang Butuh</th>
                <th className="px-3 py-2">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr
                  key={`${row.planningTargetId}:${row.divisionId}`}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 font-mono text-white/50">
                    {row.periodStart}
                    <span className="block text-[9px] text-white/25">{row.planningTargetId.slice(0, 8)}</span>
                  </td>
                  <td className="px-3 py-2 text-white">{row.divisionName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-red-300">
                    {formatHours(row.shortageHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-400">
                    {formatHours(row.recommendedOvertimeHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.unitCount}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.targetCount}</td>
                  <td className="px-3 py-2 font-mono text-white/45">
                    {formatDisplayDate(row.firstNeedDate)}
                    <span className="block text-[9px] text-white/25">
                      s.d. {formatDisplayDate(row.lastNeedDate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-white/50">{row.reason ?? "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-white/35">
                    Belum ada kebutuhan SPL dari planning yang dirilis pada minggu ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
