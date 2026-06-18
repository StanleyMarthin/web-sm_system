"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo } from "react";
import { ActionButton, CompactDateInput, CompactDateRangeInput } from "@/shared/ui/compact";
import { RefreshCcw } from "lucide-react";
import type { UnitTimesheetRecord } from "./Monitoring-unit-shell";

interface MonitoringDivisionShellProps {
    date: string;
    dateTo: string;
    activeSpan: "daily" | "weekly";
    rows: UnitTimesheetRecord[];
}

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

export function MonitoringDivisionShell({
    date,
    dateTo,
    activeSpan,
    rows,
}: MonitoringDivisionShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const resolvedDateTo = dateTo ?? (activeSpan === "weekly" ? addDaysIso(date, 6) : date);

    const divisions = useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) {
            if (r.divisionName) set.add(r.divisionName);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [rows]);

    const urlSelectedDivision = searchParams.get("division");
    const selectedDivision = urlSelectedDivision && divisions.includes(urlSelectedDivision)
        ? urlSelectedDivision
        : "";

    const matrixDates = useMemo(() => {
        const diff = differenceInDaysInclusive(date, resolvedDateTo);
        const result: string[] = [];
        for (let i = 0; i < diff; i++) {
            result.push(addDaysIso(date, i));
        }
        return result;
    }, [date, resolvedDateTo]);

    const matrixData = useMemo(() => {
        if (!selectedDivision) return [];

        const filtered = rows.filter((r) => r.divisionName === selectedDivision);
        
        type CellData = { normal: number; overtime: number };
        type UnitData = { carId: string; unitName: string; days: Record<string, CellData> };
        
        const unitMap = new Map<string, UnitData>();

        for (const r of filtered) {
            let unit = unitMap.get(r.carId);
            if (!unit) {
                unit = { carId: r.carId, unitName: r.unitName, days: {} };
                unitMap.set(r.carId, unit);
            }

            let dayCell = unit.days[r.taskDate];
            if (!dayCell) {
                dayCell = { normal: 0, overtime: 0 };
                unit.days[r.taskDate] = dayCell;
            }

            if (r.isOvertime) dayCell.overtime += r.totalActualHours;
            else dayCell.normal += r.totalActualHours;
        }

        return Array.from(unitMap.values()).sort((a, b) => a.unitName.localeCompare(b.unitName));
    }, [rows, selectedDivision]);

    const allMatrixData = useMemo(() => {
        if (selectedDivision) return [];

        type UnitRow = { carId: string; unitName: string; divHours: Record<string, number>; totalHours: number };
        const unitMap = new Map<string, UnitRow>();

        for (const r of rows) {
            if (!r.divisionName) continue;

            let unit = unitMap.get(r.carId);
            if (!unit) {
                unit = { carId: r.carId, unitName: r.unitName, divHours: {}, totalHours: 0 };
                unitMap.set(r.carId, unit);
            }

            const hours = r.totalActualHours;
            unit.divHours[r.divisionName] = (unit.divHours[r.divisionName] || 0) + hours;
            unit.totalHours += hours;
        }

        return Array.from(unitMap.values()).sort((a, b) => b.totalHours - a.totalHours); // sort by highest hours
    }, [rows, selectedDivision]);

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

    function changeDivision(div: string) {
        const p = new URLSearchParams(searchParams.toString());
        p.set("division", div);
        router.push(`${pathname}?${p.toString()}`);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-white/[0.06] bg-background px-4 py-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-[14px] font-medium text-foreground">Monitoring Divisi</h1>
                    <div className="h-4 w-px bg-white/[0.06]" />
                    <select
                        value={selectedDivision}
                        onChange={(e) => changeDivision(e.target.value)}
                        className="w-48 appearance-none bg-transparent text-[13px] text-foreground outline-none ring-0 [&>option]:bg-card [&>option]:text-foreground"
                        disabled={divisions.length === 0}
                    >
                        <option value="">Semua Divisi (Cross-Tab)</option>
                        {divisions.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                        {(["daily", "weekly"] as const).map((span) => (
                            <button
                                key={span}
                                type="button"
                                onClick={() => pushSpan(span)}
                                className={[
                                    "rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors",
                                    activeSpan === span
                                        ? "bg-primary/10 text-app-accent-ink"
                                        : "text-foreground/40 hover:text-foreground/70",
                                ].join(" ")}
                            >
                                {span === "daily" ? "Harian" : "Mingguan"}
                            </button>
                        ))}
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
                            <CompactDateInput value={date} onChange={pushDailyDate} className="w-64" />
                        )}
                    </div>

                    <ActionButton onClick={() => router.refresh()}>
                        <RefreshCcw className="h-3.5 w-3.5" />
                    </ActionButton>
                </div>
            </div>

            {selectedDivision ? (
                <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-background">
                    <div className="border-b border-white/[0.06] bg-card py-3 text-center">
                        <h2 className="text-[13px] font-bold uppercase tracking-[0.05em] text-foreground">
                            DIVISI {selectedDivision.toUpperCase()}
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th
                                        rowSpan={2}
                                        className="border-b border-r border-white/[0.06] bg-white/[0.01] px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/40 align-middle"
                                    >
                                        Unit
                                    </th>
                                    {matrixDates.map((d) => (
                                        <th
                                            key={d}
                                            colSpan={2}
                                            className="border-b border-r border-white/[0.06] bg-primary/10 px-2 py-2.5 text-center text-[11px] font-semibold text-app-accent-ink"
                                        >
                                            {formatMatrixDate(d)}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {matrixDates.map((d) => (
                                        <React.Fragment key={`sub-${d}`}>
                                            <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-foreground/50">
                                                Jam Normal
                                            </th>
                                            <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-foreground/50">
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
                                            className="px-4 py-12 text-center text-[12px] italic text-foreground/30"
                                        >
                                            Tidak ada data untuk divisi ini pada periode yang dipilih.
                                        </td>
                                    </tr>
                                ) : (
                                    matrixData.map((unit) => (
                                        <tr key={unit.carId} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                                            <td className="border-r border-white/[0.06] px-4 py-2.5 text-[11px] font-bold text-foreground uppercase tracking-wider">
                                                {unit.unitName}
                                            </td>
                                            {matrixDates.map((d) => {
                                                const cell = unit.days[d];
                                                return (
                                                    <React.Fragment key={`cell-${unit.carId}-${d}`}>
                                                        <td className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-foreground/70">
                                                            {cell?.normal ? fmt(cell.normal) : ""}
                                                        </td>
                                                        <td className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-app-accent-ink/80">
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
                <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-background">
                    <div className="border-b border-white/[0.06] bg-card py-3 text-center flex flex-col items-center justify-center gap-1">
                        <h2 className="text-[13px] font-bold uppercase tracking-[0.05em] text-foreground">
                            REPORT PROJECT {activeSpan === "weekly" ? "MINGGUAN" : "HARIAN"}
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/40">
                                        No.
                                    </th>
                                    <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-app-accent-ink/80">
                                        Jenis Kendaraan
                                    </th>
                                    {divisions.map((div) => (
                                        <th
                                            key={div}
                                            className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-app-accent-ink"
                                        >
                                            {div}
                                        </th>
                                    ))}
                                    <th className="border-b border-white/[0.06] bg-white/[0.01] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-app-accent-ink">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {allMatrixData.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={divisions.length + 3}
                                            className="px-4 py-12 text-center text-[12px] italic text-foreground/30"
                                        >
                                            Tidak ada data untuk periode yang dipilih.
                                        </td>
                                    </tr>
                                ) : (
                                    allMatrixData.map((unit, idx) => (
                                        <tr key={unit.carId} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] even:bg-white/[0.01]">
                                            <td className="border-r border-white/[0.06] px-4 py-2.5 text-[11px] text-center text-foreground/50">
                                                {idx + 1}
                                            </td>
                                            <td className="border-r border-white/[0.06] px-4 py-2.5 text-[11px] font-medium text-foreground/80 uppercase tracking-wider">
                                                {unit.unitName}
                                            </td>
                                            {divisions.map((div) => {
                                                const hours = unit.divHours[div] || 0;
                                                return (
                                                    <td key={`cell-${unit.carId}-${div}`} className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-[11px] text-foreground/70">
                                                        {hours > 0 ? (
                                                            <span className={hours > 5 ? "font-bold text-foreground" : ""}>
                                                                {fmt(hours)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-foreground/20">0.00</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-2.5 text-center tabular-nums text-[11px] font-bold text-app-accent-ink/90">
                                                {fmt(unit.totalHours)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
