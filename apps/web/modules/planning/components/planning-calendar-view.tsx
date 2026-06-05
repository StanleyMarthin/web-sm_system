"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

/**
 * Planning Calendar View — Tampilan kalender sederhana.
 *
 * Satu layar: kalender bulan + sidebar pengaturan jam kerja.
 * Tidak ada tabel risiko, tidak ada cek divisi.
 * Murni untuk melihat & mengatur hari kerja/libur bengkel.
 */

import type {
  WeeklyWorkConfigRecord,
  WeeklyWorkConfigRequest,
  WorkingDay,
  UnitEtaRecord,
} from "@smsystem/contracts/calendar";
import { ChevronLeft, ChevronRight, Settings2, Save, X, Car } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { upsertWeeklyConfig } from "@/shared/api/calendar";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { CalendarDayModal } from "./calendar-day-modal";

interface PlanningCalendarViewProps {
  weeklyConfigs: WeeklyWorkConfigRecord[];
  workingDays: {
    startDate: string;
    endDate: string;
    includeOvertime: boolean;
    days: WorkingDay[];
  };
  deliveryRiskRows: UnitEtaRecord[];
  canManage: boolean;
}

// ── Helpers ──

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

const DAY_OFFSET: Record<string, number> = {
  Senin: 0,
  Selasa: 1,
  Rabu: 2,
  Kamis: 3,
  Jumat: 4,
  Sabtu: 5,
  Minggu: 6,
};

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function shiftMonth(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function lastDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + 1, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function firstDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

// ── Component ──

export function PlanningCalendarView({
  weeklyConfigs,
  workingDays,
  deliveryRiskRows,
  canManage,
}: PlanningCalendarViewProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Settings form
  const latestConfig = weeklyConfigs[0];
  const [configForm, setConfigForm] = useState({
    weekStartDate: latestConfig?.weekStartDate ?? "",
    weekdayHours: String(latestConfig?.weekdayHours ?? 8),
    saturdayHours: String(latestConfig?.saturdayHours ?? 5),
    sundayHours: String(latestConfig?.sundayHours ?? 0),
    weekdayOvertimeHours: String(latestConfig?.weekdayOvertimeHours ?? 5),
    saturdayOvertimeHours: String(latestConfig?.saturdayOvertimeHours ?? 3),
    sundayOvertimeHours: String(latestConfig?.sundayOvertimeHours ?? 0),
    efficiencyFactor: String(latestConfig?.efficiencyFactor ?? 1),
    qcBufferDays: String(latestConfig?.qcBufferDays ?? 1),
  });

  // Month navigation based on workingDays range
  const currentStart = workingDays.startDate;
  const monthLabel = getMonthLabel(currentStart);

  function navigateMonth(delta: number) {
    const newStart = firstDayOfMonth(shiftMonth(currentStart, delta));
    const newEnd = lastDayOfMonth(newStart);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "calendar");
    params.set("startDate", newStart);
    params.set("endDate", newEnd);
    router.push(`/planning?${params.toString()}`);
  }

  // Build lookup map: date -> WorkingDay
  const dayMap = useMemo(() => {
    const map = new Map<string, WorkingDay>();
    for (const d of workingDays.days) {
      map.set(d.date, d);
    }
    return map;
  }, [workingDays.days]);

  // Build deliveries map
  const deliveriesByDate = useMemo(() => {
    const map = new Map<string, UnitEtaRecord[]>();
    for (const row of deliveryRiskRows) {
      if (!row.targetDeliveryDate) continue;
      const date = row.targetDeliveryDate.split(" ")[0]; // handle YYYY-MM-DD
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(row);
    }
    return map;
  }, [deliveryRiskRows]);

  // Build full month grid
  const calendarCells = useMemo(() => {
    const start = new Date(firstDayOfMonth(currentStart) + "T00:00:00");
    const endMonth = new Date(lastDayOfMonth(currentStart) + "T00:00:00");

    const cells: Array<{
      date: string;
      dateNum: number;
      day: WorkingDay | null;
      isCurrentMonth: boolean;
    }> = [];

    // Offset for first day
    const firstDayName = start.toLocaleDateString("id-ID", { weekday: "long" });
    const offset = DAY_OFFSET[firstDayName] ?? 0;
    for (let i = 0; i < offset; i++) {
      cells.push({ date: "", dateNum: 0, day: null, isCurrentMonth: false });
    }

    // Days of the month
    const cursor = new Date(start);
    while (cursor <= endMonth) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dd}`;
      cells.push({
        date: dateStr,
        dateNum: cursor.getDate(),
        day: dayMap.get(dateStr) ?? null,
        isCurrentMonth: true,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return cells;
  }, [currentStart, dayMap]);

  // Summary stats
  const totalWorkDays = workingDays.days.filter((d) => d.isWorkingDay).length;
  const totalHolidays = workingDays.days.filter((d) => !d.isWorkingDay).length;
  const totalCapacity = workingDays.days.reduce((s, d) => s + d.totalCapacityHours, 0);
  const totalOvertime = workingDays.days.reduce((s, d) => s + d.overtimeHours, 0);

  async function handleSaveConfig() {
    if (!canManage) {
      setError("Anda tidak memiliki izin untuk mengubah aturan kerja.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: WeeklyWorkConfigRequest = {
        weekStartDate: configForm.weekStartDate,
        weekdayHours: Number(configForm.weekdayHours),
        saturdayHours: Number(configForm.saturdayHours),
        sundayHours: Number(configForm.sundayHours),
        weekdayOvertimeHours: Number(configForm.weekdayOvertimeHours),
        saturdayOvertimeHours: Number(configForm.saturdayOvertimeHours),
        sundayOvertimeHours: Number(configForm.sundayOvertimeHours),
        efficiencyFactor: Number(configForm.efficiencyFactor),
        qcBufferDays: Number(configForm.qcBufferDays),
      };
      const result = await upsertWeeklyConfig(payload);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setMessage("Aturan jam kerja berhasil disimpan.");
      setShowSettings(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard label="Planning" className="space-y-2">
          <PageHeader
            title="Kalender kerja bengkel"
            eyebrow="Hari kerja · libur · kapasitas harian"
            actions={(
              <ActionButton onClick={() => setShowSettings((value) => !value)} variant={showSettings ? "primary" : "default"}>
                <Settings2 className="h-3.5 w-3.5" />
                {showSettings ? "Tutup Aturan" : "Atur Jam"}
              </ActionButton>
            )}
          />
          <p className="max-w-2xl text-[12px] leading-5 text-gray-600 dark:text-white/45">
            Kalender ini dipakai untuk melihat hari kerja aktif, hari libur, kapasitas normal,
            dan slot lembur per tanggal. Klik tanggal untuk melihat delivery, SPK, dan SPL yang
            terkait di hari itu.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Bulan Sebelumnya
            </ActionButton>
            <span className="border border-gray-200 bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-700 shadow-sm dark:border-white/[0.05] dark:bg-[#0a0a0c] dark:text-white/70">
              {monthLabel}
            </span>
            <ActionButton onClick={() => navigateMonth(1)}>
              Bulan Berikutnya
              <ChevronRight className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </SectionCard>

        <SectionCard label="Ringkasan" className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-300/60">
                Hari Kerja
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-emerald-700 dark:text-emerald-300">
                {totalWorkDays}
              </p>
            </div>
            <div className="border border-red-500/20 bg-red-500/[0.05] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-red-700/70 dark:text-red-300/60">
                Hari Libur
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-red-700 dark:text-red-300">
                {totalHolidays}
              </p>
            </div>
            <div className="border border-gray-200 bg-white px-3 py-3 shadow-sm dark:border-white/[0.05] dark:bg-[#0a0a0c] dark:shadow-none">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Total Kapasitas
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-gray-950 dark:text-white">
                {totalCapacity.toFixed(0)}j
              </p>
            </div>
            <div className="border border-amber-500/20 bg-amber-500/[0.05] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-700/70 dark:text-amber-300/60">
                Slot Lembur
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-amber-700 dark:text-amber-300">
                {totalOvertime.toFixed(0)}j
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Feedback */}
      {message && (
        <div className="border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-2 text-[12px] text-emerald-400">
          {message}
        </div>
      )}
      {error && (
        <div className="border border-red-500/25 bg-red-500/[0.05] px-4 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <SectionCard label="Aturan jam kerja" className="space-y-4 border-amber-500/20 bg-amber-500/[0.02]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-amber-500">
                Pengaturan Jam Dasar Kalender
              </h3>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-amber-800/65 dark:text-amber-200/50">
                Atur standar jam kerja, batas lembur, dan faktor efisiensi yang jadi basis
                hitung kapasitas di planning.
              </p>
            </div>
            <ActionButton
              onClick={() => {
                setConfigForm((prev) => ({
                  ...prev,
                  weekdayHours: "8",
                  saturdayHours: "5",
                  sundayHours: "0",
                  weekdayOvertimeHours: "5",
                  saturdayOvertimeHours: "3",
                  sundayOvertimeHours: "0",
                  efficiencyFactor: "1",
                  qcBufferDays: "1",
                }));
              }}
              variant="primary"
            >
              Isi Standar Bengkel (8j/5j)
            </ActionButton>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* TANGGAL */}
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.04] dark:bg-[#0c0c0f]/50 dark:shadow-none">
              <div>
                <label className="text-[11px] font-semibold text-gray-800 dark:text-white">Berlaku Mulai</label>
              </div>
              <input
                type="date"
                value={configForm.weekStartDate}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, weekStartDate: e.target.value }))}
                disabled={!canManage}
                className="h-9 w-full rounded border border-gray-300 bg-white px-3 text-[12px] text-gray-950 outline-none focus:border-amber-600/55 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white dark:focus:border-amber-500/50 dark:[color-scheme:dark]"
              />
            </div>

            {/* JAM REGULER */}
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.04] dark:bg-[#0c0c0f]/50 dark:shadow-none">
              <div>
                <label className="text-[11px] font-semibold text-gray-800 dark:text-white">Jam Kerja Normal</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Sen-Jum</span>
                  <input type="number" value={configForm.weekdayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, weekdayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Sabtu</span>
                  <input type="number" value={configForm.saturdayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, saturdayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Minggu</span>
                  <input type="number" value={configForm.sundayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, sundayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
              </div>
            </div>

            {/* BATAS LEMBUR */}
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.04] dark:bg-[#0c0c0f]/50 dark:shadow-none">
              <div>
                <label className="text-[11px] font-semibold text-gray-800 dark:text-white">Batas Maksimal Lembur</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Sen-Jum</span>
                  <input type="number" value={configForm.weekdayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, weekdayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Sabtu</span>
                  <input type="number" value={configForm.saturdayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, saturdayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
                <div>
                  <span className="mb-1 block text-[9px] uppercase text-gray-500 dark:text-white/40">Minggu</span>
                  <input type="number" value={configForm.sundayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, sundayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
                </div>
              </div>
            </div>
            
            {/* EFISIENSI */}
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm md:col-span-2 lg:col-span-3 dark:border-white/[0.04] dark:bg-[#0c0c0f]/50 dark:shadow-none">
              <div className="flex flex-wrap items-center gap-6">
                <div className="min-w-0 flex-1">
                  <label className="text-[11px] font-semibold text-gray-800 dark:text-white">Efisiensi Pekerjaan</label>
                  <p className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-white/40">
                    Faktor pengali kapasitas efektif untuk seluruh hari kerja pada periode ini.
                  </p>
                </div>
                <input type="number" step="0.1" value={configForm.efficiencyFactor} onChange={(e) => setConfigForm((prev) => ({ ...prev, efficiencyFactor: e.target.value }))} disabled={!canManage} className="h-9 w-24 rounded border border-gray-300 bg-white px-2 text-center text-[12px] text-gray-950 dark:border-white/[0.08] dark:bg-[#111114] dark:text-white" />
              </div>
            </div>
            
          </div>
          
          <div className="mt-5 flex items-center justify-between border-t border-amber-500/10 pt-4">
            <span className="text-[11px] text-amber-800/55 dark:text-amber-300/40">
              {weeklyConfigs.length} aturan tersimpan
            </span>
            <button
              type="button"
              disabled={isSaving || !canManage}
              onClick={() => void handleSaveConfig()}
              className="inline-flex h-9 items-center gap-2 border border-amber-500/30 bg-amber-500/[0.1] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/[0.16] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Simpan Aturan"}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Calendar Grid */}
      <SectionCard label="Kalender bulan ini" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-white/[0.05] dark:bg-[#0a0a0c] dark:shadow-none">
          <p className="text-[12px] leading-5 text-gray-600 dark:text-white/55">
            Highlight amber menandai hari ini. Badge `DL` menandai ada target delivery pada tanggal
            tersebut.
          </p>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/35">
            Klik tanggal untuk detail
          </span>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 pb-2">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={[
                "py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.1em]",
                i >= 5
                  ? "text-amber-500/60"
                  : "text-gray-500 dark:text-white/30",
              ].join(" ")}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return <div key={`empty-${idx}`} className="min-h-[88px]" />;
            }

            const day = cell.day;
            const isLibur = day ? !day.isWorkingDay : false;
            const isSabtu = day?.dayName === "Sabtu";
            const isMinggu = day?.dayName === "Minggu";
            const isWeekend = isSabtu || isMinggu;
            const hasOvertime = day ? day.overtimeHours > 0 : false;
            const today = new Date().toISOString().split("T")[0];
            const isToday = cell.date === today;
            const dateDeliveries = deliveriesByDate.get(cell.date) ?? [];
            const hasDelivery = dateDeliveries.length > 0;

            return (
              <button
                type="button"
                onClick={() => setSelectedDate(cell.date)}
                key={cell.date}
                className={[
                  "relative flex min-h-[88px] flex-col border p-2 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/[0.05]",
                  isToday
                    ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                    : isLibur
                      ? "border-red-500/20 bg-red-500/[0.04]"
                      : isWeekend
                        ? "border-gray-200 bg-gray-50 dark:border-white/[0.04] dark:bg-white/[0.01]"
                        : "border-gray-200 bg-white dark:border-white/[0.05] dark:bg-[#0c0c0f]",
                ].join(" ")}
              >
                {/* Date number */}
                <div className="flex items-start justify-between">
                  <span
                    className={[
                      "flex h-6 w-6 items-center justify-center font-mono text-[12px] font-semibold",
                      isToday
                        ? "rounded bg-amber-500 text-black"
                        : isLibur
                          ? "text-red-400"
                          : isWeekend
                          ? "text-gray-500 dark:text-white/35"
                          : "text-gray-900 dark:text-white/80",
                    ].join(" ")}
                  >
                    {cell.dateNum}
                  </span>

                  {/* Capacity badge */}
                  {day && (
                    <span
                      className={[
                        "font-mono text-[9px] font-medium",
                        isLibur
                          ? "text-red-400/60"
                          : "text-gray-500 dark:text-white/30",
                      ].join(" ")}
                    >
                      {day.totalCapacityHours}j
                    </span>
                  )}
                </div>

                {/* Status label & Deliveries */}
                <div className="mt-auto flex flex-col justify-end pt-2">
                  {hasDelivery && (
                    <div className="mb-1 flex items-center gap-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-amber-500">
                      <Car className="h-2.5 w-2.5" />
                      {dateDeliveries.length} DL
                    </div>
                  )}
                  {day ? (
                    isLibur ? (
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-red-400">
                        Libur
                      </span>
                    ) : (
                      <div className="flex items-center justify-between font-mono text-[9px]">
                        <p className="text-gray-600 dark:text-white/45">
                          {day.workingHours}j
                        </p>
                        {hasOvertime && (
                          <p className="text-amber-500">
                            +{day.overtimeHours}j
                          </p>
                        )}
                      </div>
                    )
                  ) : (
                    <span className="font-mono text-[9px] text-gray-400 dark:text-white/15">
                      Tanpa data
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 font-mono text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-[#0c0c0f]" />
          <span className="text-gray-500 dark:text-white/40">Hari Kerja</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-red-500/20 bg-red-500/[0.04]" />
          <span className="text-gray-500 dark:text-white/40">Libur</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-gray-200 bg-gray-50 dark:border-white/[0.04] dark:bg-white/[0.01]" />
          <span className="text-gray-500 dark:text-white/40">Akhir Pekan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-amber-500/50 bg-amber-500/[0.06]" />
          <span className="text-gray-500 dark:text-white/40">Hari Ini</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-3 items-center justify-center rounded bg-amber-500/10 px-1 font-mono text-[8px] font-semibold text-amber-500">DL</div>
          <span className="text-gray-500 dark:text-white/40">Deadline</span>
        </div>
      </div>

      {selectedDate && (
        <CalendarDayModal
          date={selectedDate}
          day={dayMap.get(selectedDate) ?? null}
          deliveries={deliveriesByDate.get(selectedDate) ?? []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
