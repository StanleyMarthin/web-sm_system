"use client";

import type { WeeklyPlanRecord } from "@smsystem/contracts/calendar";
import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WeeklyPlanOvertimeRecord } from "@/shared/api/planning";
import { ActionButton, CompactInput, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";

interface PlanningSplShellProps {
  asOfDate: string;
  weekStartDate: string;
  plan: WeeklyPlanRecord | null;
  rows: WeeklyPlanOvertimeRecord[];
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

function formatHours(value: number): string {
  return `${value.toFixed(1)}j`;
}

function formatDisplayDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function uniqueValues<T>(values: readonly T[]) {
  return Array.from(new Set(values));
}

export function PlanningSplShell({
  asOfDate,
  weekStartDate,
  plan,
  rows,
}: PlanningSplShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const weekEndDate = addDaysIso(weekStartDate, 6);
  const totalHours = rows.reduce((sum, row) => {
    const memberTotal = row.memberCount + (row.includeHead ? 1 : 0);
    return sum + memberTotal * row.overtimeHours;
  }, 0);
  const totalSlots = rows.reduce(
    (sum, row) => sum + row.memberCount + (row.includeHead ? 1 : 0),
    0,
  );
  const totalDays = new Set(rows.map((row) => row.overtimeDate)).size;
  const totalDivisions = new Set(rows.map((row) => row.divisionId)).size;
  const weeklyDivisionRows = uniqueValues(rows.map((row) => row.divisionId)).map((divisionId) => {
    const divisionRows = rows.filter((row) => row.divisionId === divisionId);
    const divisionName = divisionRows[0]?.divisionName ?? "-";
    const activeDays = uniqueValues(divisionRows.map((row) => row.overtimeDate)).length;
    const slotCount = divisionRows.reduce(
      (sum, row) => sum + row.memberCount + (row.includeHead ? 1 : 0),
      0,
    );
    const totalDivisionHours = divisionRows.reduce((sum, row) => {
      const memberTotal = row.memberCount + (row.includeHead ? 1 : 0);
      return sum + memberTotal * row.overtimeHours;
    }, 0);
    const perPersonHours = uniqueValues(divisionRows.map((row) => row.overtimeHours))
      .sort((left, right) => left - right)
      .map((value) => value.toFixed(1));
    const includeHeadDays = divisionRows.filter((row) => row.includeHead).length;
    const notes = uniqueValues(
      divisionRows
        .map((row) => row.notes?.trim())
        .filter((note): note is string => Boolean(note)),
    );

    return {
      divisionId,
      divisionName,
      activeDays,
      slotCount,
      totalDivisionHours,
      perPersonHours,
      includeHeadDays,
      notes,
    };
  });

  function pushReferenceDate(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", value);
    nextParams.delete("weekStart");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard
          label="Planning"
          className="space-y-2"
        >
          <PageHeader
            title="SPL mingguan"
            eyebrow="Baseline lembur"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <CompactInput
                type="date"
                value={asOfDate}
                onChange={(event) => pushReferenceDate(event.target.value)}
              />
            </div>
            <span className="border border-gray-300 dark:border-white/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/55">
              {formatDisplayDate(weekStartDate)} s.d. {formatDisplayDate(weekEndDate)}
            </span>
            <span className="border border-gray-300 dark:border-white/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/40">
              {plan?.status === "PUBLISHED" ? "Sudah dipublish" : "Masih draft"}
            </span>
          </div>
        </SectionCard>

        <SectionCard
          label="Ringkasan"
          className="space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MetricBar
              items={[
                { label: "Jam Bundle", value: formatHours(totalHours), tone: totalHours > 0 ? "warn" : "muted" },
                { label: "Hari Lembur", value: totalDays, tone: "muted" },
                { label: "Divisi Aktif", value: totalDivisions, tone: "muted" },
                { label: "Slot Orang", value: totalSlots, tone: "muted" },
              ]}
            />
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </ActionButton>
          </div>
        </SectionCard>
      </div>

      <SectionCard label="Bundle mingguan" count={weeklyDivisionRows.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] text-gray-800 dark:text-white/70">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114]">
              <tr className="border-b border-gray-300 dark:border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2 text-right">Hari Aktif</th>
                <th className="px-3 py-2 text-right">Slot Orang</th>
                <th className="px-3 py-2">Jam / Orang</th>
                <th className="px-3 py-2 text-right">Total Jam Tim</th>
                <th className="px-3 py-2 text-right">KD Ikut</th>
                <th className="px-3 py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {weeklyDivisionRows.length > 0 ? weeklyDivisionRows.map((row) => (
                <tr
                  key={`weekly-division-${row.divisionId}`}
                  className="border-b border-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 text-gray-950 dark:text-white">{row.divisionName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.activeDays}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.slotCount}</td>
                  <td className="px-3 py-2 font-mono">
                    {row.perPersonHours.length > 1
                      ? `${row.perPersonHours[0]}j - ${row.perPersonHours[row.perPersonHours.length - 1]}j`
                      : `${row.perPersonHours[0] ?? "0.0"}j`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-300">
                    {formatHours(row.totalDivisionHours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.includeHeadDays}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-white/45">
                    {row.notes.length > 0 ? row.notes.join(" • ") : "-"}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500 dark:text-white/35">
                    Belum ada baseline lembur mingguan untuk minggu ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard label="Rincian harian lembur" count={rows.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] text-gray-800 dark:text-white/70">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114]">
              <tr className="border-b border-gray-300 dark:border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2">Hari</th>
                <th className="px-3 py-2 text-right">Jam / Orang</th>
                <th className="px-3 py-2 text-right">Jumlah Orang</th>
                <th className="px-3 py-2 text-center">KD Ikut</th>
                <th className="px-3 py-2 text-right">Total Jam</th>
                <th className="px-3 py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => {
                const memberTotal = row.memberCount + (row.includeHead ? 1 : 0);
                return (
                  <tr
                    key={`${row.divisionId}-${row.overtimeDate}`}
                    className="border-b border-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 font-mono">{row.overtimeDate}</td>
                    <td className="px-3 py-2 text-gray-950 dark:text-white">{row.divisionName}</td>
                    <td className="px-3 py-2">
                      {row.dayType === "SATURDAY"
                        ? "Sabtu"
                        : row.dayType === "SUNDAY"
                          ? "Minggu"
                          : "Hari kerja"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatHours(row.overtimeHours)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{memberTotal}</td>
                    <td className="px-3 py-2 text-center font-mono">{row.includeHead ? "Ya" : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatHours(memberTotal * row.overtimeHours)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-white/45">{row.notes ?? "-"}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500 dark:text-white/35">
                    Belum ada rincian lembur harian untuk minggu ini.
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
