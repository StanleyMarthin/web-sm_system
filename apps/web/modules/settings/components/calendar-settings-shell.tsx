"use client";

import type {
  DeliveryRiskQuery,
  DeliveryRiskSummary,
  UnitEtaRecord,
  WeeklyWorkConfigRecord,
  WeeklyWorkConfigRequest,
  WorkingDay,
} from "@smsystem/contracts/calendar";
import { CalendarDays, Gauge, RefreshCcw, Save } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { simulateCapacity, upsertWeeklyConfig } from "@/shared/api/calendar";

interface CalendarSettingsShellProps {
  weeklyConfigs: WeeklyWorkConfigRecord[];
  workingDays: {
    startDate: string;
    endDate: string;
    includeOvertime: boolean;
    days: WorkingDay[];
  };
  riskRows: UnitEtaRecord[];
  riskMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  riskState: DeliveryRiskQuery;
  riskSummary: DeliveryRiskSummary;
  divisionOptions: Array<{ label: string; value: string }>;
  canManage: boolean;
  showHero?: boolean;
}

interface WeeklyConfigFormState {
  weekStartDate: string;
  weekdayHours: string;
  saturdayHours: string;
  sundayHours: string;
  weekdayOvertimeHours: string;
  saturdayOvertimeHours: string;
  sundayOvertimeHours: string;
  efficiencyFactor: string;
  qcBufferDays: string;
}

function toFormState(config?: WeeklyWorkConfigRecord): WeeklyConfigFormState {
  return {
    weekStartDate: config?.weekStartDate ?? "",
    weekdayHours: String(config?.weekdayHours ?? 8),
    saturdayHours: String(config?.saturdayHours ?? 5),
    sundayHours: String(config?.sundayHours ?? 0),
    weekdayOvertimeHours: String(config?.weekdayOvertimeHours ?? 5),
    saturdayOvertimeHours: String(config?.saturdayOvertimeHours ?? 3),
    sundayOvertimeHours: String(config?.sundayOvertimeHours ?? 0),
    efficiencyFactor: String(config?.efficiencyFactor ?? 1),
    qcBufferDays: String(config?.qcBufferDays ?? 1),
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-white/60">{label}</span>
      {children}
    </label>
  );
}

function riskRank(level: string): number {
  if (level === "BLACK") {
    return 5;
  }
  if (level === "RED") {
    return 4;
  }
  if (level === "ORANGE") {
    return 3;
  }
  if (level === "YELLOW") {
    return 2;
  }
  return 1;
}

function riskLabel(level: string): string {
  if (level === "BLACK") {
    return "Data belum lengkap";
  }
  if (level === "RED") {
    return "Perlu dikejar";
  }
  if (level === "ORANGE") {
    return "Mulai ketat";
  }
  if (level === "YELLOW") {
    return "Melekat target";
  }
  return "Masih aman";
}

function riskTone(level: string): string {
  if (level === "BLACK") {
    return "border-white/[0.12] bg-white/[0.06] text-white";
  }
  if (level === "RED") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }
  if (level === "ORANGE") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  if (level === "YELLOW") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
}

export function CalendarSettingsShell({
  weeklyConfigs,
  workingDays,
  riskRows,
  riskState,
  riskSummary,
  divisionOptions,
  canManage,
  showHero = true,
}: CalendarSettingsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [configForm, setConfigForm] = useState<WeeklyConfigFormState>(toFormState(weeklyConfigs[0]));
  const [capacityDivisionId, setCapacityDivisionId] = useState(divisionOptions[0]?.value ?? "");
  const [capacityActivePic, setCapacityActivePic] = useState("1");
  const [capacityIncludeOvertime, setCapacityIncludeOvertime] = useState(false);
  const [capacityResult, setCapacityResult] = useState<{
    divisionName: string;
    effectiveDailyCapacity: number;
    workingHours: number;
    activePicCount: number;
    efficiencyFactor: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const highRiskRows = useMemo(
    () =>
      [...riskRows]
        .sort((left, right) => {
          const levelCompare = riskRank(right.riskLevel) - riskRank(left.riskLevel);
          if (levelCompare !== 0) {
            return levelCompare;
          }

          return right.remainingHours - left.remainingHours;
        })
        .slice(0, 4),
    [riskRows],
  );

  const riskyUnitCount = riskSummary.orange + riskSummary.red + riskSummary.black;
  const safeUnitCount = riskSummary.green + riskSummary.yellow;

  function pushSearch(updates: Record<string, string | null>) {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function handleSaveConfig() {
    if (!canManage) {
      setError("Anda belum memiliki izin untuk mengubah aturan kerja mingguan.");
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

      setMessage("Aturan minggu kerja berhasil disimpan.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSimulateCapacity() {
    if (!capacityDivisionId) {
      setError("Pilih divisi yang ingin dicek.");
      return;
    }

    setError(null);
    setMessage(null);

    const result = await simulateCapacity({
      divisionId: Number.parseInt(capacityDivisionId, 10),
      date: riskState.asOfDate,
      activePicCount: Number.parseInt(capacityActivePic, 10),
      includeOvertime: capacityIncludeOvertime,
    });

    if (!result.success) {
      setError(result.message);
      return;
    }

    setCapacityResult(result.result);
  }

  return (
    <div className="space-y-6">
      {showHero ? (
        <section className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <CalendarDays className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                    Planning & ETA
                  </p>
                  <h2 className="mt-1 text-xl font-medium text-white">
                    Peta risiko serah unit minggu ini
                  </h2>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                Sistem membaca tanggal target, kapasitas kerja, dan beban yang tersisa agar PM
                bisa cepat tahu unit mana yang aman dan mana yang perlu didorong.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={riskState.asOfDate}
                onChange={(event) => pushSearch({ asOfDate: event.target.value, page: "1" })}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
              />
              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white/65 transition-colors hover:text-white"
              >
                <RefreshCcw className="h-4 w-4" />
                Muat ulang
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div>
            <p className="text-sm text-white">Posisi risiko per {riskState.asOfDate}</p>
            <p className="mt-1 text-sm text-white/45">
              Buka halaman Units untuk daftar lengkap. Di sini hanya ditampilkan hal yang perlu
              perhatian cepat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={riskState.asOfDate}
              onChange={(event) => pushSearch({ asOfDate: event.target.value, page: "1" })}
              className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
            />
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white/65 transition-colors hover:text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              Muat ulang
            </button>
          </div>
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03]">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-3 py-3">Posisi</th>
              <th className="px-3 py-3 text-right">Jumlah</th>
              <th className="px-3 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Masih aman</td>
              <td className="px-3 py-3 text-right">{safeUnitCount}</td>
              <td className="px-3 py-3 text-white/45">Unit yang masih sesuai atau melekat dengan target</td>
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Perlu dikejar</td>
              <td className="px-3 py-3 text-right">{riskSummary.orange + riskSummary.red}</td>
              <td className="px-3 py-3 text-white/45">Unit yang mulai ketat atau berisiko telat</td>
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Data belum lengkap</td>
              <td className="px-3 py-3 text-right">{riskSummary.black}</td>
              <td className="px-3 py-3 text-white/45">Target atau kapasitas belum cukup untuk dihitung rapi</td>
            </tr>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3">Perlu perhatian hari ini</td>
              <td className="px-3 py-3 text-right">{riskyUnitCount}</td>
              <td className="px-3 py-3 text-white/45">Prioritas yang perlu dicek PM lebih dulu</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-light text-white">Unit yang perlu dijaga</h2>
            <p className="mt-1 text-sm text-white/45">
              Ringkasan cepat untuk membantu PM menentukan prioritas. Daftar unit lengkap tetap
              ada di halaman Units.
            </p>
          </div>
          <Link
            href="/units"
            className="inline-flex items-center rounded-full border border-white/[0.12] px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
          >
            Buka halaman Units
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3">Posisi</th>
                <th className="px-3 py-3">Target</th>
                <th className="px-3 py-3 text-right">Sisa jam</th>
                <th className="px-3 py-3">Prediksi</th>
              </tr>
            </thead>
            <tbody>
              {highRiskRows.length > 0 ? (
                highRiskRows.map((row) => (
                  <tr key={`${row.carId}-${row.riskLevel}`} className="border-t border-white/[0.06]">
                    <td className="px-3 py-3">
                      <Link
                        href={`/units/${String(row.carId)}`}
                        className="text-white transition-colors hover:text-amber-300"
                      >
                        {row.unitName}
                      </Link>
                      <p className="mt-1 text-xs text-white/35">{row.customerName ?? "Customer belum diisi"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${riskTone(row.riskLevel)}`}
                      >
                        {riskLabel(row.riskLevel)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.targetDeliveryDate ?? "-"}</td>
                    <td className="px-3 py-3 text-right">{row.remainingHours.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      {row.predictedDeliveryDate ? `Prediksi ${row.predictedDeliveryDate}` : "Prediksi belum siap"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={5} className="px-3 py-4 text-sm text-white/50">
                    Belum ada unit yang perlu ditonjolkan di tanggal ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-light text-white">Pengaturan mesin hitung</h2>
            <p className="mt-1 text-sm text-white/45">
              Dipakai bila PM perlu menyesuaikan jam kerja mingguan, melihat kapasitas divisi,
              atau mengecek kalender kerja aktif.
            </p>
          </div>
          <span className="text-sm text-amber-300 transition-transform group-open:rotate-180">
            ˅
          </span>
        </summary>

        <div className="space-y-6 border-t border-white/[0.06] px-5 py-5">
          {message ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <section className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <Save className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                  Aturan Minggu Kerja
                </p>
                <h3 className="mt-1 text-lg font-medium text-white">Dasar hitung kapasitas</h3>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Minggu mulai">
                <input
                  type="date"
                  value={configForm.weekStartDate}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, weekStartDate: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Faktor efisiensi">
                <input
                  value={configForm.efficiencyFactor}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, efficiencyFactor: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Buffer QC (hari)">
                <input
                  value={configForm.qcBufferDays}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, qcBufferDays: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Jam kerja Senin-Jumat">
                <input
                  value={configForm.weekdayHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, weekdayHours: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Jam kerja Sabtu">
                <input
                  value={configForm.saturdayHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, saturdayHours: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Jam kerja Minggu">
                <input
                  value={configForm.sundayHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({ ...current, sundayHours: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Batas lembur Senin-Jumat">
                <input
                  value={configForm.weekdayOvertimeHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      weekdayOvertimeHours: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Batas lembur Sabtu">
                <input
                  value={configForm.saturdayOvertimeHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      saturdayOvertimeHours: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
              <FormField label="Batas lembur Minggu">
                <input
                  value={configForm.sundayOvertimeHours}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      sundayOvertimeHours: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                />
              </FormField>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isSaving || !canManage}
                onClick={() => void handleSaveConfig()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan aturan minggu kerja"}
              </button>
              <p className="text-sm text-white/45">
                Pilih salah satu aturan yang pernah dipakai untuk mengisi form lebih cepat.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {weeklyConfigs.slice(0, 4).map((config) => (
                <button
                  key={config.configId}
                  type="button"
                  onClick={() => setConfigForm(toFormState(config))}
                  className="block w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <p className="text-sm text-white">{config.weekStartDate}</p>
                  <p className="mt-1 text-sm text-white/45">
                    Senin-Jumat {config.weekdayHours} jam • Sabtu {config.saturdayHours} jam •
                    efisiensi {config.efficiencyFactor}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Gauge className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                    Cek Divisi
                  </p>
                  <h3 className="mt-1 text-lg font-medium text-white">
                    Lihat kemampuan kerja harian
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <FormField label="Divisi">
                  <select
                    value={capacityDivisionId}
                    onChange={(event) => setCapacityDivisionId(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                  >
                    <option value="">Pilih divisi</option>
                    {divisionOptions.map((division) => (
                      <option key={division.value} value={division.value}>
                        {division.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Jumlah anggota aktif">
                  <input
                    value={capacityActivePic}
                    onChange={(event) => setCapacityActivePic(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                  />
                </FormField>
                <label className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={capacityIncludeOvertime}
                    onChange={(event) => setCapacityIncludeOvertime(event.target.checked)}
                  />
                  Ikut hitung jam tambahan
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handleSimulateCapacity()}
                className="mt-5 inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-white/80 transition-colors hover:text-white"
              >
                Lihat kapasitas divisi
              </button>

              {capacityResult ? (
                <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/65">
                  <p className="text-white">{capacityResult.divisionName}</p>
                  <p className="mt-2">Anggota aktif: {capacityResult.activePicCount}</p>
                  <p>Jam kerja dasar: {capacityResult.workingHours}</p>
                  <p>Efisiensi kerja: {capacityResult.efficiencyFactor}</p>
                  <p>
                    Kapasitas efektif per hari:{" "}
                    {capacityResult.effectiveDailyCapacity.toFixed(2)} jam
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                Kalender Kerja
              </p>
              <h3 className="mt-1 text-lg font-medium text-white">Hari kerja yang sedang dihitung</h3>

              <div className="mt-4 grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
                <FormField label="Mulai">
                  <input
                    type="date"
                    value={workingDays.startDate}
                    onChange={(event) => pushSearch({ startDate: event.target.value })}
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                  />
                </FormField>
                <FormField label="Selesai">
                  <input
                    type="date"
                    value={workingDays.endDate}
                    onChange={(event) => pushSearch({ endDate: event.target.value })}
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
                  />
                </FormField>
                <FormField label="Tambahkan jam ekstra">
                  <label className="flex h-11 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white/60">
                    <input
                      type="checkbox"
                      checked={workingDays.includeOvertime}
                      onChange={(event) =>
                        pushSearch({ includeOvertime: event.target.checked ? "true" : null })
                      }
                    />
                    Ikut hitung
                  </label>
                </FormField>
              </div>

              {/* Calendar Grid Visualization */}
              <div className="mt-6">
                <div className="grid grid-cols-7 gap-1">
                  {/* Header Hari */}
                  {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((hari) => (
                    <div key={hari} className="pb-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
                      {hari.substring(0, 3)}
                    </div>
                  ))}
                  
                  {/* Empty cells for offset */}
                  {workingDays.days.length > 0 && Array.from({
                    length: {
                      "Senin": 0,
                      "Selasa": 1,
                      "Rabu": 2,
                      "Kamis": 3,
                      "Jumat": 4,
                      "Sabtu": 5,
                      "Minggu": 6
                    }[workingDays.days[0].dayName] ?? 0
                  }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px] rounded-xl bg-white/[0.01]" />
                  ))}

                  {/* Date cells */}
                  {workingDays.days.map((day) => {
                    const isLibur = day.totalCapacityHours === 0;
                    const isWeekend = day.dayName === "Minggu";
                    const isOvertime = day.overtimeHours > 0;
                    const dateNum = day.date.split("-")[2];

                    return (
                      <div
                        key={day.date}
                        className={`group relative flex min-h-[80px] flex-col rounded-xl border p-2 transition-colors hover:border-white/20 ${
                          isLibur
                            ? "border-red-500/20 bg-red-500/[0.03]"
                            : isWeekend
                              ? "border-amber-500/10 bg-amber-500/[0.02]"
                              : "border-white/[0.06] bg-white/[0.03]"
                        }`}
                      >
                        {/* Date Number */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                              isLibur
                                ? "bg-red-500/20 text-red-300"
                                : isWeekend
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "text-white/80"
                            }`}
                          >
                            {dateNum}
                          </span>
                          
                          {/* Total Hours Badge */}
                          <span className={`font-mono text-[9px] ${
                            isLibur ? "text-red-400/50" : "text-white/40"
                          }`}>
                            {day.totalCapacityHours}j
                          </span>
                        </div>

                        {/* Details */}
                        <div className="mt-auto pt-2 text-[9px] uppercase tracking-[0.05em]">
                          {isLibur ? (
                            <span className="text-red-400">Libur</span>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="text-white/60">{day.workingHours}j Reg</p>
                              {isOvertime && (
                                <p className="text-amber-400">+{day.overtimeHours}j Lbr</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}
