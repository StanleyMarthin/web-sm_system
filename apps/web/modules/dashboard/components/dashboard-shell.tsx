"use client";

import type { AuthUser } from "@smsystem/contracts/auth";
import type { DashboardSummaryPayload } from "@smsystem/contracts/dashboard";
import type { IssueRecord } from "@smsystem/contracts/issue";
import type { QcQueueRecord } from "@smsystem/contracts/qc";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  ShieldX,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DashboardFilterParams } from "@/shared/api/dashboard";
import type { PlanningWorkspacePayload } from "@/shared/api/planning";
import { SearchableSelect } from "@/shared/ui/compact";
import { getCalendarDayState } from "./dashboard-calendar";

interface DashboardShellProps {
  summary: DashboardSummaryPayload;
  currentUser: AuthUser | null;
  filters?: DashboardFilterParams;
  planning?: PlanningWorkspacePayload | null;
  qcQueue?: QcQueueRecord[];
  qcRework?: QcQueueRecord[];
  issueLogRows?: IssueRecord[];
  isDeferredLoading?: boolean;
}

type SpkWorkType = "all" | "normal" | "lembur";

type QcDivisionRow = {
  divisionName: string;
  okCount: number;
  reworkCount: number;
  total: number;
};

type IssueDivisionRow = {
  divisionId: string;
  divisionName: string;
  issueCount: number;
  issues: IssueRecord[];
};

type TaskMonitoringRow = {
  divisionId: number;
  divisionName: string;
  belumMulai: number;
  pending: number;
  berjalan: number;
  submit: number;
  done: number;
  totalTasks: number;
  performancePct: number;
};

type SpkDivisionRow = {
  divisionId: number;
  divisionName: string;
  units: Array<{
    carId: string;
    unitName: string;
    allocatedHours: number;
    actualHours: number;
    workType: "normal" | "lembur";
  }>;
  totalAllocated: number;
  totalActual: number;
};

type AktualDivisionRow = {
  divisionId: number;
  divisionName: string;
  units: Array<{ carId: string; unitName: string; actualHours: number }>;
  totalActual: number;
};

type CalRow = {
  carId: string;
  unitName: string;
  targetDeliveryDate: string | null;
};

function fmt(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

function fmtDec(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function fmtPct(value: number) {
  return `${fmtDec(value)}%`;
}

function fmtDate(value: string | null) {
  if (!value) return "Belum dijadwalkan";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`));
  } catch {
    return value;
  }
}

function fmtDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getGreetingLabel(reference: string) {
  try {
    const hour = Number.parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(new Date(reference)),
      10,
    );

    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 19) return "Selamat Sore";
    return "Selamat Malam";
  } catch {
    return "Selamat Datang";
  }
}

function buildHref(
  path: string,
  filters?: DashboardFilterParams,
  overrides?: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams();

  if (filters?.date) params.set("date", filters.date);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.divisionId) params.set("divisionId", filters.divisionId);
  if (filters?.unitId) params.set("unitId", filters.unitId);

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value == null || value === "") {
      params.delete(key);
      continue;
    }
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function buildIssueHref(filters?: DashboardFilterParams) {
  const params = new URLSearchParams();
  if (filters?.divisionId) params.append("filter", `divisionId:eq:${filters.divisionId}`);
  if (filters?.unitId) params.append("filter", `carId:eq:${filters.unitId}`);
  params.set("sortBy", "createdAt");
  params.set("sortDirection", "desc");

  const qs = params.toString();
  return qs ? `/issues?${qs}` : "/issues";
}

function displayName(user: AuthUser | null) {
  if (!user?.fullName) return "Tim";
  return user.fullName.split(" ")[0] ?? user.fullName;
}

function getHeaderHelperText(filters?: DashboardFilterParams, currentUser?: AuthUser | null) {
  if (filters?.unitId) return "Lagi fokus ke satu unit.";
  if (filters?.divisionId || currentUser?.divisionName) return "Pilih unit kalau mau cek lebih detail.";
  return "Pilih bagian atau unit kerja.";
}

function isTechnicalDivisionName(name: string | null | undefined) {
  const normalized = String(name ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("&", "AND")
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized) return false;

  const excluded = new Set([
    "ACCOUNTING",
    "ADVISOR",
    "ADMIN",
    "AR",
    "CUSTOMERSERVICE",
    "CONTINUOUSIMPROVEMENT",
    "HRD",
    "MIS",
    "PURCHASING",
    "WAREHOUSE",
    "GUDANG",
    "FINANCE",
    "MARKETING",
    "GENERALAFFAIR",
    "GA",
    "LEGAL",
    "TAX",
  ]);

  return !excluded.has(normalized);
}

function daysRemaining(targetDate: string | null, asOfDate?: string) {
  if (!targetDate) return null;

  try {
    const target = new Date(`${targetDate.split("T")[0]}T00:00:00.000Z`);
    const refValue = asOfDate?.split("T")[0] ?? new Date().toISOString().split("T")[0];
    const reference = new Date(`${refValue}T00:00:00.000Z`);
    return Math.ceil((target.getTime() - reference.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

function getQcFailRows(qcQueue: QcQueueRecord[], qcRework: QcQueueRecord[]) {
  const map = new Map<string, QcDivisionRow>();

  const ensure = (divisionName: string) => {
    const existing = map.get(divisionName);
    if (existing) return existing;

    const created: QcDivisionRow = {
      divisionName,
      okCount: 0,
      reworkCount: 0,
      total: 0,
    };
    map.set(divisionName, created);
    return created;
  };

  for (const row of qcQueue) {
    const divisionName = row.divisionName ?? "Tanpa Divisi";
    const target = ensure(divisionName);
    if (row.qcLastStatus === "LOLOS") target.okCount += 1;
    if (row.qcLastStatus === "TIDAK_LOLOS") target.reworkCount += 1;
  }

  for (const row of qcRework) {
    const divisionName = row.divisionName ?? "Tanpa Divisi";
    ensure(divisionName).reworkCount += 1;
  }

  return [...map.values()]
    .map((row) => ({ ...row, total: row.okCount + row.reworkCount }))
    .filter((row) => isTechnicalDivisionName(row.divisionName) && row.reworkCount > 0)
    .sort((left, right) => right.reworkCount - left.reworkCount || left.divisionName.localeCompare(right.divisionName));
}

function getIssueRows(issueLogRows: IssueRecord[]) {
  const map = new Map<string, IssueDivisionRow>();

  const ensure = (divisionId: string, divisionName: string) => {
    const existing = map.get(divisionId);
    if (existing) return existing;

    const created: IssueDivisionRow = {
      divisionId,
      divisionName,
      issueCount: 0,
      issues: [],
    };
    map.set(divisionId, created);
    return created;
  };

  for (const row of issueLogRows) {
    if (row.status === "RESOLVED" || row.status === "WAIVED") continue;
    const divisionId = row.divisionId ? String(row.divisionId) : "__tanpa_divisi__";
    const divisionName = row.divisionName?.trim() || "Tanpa Divisi";
    if (!isTechnicalDivisionName(divisionName)) continue;
    const target = ensure(divisionId, divisionName);
    target.issueCount += 1;
    target.issues.push(row);
  }

  return [...map.values()].sort((left, right) => right.issueCount - left.issueCount);
}

function getTaskMonitoringRows(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
) {
  const allocationUnits = planning?.weeklyPlan.units ?? [];

  const actualByCar = new Map(
    (summary.unitWorkHours ?? []).map((item) => [item.carId, item.actualHours]),
  );
  const progressByDivision = new Map(
    (summary.divisionKpis ?? []).map((row) => [row.divisionId, row.avgProgressPercent]),
  );

  type DivisionAccum = {
    divisionId: number;
    divisionName: string;
    units: Array<{
      carId: string;
      allocatedHours: number;
      actualHours: number;
      materialStatus: string;
    }>;
  };

  const divisionMap = new Map<number, DivisionAccum>();

  for (const unit of allocationUnits) {
    const divisionId = Number(unit.divisionId ?? 0);
    if (!divisionId || !isTechnicalDivisionName(unit.divisionName)) continue;

    if (!divisionMap.has(divisionId)) {
      divisionMap.set(divisionId, {
        divisionId,
        divisionName: unit.divisionName,
        units: [],
      });
    }

    divisionMap.get(divisionId)?.units.push({
      carId: unit.carId,
      allocatedHours: unit.allocatedHours,
      actualHours: actualByCar.get(unit.carId) ?? 0,
      materialStatus: unit.materialStatus ?? "",
    });
  }

  for (const division of summary.manhour?.byDivision ?? []) {
    if (!isTechnicalDivisionName(division.divisionName)) continue;

    if (!divisionMap.has(division.divisionId)) {
      divisionMap.set(division.divisionId, {
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        units: [],
      });
    }
  }

  const rows: TaskMonitoringRow[] = [];

  for (const [divisionId, division] of divisionMap.entries()) {
    let belumMulai = 0;
    let pending = 0;
    let berjalan = 0;
    let submit = 0;
    let done = 0;

    for (const unit of division.units) {
      const progress = unit.allocatedHours > 0 ? (unit.actualHours / unit.allocatedHours) * 100 : 0;

      if (unit.materialStatus === "HUNTING") pending += 1;
      else if (unit.actualHours === 0) belumMulai += 1;
      else if (progress >= 100) done += 1;
      else if (progress >= 80) submit += 1;
      else berjalan += 1;
    }

    const performancePct = clampPct(
      progressByDivision.get(divisionId) ??
        (division.units.length > 0
          ? ((done + submit) / Math.max(1, division.units.length)) * 100
          : 0),
    );

    rows.push({
      divisionId,
      divisionName: division.divisionName,
      belumMulai,
      pending,
      berjalan,
      submit,
      done,
      totalTasks: division.units.length,
      performancePct,
    });
  }

  return rows
    .filter((row) => row.totalTasks > 0 || progressByDivision.has(row.divisionId))
    .sort((left, right) => right.totalTasks - left.totalTasks || left.divisionName.localeCompare(right.divisionName));
}

function getSpkByDivision(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
  workType: SpkWorkType,
) {
  const actualByCar = new Map(
    (summary.unitWorkHours ?? []).map((item) => [item.carId, item.actualHours]),
  );
  const divisionMap = new Map<number, SpkDivisionRow>();

  for (const unit of planning?.weeklyPlan.units ?? []) {
    if (!unit.divisionId || !isTechnicalDivisionName(unit.divisionName)) continue;

    // API sudah mengirimkan flag lembur di payload runtime, tetapi kontrak typing
    // dashboard belum memuat field itu.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitWorkType: "normal" | "lembur" = (unit as any).isLembur ? "lembur" : "normal";
    if (workType !== "all" && unitWorkType !== workType) continue;

    const divisionId = Number(unit.divisionId);
    if (!divisionMap.has(divisionId)) {
      divisionMap.set(divisionId, {
        divisionId,
        divisionName: unit.divisionName,
        units: [],
        totalAllocated: 0,
        totalActual: 0,
      });
    }

    const actualHours = actualByCar.get(unit.carId) ?? 0;
    const division = divisionMap.get(divisionId)!;
    division.units.push({
      carId: unit.carId,
      unitName: unit.unitName,
      allocatedHours: unit.allocatedHours,
      actualHours,
      workType: unitWorkType,
    });
    division.totalAllocated += unit.allocatedHours;
    division.totalActual += actualHours;
  }

  return [...divisionMap.values()]
    .filter((division) => division.units.length > 0)
    .sort((left, right) => right.totalAllocated - left.totalAllocated);
}

function getAktualByDivision(
  summary: DashboardSummaryPayload,
  planning: PlanningWorkspacePayload | null | undefined,
  workType: SpkWorkType,
) {
  const carInfo = new Map<
    string,
    {
      unitName: string;
      divisionId: number;
      divisionName: string;
      workType: "normal" | "lembur";
    }
  >();

  for (const unit of planning?.weeklyPlan.units ?? []) {
    if (!unit.divisionId) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitWorkType: "normal" | "lembur" = (unit as any).isLembur ? "lembur" : "normal";
    carInfo.set(unit.carId, {
      unitName: unit.unitName,
      divisionId: Number(unit.divisionId),
      divisionName: unit.divisionName,
      workType: unitWorkType,
    });
  }

  const divisionMap = new Map<number, AktualDivisionRow>();

  for (const unitWork of summary.unitWorkHours ?? []) {
    if (unitWork.actualHours <= 0) continue;

    const info = carInfo.get(unitWork.carId);
    if (!info || !isTechnicalDivisionName(info.divisionName)) continue;
    if (workType !== "all" && info.workType !== workType) continue;

    if (!divisionMap.has(info.divisionId)) {
      divisionMap.set(info.divisionId, {
        divisionId: info.divisionId,
        divisionName: info.divisionName,
        units: [],
        totalActual: 0,
      });
    }

    const division = divisionMap.get(info.divisionId)!;
    division.units.push({
      carId: unitWork.carId,
      unitName: info.unitName,
      actualHours: unitWork.actualHours,
    });
    division.totalActual += unitWork.actualHours;
  }

  for (const division of summary.manhour?.byDivision ?? []) {
    if (!isTechnicalDivisionName(division.divisionName) || division.actualHours <= 0) continue;

    if (!divisionMap.has(division.divisionId)) {
      divisionMap.set(division.divisionId, {
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        units: [],
        totalActual: division.actualHours,
      });
    }
  }

  return [...divisionMap.values()]
    .filter((division) => division.totalActual > 0)
    .sort((left, right) => right.totalActual - left.totalActual);
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden border border-white/[0.05] bg-[#0d0d10] ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  href,
  hrefLabel,
  right,
}: {
  eyebrow: string;
  title?: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/25">
          {eyebrow}
        </p>
        {title ? (
          <h3 className="text-[13px] font-medium text-white">{title}</h3>
        ) : null}
        {detail ? (
          <p className="text-[11px] text-white/35">{detail}</p>
        ) : null}
      </div>
      {right ??
        (href && hrefLabel ? (
          <Link
            href={href}
            prefetch={false}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-white/30 transition hover:bg-white/[0.03] hover:text-white/60"
          >
            {hrefLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null)}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-4 font-mono text-[11px] text-white/30">
      {message}
    </div>
  );
}

function DeferredRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border border-white/[0.05] bg-[#0a0a0c] px-3 py-2"
        >
          <div className="h-3 w-2/5 animate-pulse bg-white/[0.06]" />
          <div className="mt-2 h-2 w-full animate-pulse bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

function InlineBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : tone === "danger"
          ? "border-red-500/30 bg-red-500/15 text-red-300"
          : "border-white/10 bg-white/[0.02] text-white/60";

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${className}`}
    >
      {children}
    </span>
  );
}

function MiniBar({
  value,
  colorClass,
}: {
  value: number;
  colorClass: string;
}) {
  return (
    <div className="h-1.5 bg-white/[0.05]">
      <div className={`h-1.5 ${colorClass}`} style={{ width: `${clampPct(value)}%` }} />
    </div>
  );
}

function InteractiveCalendar({
  rows,
  asOfDate,
  selectedDate,
  selectedUnitId,
  filters,
  onSelectDate,
}: {
  rows: CalRow[];
  asOfDate?: string;
  selectedDate: string;
  selectedUnitId?: string;
  filters?: DashboardFilterParams;
  onSelectDate: (date: string) => void;
}) {
  const initialDate = selectedDate || (asOfDate ?? new Date().toISOString()).split("T")[0]!;
  const [viewDate, setViewDate] = useState(() => {
    const [year, month] = initialDate.split("-").map(Number);
    return { year, month: (month ?? 1) - 1 };
  });

  const todayStr = new Date().toISOString().split("T")[0]!;
  const { year, month } = viewDate;
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month));

  const startDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];

  for (let index = 0; index < startDayIndex; index += 1) {
    cells.push({ day: null, dateStr: null });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      day,
      dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  const unitsByDate = new Map<string, CalRow[]>();
  for (const row of rows) {
    if (!row.targetDeliveryDate) continue;
    const key = row.targetDeliveryDate.split("T")[0]!;
    if (!unitsByDate.has(key)) unitsByDate.set(key, []);
    unitsByDate.get(key)?.push(row);
  }

  const selectedUnits = selectedDate
    ? unitsByDate.get(selectedDate) ?? []
    : rows.filter((r) => {
        if (!r.targetDeliveryDate) return false;
        const [y, m] = r.targetDeliveryDate.split("-").map(Number);
        return y === year && m === month + 1;
      });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            Kalender deadline
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="border border-white/[0.06] px-2 py-1 text-white/38">
              Dipilih: <b className="font-semibold text-white">{selectedDate ? fmtDate(selectedDate) : "Semua Bulan Ini"}</b>
            </span>
            <span className="border border-amber-400/35 bg-amber-400/[0.08] px-2 py-1 text-amber-300">
              Hari ini: <b className="font-semibold">{fmtDate(todayStr)}</b>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setViewDate(({ year: currentYear, month: currentMonth }) =>
                currentMonth === 0
                  ? { year: currentYear - 1, month: 11 }
                  : { year: currentYear, month: currentMonth - 1 },
              )
            }
            className="border border-white/[0.06] p-1 text-white/40 transition hover:bg-white/[0.05]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <p className="min-w-[112px] text-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={() =>
              setViewDate(({ year: currentYear, month: currentMonth }) =>
                currentMonth === 11
                  ? { year: currentYear + 1, month: 0 }
                  : { year: currentYear, month: currentMonth + 1 },
              )
            }
            className="border border-white/[0.06] p-1 text-white/40 transition hover:bg-white/[0.05]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-white/28">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-white/[0.04]">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.dateStr) {
            return <div key={`empty-${index}`} className="aspect-square bg-[#111114]" />;
          }

          const scheduledUnits = unitsByDate.get(cell.dateStr) ?? [];
          const dayState = getCalendarDayState({
            dateStr: cell.dateStr,
            selectedDate,
            todayStr,
            scheduledUnitCount: scheduledUnits.length,
          });

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => onSelectDate(cell.dateStr === selectedDate ? "all" : cell.dateStr!)}
              aria-current={dayState.isToday ? "date" : undefined}
              aria-pressed={dayState.isSelected}
              className={dayState.dayClassName}
            >
              <span>{cell.day}</span>
              {scheduledUnits.length > 0 ? (
                <span className="mt-0.5 text-[8px] leading-none text-emerald-400">
                  {scheduledUnits.length}
                </span>
              ) : null}
              {dayState.isToday ? (
                <span className="mt-1 border border-amber-400/30 px-1 py-0.5 font-mono text-[7px] uppercase leading-none text-amber-300">
                  Hari ini
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/[0.04] pt-3">
        {selectedUnits.length > 0 ? (
          <div className="space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
              {selectedDate ? `Unit deadline ${fmtDate(selectedDate)}` : `Semua unit bulan ini`} · {selectedUnits.length} unit
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedUnits.map((unit) => (
                <Link
                  key={unit.carId}
                  href={buildHref("/dashboard", filters, {
                    date: selectedDate || "all",
                    dateFrom: null,
                    dateTo: null,
                    unitId: unit.carId,
                  })}
                  prefetch={false}
                  className={`inline-flex items-center border px-2 py-1 font-mono text-[10px] leading-none transition ${
                    selectedUnitId === unit.carId
                      ? "border-amber-500/35 bg-amber-500/[0.08] text-amber-300"
                      : "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-300 hover:bg-emerald-500/[0.08]"
                  }`}
                >
                  {unit.unitName}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="font-mono text-[10px] text-white/28">
            Tidak ada unit deadline pada {selectedDate ? fmtDate(selectedDate) : "bulan ini"}.
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardShell({
  summary,
  currentUser,
  filters,
  planning,
  qcQueue = [],
  qcRework = [],
  issueLogRows = [],
  isDeferredLoading = false,
}: DashboardShellProps) {
  const router = useRouter();
  const [spkWorkType, setSpkWorkType] = useState<SpkWorkType>("all");

  const isAllAccess = currentUser?.scope?.canViewAllUnits === true;
  const lockedDivisionId = !isAllAccess && currentUser?.scope?.managedDivisionIds?.length
    ? currentUser.scope.managedDivisionIds[0]
    : null;

  useEffect(() => {
    if (lockedDivisionId != null && filters?.divisionId !== String(lockedDivisionId)) {
      router.replace(buildHref("/dashboard", filters, { divisionId: String(lockedDivisionId) }));
    }
  }, [lockedDivisionId, filters?.divisionId, router]);

  const todayStr = new Date().toISOString().split("T")[0]!;
  const selectedDate = filters?.date === "all" ? "" : (filters?.date?.trim() || todayStr);
  const activeDivisionId = lockedDivisionId != null ? String(lockedDivisionId) : (filters?.divisionId ?? "");
  const activeUnitId = filters?.unitId ?? "";

  const divisions = [
    ...(planning?.divisionOptions ?? []).map((row) => ({
      id: Number(row.value),
      name: row.label,
    })),
    ...(summary.unitProgress ?? []).map((row) => ({
      id: row.divisionId ?? 0,
      name: row.divisionName,
    })),
    ...(summary.divisionKpis ?? []).map((row) => ({
      id: row.divisionId,
      name: row.divisionName,
    })),
  ].filter((row, index, array) => row.id > 0 && array.findIndex((item) => item.id === row.id) === index);

  const units = [
    ...(planning?.deliveryRisk.rows ?? []).map((row) => ({
      id: row.carId,
      name: row.unitName,
    })),
    ...(summary.deliveryRisk?.topUnits ?? []).map((row) => ({
      id: row.carId,
      name: row.unitName,
    })),
    ...(summary.countdownOverdue ?? []).map((row) => ({
      id: row.carId,
      name: row.unitName,
    })),
  ].filter((row, index, array) => array.findIndex((item) => item.id === row.id) === index);

  const calendarRows: CalRow[] = [
    ...(planning?.weeklyPlan.units ?? []).map((row) => ({
      carId: row.carId,
      unitName: row.unitName,
      targetDeliveryDate: row.targetDeliveryDate,
    })),
    ...(summary.deliveryRisk?.topUnits ?? []).map((row) => ({
      carId: row.carId,
      unitName: row.unitName,
      targetDeliveryDate: row.targetDeliveryDate,
    })),
    ...(planning?.deliveryRisk.rows ?? []).map((row) => ({
      carId: row.carId,
      unitName: row.unitName,
      targetDeliveryDate: row.targetDeliveryDate,
    })),
  ].filter((row, index, array) => array.findIndex((item) => item.carId === row.carId) === index);

  const top5Deadline = calendarRows
    .filter((row) => row.targetDeliveryDate)
    .map((row) => ({
      ...row,
      days: daysRemaining(row.targetDeliveryDate, summary.asOfDate),
    }))
    .filter((row) => row.days !== null)
    .sort((left, right) => (left.days ?? Infinity) - (right.days ?? Infinity))
    .slice(0, 5);

  const spkRows = getSpkByDivision(planning, summary, spkWorkType);
  const aktualRows = getAktualByDivision(summary, planning, spkWorkType);
  const issueRows = getIssueRows(issueLogRows);
  const qcFailRows = getQcFailRows(qcQueue, qcRework);
  const taskRows = getTaskMonitoringRows(planning, summary);

  const greeting = getGreetingLabel(summary.generatedAt);
  const name = displayName(currentUser);
  const headerHelperText = getHeaderHelperText(filters, currentUser);
  const woIncoming = summary.pendingActions?.woApproval ?? 0;
  const prIncoming = summary.pendingActions?.prApproval ?? 0;
  const wovIncoming = summary.pendingActions?.vendorApproval ?? 0;

  const pushDashboard = (overrides?: Record<string, string | number | null | undefined>) => {
    router.push(buildHref("/dashboard", filters, overrides));
  };

  const hasScopeFilter = Boolean(filters?.divisionId || filters?.unitId || filters?.date !== todayStr);

  return (
    <div className="min-h-screen bg-[#111114]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111114] px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
            DASHBOARD OPERASIONAL
          </p>
          <h1 className="text-[22px] font-light text-white">
            {greeting}, <span className="text-amber-400">{name}</span>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {/* Filter Divisi */}
            <div className="min-w-[180px] border border-white/10 bg-[#1a1a1f] text-[12px] text-white">
              <SearchableSelect
                value={activeDivisionId}
                onChange={(value) =>
                  pushDashboard({
                    date: selectedDate || null,
                    dateFrom: null,
                    dateTo: null,
                    divisionId: value || null,
                    unitId: null,
                  })
                }
                options={lockedDivisionId != null 
                  ? [{ value: String(lockedDivisionId), label: divisions.find((row) => row.id === lockedDivisionId)?.name ?? "Bagian saya" }]
                  : divisions.map((row) => ({ value: String(row.id), label: row.name }))
                }
                placeholder="Semua divisi"
                disabled={lockedDivisionId != null}
              />
            </div>
            {/* Filter Unit */}
            <div className="min-w-[180px] border border-white/10 bg-[#1a1a1f] text-[12px] text-white">
              <SearchableSelect
                value={activeUnitId}
                onChange={(value) =>
                  pushDashboard({
                    date: selectedDate || null,
                    dateFrom: null,
                    dateTo: null,
                    unitId: value || null,
                  })
                }
                options={units.map((row) => ({ value: row.id, label: row.name }))}
                placeholder="Semua unit"
              />
            </div>
            {/* Reset filter */}
            {(activeDivisionId || activeUnitId) ? (
              <button
                type="button"
                onClick={() => pushDashboard({ divisionId: null, unitId: null, date: null })}
                className="border border-white/[0.08] px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40 transition hover:bg-white/[0.04] hover:text-white/70"
              >
                Reset
              </button>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/35">
            <span className="mr-2 text-white/15">|</span>
            {fmtDate(todayStr)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader
            eyebrow="Timeline"
            title="Calendar-first Deadline View"
            detail="Tanggal aktif dashboard mengikuti pilihan kalender."
            href={buildHref("/reports/delivery-accuracy", filters)}
            hrefLabel="Delivery risk"
            right={
              selectedDate !== todayStr ? (
                <button
                  type="button"
                  onClick={() =>
                    pushDashboard({
                      date: todayStr,
                      dateFrom: null,
                      dateTo: null,
                    })
                  }
                  className="inline-flex items-center gap-1 border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300 transition hover:bg-amber-500/[0.14]"
                >
                  Hari ini
                </button>
              ) : null
            }
          />
          <div className="px-3 py-3">
            <InteractiveCalendar
              key={selectedDate}
              rows={calendarRows}
              asOfDate={summary.asOfDate}
              selectedDate={selectedDate}
              selectedUnitId={activeUnitId}
              filters={filters}
              onSelectDate={(date) =>
                pushDashboard({
                  date,
                  dateFrom: null,
                  dateTo: null,
                  divisionId: activeDivisionId || null,
                  unitId: activeUnitId || null,
                })
              }
            />
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="flex-1">
            <SectionHeader eyebrow="Prioritas" title="5 Unit Mendekati Deadline" />
            <div className="divide-y divide-white/[0.04]">
              {top5Deadline.length > 0 ? (
                top5Deadline.map((unit) => {
                  const tone =
                    unit.days == null || unit.days > 7
                      ? "neutral"
                      : unit.days < 0 || unit.days <= 3
                        ? "danger"
                        : "warn";

                  return (
                    <Link
                      key={unit.carId}
                      href={buildHref("/dashboard", filters, {
                        date: unit.targetDeliveryDate?.split("T")[0] ?? selectedDate,
                        dateFrom: null,
                        dateTo: null,
                        unitId: unit.carId,
                      })}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-[12px] font-medium text-white">
                          {unit.unitName}
                        </p>
                        <p className="font-mono text-[10px] text-white/35">
                          {fmtDate(unit.targetDeliveryDate)}
                        </p>
                      </div>
                      <InlineBadge tone={tone}>
                        {unit.days == null
                          ? "Belum pasti"
                          : unit.days < 0
                            ? `+${Math.abs(unit.days)}h lewat`
                            : unit.days === 0
                              ? "Hari ini"
                              : `${unit.days}h lagi`}
                      </InlineBadge>
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-3">
                  <EmptyState message="Belum ada unit dengan target delivery aktif." />
                </div>
              )}
            </div>
          </Card>

          <div className="border border-white/[0.05] bg-[#0d0d10] p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/30">
              PERMINTAAN MASUK HARI INI
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-white/[0.05] bg-white/[0.01] p-3">
                <p className="mb-1 font-mono text-[9px] uppercase text-white/25">WORK ORDER (WO)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-amber-400">{fmt(woIncoming)}</p>
              </div>
              <div className="border border-white/[0.05] bg-white/[0.01] p-3">
                <p className="mb-1 font-mono text-[9px] uppercase text-white/25">PURCHASE REQUEST (PR)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-sky-400">{fmt(prIncoming)}</p>
              </div>
              <div className="border border-white/[0.05] bg-white/[0.01] p-3">
                <p className="mb-1 font-mono text-[9px] uppercase text-white/25">WO VENDOR (WOV)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-white">{fmt(wovIncoming)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SPK table section */}
      <div className="px-3 pb-3">
        <div className="border border-white/[0.05] bg-[#0d0d10]">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <div className="flex gap-4">
              {(["all", "normal", "lembur"] as SpkWorkType[]).map((type) => {
                const label = type === "all" ? "SEMUA" : type === "normal" ? "NORMAL (SPK)" : "LEMBUR (SPL)";
                const isActive = spkWorkType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setSpkWorkType(type)}
                    className={`font-mono text-[11px] uppercase tracking-widest ${
                      isActive
                        ? "border-b-2 border-amber-400 pb-1 text-amber-400"
                        : "text-white/35 transition hover:text-white/60"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[11px] text-white/30">
              {selectedDate === todayStr ? "Hari ini" : "Filter"} · {fmtDate(selectedDate || todayStr)}
            </p>
          </div>
          
          <div className="grid grid-cols-[140px_1fr_100px_100px_100px] border-b border-white/[0.05] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white/25">
            <div>DIVISI</div>
            <div>UNIT</div>
            <div>TARGET JAM</div>
            <div>AKTUAL</div>
            <div>STATUS</div>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {spkRows.map((division) => (
              division.units.map((unit, idx) => {
                let statusBadge = "";
                let statusClass = "";
                if (unit.actualHours === 0) {
                  statusBadge = "BELUM";
                  statusClass = "border-red-500/25 bg-red-500/15 text-red-300";
                } else if (unit.actualHours >= unit.allocatedHours) {
                  statusBadge = "SELESAI";
                  statusClass = "border-emerald-500/25 bg-emerald-500/15 text-emerald-300";
                } else {
                  statusBadge = "JALAN";
                  statusClass = "border-sky-500/25 bg-sky-500/15 text-sky-300";
                }

                return (
                  <div key={`${division.divisionId}-${unit.carId}`} className="grid grid-cols-[140px_1fr_100px_100px_100px] items-center border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]">
                    <div className="truncate pr-4 text-[11px] text-white/35">
                      {idx === 0 ? division.divisionName : ""}
                    </div>
                    <div className="truncate pr-4 text-[13px] font-medium text-white">
                      {unit.unitName}
                    </div>
                    <div className="font-mono text-[12px] text-white/50">
                      {fmtDec(unit.allocatedHours)}j
                    </div>
                    <div className="font-mono text-[13px] font-semibold text-amber-300">
                      {unit.actualHours > 0 ? `${fmtDec(unit.actualHours)}j` : <span className="text-white/20">–</span>}
                    </div>
                    <div>
                      <span className={`inline-block border px-2 py-0.5 font-mono text-[9px] uppercase ${statusClass}`}>
                        {statusBadge}
                      </span>
                    </div>
                  </div>
                );
              })
            ))}
            {spkRows.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-white/30">
                Tidak ada data SPK
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-3 pb-3 xl:grid-cols-2">
        {/* Issue Log Belum Selesai */}
        <div className="border border-white/[0.05] bg-[#0d0d10]">
          <SectionHeader
            eyebrow="ISSUE LOG BELUM SELESAI"
          />
          <div className="grid grid-cols-[1fr_80px_80px] border-b border-white/[0.05] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white/25">
            <div>DIVISI</div>
            <div className="text-center">OPEN</div>
            <div className="text-center">HIGH</div>
          </div>
          <div>
            {issueRows.map((row) => {
              const highIssues = row.issues.filter(i => i.severity === "HIGH" || i.isUrgent).length;
              return (
                <div key={row.divisionId} className="grid grid-cols-[1fr_80px_80px] items-center border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="truncate pr-4 text-[13px] text-white">
                    {row.divisionName}
                  </div>
                  <div className="text-center">
                    <span className="inline-block min-w-[28px] border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-center font-mono text-[11px] font-bold text-amber-300">
                      {row.issueCount}
                    </span>
                  </div>
                  <div className="text-center">
                    {highIssues > 0 ? (
                      <span className="inline-block min-w-[28px] border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-center font-mono text-[11px] font-bold text-red-300">
                        {highIssues}
                      </span>
                    ) : (
                      <span className="font-mono text-white/20">–</span>
                    )}
                  </div>
                </div>
              );
            })}
            {issueRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-white/30">
                Tidak ada issue open
              </div>
            )}
          </div>
        </div>

        {/* QC Tidak Lolos */}
        <div className="border border-white/[0.05] bg-[#0d0d10]">
          <SectionHeader
            eyebrow="QC TIDAK LOLOS"
          />
          <div className="grid grid-cols-[1fr_120px] border-b border-white/[0.05] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white/25">
            <div>DIVISI</div>
            <div>HASIL</div>
          </div>
          <div>
            {qcFailRows.map((row) => (
              <div key={row.divisionName} className="grid grid-cols-[1fr_120px] items-center border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]">
                <div className="truncate pr-4 text-[13px] text-white">
                  {row.divisionName}
                </div>
                <div>
                  {row.reworkCount > 0 ? (
                    <span className="inline-block border border-red-500/25 bg-red-500/15 px-2 py-0.5 font-mono text-[10px] uppercase text-red-300">
                      {row.reworkCount} GAGAL
                    </span>
                  ) : (
                    <span className="inline-block border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-300">
                      LOLOS
                    </span>
                  )}
                </div>
              </div>
            ))}
            {qcFailRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-white/30">
                Tidak ada QC gagal
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="border border-white/[0.05] bg-[#0d0d10]">
          <SectionHeader eyebrow="CONTROL MONITORING PER DIVISI" />
          <div className="grid grid-cols-[minmax(150px,1fr)_80px_80px_80px_80px_80px_140px] border-b border-white/[0.05] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white/25">
            <div>DIVISI</div>
            <div className="text-center">BLM MULAI</div>
            <div className="text-center">PENDING</div>
            <div className="text-center">BERJALAN</div>
            <div className="text-center">SUBMIT</div>
            <div className="text-center">DONE</div>
            <div>PERFORMA</div>
          </div>
          <div>
            {taskRows.map((row) => {
              const renderBadge = (count: number, type: 'amber' | 'sky' | 'plain') => {
                if (count === 0) return <span className="text-white/15">0</span>;
                if (type === 'plain') return <span className="font-mono text-white/50">{count}</span>;
                const classes = type === 'amber' 
                  ? 'border-amber-500/25 bg-amber-500/15 text-amber-300'
                  : 'border-sky-500/25 bg-sky-500/15 text-sky-300';
                return <span className={`inline-block border px-2 py-0.5 font-mono text-[11px] font-bold ${classes}`}>{count}</span>;
              };

              let perfColor = "bg-emerald-400";
              let perfText = "text-emerald-400";
              if (row.performancePct < 50) {
                perfColor = "bg-red-400";
                perfText = "text-red-400";
              } else if (row.performancePct < 80) {
                perfColor = "bg-amber-400";
                perfText = "text-amber-400";
              }

              return (
                <div key={row.divisionId} className="grid grid-cols-[minmax(150px,1fr)_80px_80px_80px_80px_80px_140px] items-center border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="truncate pr-4 text-[13px] text-white">
                    {row.divisionName}
                  </div>
                  <div className="text-center">{renderBadge(row.belumMulai, 'amber')}</div>
                  <div className="text-center">{renderBadge(row.pending, 'amber')}</div>
                  <div className="text-center">{renderBadge(row.berjalan, 'sky')}</div>
                  <div className="text-center">{renderBadge(row.submit, 'sky')}</div>
                  <div className="text-center">{renderBadge(row.done, 'plain')}</div>
                  <div className="flex items-center gap-3">
                    <span className={`w-10 font-mono text-[11px] font-bold ${perfText}`}>
                      {fmtPct(row.performancePct)}
                    </span>
                    <div className="h-1 w-16 bg-white/[0.06]">
                      <div className={`h-1 ${perfColor}`} style={{ width: `${clampPct(row.performancePct)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {taskRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-white/30">
                Belum ada data monitoring
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
