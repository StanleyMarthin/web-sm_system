"use client";

/**
 * CalendarDayModal — Popup detail tanggal di kalender planning.
 * Menampilkan: Info Jam, Delivery, SPK (per unit+divisi), SPL.
 * Data SPK di-fetch lazy saat modal dibuka.
 */

import { useEffect, useState } from "react";
import type {
  CalendarDayOverrideRequest,
  WorkingDay,
  UnitEtaRecord,
} from "@smsystem/contracts/calendar";
import { useRouter } from "next/navigation";
import { X, Car, FileText, AlertTriangle, Loader2, Save } from "lucide-react";
import { fetchSpkGrid } from "@/shared/api/spk";
import { upsertCalendarDayOverride } from "@/shared/api/calendar";
import type { SpkHeaderRecord } from "@smsystem/contracts/spk";

interface CalendarDayModalProps {
  date: string;
  day: WorkingDay | null;
  deliveries: UnitEtaRecord[];
  canManage: boolean;
  onSaved?: () => void;
  onClose: () => void;
}

type ActiveTab = "delivery" | "spk" | "spl";
type OverrideMode = CalendarDayOverrideRequest["mode"];

function riskBadge(level: string) {
  const map: Record<string, string> = {
    RED: "bg-red-500/20 text-red-700 dark:text-red-300",
    ORANGE: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    YELLOW: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    GREEN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    BLACK: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
  };
  return map[level] ?? "bg-blue-500/20 text-blue-700 dark:text-blue-300";
}

function spkStatusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-500/15 text-gray-600 dark:text-gray-300",
    SUBMITTED: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    ACTIVE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    DONE: "bg-gray-400/15 text-gray-500 dark:text-gray-400",
    REJECTED: "bg-red-500/15 text-red-700 dark:text-red-300",
  };
  return map[status] ?? "bg-gray-500/15 text-gray-600";
}

export function CalendarDayModal({
  date,
  day,
  deliveries,
  canManage,
  onSaved,
  onClose,
}: CalendarDayModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("delivery");
  const [spkList, setSpkList] = useState<SpkHeaderRecord[]>([]);
  const [isLoadingSpk, setIsLoadingSpk] = useState(false);
  const [spkError, setSpkError] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>(
    day?.override?.mode ?? (day?.isWorkingDay ? "CUSTOM_HOURS" : "LIBUR"),
  );
  const [overrideWorkingHours, setOverrideWorkingHours] = useState(
    String(day?.workingHours ?? 0),
  );
  const [overrideOvertimeHours, setOverrideOvertimeHours] = useState(
    String(day?.overtimeHours ?? 0),
  );
  const [overrideNote, setOverrideNote] = useState(day?.override?.note ?? "");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Fetch SPK when tab switched to spk or spl
  useEffect(() => {
    if (activeTab !== "spk" && activeTab !== "spl") return;
    if (spkList.length > 0) return; // already fetched
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoadingSpk(true);
      setSpkError(null);
      fetchSpkGrid("", { date })
        .then((res) => {
          if (cancelled) return;
          if (res.payload) setSpkList(res.payload.data);
          else setSpkError("Gagal memuat data SPK.");
        })
        .catch(() => {
          if (!cancelled) setSpkError("Gagal memuat data SPK.");
        })
        .finally(() => {
          if (!cancelled) setIsLoadingSpk(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, date, spkList.length]);

  // SPL = SPK yang punya overtime rows > 0 (via plannerMeta)
  const splSpkList = spkList.filter(
    (s) => s.plannerMeta && s.plannerMeta.generatedOvertimeRows > 0
  );

  // Group allocations per unit for SPK detail view
  function groupAllocByUnit(spk: SpkHeaderRecord) {
    if (!spk.plannerMeta?.allocations) return [];
    const map = new Map<string, { unitName: string; divisions: { name: string; hours: number }[]; totalHours: number }>();
    for (const a of spk.plannerMeta.allocations) {
      if (!map.has(a.carId)) {
        map.set(a.carId, { unitName: a.unitName, divisions: [], totalHours: 0 });
      }
      const unit = map.get(a.carId)!;
      unit.divisions.push({ name: a.divisionName, hours: a.targetHours });
      unit.totalHours += a.targetHours;
    }
    return [...map.values()];
  }

  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: "delivery", label: "Delivery", count: deliveries.length },
    { id: "spk", label: "SPK", count: spkList.length || undefined },
    { id: "spl", label: "SPL", count: splSpkList.length || undefined },
  ];

  function selectOverrideMode(mode: OverrideMode) {
    setOverrideMode(mode);
    setOverrideError(null);
    if (mode === "LIBUR") {
      setOverrideWorkingHours("0");
      setOverrideOvertimeHours("0");
      return;
    }
    if (mode === "SETENGAH_HARI") {
      const halfDayHours = Math.ceil((day?.workingHours ?? 0) / 2);
      setOverrideWorkingHours(String(halfDayHours));
      setOverrideOvertimeHours("0");
      return;
    }
    setOverrideWorkingHours(String(day?.workingHours ?? 0));
    setOverrideOvertimeHours(String(day?.overtimeHours ?? 0));
  }

  async function handleSaveOverride() {
    if (!canManage) {
      setOverrideError("Anda tidak memiliki izin untuk mengubah kalender.");
      return;
    }

    const workingHours = overrideMode === "LIBUR" ? 0 : Number(overrideWorkingHours);
    const overtimeHours = overrideMode === "LIBUR" ? 0 : Number(overrideOvertimeHours);
    if (!Number.isFinite(workingHours) || !Number.isFinite(overtimeHours)) {
      setOverrideError("Jam kerja harus berupa angka.");
      return;
    }

    setIsSavingOverride(true);
    setOverrideError(null);
    try {
      const result = await upsertCalendarDayOverride({
        date,
        mode: overrideMode,
        workingHours: Math.max(0, workingHours),
        overtimeHours: Math.max(0, overtimeHours),
        note: overrideNote.trim() || null,
      });
      if (!result.success) {
        setOverrideError(result.message);
        return;
      }
      onSaved?.();
      router.refresh();
    } finally {
      setIsSavingOverride(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-md border border-white/5 bg-[#111114]" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-white/[0.05] px-6 py-4">
          <div>
            <h3 className="text-[16px] font-semibold text-white">{dateLabel}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-white/35">
              {day ? (day.isWorkingDay ? `Hari Kerja · ${day.workingHours}j reguler${day.overtimeHours > 0 ? ` · +${day.overtimeHours}j lembur` : ""}` : "Hari Libur") : "Tanpa data kalender"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-4 rounded p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/80">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Jam summary */}
        {day && (
          <div className="flex-shrink-0 border-b border-white/[0.04] px-6 py-3">
            <div className="flex gap-3">
              {[
                { label: "Jam Reguler", value: `${day.workingHours}j`, tone: "normal" },
                { label: "Jam Lembur", value: `${day.overtimeHours}j`, tone: day.overtimeHours > 0 ? "amber" : "normal" },
                { label: "Total Kapasitas", value: `${day.totalCapacityHours}j`, tone: "green" },
              ].map((m) => (
                <div key={m.label} className={`flex-1 rounded border px-3 py-2 ${m.tone === "green" ? "border-emerald-500/20 bg-emerald-500/[0.04]" : m.tone === "amber" ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-white/[0.04] bg-white/[0.02]"}`}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">{m.label}</p>
                  <p className={`mt-0.5 font-mono text-[15px] font-semibold ${m.tone === "green" ? "text-emerald-400" : m.tone === "amber" && day.overtimeHours > 0 ? "text-amber-400" : "text-white/80"}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {canManage && (
              <div className="mt-3 rounded border border-amber-500/15 bg-amber-500/[0.025] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400">
                      Atur tanggal ini
                    </p>
                  </div>
                  {day.override && (
                    <span className="border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-300">
                      Override aktif
                    </span>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { mode: "LIBUR" as const, label: "Libur", hint: "Bengkel tutup" },
                    { mode: "SETENGAH_HARI" as const, label: "Setengah Hari", hint: "Jam pendek" },
                    { mode: "CUSTOM_HOURS" as const, label: "Jam Khusus", hint: "Isi manual" },
                  ].map((option) => (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => selectOverrideMode(option.mode)}
                      className={[
                        "border px-3 py-2 text-left transition-colors",
                        overrideMode === option.mode
                          ? "border-amber-500/45 bg-amber-500/[0.1] text-amber-200"
                          : "border-white/[0.06] bg-[#0a0a0c] text-white/55 hover:border-amber-500/25",
                      ].join(" ")}
                    >
                      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[10px] text-white/30">{option.hint}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid gap-3">
                  {overrideMode !== "LIBUR" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-[11px] text-white/55">Jam kerja</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={overrideWorkingHours}
                          onChange={(event) => setOverrideWorkingHours(event.target.value)}
                          className="h-9 w-full border border-white/[0.08] bg-[#111114] px-3 font-mono text-[12px] text-white outline-none focus:border-amber-500/50"
                          aria-label="Jam kerja"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px] text-white/55">Jam lembur</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={overrideOvertimeHours}
                          onChange={(event) => setOverrideOvertimeHours(event.target.value)}
                          className="h-9 w-full border border-white/[0.08] bg-[#111114] px-3 font-mono text-[12px] text-white outline-none focus:border-amber-500/50"
                          aria-label="Jam lembur"
                        />
                      </label>
                    </div>
                  )}
                  <label>
                    <span className="mb-1 block text-[11px] text-white/55">Catatan</span>
                    <input
                      type="text"
                      maxLength={200}
                      value={overrideNote}
                      onChange={(event) => setOverrideNote(event.target.value)}
                      placeholder="Contoh: Cuti bersama"
                      className="h-9 w-full border border-white/[0.08] bg-[#111114] px-3 text-[12px] text-white outline-none placeholder:text-white/20 focus:border-amber-500/50"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSaveOverride()}
                    disabled={isSavingOverride}
                    className="inline-flex h-9 items-center justify-center gap-2 border border-amber-500/35 bg-amber-500/[0.12] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingOverride ? "Menyimpan..." : "Simpan tanggal"}
                  </button>
                </div>
                {overrideError && (
                  <p className="mt-2 text-[11px] text-red-300">{overrideError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mr-4 flex flex-shrink-0 gap-0 border-b border-white/[0.05] px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`mr-4 flex items-center gap-1.5 border-b-2 pb-2.5 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${activeTab === tab.id ? "border-amber-500 text-amber-500" : "border-transparent text-white/30 hover:text-white/60"}`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${activeTab === tab.id ? "bg-amber-500/20 text-amber-500" : "bg-white/[0.06] text-white/40"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── DELIVERY TAB ── */}
          {activeTab === "delivery" && (
            <div className="space-y-2">
              {deliveries.length === 0 ? (
                <div className="rounded border border-dashed border-white/[0.08] py-10 text-center">
                  <Car className="mx-auto mb-2 h-8 w-8 text-white/20" />
                  <p className="text-[12px] text-white/30">Tidak ada target delivery di tanggal ini.</p>
                </div>
              ) : (
                deliveries.map((unit) => (
                  <div key={unit.carId} className="rounded border border-blue-500/15 bg-blue-500/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-white">{unit.unitName}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">{unit.customerName ?? "Customer belum diisi"}</p>
                      </div>
                      <span className={`rounded px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${riskBadge(unit.riskLevel)}`}>
                        {unit.riskLevel}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="font-mono text-[9px] uppercase text-white/30">Sisa Jam</p>
                        <p className="mt-0.5 font-semibold text-white/80">{unit.remainingHours.toFixed(1)}j</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase text-white/30">ETA</p>
                        <p className="mt-0.5 font-semibold text-white/80">{unit.etaDays} hari</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase text-white/30">Prediksi</p>
                        <p className="mt-0.5 font-semibold text-white/80">{unit.predictedDeliveryDate ?? "–"}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── SPK TAB ── */}
          {activeTab === "spk" && (
            <div>
              {isLoadingSpk ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  <span className="ml-2 text-[12px] text-white/40">Memuat data SPK...</span>
                </div>
              ) : spkError ? (
                <div className="rounded border border-red-500/20 bg-red-500/[0.04] p-4 text-[12px] text-red-400">{spkError}</div>
              ) : spkList.length === 0 ? (
                <div className="rounded border border-dashed border-white/[0.08] py-10 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-white/20" />
                  <p className="text-[12px] text-white/30">Belum ada SPK di tanggal ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {spkList.map((spk) => {
                    const units = groupAllocByUnit(spk);
                    return (
                      <div key={spk.spkId} className="overflow-hidden rounded border border-white/[0.06]">
                        {/* SPK header */}
                        <div className="flex items-center justify-between bg-white/[0.02] px-4 py-3">
                          <div>
                            <p className="font-mono text-[11px] font-bold text-white">{spk.spkNumber}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-white/30">
                              {spk.totalUnits} unit · {spk.totalHours.toFixed(0)}j total
                            </p>
                          </div>
                          <span className={`rounded px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${spkStatusBadge(spk.status)}`}>
                            {spk.status}
                          </span>
                        </div>

                        {/* Per-unit breakdown */}
                        {units.length > 0 ? (
                          <div className="divide-y divide-white/[0.04]">
                            {units.map((u, i) => (
                              <div key={i} className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[13px] font-semibold text-white">{u.unitName}</p>
                                  <span className="font-mono text-[11px] font-semibold text-white/70">
                                    Total: {u.totalHours.toFixed(0)}j
                                  </span>
                                </div>
                                {/* Per-division rows */}
                                <div className="mt-2 space-y-1">
                                  {u.divisions.map((d, di) => (
                                    <div key={di} className="flex items-center justify-between rounded bg-white/[0.02] px-2 py-1">
                                      <span className="font-mono text-[10px] text-white/50">{d.name}</span>
                                      <span className="font-mono text-[10px] font-medium text-white/70">{d.hours.toFixed(0)}j</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-4 py-3 text-[11px] text-white/30">Detail alokasi tidak tersedia (SPK lama).</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SPL TAB ── */}
          {activeTab === "spl" && (
            <div>
              {isLoadingSpk ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  <span className="ml-2 text-[12px] text-white/40">Memuat data SPL...</span>
                </div>
              ) : spkError ? (
                <div className="rounded border border-red-500/20 bg-red-500/[0.04] p-4 text-[12px] text-red-400">{spkError}</div>
              ) : splSpkList.length === 0 ? (
                <div className="rounded border border-dashed border-white/[0.08] py-10 text-center">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-white/20" />
                  <p className="text-[12px] text-white/30">Tidak ada SPL (lembur) di tanggal ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {splSpkList.map((spk) => {
                    const units = groupAllocByUnit(spk);
                    const overtimeRows = spk.plannerMeta?.generatedOvertimeRows ?? 0;
                    return (
                      <div key={spk.spkId} className="overflow-hidden rounded border border-amber-500/20">
                        {/* SPL header */}
                        <div className="flex items-center justify-between bg-amber-500/[0.04] px-4 py-3">
                          <div>
                            <p className="font-mono text-[11px] font-bold text-amber-500">{spk.spkNumber}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-amber-500/50">
                              {overtimeRows} sesi lembur · {spk.totalHours.toFixed(0)}j total
                            </p>
                          </div>
                          <span className={`rounded px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${spkStatusBadge(spk.status)}`}>
                            {spk.status}
                          </span>
                        </div>

                        {units.length > 0 ? (
                          <div className="divide-y divide-amber-500/[0.08]">
                            {units.map((u, i) => (
                              <div key={i} className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[13px] font-semibold text-white">{u.unitName}</p>
                                  <span className="font-mono text-[11px] font-semibold text-amber-500">
                                    Total: {u.totalHours.toFixed(0)}j
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {u.divisions.map((d, di) => (
                                    <div key={di} className="flex items-center justify-between rounded bg-amber-500/[0.04] px-2 py-1">
                                      <span className="font-mono text-[10px] text-amber-500/60">{d.name}</span>
                                      <span className="font-mono text-[10px] font-medium text-amber-500">{d.hours.toFixed(0)}j</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-4 py-3 text-[11px] text-amber-500/40">Detail alokasi tidak tersedia.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
