"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import type { PlanningEvaluationDivisionRecord } from "@smsystem/contracts/planning-evaluation";
import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ActionButton,
  CompactDateInput,
  CompactDateRangeInput,
  MetricBar,
  SectionCard,
} from "@/shared/ui/compact";

interface PlanningEvaluationShellProps {
  date: string;
  dateTo: string;
  activeMode: "all" | "normal" | "overtime";
  activeSpan: "daily" | "weekly";
  summary: {
    baselineHours: number;
    revisionHours: number;
    actualHours: number;
    revisionDeltaHours: number;
    actualDeltaHours: number;
  };
  rows: PlanningEvaluationDivisionRecord[];
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

function differenceInDaysInclusive(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endDate - startDate) / 86_400_000) + 1;
}

function clampWeeklyRange(start: string, end: string) {
  const nextStart = start;
  let nextEnd = end;
  if (nextEnd < nextStart) {
    nextEnd = nextStart;
  }
  if (differenceInDaysInclusive(nextStart, nextEnd) > 7) {
    nextEnd = addDaysIso(nextStart, 6);
  }
  return {
    start: nextStart,
    end: nextEnd,
  };
}

function formatHours(value: number): string {
  return `${value.toFixed(1)}j`;
}

export function PlanningEvaluationShell({
  date,
  dateTo,
  activeMode,
  activeSpan,
  summary,
  rows,
}: PlanningEvaluationShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedDateTo = activeSpan === "weekly" ? dateTo : date;
  const spkDate = date;
  const splDate = date;

  function openLinkedSpk() {
    router.push(`/spk?date=${spkDate}`);
  }

  function openLinkedSpl() {
    router.push(`/planning/spl?date=${splDate}`);
  }

  function pushMode(value: "all" | "normal" | "overtime") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("mode", value);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function pushSpan(value: "daily" | "weekly") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("span", value);
    if (value === "weekly") {
      nextParams.set("dateTo", resolvedDateTo);
    } else {
      nextParams.delete("dateTo");
    }
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function pushDailyDate(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", value);
    nextParams.delete("dateTo");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function applyRangeSelection(range: { from: string; to: string }) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (range.from === range.to) {
      nextParams.set("date", range.from);
      nextParams.delete("dateTo");
      nextParams.set("span", "daily");
      router.push(`${pathname}?${nextParams.toString()}`);
      return;
    }

    const normalized = clampWeeklyRange(range.from, range.to);
    nextParams.set("date", normalized.start);
    nextParams.set("dateTo", normalized.end);
    nextParams.set("span", "weekly");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-3">
      <SectionCard label="Evaluasi planning" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-foreground">Bandingkan rencana dan realisasi</h2>
            <p className="mt-1 max-w-2xl text-[14px] leading-6 text-muted-foreground">
              Gunakan halaman ini untuk melihat apakah jam kerja aktual sudah mengikuti rencana SPK.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={openLinkedSpk}>Buka SPK</ActionButton>
            <ActionButton onClick={openLinkedSpl}>Buka SPL</ActionButton>
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-3 border border-border bg-background p-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)]">
          <label className="space-y-1">
            <span className="block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
              Tanggal review
            </span>
            {activeSpan === "daily" ? (
              <CompactDateInput value={date} onChange={pushDailyDate} />
            ) : (
              <CompactDateRangeInput
                from={date}
                to={resolvedDateTo}
                onChange={applyRangeSelection}
                selectionBehavior="single-or-range"
              />
            )}
          </label>

          <div className="space-y-1">
            <span className="block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
              Rentang
            </span>
            <div className="grid grid-cols-2 gap-1 border border-border bg-card p-1">
              {(["daily", "weekly"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => pushSpan(value)}
                  className={[
                    "px-2.5 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors",
                    activeSpan === value
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {value === "daily" ? "Harian" : "Mingguan"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
              Jenis jam
            </span>
            <div className="grid grid-cols-3 gap-1 border border-border bg-card p-1">
              {([
                { value: "all", label: "Semua" },
                { value: "normal", label: "Normal" },
                { value: "overtime", label: "Lembur" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => pushMode(option.value)}
                  className={[
                    "px-2 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors",
                    activeMode === option.value
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <MetricBar
        items={[
          { label: "Rencana Awal", value: formatHours(summary.baselineHours) },
          { label: "Update", value: formatHours(summary.revisionHours), tone: "warn" },
          { label: "Realisasi", value: formatHours(summary.actualHours), tone: "up" },
          {
            label: "Selisih Plan",
            value: formatHours(summary.revisionDeltaHours),
            tone: summary.revisionDeltaHours > 0 ? "warn" : summary.revisionDeltaHours < 0 ? "down" : "muted",
          },
          {
            label: "Selisih Aktual",
            value: formatHours(summary.actualDeltaHours),
            tone: summary.actualDeltaHours > 0 ? "warn" : summary.actualDeltaHours < 0 ? "down" : "muted",
          },
        ]}
      />

      <SectionCard label="Hasil per divisi" count={rows.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[14px] text-foreground">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Rencana Awal</th>
                <th className="px-3 py-2 text-right">Update</th>
                <th className="px-3 py-2 text-right">Realisasi</th>
                <th className="px-3 py-2 text-right">Selisih</th>
                <th className="px-3 py-2 text-right">Output</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr
                  key={`${row.divisionId ?? "unknown"}:${row.divisionName ?? "-"}`}
                  className="border-b border-border hover:bg-muted"
                >
                  <td className="px-3 py-2 text-foreground">{row.divisionName ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatHours(row.baselineHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-app-accent-ink">{formatHours(row.revisionHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-success">{formatHours(row.actualHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    <span className={row.revisionDeltaHours > 0 ? "text-app-accent-ink" : row.revisionDeltaHours < 0 ? "text-destructive" : "text-muted-foreground"}>
                      Plan {formatHours(row.revisionDeltaHours)}
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      Aktual {formatHours(row.actualDeltaHours)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.actualUnitCount} unit
                    <span className="block text-[12px] text-muted-foreground">
                      {row.revisionJobCount} job plan
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Belum ada data evaluasi untuk filter yang dipilih.
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
