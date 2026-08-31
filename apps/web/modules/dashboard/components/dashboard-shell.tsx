"use client";

import type { AuthUser } from "@smsystem/contracts/auth";
import type { DashboardSummaryPayload } from "@smsystem/contracts/dashboard";
import type { CalendarDayOverride } from "@smsystem/contracts/calendar";
import type { IssueRecord } from "@smsystem/contracts/issue";
import type { JobPlanRecord } from "@smsystem/contracts/job-plan";
import type { QcQueueRecord } from "@smsystem/contracts/qc";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  jobPlanRows?: JobPlanRecord[];
  holidayOverrides?: CalendarDayOverride[];
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
    planId: string;
    unitName: string;
    targetHours: number;
    actualHours: number;
    workType: "normal" | "lembur";
  }>;
  totalTarget: number;
  totalActual: number;
};

type CalRow = {
  carId: string;
  unitName: string;
  targetDeliveryDate: string | null;
};

type UnitDeadlineProgress = {
  actualHours: number;
  targetHours: number;
  progressPct: number;
  jobCount: number;
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

function fmtWorkHours(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}`;
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

function displayName(user: AuthUser | null) {
  if (!user?.fullName) return "Tim";
  return user.fullName.split(" ")[0] ?? user.fullName;
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
    "QA",
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

function deadlineMargin(days: number | null) {
  if (days == null) {
    return { label: "Belum pasti", detail: "Tanggal belum ada", compact: "Belum pasti", tone: "neutral" as const };
  }

  if (days <= 0) {
    return {
      label: "Non margin",
      detail: days < 0 ? `${Math.abs(days)} hari lewat` : "Deadline hari ini",
      compact: days < 0 ? `Non margin +${Math.abs(days)}h` : "Non margin",
      tone: "danger" as const,
    };
  }

  return {
    label: "Margin",
    detail: `${days} hari tersisa`,
    compact: `Margin ${days}h`,
    tone: days <= 3 ? ("warn" as const) : ("neutral" as const),
  };
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

function getJobPlanActualHours(row: JobPlanRecord) {
  if (row.actualProgressPercent != null && row.actualProgressPercent > 0) {
    return (row.targetHours * clampPct(row.actualProgressPercent)) / 100;
  }

  if (row.actualStatus === "DONE" || row.status === "DONE" || row.status === "READY_QC") {
    return row.targetHours;
  }

  return 0;
}

function getSpkByDivision(
  rows: JobPlanRecord[],
  workType: SpkWorkType,
  activeUnitName?: string | null,
) {
  const divisionMap = new Map<number, SpkDivisionRow>();

  for (const row of rows) {
    if (!row.divisionId || !isTechnicalDivisionName(row.divisionName)) continue;
    if (activeUnitName && row.unitName !== activeUnitName) continue;

    const unitWorkType: "normal" | "lembur" = row.isOvertime ? "lembur" : "normal";
    if (workType !== "all" && unitWorkType !== workType) continue;

    const divisionId = Number(row.divisionId);
    if (!divisionMap.has(divisionId)) {
      divisionMap.set(divisionId, {
        divisionId,
        divisionName: row.divisionName,
        units: [],
        totalTarget: 0,
        totalActual: 0,
      });
    }

    const actualHours = getJobPlanActualHours(row);
    const division = divisionMap.get(divisionId)!;
    division.units.push({
      planId: row.planId,
      unitName: row.unitName,
      targetHours: row.targetHours,
      actualHours,
      workType: unitWorkType,
    });
    division.totalTarget += row.targetHours;
    division.totalActual += actualHours;
  }

  return [...divisionMap.values()]
    .filter((division) => division.units.length > 0)
    .sort((left, right) => right.totalTarget - left.totalTarget);
}

function getUnitDeadlineProgress(rows: JobPlanRecord[]) {
  type Accum = {
    unitName: string;
    actualHours: number;
    targetHours: number;
    jobCount: number;
  };

  const map = new Map<string, Accum>();

  const ensure = (key: string, unitName: string) => {
    const existing = map.get(key);
    if (existing) return existing;

    const created: Accum = {
      unitName,
      actualHours: 0,
      targetHours: 0,
      jobCount: 0,
    };
    map.set(key, created);
    return created;
  };

  for (const row of rows) {
    const keys = [row.draftCarId, row.unitName].filter((value): value is string => Boolean(value));
    if (keys.length === 0) continue;

    const actualHours = getJobPlanActualHours(row);
    for (const key of keys) {
      const target = ensure(key, row.unitName);
      target.actualHours += actualHours;
      target.targetHours += row.targetHours;
      target.jobCount += 1;
    }
  }

  const result = new Map<string, UnitDeadlineProgress>();

  for (const [key, item] of map.entries()) {
    result.set(key, {
      actualHours: item.actualHours,
      targetHours: item.targetHours,
      progressPct: clampPct(item.targetHours > 0 ? (item.actualHours / item.targetHours) * 100 : 0),
      jobCount: item.jobCount,
    });
  }

  return result;
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
      className={`overflow-hidden border border-border bg-card ${className}`}
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
        <p className="font-mono text-[14px] uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        {title ? (
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        ) : null}
        {detail ? (
          <p className="text-[15px] text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      {right ??
        (href && hrefLabel ? (
          <Link
            href={href}
            prefetch={false}
            className="inline-flex items-center gap-1 font-mono text-[14px] uppercase tracking-widest text-muted-foreground transition hover:bg-accent hover:text-foreground"
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
    <div className="border border-dashed border-border bg-muted px-3 py-4 font-mono text-[15px] text-muted-foreground">
      {message}
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
      ? "border-success/30 bg-success/15 text-success"
      : tone === "warn"
        ? "border-primary/30 bg-primary/15 text-app-accent-ink"
        : tone === "danger"
          ? "border-destructive/30 bg-destructive/15 text-destructive"
          : "border-border bg-muted text-foreground";

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[14px] uppercase tracking-widest ${className}`}
    >
      {children}
    </span>
  );
}

function InteractiveCalendar({
  rows,
  asOfDate,
  selectedDate,
  selectedUnitId,
  filters,
  onSelectDate,
  holidayByDate,
}: {
  rows: CalRow[];
  asOfDate?: string;
  selectedDate: string;
  selectedUnitId?: string;
  filters?: DashboardFilterParams;
  onSelectDate: (date: string) => void;
  holidayByDate?: Record<string, string>;
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
            Kalender deadline
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
            <span className="border border-border px-2 py-1 text-muted-foreground">
              Dipilih: <b className="font-semibold text-foreground">{selectedDate ? fmtDate(selectedDate) : "Semua Bulan Ini"}</b>
            </span>
            <span className="border border-primary/35 bg-primary/[0.08] px-2 py-1 text-app-accent-ink">
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
            className="border border-border p-1 text-muted-foreground transition hover:bg-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <p className="min-w-[112px] text-center font-mono text-[15px] font-semibold uppercase tracking-[0.12em] text-foreground">
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
            className="border border-border p-1 text-muted-foreground transition hover:bg-accent"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.dateStr) {
            return <div key={`empty-${index}`} className="aspect-square bg-card" />;
          }

          const scheduledUnits = unitsByDate.get(cell.dateStr) ?? [];
          const margin = scheduledUnits.length > 0 ? deadlineMargin(daysRemaining(cell.dateStr, asOfDate)) : null;
          const holidayLabel = holidayByDate?.[cell.dateStr] ?? null;
          const dayState = getCalendarDayState({
            dateStr: cell.dateStr,
            selectedDate,
            todayStr,
            scheduledUnitCount: scheduledUnits.length,
            isHoliday: holidayLabel != null,
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
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {cell.day}
              </span>
              {scheduledUnits.length > 0 ? (
                <span className="mt-1 flex min-w-0 flex-col gap-0.5">
                  {margin ? (
                    <span
                      className={`mb-0.5 self-start border px-1.5 py-0.5 font-mono text-[10px] uppercase leading-none ${
                        margin.tone === "danger"
                          ? "border-destructive/30 bg-destructive/15 text-destructive"
                          : margin.tone === "warn"
                            ? "border-primary/30 bg-primary/15 text-app-accent-ink"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {margin.compact}
                    </span>
                  ) : null}
                  {scheduledUnits.slice(0, 3).map((unit) => (
                    <span
                      key={unit.carId}
                      className="truncate font-mono text-[11px] font-semibold leading-tight text-success"
                      title={unit.unitName}
                    >
                      {unit.unitName}
                    </span>
                  ))}
                  {scheduledUnits.length > 3 ? (
                    <span className="font-mono text-[11px] font-semibold leading-tight text-muted-foreground">
                      +{scheduledUnits.length - 3} unit
                    </span>
                  ) : null}
                </span>
              ) : null}
              {holidayLabel ? (
                <span
                  className="mt-auto self-start max-w-full truncate border border-destructive/30 bg-destructive/10 px-1 py-0.5 font-mono text-[11px] uppercase leading-none text-destructive"
                  title={holidayLabel}
                >
                  {holidayLabel}
                </span>
              ) : null}
              {dayState.isToday ? (
                <span className="mt-auto self-start border border-primary/30 px-1 py-0.5 font-mono text-[11px] uppercase leading-none text-app-accent-ink">
                  Hari ini
                </span>
              ) : null}
            </button>
          );
        })}
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
  jobPlanRows = [],
  holidayOverrides = [],
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
  }, [lockedDivisionId, filters, filters?.divisionId, router]);

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
  const activeUnitName = activeUnitId
    ? units.find((row) => row.id === activeUnitId)?.name ?? null
    : null;

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

  const holidayByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const override of holidayOverrides) {
      if (override.mode === "LIBUR") {
        map[override.date] = override.note ?? "Libur";
      }
    }
    return map;
  }, [holidayOverrides]);

  const top5Deadline = calendarRows
    .filter((row) => row.targetDeliveryDate)
    .map((row) => ({
      ...row,
      days: daysRemaining(row.targetDeliveryDate, summary.asOfDate),
    }))
    .filter((row) => row.days !== null)
    .sort((left, right) => (left.days ?? Infinity) - (right.days ?? Infinity))
    .slice(0, 5);
  const unitDeadlineProgress = getUnitDeadlineProgress(jobPlanRows);

  const spkRows = getSpkByDivision(jobPlanRows, spkWorkType, activeUnitName);
  const issueRows = getIssueRows(issueLogRows);
  const qcFailRows = getQcFailRows(qcQueue, qcRework);
  const taskRows = getTaskMonitoringRows(planning, summary);

  const greeting = getGreetingLabel(summary.generatedAt);
  const name = displayName(currentUser);
  const woIncoming = summary.pendingActions?.woApproval ?? 0;
  const prIncoming = summary.pendingActions?.prApproval ?? 0;
  const wovIncoming = summary.pendingActions?.vendorApproval ?? 0;

  const pushDashboard = (overrides?: Record<string, string | number | null | undefined>) => {
    router.push(buildHref("/dashboard", filters, overrides));
  };

  return (
    <div className="min-h-screen bg-card">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <p className="font-mono text-[14px] uppercase tracking-widest text-muted-foreground">
            DASHBOARD OPERASIONAL
          </p>
          <h1 className="text-[24px] font-semibold text-foreground">
            {greeting}, <span className="text-app-accent-ink">{name}</span>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {/* Filter Divisi */}
            <div className="min-w-[180px] border border-border bg-popover text-[14px] text-foreground">
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
            <div className="min-w-[180px] border border-border bg-popover text-[14px] text-foreground">
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
                className="border border-border px-2 py-1.5 font-mono text-[14px] uppercase tracking-widest text-muted-foreground transition hover:bg-border hover:text-foreground"
              >
                Reset
              </button>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[15px] text-muted-foreground">
            <span className="mr-2 text-muted-foreground">|</span>
            {fmtDate(todayStr)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader
            eyebrow="Timeline"
            title="Kalendar Deadline"
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
                  className="inline-flex items-center gap-1 border border-primary/25 bg-primary/[0.08] px-2 py-1 font-mono text-[14px] uppercase tracking-[0.12em] text-app-accent-ink transition hover:bg-primary/[0.14]"
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
              holidayByDate={holidayByDate}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <SectionHeader eyebrow="Prioritas" title="5 Unit Mendekati Deadline" />
            <div className="divide-y divide-border">
              {top5Deadline.length > 0 ? (
                top5Deadline.map((unit) => {
                  const margin = deadlineMargin(unit.days);
                  const progress = unitDeadlineProgress.get(unit.carId) ?? unitDeadlineProgress.get(unit.unitName);
                  const progressPct = progress?.progressPct ?? 0;

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
                      className="block px-3 py-3 transition hover:bg-accent"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-[15px] font-semibold text-foreground">
                              {unit.unitName}
                            </p>
                            <p className="font-mono text-[13px] text-muted-foreground">
                              Deadline {fmtDate(unit.targetDeliveryDate)}
                            </p>
                          </div>
                          <InlineBadge tone={margin.tone}>
                            {margin.label}
                          </InlineBadge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
                          <span className="border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                            {margin.detail}
                          </span>
                          {progress ? (
                            <span className="border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                              {fmt(progress.jobCount)} SPK
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 font-mono text-[12px] text-muted-foreground">
                            <span>Progress</span>
                            <span className="font-semibold text-foreground">
                              {progress ? fmtPct(progressPct) : "Belum ada SPK"}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden border border-border bg-muted">
                            <div
                              className={`h-full ${
                                margin.tone === "danger"
                                  ? "bg-destructive"
                                  : margin.tone === "warn"
                                    ? "bg-primary"
                                    : "bg-success"
                              }`}
                              style={{ width: `${progress ? progressPct : 0}%` }}
                            />
                          </div>
                        </div>
                        {progress ? (
                          <p className="font-mono text-[12px] text-muted-foreground">
                            {fmtWorkHours(progress.actualHours)} / {fmtWorkHours(progress.targetHours)} · {fmt(progress.jobCount)} pekerjaan
                          </p>
                        ) : null}
                      </div>
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

          <div className="border border-border bg-card p-3">
            <p className="mb-2 font-mono text-[14px] uppercase tracking-widest text-muted-foreground">
              PERMINTAAN MASUK HARI INI
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-border bg-muted p-3">
                <p className="mb-1 font-mono text-[15px] uppercase text-muted-foreground">WORK ORDER (WO)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-app-accent-ink">{fmt(woIncoming)}</p>
              </div>
              <div className="border border-border bg-muted p-3">
                <p className="mb-1 font-mono text-[15px] uppercase text-muted-foreground">PURCHASE REQUEST (PR)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-info">{fmt(prIncoming)}</p>
              </div>
              <div className="border border-border bg-muted p-3">
                <p className="mb-1 font-mono text-[15px] uppercase text-muted-foreground">WO VENDOR (WOV)</p>
                <p className="font-mono text-[32px] font-bold leading-none text-foreground">{fmt(wovIncoming)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SPK table section */}
      <div className="px-3 pb-3">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex gap-4">
              {(["all", "normal", "lembur"] as SpkWorkType[]).map((type) => {
                const label = type === "all" ? "SEMUA" : type === "normal" ? "NORMAL (SPK)" : "LEMBUR (SPL)";
                const isActive = spkWorkType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setSpkWorkType(type)}
                    className={`font-mono text-[15px] uppercase tracking-widest ${
                      isActive
                        ? "border-b-2 border-primary pb-1 text-app-accent-ink"
                        : "text-muted-foreground transition hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[15px] text-muted-foreground">
              {selectedDate === todayStr ? "Hari ini" : "Filter"} · {fmtDate(selectedDate || todayStr)}
            </p>
          </div>
          
          <div className="grid grid-cols-[140px_1fr_120px_120px] border-b border-border px-4 py-2 font-mono text-[15px] uppercase tracking-widest text-muted-foreground">
            <div>DIVISI</div>
            <div>UNIT</div>
            <div>TARGET JAM</div>
            <div>AKTUAL</div>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {spkRows.map((division) => (
              division.units.map((unit, idx) => (
                <div key={`${division.divisionId}-${unit.planId}`} className="grid grid-cols-[140px_1fr_120px_120px] items-center border-b border-border px-4 py-2.5 hover:bg-muted">
                  <div className="truncate pr-4 text-[15px] text-muted-foreground">
                    {idx === 0 ? division.divisionName : ""}
                  </div>
                  <div className="truncate pr-4 text-[15px] font-semibold text-foreground">
                    {unit.unitName}
                  </div>
                  <div className="font-mono text-[14px] text-foreground">
                    {fmtWorkHours(unit.targetHours)}
                  </div>
                  <div className="font-mono text-[15px] font-semibold text-app-accent-ink">
                    {fmtWorkHours(unit.actualHours)}
                  </div>
                </div>
              ))
            ))}
            {spkRows.length === 0 && (
              <div className="px-4 py-8 text-center text-[14px] text-muted-foreground">
                Tidak ada data SPK
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-3 pb-3 xl:grid-cols-2">
        {/* Issue Log Belum Selesai */}
        <div className="border border-border bg-card">
          <SectionHeader
            eyebrow="ISSUE LOG BELUM SELESAI"
          />
          <div className="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2 font-mono text-[15px] uppercase tracking-widest text-muted-foreground">
            <div>DIVISI</div>
            <div className="text-center">OPEN</div>
            <div className="text-center">HIGH</div>
          </div>
          <div>
            {issueRows.map((row) => {
              const highIssues = row.issues.filter(i => i.severity === "HIGH" || i.isUrgent).length;
              return (
                <div key={row.divisionId} className="grid grid-cols-[1fr_80px_80px] items-center border-b border-border px-4 py-2.5 hover:bg-muted">
                  <div className="truncate pr-4 text-[15px] text-foreground">
                    {row.divisionName}
                  </div>
                  <div className="text-center">
                    <span className="inline-block min-w-[28px] border border-primary/25 bg-primary/15 px-2 py-0.5 text-center font-mono text-[15px] font-bold text-app-accent-ink">
                      {row.issueCount}
                    </span>
                  </div>
                  <div className="text-center">
                    {highIssues > 0 ? (
                      <span className="inline-block min-w-[28px] border border-destructive/25 bg-destructive/15 px-2 py-0.5 text-center font-mono text-[15px] font-bold text-destructive">
                        {highIssues}
                      </span>
                    ) : (
                      <span className="font-mono text-muted-foreground">–</span>
                    )}
                  </div>
                </div>
              );
            })}
            {issueRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[14px] text-muted-foreground">
                Tidak ada issue open
              </div>
            )}
          </div>
        </div>

        {/* QC Tidak Lolos */}
        <div className="border border-border bg-card">
          <SectionHeader
            eyebrow="QC TIDAK LOLOS"
          />
          <div className="grid grid-cols-[1fr_120px] border-b border-border px-4 py-2 font-mono text-[15px] uppercase tracking-widest text-muted-foreground">
            <div>DIVISI</div>
            <div>HASIL</div>
          </div>
          <div>
            {qcFailRows.map((row) => (
              <div key={row.divisionName} className="grid grid-cols-[1fr_120px] items-center border-b border-border px-4 py-2.5 hover:bg-muted">
                <div className="truncate pr-4 text-[15px] text-foreground">
                  {row.divisionName}
                </div>
                <div>
                  {row.reworkCount > 0 ? (
                    <span className="inline-block border border-destructive/25 bg-destructive/15 px-2 py-0.5 font-mono text-[14px] uppercase text-destructive">
                      {row.reworkCount} GAGAL
                    </span>
                  ) : (
                    <span className="inline-block border border-success/25 bg-success/15 px-2 py-0.5 font-mono text-[14px] uppercase text-success">
                      LOLOS
                    </span>
                  )}
                </div>
              </div>
            ))}
            {qcFailRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[14px] text-muted-foreground">
                Tidak ada QC gagal
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="border border-border bg-card">
          <SectionHeader eyebrow="CONTROL MONITORING PER DIVISI" />
          <div className="grid grid-cols-[minmax(150px,1fr)_80px_80px_80px_80px_80px_140px] border-b border-border px-4 py-2 font-mono text-[15px] uppercase tracking-widest text-muted-foreground">
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
                if (count === 0) return <span className="text-muted-foreground">0</span>;
                if (type === 'plain') return <span className="font-mono text-foreground">{count}</span>;
                const classes = type === 'amber' 
                  ? 'border-primary/25 bg-primary/15 text-app-accent-ink'
                  : 'border-info/25 bg-info/15 text-info';
                return <span className={`inline-block border px-2 py-0.5 font-mono text-[15px] font-bold ${classes}`}>{count}</span>;
              };

              let perfColor = "bg-success";
              let perfText = "text-success";
              if (row.performancePct < 50) {
                perfColor = "bg-destructive";
                perfText = "text-destructive";
              } else if (row.performancePct < 80) {
                perfColor = "bg-primary";
                perfText = "text-app-accent-ink";
              }

              return (
                <div key={row.divisionId} className="grid grid-cols-[minmax(150px,1fr)_80px_80px_80px_80px_80px_140px] items-center border-b border-border px-4 py-2.5 hover:bg-muted">
                  <div className="truncate pr-4 text-[15px] text-foreground">
                    {row.divisionName}
                  </div>
                  <div className="text-center">{renderBadge(row.belumMulai, 'amber')}</div>
                  <div className="text-center">{renderBadge(row.pending, 'amber')}</div>
                  <div className="text-center">{renderBadge(row.berjalan, 'sky')}</div>
                  <div className="text-center">{renderBadge(row.submit, 'sky')}</div>
                  <div className="text-center">{renderBadge(row.done, 'plain')}</div>
                  <div className="flex items-center gap-3">
                    <span className={`w-10 font-mono text-[15px] font-bold ${perfText}`}>
                      {fmtPct(row.performancePct)}
                    </span>
                    <div className="h-1 w-16 bg-border">
                      <div className={`h-1 ${perfColor}`} style={{ width: `${clampPct(row.performancePct)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {taskRows.length === 0 && (
              <div className="px-4 py-6 text-center text-[14px] text-muted-foreground">
                Belum ada data monitoring
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
