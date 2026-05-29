import type { AuthUser } from "@smsystem/contracts/auth";
import type { DashboardSummaryPayload } from "@smsystem/contracts/dashboard";
import type { QcQueueRecord } from "@smsystem/contracts/qc";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Gauge,
  PackageSearch,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  DashboardFilterParams,
} from "@/shared/api/dashboard";
import type { PlanningWorkspacePayload } from "@/shared/api/planning";
import { DashboardFilterBar } from "./dashboard-filter-bar";

interface DashboardShellProps {
  summary: DashboardSummaryPayload;
  currentUser: AuthUser | null;
  filters?: DashboardFilterParams;
  planning?: PlanningWorkspacePayload | null;
  qcQueue?: QcQueueRecord[];
  qcRework?: QcQueueRecord[];
  isDeferredLoading?: boolean;
}

type SignalTone = "danger" | "warn" | "info";

type QaDivisionRow = {
  divisionName: string;
  okCount: number;
  reworkCount: number;
  total: number;
};

type DangerSignal = {
  key: string;
  label: string;
  detail: string;
  href: string;
  tone: SignalTone;
};

function fmt(v: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
}

function fmtDec(v: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(v);
}

function fmtPct(v: number) {
  return `${fmtDec(v)}%`;
}

function fmtDate(v: string | null) {
  if (!v) return "Belum dijadwalkan";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${v}T00:00:00.000Z`));
  } catch {
    return v;
  }
}

function fmtDateTime(v: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date(v));
  } catch {
    return v;
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

function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function isExecutiveRole(user: AuthUser | null) {
  const role = normalizeRoleName(user?.roleName);
  return [
    "DIREKSI",
    "DIRECTOR",
    "PROJECT_MANAGER",
    "MANAGER_PRODUKSI",
    "MANAGER_PROJECT",
    "MANAGER_OPERATIONAL",
    "MIS",
    "ADMIN",
  ].includes(role) || Boolean(user?.scope.canViewAllUnits);
}

function isKdRole(user: AuthUser | null) {
  return normalizeRoleName(user?.roleName) === "KETUA_DIVISI";
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
      className={`overflow-hidden border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] ${className}`}
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
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-300 dark:border-white/[0.05] px-3 py-2">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">{eyebrow}</p>
        <div className="space-y-0.5">
          <h3 className="text-[12px] font-medium text-gray-950 dark:text-white">{title}</h3>
          {detail ? null : null}
        </div>
      </div>
      {href && hrefLabel ? (
        <Link
          href={href}
          prefetch={false}
          className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/35 transition hover:text-gray-700 dark:text-white/68"
        >
          {hrefLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-4 text-[11px] text-gray-500 dark:text-white/35">
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
          className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2"
        >
          <div className="h-3 w-2/5 animate-pulse bg-gray-200 dark:bg-white/[0.06]" />
          <div className="mt-2 h-2 w-full animate-pulse bg-gray-200 dark:bg-white/[0.05]" />
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
      ? "border-emerald-400/30 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 text-amber-500/70"
        : tone === "danger"
          ? "border-red-400/30 text-red-400/70"
          : "border-gray-300 dark:border-white/10 text-gray-700 dark:text-white/60";
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${className}`}>
      {children}
    </span>
  );
}

function MetricPill({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] font-semibold text-gray-950 dark:text-white">{value}</p>
      {helper ? null : null}
    </div>
  );
}

function BarTrack({
  label,
  value,
  total,
  colorClass,
  helper,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
  helper: string;
}) {
  const pct = total > 0 ? clampPct((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-[12px] text-gray-950 dark:text-white">
        <span>{label}</span>
        <span className="font-mono font-semibold">{fmtDec(value)} jam</span>
      </div>
      <div className="h-2 bg-white/[0.06]">
        <div className={`h-2 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      {helper ? null : null}
    </div>
  );
}

function StackedBar({
  plan,
  actual,
  remaining,
}: {
  plan: number;
  actual: number;
  remaining: number;
}) {
  const total = Math.max(1, plan + actual + remaining);
  return (
    <div className="flex h-2 overflow-hidden bg-white/[0.05]">
      <div className="bg-sky-400" style={{ width: `${(plan / total) * 100}%` }} />
      <div className="bg-emerald-400" style={{ width: `${(actual / total) * 100}%` }} />
      <div className="bg-amber-400/75" style={{ width: `${(remaining / total) * 100}%` }} />
    </div>
  );
}

function MiniCalendar({
  rows,
  asOfDate,
}: {
  rows: { unitName: string; targetDeliveryDate: string | null }[];
  asOfDate?: string;
}) {
  const activeDate = asOfDate ? new Date(asOfDate) : new Date();
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(activeDate);

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const days: { dayNumber: number | null; dateString: string | null }[] = [];
  for (let i = 0; i < startDayIndex; i += 1) {
    days.push({ dayNumber: null, dateString: null });
  }
  for (let day = 1; day <= totalDaysInMonth; day += 1) {
    days.push({
      dayNumber: day,
      dateString: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  const unitsByDate = new Map<string, number>();
  for (const row of rows) {
    if (!row.targetDeliveryDate) continue;
    const dateKey = row.targetDeliveryDate.split("T")[0];
    unitsByDate.set(dateKey, (unitsByDate.get(dateKey) ?? 0) + 1);
  }

  return (
    <div className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-gray-950 dark:text-white">{monthLabel}</p>
        </div>
        <InlineBadge tone="neutral">{fmt(rows.length)} unit</InlineBadge>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-gray-300 dark:text-white/28">
        <span>Sen</span>
        <span>Sel</span>
        <span>Rab</span>
        <span>Kam</span>
        <span>Jum</span>
        <span>Sab</span>
        <span>Min</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((item, index) => {
          if (!item.dayNumber || !item.dateString) {
            return <div key={`empty-${index}`} className="aspect-square bg-transparent" />;
          }

          const scheduledCount = unitsByDate.get(item.dateString) ?? 0;
          const isToday = item.dateString === todayStr;

          return (
            <div
              key={item.dateString}
              className={`flex aspect-square flex-col items-center justify-center border text-[11px] transition ${
                isToday
                  ? "border-sky-400/40 bg-transparent text-gray-950 dark:text-white"
                  : scheduledCount > 0
                    ? "border-emerald-400/30 bg-transparent text-emerald-100"
                    : "border-gray-300 dark:border-white/[0.05] bg-transparent text-gray-500 dark:text-white/42"
              }`}
            >
              <span className={isToday ? "font-semibold" : ""}>{item.dayNumber}</span>
              {scheduledCount > 0 ? (
                <span className="mt-0.5 text-[9px] font-medium text-emerald-300">{scheduledCount}u</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineBoard({
  rows,
  asOfDate,
}: {
  rows: { unitName: string; remainingHours: number; effectiveDailyCapacity: number; targetDeliveryDate: string | null }[];
  asOfDate?: string;
}) {
  const scheduled = rows
    .filter((row) => row.targetDeliveryDate)
    .sort((left, right) => (left.targetDeliveryDate ?? "").localeCompare(right.targetDeliveryDate ?? ""));
  const unscheduled = rows.filter((row) => !row.targetDeliveryDate);

  return (
    <div className="grid gap-2 lg:grid-cols-[1.45fr_1fr]">
      <MiniCalendar rows={rows} asOfDate={asOfDate} />

      <div className="grid gap-3">
        <div className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-950 dark:text-white">Unit prioritas</p>
            </div>
            <InlineBadge tone="neutral">{fmt(scheduled.length)} terjadwal</InlineBadge>
          </div>
          <div className="space-y-2">
            {scheduled.length > 0 ? (
              scheduled.slice(0, 5).map((row) => (
                <div
                  key={`${row.unitName}-${row.targetDeliveryDate}`}
                  className="border border-gray-300 dark:border-white/[0.05] bg-transparent px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-950 dark:text-white">{row.unitName}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/42">
                        {fmtDec(row.remainingHours)} jam sisa • kapasitas {fmtDec(row.effectiveDailyCapacity)} jam/hari
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] font-medium text-emerald-200">
                      {fmtDate(row.targetDeliveryDate)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="Belum ada unit dengan target delivery terjadwal." />
            )}
          </div>
        </div>

        <div className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-950 dark:text-white">Belum terjadwal</p>
            </div>
            <InlineBadge tone="neutral">
              {fmt(unscheduled.length)} unit
            </InlineBadge>
          </div>
          {unscheduled.length > 0 ? (
            <div className="space-y-2">
              {unscheduled.slice(0, 4).map((row) => (
                <div
                  key={`${row.unitName}-draft`}
                  className="flex items-center justify-between gap-3 border border-gray-300 dark:border-white/[0.05] bg-transparent px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-950 dark:text-white">{row.unitName}</p>
                    <p className="text-[11px] text-gray-500 dark:text-white/42">{fmtDec(row.remainingHours)} jam belum diplot ke delivery</p>
                  </div>
                  <Clock3 className="h-4 w-4 shrink-0 text-gray-500 dark:text-white/30" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Semua unit pada scope aktif sudah memiliki target delivery." />
          )}
        </div>
      </div>
    </div>
  );
}

function getUnitScopeSummary(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
) {
  const planningUnits = planning?.weeklyPlan.planningUnits ?? [];
  const totalBacklogHours =
    planningUnits.length > 0
      ? planningUnits.reduce((sum, item) => sum + item.remainingHours, 0)
      : (summary.deliveryRisk?.topUnits ?? []).reduce((sum, item) => sum + item.remainingHours, 0);

  const totalWeeklyCapacity =
    summary.manhour?.byDivision.reduce((sum, item) => sum + item.capacityHours, 0) ?? 0;

  return {
    totalBacklogHours,
    totalWeeklyCapacity,
    pressurePercent:
      totalWeeklyCapacity > 0 ? (totalBacklogHours / totalWeeklyCapacity) * 100 : 0,
  };
}

function getMarginInsights(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
) {
  const planningUnits = planning?.weeklyPlan.planningUnits ?? [];
  const allocationUnits = planning?.weeklyPlan.units ?? [];
  const actualByCar = new Map(
    (summary.unitWorkHours ?? []).map((item) => [item.carId, item.actualHours]),
  );

  const flagByCar = new Map<string, boolean>();
  for (const item of planningUnits) flagByCar.set(item.carId, item.isMargin);
  for (const item of allocationUnits) flagByCar.set(item.carId, item.isMargin);

  let marginActual = 0;
  let nonMarginActual = 0;
  let knownActualCount = 0;
  for (const [carId, actualHours] of actualByCar.entries()) {
    const isMargin = flagByCar.get(carId);
    if (typeof isMargin !== "boolean") continue;
    knownActualCount += 1;
    if (isMargin) marginActual += actualHours;
    else nonMarginActual += actualHours;
  }

  let dataSource: "actual" | "allocated" = "actual";
  if (knownActualCount === 0) {
    dataSource = "allocated";
    marginActual = 0;
    nonMarginActual = 0;
    for (const item of allocationUnits) {
      if (item.isMargin) marginActual += item.allocatedHours;
      else nonMarginActual += item.allocatedHours;
    }
  }

  const totalProjects = planningUnits.length || allocationUnits.length;
  const marginProjects = (planningUnits.length > 0 ? planningUnits : allocationUnits).filter(
    (item) => item.isMargin,
  ).length;

  return {
    marginHours: marginActual,
    nonMarginHours: nonMarginActual,
    totalHours: marginActual + nonMarginActual,
    dataSource,
    marginProjectRatio: totalProjects > 0 ? (marginProjects / totalProjects) * 100 : 0,
  };
}

function getBottleneckDivision(summary: DashboardSummaryPayload) {
  const rows = summary.manhour?.byDivision ?? [];
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((left, right) => {
    const rightLoad =
      right.utilizationPercent ?? (right.capacityHours > 0 ? (right.actualHours / right.capacityHours) * 100 : 0);
    const leftLoad =
      left.utilizationPercent ?? (left.capacityHours > 0 ? (left.actualHours / left.capacityHours) * 100 : 0);
    return rightLoad - leftLoad;
  });
  const top = sorted[0];
  const load =
    top?.utilizationPercent ?? (top && top.capacityHours > 0 ? (top.actualHours / top.capacityHours) * 100 : 0);
  if (!top) return null;
  return {
    divisionId: top.divisionId,
    divisionName: top.divisionName,
    loadPercent: load,
  };
}

function getAllocationRows(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
) {
  const rows = planning?.weeklyPlan.units ?? [];
  const actualByCar = new Map((summary.unitWorkHours ?? []).map((item) => [item.carId, item.actualHours]));
  const merged = rows.map((row) => ({
    carId: row.carId,
    unitName: row.unitName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    targetHours: row.allocatedHours,
    actualHours: actualByCar.get(row.carId) ?? 0,
    isMargin: row.isMargin,
    materialStatus: row.materialStatus,
    targetDeliveryDate: row.targetDeliveryDate,
  }));
  return merged
    .sort((left, right) => {
      const leftDate = left.targetDeliveryDate ?? "9999-12-31";
      const rightDate = right.targetDeliveryDate ?? "9999-12-31";
      return leftDate.localeCompare(rightDate);
    })
    .slice(0, 8);
}

function getDangerSignals(
  planning: PlanningWorkspacePayload | null | undefined,
  summary: DashboardSummaryPayload,
  filters?: DashboardFilterParams,
): DangerSignal[] {
  const signals: DangerSignal[] = [];
  for (const row of summary.manhour?.byDivision ?? []) {
    const load =
      row.utilizationPercent ?? (row.capacityHours > 0 ? (row.actualHours / row.capacityHours) * 100 : 0);
    if (load > 100) {
      signals.push({
        key: `load-${row.divisionId}`,
        label: `${row.divisionName} overbudget jam kerja`,
        detail: `${fmtPct(load)} load dari kapasitas normal mingguan.`,
        href: buildHref("/monitoring/division", filters, { divisionId: row.divisionId }),
        tone: "danger",
      });
    }
  }

  const huntingRows = (planning?.weeklyPlan.units ?? []).filter((row) => row.materialStatus === "HUNTING");
  for (const row of huntingRows.slice(0, 3)) {
    signals.push({
      key: `hunt-${row.carId}-${row.divisionId}`,
      label: `${row.unitName} macet material`,
      detail: `${row.divisionName} masih menunggu part/material.`,
      href: buildHref("/planning", filters, { unitId: row.carId, divisionId: row.divisionId }),
      tone: "warn",
    });
  }

  for (const row of (summary.countdownOverdue ?? []).slice(0, 3)) {
    signals.push({
      key: `overdue-${row.countdownId}`,
      label: `${row.unitName} lewat timeline`,
      detail: `${row.panelName} terlambat ${fmt(row.overdueDays)} hari.`,
      href: buildHref("/countdown", filters, { unitId: row.carId }),
      tone: row.overdueDays >= 7 ? "danger" : "warn",
    });
  }

  const riskSummary = summary.deliveryRisk?.summary;
  if (riskSummary && (riskSummary.red > 0 || riskSummary.orange > 0)) {
    signals.unshift({
      key: "delivery-risk",
      label: `${fmt(riskSummary.red + riskSummary.orange)} unit butuh rescue delivery`,
      detail: `${fmt(riskSummary.red)} merah, ${fmt(riskSummary.orange)} oranye pada radar delivery.`,
      href: buildHref("/reports/delivery-accuracy", filters),
      tone: "danger",
    });
  }

  return signals.slice(0, 6);
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

function getPlanVsActualRows(summary: DashboardSummaryPayload) {
  const progressMap = new Map(
    (summary.divisionKpis ?? []).map((row) => [row.divisionId, row.avgProgressPercent]),
  );
  return (summary.manhour?.byDivision ?? [])
    .filter((row) => isTechnicalDivisionName(row.divisionName))
    .filter((row) => row.plannedHours > 0 || row.actualHours > 0 || row.remainingHours > 0)
    .map((row) => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      planHours: row.plannedHours,
      actualHours: row.actualHours,
      remainingHours: row.remainingHours,
      progressPercent: progressMap.get(row.divisionId) ?? null,
    }))
    .sort((left, right) => {
      const rightScore = right.actualHours + right.remainingHours + right.planHours;
      const leftScore = left.actualHours + left.remainingHours + left.planHours;
      return rightScore - leftScore;
    });
}

function getQaRows(qcQueue: QcQueueRecord[], qcRework: QcQueueRecord[]) {
  const map = new Map<string, QaDivisionRow>();

  const ensure = (divisionName: string) => {
    const existing = map.get(divisionName);
    if (existing) return existing;
    const created: QaDivisionRow = {
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
    const target = ensure(divisionName);
    target.reworkCount += 1;
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    total: row.okCount + row.reworkCount,
  }));

  return rows
    .filter((row) => isTechnicalDivisionName(row.divisionName))
    .sort((left, right) => right.total - left.total || left.divisionName.localeCompare(right.divisionName))
    .slice(0, 6);
}

function buildGreeting({
  currentUser,
  summary,
  planning,
  qcRework,
}: {
  currentUser: AuthUser | null;
  summary: DashboardSummaryPayload;
  planning: PlanningWorkspacePayload | null | undefined;
  qcRework: QcQueueRecord[];
}) {
  const hello = getGreetingLabel(summary.generatedAt);
  const name = displayName(currentUser);
  const margin = getMarginInsights(planning, summary);
  const riskUnits = (summary.deliveryRisk?.summary.red ?? 0) + (summary.deliveryRisk?.summary.orange ?? 0);
  const pending = summary.pendingActions?.total ?? 0;
  const bottleneck = getBottleneckDivision(summary);

  if (isKdRole(currentUser)) {
    const divisionName = currentUser?.divisionName || "Divisi";
    const members = (summary.manhour?.byEmployee ?? []).filter(
      (row) => row.divisionName === divisionName,
    ).length;
    const targetHours = (planning?.weeklyPlan.units ?? [])
      .filter((row) => row.divisionId === currentUser?.divisionId)
      .reduce((sum, row) => sum + row.allocatedHours, 0);
    const qcRevisionCount = qcRework.filter(
      (row) => (row.divisionName ?? "") === divisionName,
    ).length;

    return members >= 0 && targetHours >= 0 && qcRevisionCount >= 0 && hello && name ? null : null;
  }

  if (isExecutiveRole(currentUser)) {
    return margin.marginProjectRatio >= 0 && riskUnits >= 0 && pending >= 0 && hello && name ? null : null;
  }

  return riskUnits >= 0 && pending >= 0 && hello && name && (bottleneck ? bottleneck.loadPercent >= 0 : true) ? null : null;
}

export function DashboardShell({
  summary,
  currentUser,
  filters,
  planning,
  qcQueue = [],
  qcRework = [],
  isDeferredLoading = false,
}: DashboardShellProps) {
  const margin = getMarginInsights(planning, summary);
  const scope = getUnitScopeSummary(planning, summary);
  const allocationRows = getAllocationRows(planning, summary);
  const dangerSignals = getDangerSignals(planning, summary, filters);
  const planVsActualRows = getPlanVsActualRows(summary);
  const qaRows = getQaRows(qcQueue, qcRework);
  const bottleneck = getBottleneckDivision(summary);

  const lockedDivisionId = currentUser?.scope.managedDivisionIds.length
    ? currentUser.scope.managedDivisionIds[0]
    : null;

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

  const timelineRows =
    summary.deliveryRisk?.topUnits && summary.deliveryRisk.topUnits.length > 0
      ? summary.deliveryRisk.topUnits
      : (planning?.deliveryRisk.rows ?? []).slice(0, 8).map((row) => ({
          unitName: row.unitName,
          remainingHours: row.remainingHours,
          effectiveDailyCapacity: row.effectiveDailyCapacity,
          targetDeliveryDate: row.targetDeliveryDate,
        }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Dashboard operasional</p>
          <div className="space-y-1">
            <h1 className="text-[14px] font-semibold text-gray-950 dark:text-white">{summary.headline.title}</h1>
            {summary.headline.scopeNote ? null : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-white/34">
          {filters?.divisionId ? (
            <InlineBadge>
              {divisions.find((d) => String(d.id) === filters.divisionId)?.name ?? `Divisi ${filters.divisionId}`}
            </InlineBadge>
          ) : null}
          {filters?.unitId ? (
            <InlineBadge>
              {units.find((u) => u.id === filters.unitId)?.name ?? `Unit ${filters.unitId}`}
            </InlineBadge>
          ) : null}
          <span className="font-mono">Diperbarui {fmtDateTime(summary.generatedAt)}</span>
        </div>
      </div>

      <DashboardFilterBar divisions={divisions} units={units} lockedDivisionId={lockedDivisionId} />

      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-white/5 border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] md:grid-cols-4">
        <div className="flex items-center gap-3 px-4 py-3">
          <CalendarClock className="h-4 w-4 text-gray-400 dark:text-white/40 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Unit Aktif</p>
            <p className="font-mono text-[18px] font-semibold text-gray-950 dark:text-white leading-none mt-1">{fmt(summary.kpis.activeUnits)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Gauge className="h-4 w-4 text-gray-400 dark:text-white/40 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Delivery Minggu Ini</p>
            <p className="font-mono text-[18px] font-semibold text-gray-950 dark:text-white leading-none mt-1">{fmt(summary.kpis.deliveryThisWeek)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-red-400/60 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Overdue</p>
            <p className="font-mono text-[18px] font-semibold text-gray-950 dark:text-white leading-none mt-1">{fmt(summary.kpis.overdueUnits)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Clock3 className="h-4 w-4 text-gray-400 dark:text-white/40 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Pending Approval</p>
            <p className="font-mono text-[18px] font-semibold text-gray-950 dark:text-white leading-none mt-1">{fmt(summary.pendingActions?.total ?? 0)}</p>
          </div>
        </div>
      </div>

      {buildGreeting({ currentUser, summary, planning, qcRework })}

      <div className="grid gap-3 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <SectionHeader
            eyebrow="Overview"
            title="Reality Check"
            detail="Bandingkan backlog jam kerja dengan kapasitas normal mingguan."
            href={buildHref("/planning", filters)}
            hrefLabel="Buka planning"
          />
          <div className="space-y-3 px-3 py-3">
            <div className="grid gap-2 md:grid-cols-3">
              <MetricPill
                label="Backlog bengkel"
                value={`${fmtDec(scope.totalBacklogHours)} jam`}
                helper="Total sisa jam unit aktif dalam scope filter saat ini."
              />
              <MetricPill
                label="Kapasitas mingguan"
                value={`${fmtDec(scope.totalWeeklyCapacity)} jam`}
                helper="Kapasitas normal agregat seluruh divisi pada dashboard."
              />
              <MetricPill
                label="Tekanan kapasitas"
                value={fmtPct(scope.pressurePercent)}
                helper="Semakin tinggi, semakin rapat cadangan waktu bengkel."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] text-gray-800 dark:text-white/76">
                <span>Backlog vs kapasitas normal</span>
                <span className="font-mono font-semibold text-gray-950 dark:text-white">{fmtPct(scope.pressurePercent)}</span>
              </div>
              <div className="h-2 bg-white/[0.06]">
                <div
                  className={`h-2 ${
                    scope.pressurePercent >= 100
                      ? "bg-red-400"
                      : scope.pressurePercent >= 75
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${clampPct(scope.pressurePercent)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <SectionHeader
            eyebrow="Overview"
            title="Margin vs Non-Margin"
            detail="Perbandingan jam kerja unit margin dan non-margin."
            href={buildHref("/planning", filters)}
            hrefLabel="Lihat unit"
          />
          <div className="space-y-3 px-3 py-3">
            <BarTrack
              label="Margin"
              value={margin.marginHours}
              total={Math.max(1, margin.totalHours)}
              colorClass="bg-emerald-400"
              helper="Jam unit bernilai margin pada scope aktif."
            />
            <BarTrack
              label="Non-Margin"
              value={margin.nonMarginHours}
              total={Math.max(1, margin.totalHours)}
              colorClass="bg-amber-400"
              helper="Jam unit non-margin yang ikut memakan kapasitas."
            />
            {margin.dataSource ? null : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-7">
        <Card className="xl:col-span-4">
          <SectionHeader
            eyebrow="Eksekusi SPK"
            title="Alokasi SPK Aktif"
            detail="SPK dibaca sebagai Unit -> Divisi -> target jam kerja."
            href={buildHref("/planning", filters)}
            hrefLabel="Kelola SPK"
          />
          <div className="px-3 py-3">
            {isDeferredLoading ? (
              <DeferredRowsSkeleton rows={4} />
            ) : allocationRows.length > 0 ? (
              <div className="space-y-2">
                {allocationRows.map((row) => {
                  const progressPct = row.targetHours > 0 ? (row.actualHours / row.targetHours) * 100 : 0;
                  return (
                    <div
                      key={`${row.carId}-${row.divisionId}`}
                      className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-semibold text-gray-950 dark:text-white">{row.unitName}</p>
                            <InlineBadge tone={row.isMargin ? "good" : "warn"}>
                              {row.isMargin ? "Margin" : "Non-Margin"}
                            </InlineBadge>
                            {row.materialStatus === "HUNTING" ? (
                              <InlineBadge tone="danger">Hunting Part</InlineBadge>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-white/42">
                            {row.divisionName} • deadline {fmtDate(row.targetDeliveryDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[12px] font-semibold text-gray-950 dark:text-white">
                            {fmtDec(row.actualHours)} / {fmtDec(row.targetHours)} jam
                          </p>
                          <p className="font-mono text-[10px] text-gray-500 dark:text-white/38">{fmtPct(progressPct)}</p>
                        </div>
                      </div>
                      <div className="mt-2 h-2 bg-white/[0.05]">
                        <div
                          className={`h-2 ${
                            progressPct > 100 ? "bg-red-400" : progressPct >= 75 ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                          style={{ width: `${clampPct(progressPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="Belum ada alokasi SPK aktif pada filter yang dipilih." />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <SectionHeader
            eyebrow="Eksekusi SPK"
            title="Sinyal Bahaya"
            detail="Deteksi divisi macet, jam kerja overbudget, dan part hunting."
            href={buildHref("/monitoring", filters)}
            hrefLabel="Buka monitoring"
          />
          <div className="space-y-2 px-3 py-3">
            {dangerSignals.length > 0 ? (
              dangerSignals.map((signal) => (
                <Link
                  key={signal.key}
                  href={signal.href}
                  prefetch={false}
                  className="flex items-start justify-between gap-3 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2 transition hover:bg-gray-100 dark:hover:bg-white/[0.05]"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 border p-1.5 ${
                        signal.tone === "danger"
                          ? "border-red-400/30 text-red-400/70"
                          : signal.tone === "warn"
                            ? "border-amber-500/30 text-amber-500/70"
                            : "border-gray-300 dark:border-white/10 text-gray-400 dark:text-white/40"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-gray-950 dark:text-white">{signal.label}</p>
                      <p className="text-xs text-gray-500 dark:text-white/42">{signal.detail}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 dark:text-white/28" />
                </Link>
              ))
            ) : (
              <EmptyState message="Tidak ada sinyal bahaya dominan dalam scope filter aktif." />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <SectionHeader
            eyebrow="Progress"
            title="Timeline Pengiriman Unit"
            detail="Kalender unit aktif mengikuti filter unit dan divisi dari toolbar."
            href={buildHref("/reports/delivery-accuracy", filters)}
            hrefLabel="Delivery risk"
          />
          <div className="px-3 py-3">
            {timelineRows.length > 0 ? (
              <TimelineBoard rows={timelineRows} asOfDate={summary.asOfDate} />
            ) : (
              <EmptyState message="Belum ada unit aktif yang memiliki timeline pengiriman." />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-6">
          <SectionHeader
            eyebrow="Progress"
            title="Plan vs Actual per Divisi"
            detail={
              filters?.unitId
                ? "Hanya divisi teknis pada unit yang dipilih di URL."
                : "PLAN, ACTUAL, dan SISA otomatis mengikuti filter dashboard untuk divisi teknis."
            }
            href={buildHref("/monitoring/division", filters)}
            hrefLabel="Detail divisi"
          />
          <div className="space-y-3 px-3 py-3">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/42">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 border border-sky-400/70 bg-sky-400/20" />Plan</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 border border-emerald-400/70 bg-emerald-400/20" />Actual</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 border border-amber-400/70 bg-amber-400/20" />Sisa</span>
            </div>
            {planVsActualRows.length > 0 ? (
              planVsActualRows.slice(0, 6).map((row) => (
                <div key={row.divisionId} className="space-y-1.5 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-gray-950 dark:text-white">{row.divisionName}</p>
                      <p className="text-[11px] text-gray-400 dark:text-white/40">
                        {row.progressPercent != null ? `Progress ${fmtPct(row.progressPercent)}` : "Progress belum tersedia"}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-gray-600 dark:text-white/45">
                      <p>{fmtDec(row.planHours)} plan</p>
                      <p>{fmtDec(row.actualHours)} aktual</p>
                      <p>{fmtDec(row.remainingHours)} sisa</p>
                    </div>
                  </div>
                  <StackedBar
                    plan={row.planHours}
                    actual={row.actualHours}
                    remaining={row.remainingHours}
                  />
                </div>
              ))
            ) : (
              <EmptyState message="Belum ada data plan vs actual per divisi." />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader
          eyebrow="QA"
          title="Dashboard QA"
          detail="Snapshot kualitas aktif per divisi dari queue QC dan rework yang sedang berjalan."
          href={buildHref("/qc", filters)}
          hrefLabel="Buka QC"
        />
        <div className="grid gap-2 px-3 py-3 md:grid-cols-2 xl:grid-cols-4">
          {isDeferredLoading ? (
            <div className="md:col-span-2 xl:col-span-4">
              <DeferredRowsSkeleton rows={3} />
            </div>
          ) : qaRows.length > 0 ? (
            qaRows.map((row) => {
              const total = Math.max(1, row.total);
              return (
                <div key={row.divisionName} className="border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-gray-950 dark:text-white">{row.divisionName}</p>
                    </div>
                    <ClipboardCheck className="h-4 w-4 text-gray-500 dark:text-white/30" />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300/85">OK</p>
                        <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">{fmt(row.okCount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-red-300/85">Revisi / Rework</p>
                        <p className="mt-1 text-xl font-semibold text-gray-950 dark:text-white">{fmt(row.reworkCount)}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-white/[0.06]">
                      <div className="flex h-2 overflow-hidden">
                        <div className="bg-emerald-400" style={{ width: `${(row.okCount / total) * 100}%` }} />
                        <div className="bg-red-400" style={{ width: `${(row.reworkCount / total) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="md:col-span-2 xl:col-span-4">
              <EmptyState message="Belum ada snapshot QC / rework per divisi yang bisa ditampilkan pada scope ini." />
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref("/wo", filters)}
          prefetch={false}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/58 transition hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:text-white/80"
        >
          <Wrench className="h-3.5 w-3.5 text-amber-300" />
          WO aktif
        </Link>
        <Link
          href={buildHref("/pr", filters)}
          prefetch={false}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/58 transition hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:text-white/80"
        >
          <PackageSearch className="h-3.5 w-3.5 text-amber-300" />
          Antrean PR
        </Link>
        <Link
          href={buildHref("/vendor", filters)}
          prefetch={false}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/58 transition hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:text-white/80"
        >
          <BriefcaseBusiness className="h-3.5 w-3.5 text-amber-300" />
          Pekerjaan vendor
        </Link>
        <Link
          href={buildHref("/warehouse", filters)}
          prefetch={false}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/58 transition hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:text-white/80"
        >
          <Boxes className="h-3.5 w-3.5 text-amber-300" />
          Permintaan gudang
        </Link>
        <Link
          href={buildHref("/qc", filters)}
          prefetch={false}
          className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/58 transition hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:text-white/80"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />
          Revisi QC
        </Link>
      </div>

      {bottleneck ? null : null}
    </div>
  );
}
