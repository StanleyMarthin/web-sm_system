"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PlanningSplRecommendation } from "@/shared/api/work-control";
import { ActionButton, CompactDateInput, MetricBar, SectionCard } from "@/shared/ui/compact";

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
    <div className="space-y-3">
      <SectionCard label="Rekomendasi SPL" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-foreground">Jam lembur yang perlu disiapkan</h2>
            <p className="mt-1 max-w-2xl text-[14px] leading-6 text-muted-foreground">
              Sistem menghitung kekurangan jam dari target planning yang sudah dirilis ke SPK.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={openLinkedPlanning}>Buka Planning</ActionButton>
            <ActionButton onClick={openLinkedSpk}>Buka SPK</ActionButton>
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-3 border border-border bg-background p-3 md:grid-cols-[220px_1fr]">
          <label className="space-y-1">
            <span className="block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
              Tanggal acuan
            </span>
            <CompactDateInput value={asOfDate} onChange={pushReferenceDate} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border border-border bg-card px-3 py-2">
              <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Periode minggu</p>
              <p className="mt-1 font-mono text-[14px] font-semibold text-foreground">
                {formatDisplayDate(weekStartDate)} s.d. {formatDisplayDate(weekEndDate)}
              </p>
            </div>
            <div className="border border-primary/25 bg-primary/[0.06] px-3 py-2">
              <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-app-accent-ink">Sumber data</p>
              <p className="mt-1 text-[14px] text-foreground">Target planning yang sudah rilis</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <MetricBar
        items={[
          { label: "Jam Kurang", value: formatHours(totalShortageHours), tone: totalShortageHours > 0 ? "warn" : "muted" },
          { label: "SPL Disarankan", value: formatHours(totalRecommendedHours), tone: totalRecommendedHours > 0 ? "warn" : "muted" },
          { label: "Unit", value: totalUnits, tone: "muted" },
          { label: "Target", value: totalTargets, tone: "muted" },
        ]}
      />

      <SectionCard label="Rekomendasi per divisi" count={rows.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[14px] text-foreground">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Jam Kurang</th>
                <th className="px-3 py-2 text-right">SPL Disarankan</th>
                <th className="px-3 py-2 text-right">Dampak</th>
                <th className="px-3 py-2">Tanggal Dibutuhkan</th>
                <th className="px-3 py-2">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr
                  key={`${row.planningTargetId}:${row.divisionId}`}
                  className="border-b border-border hover:bg-muted"
                >
                  <td className="px-3 py-2 text-foreground">{row.divisionName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-destructive">
                    {formatHours(row.shortageHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-app-accent-ink">
                    {formatHours(row.recommendedOvertimeHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.unitCount} unit
                    <span className="block text-[12px] text-muted-foreground">{row.targetCount} target</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {formatDisplayDate(row.firstNeedDate)}
                    <span className="block text-[12px] text-muted-foreground">
                      s.d. {formatDisplayDate(row.lastNeedDate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.reason ?? "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
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
