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
import { ChevronLeft, ChevronRight, Settings2, Save, Car } from "lucide-react";
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
          <p className="max-w-2xl text-[14px] leading-5 text-muted-foreground dark:text-muted-foreground">
            Kalender ini dipakai untuk melihat hari kerja aktif, hari libur, kapasitas normal,
            dan slot lembur per tanggal. Klik tanggal untuk melihat delivery, SPK, dan SPL yang
            terkait di hari itu.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Bulan Sebelumnya
            </ActionButton>
            <span className="border border-border bg-card px-3 py-1 font-mono text-[15px] uppercase tracking-[0.12em] text-foreground shadow-sm dark:border-border dark:bg-background dark:text-foreground">
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
            <div className="border border-success/20 bg-success/[0.05] px-3 py-3">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-success/70 dark:text-success/60">
                Hari Kerja
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-success dark:text-success">
                {totalWorkDays}
              </p>
            </div>
            <div className="border border-destructive/20 bg-destructive/[0.05] px-3 py-3">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-destructive/70 dark:text-destructive/60">
                Hari Libur
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-destructive dark:text-destructive">
                {totalHolidays}
              </p>
            </div>
            <div className="border border-border bg-card px-3 py-3 shadow-sm dark:border-border dark:bg-background dark:shadow-none">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
                Total Kapasitas
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-foreground dark:text-foreground">
                {totalCapacity.toFixed(0)}j
              </p>
            </div>
            <div className="border border-primary/20 bg-primary/[0.05] px-3 py-3">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-app-accent-ink/70 dark:text-app-accent-ink/60">
                Slot Lembur
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold text-app-accent-ink dark:text-app-accent-ink">
                {totalOvertime.toFixed(0)}j
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Feedback */}
      {message && (
        <div className="border border-success/25 bg-success/[0.05] px-4 py-2 text-[14px] text-success">
          {message}
        </div>
      )}
      {error && (
        <div className="border border-destructive/25 bg-destructive/[0.05] px-4 py-2 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <SectionCard label="Aturan jam kerja" className="space-y-4 border-primary/20 bg-primary/[0.02]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-app-accent-ink">
                Pengaturan Jam Dasar Kalender
              </h3>
              <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-app-accent-ink/65 dark:text-app-accent-ink/50">
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
            <div className="space-y-3 rounded border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card/50 dark:shadow-none">
              <div>
                <label className="text-[15px] font-semibold text-foreground dark:text-foreground">Berlaku Mulai</label>
              </div>
              <input
                type="date"
                value={configForm.weekStartDate}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, weekStartDate: e.target.value }))}
                disabled={!canManage}
                className="h-9 w-full rounded border border-border bg-card px-3 text-[14px] text-foreground outline-none focus:border-primary/55 disabled:opacity-50 dark:border-border dark:bg-card dark:text-foreground dark:focus:border-primary/50 dark:[color-scheme:dark]"
              />
            </div>

            {/* JAM REGULER */}
            <div className="space-y-3 rounded border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card/50 dark:shadow-none">
              <div>
                <label className="text-[15px] font-semibold text-foreground dark:text-foreground">Jam Kerja Normal</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Sen-Jum</span>
                  <input type="number" value={configForm.weekdayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, weekdayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Sabtu</span>
                  <input type="number" value={configForm.saturdayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, saturdayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Minggu</span>
                  <input type="number" value={configForm.sundayHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, sundayHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
              </div>
            </div>

            {/* BATAS LEMBUR */}
            <div className="space-y-3 rounded border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card/50 dark:shadow-none">
              <div>
                <label className="text-[15px] font-semibold text-foreground dark:text-foreground">Batas Maksimal Lembur</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Sen-Jum</span>
                  <input type="number" value={configForm.weekdayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, weekdayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Sabtu</span>
                  <input type="number" value={configForm.saturdayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, saturdayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
                <div>
                  <span className="mb-1 block text-[15px] uppercase text-muted-foreground dark:text-muted-foreground">Minggu</span>
                  <input type="number" value={configForm.sundayOvertimeHours} onChange={(e) => setConfigForm((prev) => ({ ...prev, sundayOvertimeHours: e.target.value }))} disabled={!canManage} className="h-8 w-full rounded border border-border bg-card px-2 text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
                </div>
              </div>
            </div>
            
            {/* EFISIENSI */}
            <div className="space-y-3 rounded border border-border bg-card p-4 shadow-sm md:col-span-2 lg:col-span-3 dark:border-border dark:bg-card/50 dark:shadow-none">
              <div className="flex flex-wrap items-center gap-6">
                <div className="min-w-0 flex-1">
                  <label className="text-[15px] font-semibold text-foreground dark:text-foreground">Efisiensi Pekerjaan</label>
                  <p className="mt-1 text-[15px] leading-5 text-muted-foreground dark:text-muted-foreground">
                    Faktor pengali kapasitas efektif untuk seluruh hari kerja pada periode ini.
                  </p>
                </div>
                <input type="number" step="0.1" value={configForm.efficiencyFactor} onChange={(e) => setConfigForm((prev) => ({ ...prev, efficiencyFactor: e.target.value }))} disabled={!canManage} className="h-9 w-24 rounded border border-border bg-card px-2 text-center text-[14px] text-foreground dark:border-border dark:bg-card dark:text-foreground" />
              </div>
            </div>
            
          </div>
          
          <div className="mt-5 flex items-center justify-between border-t border-primary/10 pt-4">
            <span className="text-[15px] text-app-accent-ink/55 dark:text-app-accent-ink/40">
              {weeklyConfigs.length} aturan tersimpan
            </span>
            <button
              type="button"
              disabled={isSaving || !canManage}
              onClick={() => void handleSaveConfig()}
              className="inline-flex h-9 items-center gap-2 border border-primary/30 bg-primary/[0.1] px-5 font-mono text-[15px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/[0.16] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Simpan Aturan"}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Calendar Grid */}
      <SectionCard label="Kalender bulan ini" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2 shadow-sm dark:border-border dark:bg-background dark:shadow-none">
          <p className="text-[14px] leading-5 text-muted-foreground dark:text-muted-foreground">
            Highlight amber menandai hari ini. Badge `DL` menandai ada target delivery pada tanggal
            tersebut.
          </p>
          <span className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
            Klik tanggal untuk detail
          </span>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 pb-2">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={[
                "py-1.5 text-center font-mono text-[14px] uppercase tracking-[0.1em]",
                i >= 5
                  ? "text-app-accent-ink/60"
                  : "text-muted-foreground dark:text-muted-foreground",
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
            const hasOverride = Boolean(day?.override);
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
                  "relative flex min-h-[88px] flex-col border p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.05]",
                  isToday
                    ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                    : isLibur
                      ? "border-destructive/20 bg-destructive/[0.04]"
                      : isWeekend
                        ? "border-border bg-muted dark:border-border dark:bg-muted"
                        : "border-border bg-card dark:border-border dark:bg-card",
                ].join(" ")}
              >
                {/* Date number */}
                <div className="flex items-start justify-between">
                  <span
                    className={[
                      "flex h-6 w-6 items-center justify-center font-mono text-[14px] font-semibold",
                      isToday
                        ? "rounded bg-primary text-primary-foreground"
                        : isLibur
                          ? "text-destructive"
                          : isWeekend
                          ? "text-muted-foreground dark:text-muted-foreground"
                          : "text-foreground dark:text-foreground",
                    ].join(" ")}
                  >
                    {cell.dateNum}
                  </span>

                  {/* Capacity badge */}
                  {day && (
                    <span
                      className={[
                        "font-mono text-[15px] font-medium",
                        isLibur
                          ? "text-destructive/60"
                          : "text-muted-foreground dark:text-muted-foreground",
                      ].join(" ")}
                    >
                      {day.totalCapacityHours}j
                    </span>
                  )}
                </div>

                {/* Status label & Deliveries */}
                <div className="mt-auto flex flex-col justify-end pt-2">
                  {hasOverride && (
                    <div className="mb-1 border border-primary/20 bg-primary/[0.08] px-1 py-0.5 font-mono text-[15px] font-semibold uppercase tracking-[0.06em] text-app-accent-ink">
                      Jam khusus
                    </div>
                  )}
                  {hasDelivery && (
                    <div className="mb-1 flex items-center gap-1 rounded bg-primary/10 px-1 py-0.5 font-mono text-[15px] font-semibold uppercase tracking-[0.05em] text-app-accent-ink">
                      <Car className="h-2.5 w-2.5" />
                      {dateDeliveries.length} DL
                    </div>
                  )}
                  {day ? (
                    isLibur ? (
                      <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.05em] text-destructive">
                        Libur
                      </span>
                    ) : (
                      <div className="flex items-center justify-between font-mono text-[15px]">
                        <p className="text-muted-foreground dark:text-muted-foreground">
                          {day.workingHours}j
                        </p>
                        {hasOvertime && (
                          <p className="text-app-accent-ink">
                            +{day.overtimeHours}j
                          </p>
                        )}
                      </div>
                    )
                  ) : (
                    <span className="font-mono text-[15px] text-muted-foreground dark:text-muted-foreground">
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
      <div className="flex flex-wrap items-center gap-4 px-1 font-mono text-[14px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-border bg-card dark:border-border dark:bg-card" />
          <span className="text-muted-foreground dark:text-muted-foreground">Hari Kerja</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-destructive/20 bg-destructive/[0.04]" />
          <span className="text-muted-foreground dark:text-muted-foreground">Libur</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-border bg-muted dark:border-border dark:bg-muted" />
          <span className="text-muted-foreground dark:text-muted-foreground">Akhir Pekan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 border border-primary/50 bg-primary/[0.06]" />
          <span className="text-muted-foreground dark:text-muted-foreground">Hari Ini</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-3 items-center justify-center rounded bg-primary/10 px-1 font-mono text-[15px] font-semibold text-app-accent-ink">DL</div>
          <span className="text-muted-foreground dark:text-muted-foreground">Deadline</span>
        </div>
      </div>

      {selectedDate && (
        <CalendarDayModal
          date={selectedDate}
          day={dayMap.get(selectedDate) ?? null}
          deliveries={deliveriesByDate.get(selectedDate) ?? []}
          canManage={canManage}
          onSaved={() => {
            setMessage("Pengaturan tanggal berhasil disimpan.");
            setSelectedDate(null);
          }}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
