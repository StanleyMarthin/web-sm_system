"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState, useEffect } from "react";
import { ActionButton, CompactDateInput, CompactDateRangeInput } from "@/shared/ui/compact";
import { RefreshCcw } from "lucide-react";

// ─── Contract ────────────────────────────────────────────────────────────────

export interface UnitTimesheetRecord {
    carId: string;
    unitName: string;
    customerName: string | null;
    employeeId: string | null;
    employeeName: string | null;
    divisionName?: string | null;
    isOvertime: boolean;
    taskDate: string;
    totalActualHours: number;
    totalPlannedHours: number;
    totalRemainingHours: number;
    averageProgressPercent: number;
    totalTasks: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MonitoringUnitShellProps {
    date: string;
    dateTo: string;
    activeSpan: "daily" | "weekly";
    rows: UnitTimesheetRecord[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDaysIso(baseDate: string, days: number): string {
    const [year, month, day] = baseDate.split("-").map((v) => Number.parseInt(v, 10));
    const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    d.setUTCDate(d.getUTCDate() + days);
    return [
        d.getUTCFullYear(),
        String(d.getUTCMonth() + 1).padStart(2, "0"),
        String(d.getUTCDate()).padStart(2, "0"),
    ].join("-");
}

function differenceInDaysInclusive(start: string, end: string): number {
    const s = new Date(`${start}T00:00:00`).getTime();
    const e = new Date(`${end}T00:00:00`).getTime();
    return Math.floor((e - s) / 86_400_000) + 1;
}

function clampWeeklyRange(start: string, end: string): { start: string; end: string } {
    const nextEnd = end < start ? start : differenceInDaysInclusive(start, end) > 7 ? addDaysIso(start, 6) : end;
    return { start, end: nextEnd };
}

function fmt(hours: number): string {
    return hours ? hours.toFixed(2) : "";
}

const daysOfWeek = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

function formatMatrixDate(isoString: string) {
    const d = new Date(`${isoString}T00:00:00`);
    return `${daysOfWeek[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MonitoringUnitShell({
    date,
    dateTo,
    activeSpan,
    rows,
}: MonitoringUnitShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const resolvedDateTo = dateTo ?? (activeSpan === "weekly" ? addDaysIso(date, 6) : date);

    // Filter available units
    const units = useMemo(() => {
        const map = new Map<string, { carId: string; unitName: string; customerName: string | null }>();
        for (const r of rows) {
            if (!map.has(r.carId)) {
                map.set(r.carId, { carId: r.carId, unitName: r.unitName, customerName: r.customerName });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.unitName.localeCompare(b.unitName));
    }, [rows]);

    const urlSelectedUnit = searchParams.get("carId");
    const selectedUnitId = urlSelectedUnit && units.some((u) => u.carId === urlSelectedUnit)
        ? urlSelectedUnit
        : (units.length > 0 ? units[0].carId : "");

    // Generated columns for the date range
    const matrixDates = useMemo(() => {
        const diff = differenceInDaysInclusive(date, resolvedDateTo);
        const result: string[] = [];
        for (let i = 0; i < diff; i++) {
            result.push(addDaysIso(date, i));
        }
        return result;
    }, [date, resolvedDateTo]);

    // Matrix data structure for the selected unit
    const matrixData = useMemo(() => {
        if (!selectedUnitId) return [];

        const filtered = rows.filter((r) => r.carId === selectedUnitId && r.employeeName);
        
        type CellData = { normal: number; overtime: number };
        type EmpData = { employeeId: string | null; employeeName: string; days: Record<string, CellData> };
        
        const empMap = new Map<string, EmpData>();

        for (const r of filtered) {
            const empKey = r.employeeId ?? r.employeeName!;
            let emp = empMap.get(empKey);
            if (!emp) {
                emp = { employeeId: r.employeeId, employeeName: r.employeeName!, days: {} };
                empMap.set(empKey, emp);
            }

            let dayCell = emp.days[r.taskDate];
            if (!dayCell) {
                dayCell = { normal: 0, overtime: 0 };
                emp.days[r.taskDate] = dayCell;
            }

            if (r.isOvertime) dayCell.overtime += r.totalActualHours;
            else dayCell.normal += r.totalActualHours;
        }

        return Array.from(empMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [rows, selectedUnitId]);

    const selectedUnitDetails = units.find((u) => u.carId === selectedUnitId);

    // ── Navigation helpers ─────────────────────────────────────────────────────

    function pushSpan(value: "daily" | "weekly") {
        const p = new URLSearchParams(searchParams.toString());
        p.set("span", value);
        if (value === "weekly") p.set("dateTo", resolvedDateTo);
        else p.delete("dateTo");
        router.push(`${pathname}?${p.toString()}`);
    }

    function pushDailyDate(value: string) {
        const p = new URLSearchParams(searchParams.toString());
        p.set("date", value);
        p.delete("dateTo");
        router.push(`${pathname}?${p.toString()}`);
    }

    function applyRangeSelection(range: { from: string; to: string }) {
        const p = new URLSearchParams(searchParams.toString());
        if (range.from === range.to) {
            p.set("date", range.from);
            p.delete("dateTo");
            p.set("span", "daily");
        } else {
            const norm = clampWeeklyRange(range.from, range.to);
            p.set("date", norm.start);
            p.set("dateTo", norm.end);
            p.set("span", "weekly");
        }
        router.push(`${pathname}?${p.toString()}`);
    }

    function changeUnit(carId: string) {
        const p = new URLSearchParams(searchParams.toString());
        p.set("carId", carId);
        router.push(`${pathname}?${p.toString()}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ── Header bar ──────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-white/[0.06] bg-[#0a0a0c] px-4 py-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-[14px] font-medium text-white">Monitoring Unit</h1>
                    <div className="h-4 w-px bg-white/[0.06]" />
                    <select
                        value={selectedUnitId}
                        onChange={(e) => changeUnit(e.target.value)}
                        className="w-48 appearance-none bg-transparent text-[13px] text-white outline-none ring-0 [&>option]:bg-[#111114] [&>option]:text-white"
                        disabled={units.length === 0}
                    >
                        {units.length === 0 && <option value="">Belum ada unit</option>}
                        {units.map((u) => (
                            <option key={u.carId} value={u.carId}>
                                {u.unitName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Span toggle */}
                    <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                        {(["daily", "weekly"] as const).map((span) => (
                            <button
                                key={span}
                                type="button"
                                onClick={() => pushSpan(span)}
                                className={[
                                    "rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors",
                                    activeSpan === span
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "text-white/40 hover:text-white/70",
                                ].join(" ")}
                            >
                                {span === "daily" ? "Harian" : "Mingguan"}
                            </button>
                        ))}
                    </div>

                    {/* Date picker */}
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
                            <CompactDateInput value={date} onChange={pushDailyDate} className="w-64" />
                        )}
                    </div>

                    <ActionButton onClick={() => router.refresh()}>
                        <RefreshCcw className="h-3.5 w-3.5" />
                    </ActionButton>
                </div>
            </div>

            {/* ── Spreadsheet Matrix ──────────────────────────────────────────────────────── */}
            {selectedUnitId ? (
                <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#0a0a0c]">
                    {/* Matrix Header */}
                    <div className="border-b border-white/[0.06] bg-[#111114] py-3 text-center">
                        <h2 className="text-[13px] font-bold uppercase tracking-[0.05em] text-white">
                            {selectedUnitDetails?.unitName}
                            {selectedUnitDetails?.customerName && (
                                <span className="ml-2 font-normal text-white/50">
                                    {selectedUnitDetails.customerName}
                                </span>
                            )}
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th
                                        rowSpan={2}
                                        className="border-b border-r border-white/[0.06] bg-white/[0.01] px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-white/40 align-middle"
                                    >
                                        Nama
                                    </th>
                                    {matrixDates.map((d) => (
                                        <th
                                            key={d}
                                            colSpan={2}
                                            className="border-b border-r border-white/[0.06] bg-amber-500/10 px-2 py-2.5 text-center text-[11px] font-semibold text-amber-500"
                                        >
                                            {formatMatrixDate(d)}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {matrixDates.map((d) => (
                                        <React.Fragment key={`sub-${d}`}>
                                            <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-white/50">
                                                Jam Normal
                                            </th>
                                            <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-white/50">
                                                Jam Lembur
                                            </th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixData.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={matrixDates.length * 2 + 1}
                                            className="px-4 py-12 text-center text-[12px] italic text-white/30"
                                        >
                                            Tidak ada data karyawan untuk unit ini pada periode yang dipilih.
                                        </td>
                                    </tr>
                                ) : (
                                    matrixData.map((emp) => (
                                        <tr key={emp.employeeName} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                                            <td className="border-r border-white/[0.06] px-4 py-2.5 text-[11px] font-bold text-white uppercase tracking-wider">
                                                {emp.employeeName}
                                            </td>
                                            {matrixDates.map((d) => {
                                                const cell = emp.days[d];
                                                return (
                                                    <React.Fragment key={`cell-${emp.employeeName}-${d}`}>
                                                        <td className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-white/70">
                                                            {cell?.normal ? fmt(cell.normal) : ""}
                                                        </td>
                                                        <td className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-amber-500/80">
                                                            {cell?.overtime ? fmt(cell.overtime) : ""}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : (
                <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0c] px-4 py-12 text-center text-[12px] text-white/30">
                    Silakan pilih filter unit dan waktu untuk melihat matriks pengerjaan.
                </div>
            )}
        </div>
    );
}