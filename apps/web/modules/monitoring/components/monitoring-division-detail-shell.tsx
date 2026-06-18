"use client";

import type {
  MonitoringDivisionDetailSummary,
  MonitoringDivisionMemberRecord,
  MonitoringDivisionUnitRecord,
} from "@smsystem/contracts/monitoring";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActionButton, CompactDateInput, CompactDateRangeInput } from "@/shared/ui/compact";

interface MonitoringDivisionDetailShellProps {
  divisionId: number;
  divisionName: string | null;
  date: string;
  dateTo?: string;
  activeMode: "all" | "normal" | "overtime";
  activeSpan: "daily" | "weekly";
  summary: MonitoringDivisionDetailSummary;
  units: MonitoringDivisionUnitRecord[];
  members: MonitoringDivisionMemberRecord[];
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

export function MonitoringDivisionDetailShell({
  divisionId,
  divisionName,
  date,
  dateTo,
  activeMode,
  activeSpan,
  summary,
  units,
  members,
}: MonitoringDivisionDetailShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedDateTo = dateTo ?? (activeSpan === "weekly" ? addDaysIso(date, 6) : date);

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

  function goBack() {
    const nextParams = new URLSearchParams(searchParams.toString());
    router.push(`/monitoring/division?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="rounded-[14px] border border-white/[0.06] bg-background px-3 py-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton onClick={goBack}>
                <ArrowLeft className="h-3 w-3" />
                Kembali
              </ActionButton>
              <h1 className="text-[13px] font-medium text-foreground">
                {divisionName ? `Divisi ${divisionName}` : `Divisi #${divisionId}`}
              </h1>

              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => pushSpan("daily")}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    activeSpan === "daily"
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-foreground/40 hover:text-foreground/70",
                  ].join(" ")}
                >
                  Harian
                </button>
                <button
                  type="button"
                  onClick={() => pushSpan("weekly")}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    activeSpan === "weekly"
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-foreground/40 hover:text-foreground/70",
                  ].join(" ")}
                >
                  Mingguan
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => pushMode("all")}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    activeMode === "all"
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-foreground/40 hover:text-foreground/70",
                  ].join(" ")}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => pushMode("normal")}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    activeMode === "normal"
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-foreground/40 hover:text-foreground/70",
                  ].join(" ")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => pushMode("overtime")}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    activeMode === "overtime"
                      ? "bg-primary/10 text-app-accent-ink"
                      : "text-foreground/40 hover:text-foreground/70",
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

        <div className="rounded-[14px] border border-white/[0.06] bg-background px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-foreground/30">Unit Aktif</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-foreground tabular-nums">{summary.totalUnits}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-foreground/30">Anggota</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-foreground tabular-nums">{summary.totalMembers}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-success/70">Jam Aktual</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-success tabular-nums">
                  {summary.totalActualHours.toFixed(2)}j
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-app-accent-ink/70">Sisa Jam</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-app-accent-ink tabular-nums">
                  {summary.totalRemainingHours.toFixed(2)}j
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

      <section className="rounded-[14px] border border-white/[0.06] bg-background">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-medium text-foreground">Jam kerja per unit</h2>
            <span className="text-[11px] text-foreground/35">{units.length} unit</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-foreground/70">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-[0.16em] text-foreground/35">
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3 text-right">Tugas</th>
                <th className="px-3 py-3 text-right">Jam Plan</th>
                <th className="px-3 py-3 text-right">Jam Aktual</th>
                <th className="px-3 py-3 text-right">Sisa Jam</th>
                <th className="px-3 py-3 text-right">Progress</th>
              </tr>
            </thead>
            <tbody>
              {units.length > 0 ? units.map((row) => (
                <tr key={row.carId} className="border-b border-white/[0.04]">
                  <td className="px-3 py-3 text-foreground">{row.unitName}</td>
                  <td className="px-3 py-3 text-foreground/55">{row.customerName ?? "-"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalTasks}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalPlannedHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalActualHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalRemainingHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.averageProgressPercent.toFixed(0)}%</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-foreground/35">
                    Belum ada data unit untuk filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[14px] border border-white/[0.06] bg-background">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-medium text-foreground">Jam kerja per anggota</h2>
            <span className="text-[11px] text-foreground/35">{members.length} anggota</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-foreground/70">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-[0.16em] text-foreground/35">
                <th className="px-3 py-3">Anggota</th>
                <th className="px-3 py-3 text-right">Tugas</th>
                <th className="px-3 py-3 text-right">Jam Plan</th>
                <th className="px-3 py-3 text-right">Jam Aktual</th>
                <th className="px-3 py-3 text-right">Sisa Jam</th>
                <th className="px-3 py-3 text-right">Progress</th>
              </tr>
            </thead>
            <tbody>
              {members.length > 0 ? members.map((row, index) => (
                <tr key={`${row.employeeId ?? "unassigned"}:${index}`} className="border-b border-white/[0.04]">
                  <td className="px-3 py-3 text-foreground">{row.employeeName ?? row.employeeId ?? "Belum dipilih"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalTasks}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalPlannedHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalActualHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.totalRemainingHours.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.averageProgressPercent.toFixed(0)}%</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-foreground/35">
                    Belum ada data anggota untuk filter yang dipilih.
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
