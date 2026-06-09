"use client";

import type { MonitoringDivisionLoadRecord } from "@smsystem/contracts/monitoring";
import { ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { ActionButton, CompactDateInput, CompactDateRangeInput } from "@/shared/ui/compact";

interface MonitoringDivisionShellProps {
  date: string;
  dateTo?: string;
  activeMode: "all" | "normal" | "overtime";
  activeSpan: "daily" | "weekly";
  rows: MonitoringDivisionLoadRecord[];
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

function clampWeeklyRange(start: string, end: string): { start: string; end: string } {
  const nextStart = start;
  let nextEnd = end;

  if (nextEnd < nextStart) {
    nextEnd = nextStart;
  }

  const span = differenceInDaysInclusive(nextStart, nextEnd);
  if (span > 7) {
    nextEnd = addDaysIso(nextStart, 6);
  }

  return {
    start: nextStart,
    end: nextEnd,
  };
}

export function MonitoringDivisionShell({
  date,
  dateTo,
  activeMode,
  activeSpan,
  rows,
}: MonitoringDivisionShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalTasks = rows.reduce((sum, row) => sum + row.totalTasks, 0);
  const totalStarted = rows.reduce((sum, row) => sum + row.startedTasks, 0);
  const totalPendingSubmit = rows.reduce((sum, row) => sum + row.pendingSubmitTasks, 0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function rowKey(row: MonitoringDivisionLoadRecord): string {
    return String(row.divisionId ?? row.divisionName ?? "unknown");
  }

  function toggleRow(key: string) {
    const next = new Set(expandedRows);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRows(next);
  }

  function pushDailyDate(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", value);
    nextParams.delete("dateTo");
    router.push(`${pathname}?${nextParams.toString()}`);
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

  const resolvedDateTo = dateTo ?? (activeSpan === "weekly" ? addDaysIso(date, 6) : date);
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

  function openDivisionDetail(divisionId: number) {
    const nextParams = new URLSearchParams(searchParams.toString());
    router.push(`/monitoring/division/${divisionId}?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[12px] font-medium text-gray-950 dark:text-white">Monitoring per divisi</h1>

              <div className="flex items-center gap-1.5 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-1">
                <button
                  type="button"
                  onClick={() => pushSpan("daily")}
                  className={[
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    activeSpan === "daily"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-gray-400 dark:text-white/40 hover:text-gray-800 dark:text-white/70",
                  ].join(" ")}
                >
                  Harian
                </button>
                <button
                  type="button"
                  onClick={() => pushSpan("weekly")}
                  className={[
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    activeSpan === "weekly"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-gray-400 dark:text-white/40 hover:text-gray-800 dark:text-white/70",
                  ].join(" ")}
                >
                  Mingguan
                </button>
              </div>

              <div className="flex items-center gap-1.5 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-1">
                <button
                  type="button"
                  onClick={() => pushMode("all")}
                  className={[
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    activeMode === "all"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-gray-400 dark:text-white/40 hover:text-gray-800 dark:text-white/70",
                  ].join(" ")}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => pushMode("normal")}
                  className={[
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    activeMode === "normal"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-gray-400 dark:text-white/40 hover:text-gray-800 dark:text-white/70",
                  ].join(" ")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => pushMode("overtime")}
                  className={[
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    activeMode === "overtime"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-gray-400 dark:text-white/40 hover:text-gray-800 dark:text-white/70",
                  ].join(" ")}
                >
                  Lembur
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </div>
        </div>

        <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-stretch border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c]">
              <div className="border-r border-gray-300 dark:border-white/[0.05] px-3 py-2 last:border-r-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Total Pekerjaan</p>
                <p className="mt-1 font-mono text-[13px] font-medium leading-none text-gray-950 dark:text-white tabular-nums">
                  {totalTasks}
                </p>
              </div>
              <div className="border-r border-gray-300 dark:border-white/[0.05] px-3 py-2 last:border-r-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-500/70">Sudah Mulai</p>
                <p className="mt-1 font-mono text-[13px] font-medium leading-none text-emerald-500 tabular-nums">
                  {totalStarted}
                </p>
              </div>
              <div className="px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-500/70">Belum Ditutup</p>
                <p className="mt-1 font-mono text-[13px] font-medium leading-none text-amber-500 tabular-nums">
                  {totalPendingSubmit}
                </p>
              </div>
            </div>

            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </ActionButton>
          </div>
        </div>
      </div>

      <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 dark:border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Ringkasan divisi</h2>
            <span className="font-mono text-[10px] text-gray-500 dark:text-white/35">{rows.length} divisi</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] text-gray-800 dark:text-white/70">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114]">
              <tr className="border-b border-gray-300 dark:border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                <th className="px-3 py-2 text-center">Unit</th>
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Jml Unit</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Sudah Mulai</th>
                <th className="px-3 py-2 text-right">Belum Ditutup</th>
                <th className="px-3 py-2 text-right">Selesai</th>
                <th className="px-3 py-2 text-right">Jam Aktual</th>
                <th className="px-3 py-2 text-right">Sisa Jam</th>
                <th className="px-3 py-2 text-right">Rata-rata Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => {
                const key = rowKey(row);
                const isExpanded = expandedRows.has(key);
                return (
                  <React.Fragment key={`${row.divisionId ?? "unknown"}:${row.divisionName ?? "-"}`}>
                    <tr className="border-b border-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRow(key)}
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center border transition-colors",
                            isExpanded
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                              : "border-gray-300 text-gray-400 hover:border-amber-500/30 hover:text-amber-500 dark:border-white/[0.06] dark:text-white/30",
                          ].join(" ")}
                          aria-label={isExpanded ? "Tutup rincian unit" : "Buka rincian unit"}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-gray-950 dark:text-white">
                        {row.divisionId ? (
                          <button
                            type="button"
                            onClick={() => openDivisionDetail(row.divisionId!)}
                            className="font-mono text-left text-amber-400 transition-colors hover:text-amber-300"
                          >
                            {row.divisionName ?? "-"}
                          </button>
                        ) : (
                          row.divisionName ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.units.length}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.totalTasks}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.startedTasks}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.pendingSubmitTasks}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.doneTasks}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.totalActualHours.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.totalRemainingHours.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.averageProgressPercent.toFixed(0)}%
                      </td>
                    </tr>
                    {isExpanded && row.units.length > 0 && (
                      <tr className="bg-gray-50 dark:bg-[#050505]">
                        <td colSpan={10} className="p-0">
                          <div className="border-l-2 border-amber-500/40 px-4 py-3 md:ml-12">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                                Unit yang dikerjakan
                              </p>
                              <span className="font-mono text-[10px] text-gray-500 dark:text-white/35">
                                {row.units.length} unit
                              </span>
                            </div>
                            <div className="overflow-x-auto border border-gray-200 bg-white dark:border-white/[0.04] dark:bg-[#0a0a0c]">
                              <table className="min-w-full text-[11px]">
                                <thead>
                                  <tr className="border-b border-gray-200 text-left font-mono uppercase tracking-[0.1em] text-gray-500 dark:border-white/[0.04] dark:text-white/30">
                                    <th className="px-3 py-2">Unit</th>
                                    <th className="px-3 py-2 text-right">Pekerjaan</th>
                                    <th className="px-3 py-2 text-right">Jam Aktual</th>
                                    <th className="px-3 py-2 text-right">Sisa Jam</th>
                                    <th className="px-3 py-2 text-right">Progress</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                                  {row.units.map((unit) => (
                                    <tr key={unit.carId} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-gray-950 dark:text-white/80">{unit.unitName}</div>
                                        <div className="text-[10px] text-gray-500 dark:text-white/30">{unit.customerName ?? "Customer belum diisi"}</div>
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">{unit.totalTasks}</td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">{unit.totalActualHours.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">{unit.totalRemainingHours.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-500">{unit.averageProgressPercent.toFixed(0)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isExpanded && row.units.length === 0 && (
                      <tr className="bg-gray-50 dark:bg-[#050505]">
                        <td colSpan={10} className="px-4 py-4 text-[11px] text-gray-500 dark:text-white/30 md:pl-16">
                          Belum ada rincian unit untuk divisi ini.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }) : (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-gray-500 dark:text-white/35">
                    Belum ada data untuk filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
