"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import type { MonitoringReferences, MonitoringTaskRecord } from "@smsystem/contracts/monitoring";
import { isNonTechnicalDivision } from "@smsystem/contracts/division";
import { createMonitoringActual } from "@/shared/api/monitoring";
import { ActionButton, CompactDateInput, CompactDateRangeInput, CompactInput, CompactSelect, CompactTextarea, FieldLabel } from "@/shared/ui/compact";
import { RefreshCcw, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { UnitTimesheetRecord } from "./Monitoring-unit-shell";

interface MonitoringEmployeeShellProps {
    date: string;
    dateTo: string;
    activeSpan: "daily" | "weekly";
    rows: UnitTimesheetRecord[];
    references: MonitoringReferences;
    plans: MonitoringTaskRecord[];
}

interface ActualFormState {
    date: string;
    planId: string;
    employeeId: string;
    divisionId: string;
    carId: string;
    jobDescription: string;
    resultNote: string;
    startTime: string;
    finishTime: string;
    breakMinutes: string;
    progressPercent: string;
    taskStatus: "ONPROGRESS" | "READY_QC" | "DONE" | "PENDING" | "CANCEL";
    location: string;
    isOvertime: boolean;
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

export function MonitoringEmployeeShell({
    date,
    dateTo,
    activeSpan,
    rows,
    references,
    plans,
}: MonitoringEmployeeShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const resolvedDateTo = dateTo ?? (activeSpan === "weekly" ? addDaysIso(date, 6) : date);

    const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());
    const [actualOpen, setActualOpen] = useState(false);
    const [actualSubmitting, setActualSubmitting] = useState(false);
    const [actualError, setActualError] = useState<string | null>(null);
    const [drilldown, setDrilldown] = useState<{ employeeKey: string; date: string; isOvertime: boolean } | null>(null);
    const [actualForm, setActualForm] = useState<ActualFormState>({
        date,
        planId: "",
        employeeId: "",
        divisionId: "",
        carId: "",
        jobDescription: "",
        resultNote: "",
        startTime: "08:00",
        finishTime: "09:00",
        breakMinutes: "0",
        progressPercent: "0",
        taskStatus: "ONPROGRESS",
        location: "",
        isOvertime: false,
    });

    const matrixDates = useMemo(() => {
        const diff = differenceInDaysInclusive(date, resolvedDateTo);
        const result: string[] = [];
        for (let i = 0; i < diff; i++) {
            result.push(addDaysIso(date, i));
        }
        return result;
    }, [date, resolvedDateTo]);

    const matrixData = useMemo(() => {
        type CellData = { normal: number; overtime: number };
        type UnitData = { carId: string; unitName: string; days: Record<string, CellData> };
        type EmpData = { employeeId: string | null; employeeName: string; days: Record<string, CellData>; units: Map<string, UnitData> };
        
        const empMap = new Map<string, EmpData>();

        for (const r of rows) {
            if (!r.employeeName) continue;

            const empKey = r.employeeId ?? r.employeeName;
            let emp = empMap.get(empKey);
            if (!emp) {
                emp = { employeeId: r.employeeId, employeeName: r.employeeName, days: {}, units: new Map() };
                empMap.set(empKey, emp);
            }

            // Employee day totals
            let empDayCell = emp.days[r.taskDate];
            if (!empDayCell) {
                empDayCell = { normal: 0, overtime: 0 };
                emp.days[r.taskDate] = empDayCell;
            }

            if (r.isOvertime) empDayCell.overtime += r.totalActualHours;
            else empDayCell.normal += r.totalActualHours;

            // Unit details
            let unit = emp.units.get(r.carId);
            if (!unit) {
                unit = { carId: r.carId, unitName: r.unitName, days: {} };
                emp.units.set(r.carId, unit);
            }

            let unitDayCell = unit.days[r.taskDate];
            if (!unitDayCell) {
                unitDayCell = { normal: 0, overtime: 0 };
                unit.days[r.taskDate] = unitDayCell;
            }

            if (r.isOvertime) unitDayCell.overtime += r.totalActualHours;
            else unitDayCell.normal += r.totalActualHours;
        }

        return Array.from(empMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [rows]);

    const selectedDivisionIsNonTechnical = useMemo(
        () => isNonTechnicalDivision(actualForm.divisionId, references.divisions),
        [actualForm.divisionId, references.divisions],
    );

    const drilldownActivities = useMemo(() => {
        if (!drilldown) return [];
        return plans.filter((plan) => {
            const employeeKey = plan.employeeId ?? plan.employeeName ?? "";
            return (
                employeeKey === drilldown.employeeKey &&
                plan.taskDate === drilldown.date &&
                plan.isOvertime === drilldown.isOvertime
            );
        });
    }, [drilldown, plans]);

    function toggleEmp(empKey: string) {
        setExpandedEmps(prev => {
            const next = new Set(prev);
            if (next.has(empKey)) next.delete(empKey);
            else next.add(empKey);
            return next;
        });
    }

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

    function openActual() {
        setActualError(null);
        setActualForm((current) => ({
            ...current,
            date,
            planId: "",
        }));
        setActualOpen(true);
    }

    function applyPlan(planId: string) {
        const plan = plans.find((item) => item.planId === planId);
        setActualForm((current) => ({
            ...current,
            planId,
            employeeId: plan?.employeeId ?? current.employeeId,
            divisionId: plan?.divisionId ? String(plan.divisionId) : current.divisionId,
            carId: plan?.carId ?? current.carId,
            jobDescription: plan?.jobDescription ?? current.jobDescription,
            startTime: plan?.planStartTime ?? current.startTime,
            finishTime: plan?.planFinishTime ?? current.finishTime,
            isOvertime: plan?.isOvertime ?? current.isOvertime,
        }));
    }

    async function submitActual() {
        setActualError(null);
        const breakMinutes = Number.parseInt(actualForm.breakMinutes || "0", 10);
        const progressPercent = Number.parseInt(actualForm.progressPercent || "0", 10);
        if (!actualForm.employeeId || !actualForm.divisionId || !actualForm.jobDescription.trim()) {
            setActualError("Lengkapi employee, divisi, dan jobDescription.");
            return;
        }

        if (!actualForm.planId && !selectedDivisionIsNonTechnical) {
            setActualError("Actual teknis harus dibuat dari plan atau countdown.");
            return;
        }

        setActualSubmitting(true);
        try {
            const result = await createMonitoringActual({
                date: actualForm.date,
                employeeId: actualForm.employeeId,
                divisionId: Number(actualForm.divisionId),
                planId: actualForm.planId || null,
                carId: actualForm.carId || null,
                jobDescription: actualForm.jobDescription.trim(),
                resultNote: actualForm.resultNote.trim() || null,
                startTime: actualForm.startTime,
                finishTime: actualForm.finishTime,
                breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : 0,
                progressPercent: Number.isFinite(progressPercent) ? progressPercent : 0,
                taskStatus: actualForm.taskStatus,
                location: actualForm.location.trim() || null,
                isOvertime: actualForm.isOvertime,
            });
            if (!result.success) {
                setActualError(result.message);
                return;
            }
            setActualOpen(false);
            router.refresh();
        } finally {
            setActualSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-white/[0.06] bg-[#0a0a0c] px-4 py-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-[14px] font-medium text-white">Monitoring Karyawan</h1>
                    <div className="h-4 w-px bg-white/[0.06]" />
                    <span className="text-[11px] text-white/40">{matrixData.length} Karyawan</span>
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
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "text-white/40 hover:text-white/70",
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
                    <ActionButton variant="primary" onClick={openActual}>
                        <Plus className="h-3.5 w-3.5" />
                        Input Actual
                    </ActionButton>
                </div>
            </div>

            <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#0a0a0c]">
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th
                                        rowSpan={2}
                                        className="border-b border-r border-white/[0.06] bg-white/[0.01] px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-white/40 align-middle"
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
                                                Work Hour
                                            </th>
                                            <th className="border-b border-r border-white/[0.06] bg-white/[0.01] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-amber-500/50">
                                                Lembur
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
                                            Tidak ada data karyawan pada periode yang dipilih.
                                        </td>
                                    </tr>
                                ) : (
                                    matrixData.map((emp) => {
                                        const empKey = emp.employeeId ?? emp.employeeName;
                                        const isExpanded = expandedEmps.has(empKey);
                                        
                                        return (
                                            <React.Fragment key={empKey}>
                                                {/* Employee Master Row */}
                                                <tr 
                                                    className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] cursor-pointer"
                                                    onClick={() => toggleEmp(empKey)}
                                                >
                                                    <td className="border-r border-white/[0.06] px-4 py-2.5 text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                        <button type="button" className="text-white/40 hover:text-white">
                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {emp.employeeName}
                                                    </td>
                                                    {matrixDates.map((d) => {
                                                        const cell = emp.days[d];
                                                        return (
                                                            <React.Fragment key={`cell-${empKey}-${d}`}>
                                                                <td
                                                                    className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-white/70 bg-white/[0.01] cursor-pointer hover:bg-white/[0.04]"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setDrilldown({ employeeKey: empKey, date: d, isOvertime: false });
                                                                    }}
                                                                >
                                                                    {cell?.normal ? fmt(cell.normal) : ""}
                                                                </td>
                                                                <td
                                                                    className="border-r border-white/[0.06] px-2 py-2.5 text-center tabular-nums text-amber-500/80 bg-white/[0.01] cursor-pointer hover:bg-white/[0.04]"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setDrilldown({ employeeKey: empKey, date: d, isOvertime: true });
                                                                    }}
                                                                >
                                                                    {cell?.overtime ? fmt(cell.overtime) : ""}
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                                
                                                {/* Expanded Units Rows */}
                                                {isExpanded && Array.from(emp.units.values()).sort((a, b) => a.unitName.localeCompare(b.unitName)).map((unit) => (
                                                    <tr key={`${empKey}-unit-${unit.carId}`} className="border-b border-white/[0.02] bg-[#050505] transition-colors hover:bg-white/[0.02]">
                                                        <td className="border-r border-white/[0.06] pl-10 pr-4 py-2 text-[10px] text-white/50 uppercase tracking-wider">
                                                            {unit.unitName}
                                                        </td>
                                                        {matrixDates.map((d) => {
                                                            const cell = unit.days[d];
                                                            return (
                                                                <React.Fragment key={`cell-${empKey}-unit-${unit.carId}-${d}`}>
                                                                    <td className="border-r border-white/[0.06] px-2 py-2 text-center tabular-nums text-[10px] text-white/40">
                                                                        {cell?.normal ? fmt(cell.normal) : ""}
                                                                    </td>
                                                                    <td className="border-r border-white/[0.06] px-2 py-2 text-center tabular-nums text-[10px] text-amber-500/50">
                                                                        {cell?.overtime ? fmt(cell.overtime) : ""}
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            {drilldown ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-3xl border border-white/10 bg-[#111114]">
                        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                            <p className="text-[12px] font-mono text-white/70">Actual Activity</p>
                            <button type="button" onClick={() => setDrilldown(null)} className="text-white/40 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto p-4">
                            {drilldownActivities.length === 0 ? (
                                <p className="py-8 text-center text-[12px] text-white/35">Belum ada detail actual pada cell ini.</p>
                            ) : (
                                <div className="space-y-2">
                                    {drilldownActivities.map((activity) => (
                                        <div key={activity.planId} className="border border-white/5 bg-[#0a0a0c] p-3 text-[12px] text-white/65">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-medium text-white">{activity.unitName}</p>
                                                <span className="font-mono text-[10px] text-amber-400">{Number(activity.targetTotalHours ?? 0) <= 0 ? "MANUAL" : "PLAN"}</span>
                                            </div>
                                            <p className="mt-1 text-white/45">{activity.divisionName ?? "-"} · {activity.jobDescription}</p>
                                            <p className="mt-2 font-mono text-[11px] text-white/55">
                                                {activity.actualStartTime ?? "-"} - {activity.actualFinishTime ?? "-"} · {activity.actualDurationHours ?? activity.totalActualHours}j · {activity.progressPercent}% · {activity.executionStatus}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {actualOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-4xl border border-white/10 bg-[#111114]">
                        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Input Actual Tanpa Plan</p>
                                <h3 className="text-[13px] font-mono text-white/80">Input Actual</h3>
                            </div>
                            <button type="button" onClick={() => setActualOpen(false)} className="text-white/40 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid gap-3 p-4 md:grid-cols-3">
                            <div>
                                <FieldLabel>Tanggal</FieldLabel>
                                <CompactInput type="date" value={actualForm.date} onChange={(event) => setActualForm((current) => ({ ...current, date: event.target.value }))} />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel>Plan Existing</FieldLabel>
                                <CompactSelect value={actualForm.planId} onChange={(event) => applyPlan(event.target.value)}>
                                    <option value="">Tanpa Plan</option>
                                    {plans.map((plan) => (
                                        <option key={plan.planId} value={plan.planId}>
                                            {plan.employeeName ?? plan.employeeId} · {plan.unitName} · {plan.jobDescription}
                                        </option>
                                    ))}
                                </CompactSelect>
                            </div>
                            <div>
                                <FieldLabel required>Employee</FieldLabel>
                                <CompactSelect value={actualForm.employeeId} onChange={(event) => setActualForm((current) => ({ ...current, employeeId: event.target.value }))}>
                                    <option value="">Pilih employee</option>
                                    {references.employees.map((employee) => (
                                        <option key={employee.value} value={employee.value}>{employee.label}</option>
                                    ))}
                                </CompactSelect>
                            </div>
                            <div>
                                <FieldLabel required>Divisi</FieldLabel>
                                <CompactSelect value={actualForm.divisionId} onChange={(event) => setActualForm((current) => ({ ...current, divisionId: event.target.value }))}>
                                    <option value="">Pilih divisi</option>
                                    {references.divisions.map((divisionOption) => (
                                        <option key={divisionOption.value} value={divisionOption.value}>{divisionOption.label}</option>
                                    ))}
                                </CompactSelect>
                            </div>
                            <div>
                                <FieldLabel>Unit</FieldLabel>
                                <CompactSelect value={actualForm.carId} onChange={(event) => setActualForm((current) => ({ ...current, carId: event.target.value }))}>
                                    <option value="">Internal / tanpa unit</option>
                                    {references.units.map((unit) => (
                                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                                    ))}
                                </CompactSelect>
                            </div>
                            <div className="md:col-span-3">
                                <FieldLabel required>Job Description</FieldLabel>
                                <CompactInput value={actualForm.jobDescription} onChange={(event) => setActualForm((current) => ({ ...current, jobDescription: event.target.value }))} placeholder="Activity / jobdesc" />
                            </div>
                            <div>
                                <FieldLabel>Start Time</FieldLabel>
                                <CompactInput type="time" value={actualForm.startTime} onChange={(event) => setActualForm((current) => ({ ...current, startTime: event.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>Finish Time</FieldLabel>
                                <CompactInput type="time" value={actualForm.finishTime} onChange={(event) => setActualForm((current) => ({ ...current, finishTime: event.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>Break Minutes</FieldLabel>
                                <CompactInput type="number" value={actualForm.breakMinutes} onChange={(event) => setActualForm((current) => ({ ...current, breakMinutes: event.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>Progress</FieldLabel>
                                <CompactInput type="number" min={0} max={100} value={actualForm.progressPercent} onChange={(event) => setActualForm((current) => ({ ...current, progressPercent: event.target.value }))} />
                            </div>
                            <div>
                                <FieldLabel>Status</FieldLabel>
                                <CompactSelect value={actualForm.taskStatus} onChange={(event) => setActualForm((current) => ({ ...current, taskStatus: event.target.value as ActualFormState["taskStatus"] }))}>
                                    <option value="ONPROGRESS">ONPROGRESS</option>
                                    <option value="READY_QC">READY_QC</option>
                                    <option value="DONE">DONE</option>
                                    <option value="PENDING">PENDING</option>
                                    <option value="CANCEL">CANCEL</option>
                                </CompactSelect>
                            </div>
                            <div>
                                <FieldLabel>Location</FieldLabel>
                                <CompactInput value={actualForm.location} onChange={(event) => setActualForm((current) => ({ ...current, location: event.target.value }))} />
                            </div>
                            <div className="md:col-span-3">
                                <FieldLabel>Actual Result</FieldLabel>
                                <CompactTextarea rows={3} value={actualForm.resultNote} onChange={(event) => setActualForm((current) => ({ ...current, resultNote: event.target.value }))} />
                            </div>
                            <label className="flex items-center gap-2 text-[12px] text-white/65">
                                <input type="checkbox" checked={actualForm.isOvertime} onChange={(event) => setActualForm((current) => ({ ...current, isOvertime: event.target.checked }))} className="h-3.5 w-3.5 accent-amber-500" />
                                Overtime
                            </label>
                            {actualError ? <p className="md:col-span-3 text-[12px] text-red-300">{actualError}</p> : null}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
                            <ActionButton onClick={() => setActualOpen(false)}>Batal</ActionButton>
                            <ActionButton variant="primary" disabled={actualSubmitting} onClick={() => { void submitActual(); }}>
                                {actualSubmitting ? "Menyimpan..." : "Simpan Actual"}
                            </ActionButton>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
