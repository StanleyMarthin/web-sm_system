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
    <div className="space-y-2">
      <section className="border border-white/5 bg-[#111114] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                Planning
              </p>
              <h2 className="text-[13px] font-mono text-white/80">
                Review Plan & Realisasi
              </h2>
            </div>
            
            <div className="h-6 w-px bg-white/10 hidden sm:block"></div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 border border-white/10 bg-[#0a0a0c] p-1">
                {(["daily", "weekly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pushSpan(value)}
                    className={[
                      "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                      activeSpan === value
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-white/40 hover:text-white/70",
                    ].join(" ")}
                  >
                    {value === "daily" ? "Harian" : "Mingguan"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 border border-white/10 bg-[#0a0a0c] p-1">
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
                      "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                      activeMode === option.value
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-white/40 hover:text-white/70",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={openLinkedSpk}>
              Buka SPK
            </ActionButton>
            <ActionButton onClick={openLinkedSpl}>
              Buka SPL
            </ActionButton>
            {activeSpan === "daily" ? (
              <div className="w-40">
                <CompactDateInput value={date} onChange={pushDailyDate} className="w-64" />
              </div>
            ) : (
              <CompactDateRangeInput
                from={date}
                to={resolvedDateTo}
                onChange={applyRangeSelection}
                selectionBehavior="single-or-range"
                className="w-64"
              />
            )}
            <span className="border border-white/5 bg-[#0a0a0c] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45 h-8 flex items-center">
              {activeSpan === "daily" ? "Review harian" : "Maks 7 hari"}
            </span>
          </div>
        </div>
      </section>

      <section className="border border-white/5 bg-[#111114] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <MetricBar
          items={[
            { label: "Rencana Awal", value: formatHours(summary.baselineHours) },
            { label: "Rencana Update", value: formatHours(summary.revisionHours), tone: "warn" },
            { label: "Realisasi", value: formatHours(summary.actualHours), tone: "up" },
            {
              label: "Selisih Rencana",
              value: formatHours(summary.revisionDeltaHours),
              tone: summary.revisionDeltaHours > 0 ? "warn" : summary.revisionDeltaHours < 0 ? "down" : "muted",
            },
            {
              label: "Selisih Realisasi",
              value: formatHours(summary.actualDeltaHours),
              tone: summary.actualDeltaHours > 0 ? "warn" : summary.actualDeltaHours < 0 ? "down" : "muted",
            },
          ]}
        />
        <ActionButton onClick={() => router.refresh()}>
          <RefreshCcw className="h-3 w-3" />
          Refresh
        </ActionButton>
      </section>

      <SectionCard label="Per divisi" count={rows.length}>
        <div className="flex flex-wrap items-center justify-between gap-2 border border-white/[0.05] bg-[#0a0a0c] px-3 py-2">
          <p className="text-[12px] text-white/50">
            Review ini tersambung ke SPK tanggal <span className="font-mono text-white/70">{spkDate}</span>
            {" "}dan SPL periode yang sama.
          </p>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
            Sorted by source data
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] text-white/70">
            <thead className="sticky top-0 z-10 bg-[#111114]">
              <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Rencana Awal</th>
                <th className="px-3 py-2 text-right">Rencana Update</th>
                <th className="px-3 py-2 text-right">Realisasi</th>
                <th className="px-3 py-2 text-right">Selisih Rencana</th>
                <th className="px-3 py-2 text-right">Selisih Realisasi</th>
                <th className="px-3 py-2 text-right">Unit Awal</th>
                <th className="px-3 py-2 text-right">Job Direncanakan</th>
                <th className="px-3 py-2 text-right">Unit Dikerjakan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr
                  key={`${row.divisionId ?? "unknown"}:${row.divisionName ?? "-"}`}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 text-white">{row.divisionName ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatHours(row.baselineHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-500">{formatHours(row.revisionHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-400">{formatHours(row.actualHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatHours(row.revisionDeltaHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatHours(row.actualDeltaHours)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.baselineUnitCount}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.revisionJobCount}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.actualUnitCount}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-white/35">
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
