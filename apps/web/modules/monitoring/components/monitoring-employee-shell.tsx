"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { ActionButton, CompactDateInput, CompactDateRangeInput } from "@/shared/ui/compact";
import { RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";

interface EmployeeTimesheetRecord {
  employeeId: string | null;
  employeeName: string | null;
  carId: string;
  unitName: string;
  isOvertime: boolean;
  totalActualHours: number;
}

interface MonitoringEmployeeShellProps {
  date: string;
  dateTo: string;
  activeSpan: "daily" | "weekly";
  rows: EmployeeTimesheetRecord[];
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

  return { start: nextStart, end: nextEnd };
}

function formatHours(hours: number): string {
  if (!hours) return "0.00";
  return hours.toFixed(2);
}

export function MonitoringEmployeeShell({
  date,
  dateTo,
  activeSpan,
  rows,
}: MonitoringEmployeeShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
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

  const employeeData = useMemo(() => {
    const employeeMap = new Map<string, any>();

    for (const row of rows) {
      if (!row.employeeName) continue;

      let emp = employeeMap.get(row.employeeName);
      if (!emp) {
        emp = {
          id: row.employeeName,
          Nama: row.employeeName,
          _totalNormal: 0,
          _totalOvertime: 0,
          _totalHours: 0,
          units: new Map<string, any>()
        };
        employeeMap.set(row.employeeName, emp);
      }

      const hours = row.totalActualHours || 0;
      if (row.isOvertime) {
        emp._totalOvertime += hours;
      } else {
        emp._totalNormal += hours;
      }
      emp._totalHours += hours;

      if (row.unitName) {
        let unitData = emp.units.get(row.carId);
        if (!unitData) {
          unitData = {
            carId: row.carId,
            unitName: row.unitName,
            normalHours: 0,
            overtimeHours: 0,
            totalHours: 0
          };
          emp.units.set(row.carId, unitData);
        }

        if (row.isOvertime) {
          unitData.overtimeHours += hours;
        } else {
          unitData.normalHours += hours;
        }
        unitData.totalHours += hours;
      }
    }

    return Array.from(employeeMap.values()).map(emp => ({
      ...emp,
      units: Array.from(emp.units.values())
    }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[14px] font-medium text-white">Monitoring Karyawan</h1>
          <div className="h-4 w-px bg-white/[0.06]" />
          <span className="text-[11px] text-white/40">{employeeData.length} Karyawan</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => pushSpan("daily")}
              className={[
                "rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors",
                activeSpan === "daily"
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-white/40 hover:text-white/70",
              ].join(" ")}
            >
              Harian
            </button>
            <button
              type="button"
              onClick={() => pushSpan("weekly")}
              className={[
                "rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors",
                activeSpan === "weekly"
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-white/40 hover:text-white/70",
              ].join(" ")}
            >
              Mingguan
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1">
            {activeSpan === "weekly" ? (
              <CompactDateRangeInput
                from={date}
                to={resolvedDateTo}
                onChange={applyRangeSelection}
                selectionBehavior="single-or-range"
                className="w-64"
              />
            ) : (
              <CompactDateInput
                value={date}
                onChange={pushDailyDate}
                className="w-64"
              />
            )}
          </div>

          <ActionButton onClick={() => router.refresh()}>
            <RefreshCcw className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>

      <section className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/70">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01] text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <th className="px-3 py-4 w-10 text-center">NO</th>
                <th className="px-4 py-4 font-medium text-white/60">Nama Karyawan</th>
                <th className="px-4 py-4 text-right font-medium text-white/60">Work Hour</th>
                <th className="px-4 py-4 text-right font-medium text-white/60">Lembur</th>
                <th className="px-4 py-4 text-right font-medium text-amber-500/80">Total Jam Kerja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {employeeData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[12px] text-white/30">
                    Belum ada data untuk filter waktu yang dipilih.
                  </td>
                </tr>
              ) : (
                employeeData.map((emp) => {
                  const isExpanded = expandedRows.has(emp.id);
                  return (
                    <React.Fragment key={emp.id}>
                      <tr className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-3.5 text-center">
                          <button
                            onClick={() => toggleRow(emp.id)}
                            className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors mx-auto ${isExpanded ? 'bg-amber-500/10 text-amber-500' : 'text-white/30 hover:bg-white/10 hover:text-white/70'}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleRow(emp.id)}
                            className="text-left font-medium text-white group-hover:text-amber-400 transition-colors"
                          >
                            {emp.Nama}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-white/80">{formatHours(emp._totalNormal)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-white/80">{formatHours(emp._totalOvertime)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-amber-500">{formatHours(emp._totalHours)}</td>
                      </tr>
                      {isExpanded && emp.units.length > 0 && (
                        <tr className="bg-[#050505]">
                          <td colSpan={5} className="p-0 border-t border-white/[0.02]">
                            <div className="pl-[52px] pr-4 py-4 border-l-2 border-amber-500/40">
                              <h4 className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3 font-medium flex items-center gap-2">
                                Rincian Unit / Pekerjaan
                                <div className="h-px flex-1 bg-white/[0.04]"></div>
                              </h4>
                              <div className="rounded-lg border border-white/[0.04] overflow-hidden">
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="bg-white/[0.02] text-white/40 border-b border-white/[0.04]">
                                      <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">Nama Unit</th>
                                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-wider">Jam Normal</th>
                                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-wider">Jam Lembur</th>
                                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-wider text-amber-500/60">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/[0.02]">
                                    {emp.units.map((unit: any) => (
                                      <tr key={unit.carId} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="px-4 py-2.5 text-white/70 font-medium">{unit.unitName}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-white/50">{formatHours(unit.normalHours)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-white/50">{formatHours(unit.overtimeHours)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-500/80 font-medium">{formatHours(unit.totalHours)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && emp.units.length === 0 && (
                        <tr className="bg-[#050505]">
                          <td colSpan={5} className="px-[52px] py-4 text-[11px] text-white/30 italic border-l-2 border-white/[0.05]">
                            Tidak ada rincian data unit untuk periode ini.
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
