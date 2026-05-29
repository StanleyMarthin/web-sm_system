"use client";

import type {
  SpkDetailRecord,
  SpkHeaderRecord,
  SpkPlannerAllocation,
} from "@smsystem/contracts/spk";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  activateSpk,
  updateSpkDraftDetails,
} from "@/shared/api/spk";

interface SpkDetailShellProps {
  header: SpkHeaderRecord;
  details: SpkDetailRecord[];
  canStart: boolean;
  canEditBreakdown: boolean;
}

interface BreakdownRowState {
  clientId: string;
  detailId: string | null;
  unitNameSnapshot: string;
  divisionNameSnapshot: string;
  jobNameSnapshot: string;
  picNameSnapshot: string;
  targetHoursInput: string;
  targetDateSnapshot: string;
}

function formatStatusLabel(value: string): string {
  switch (value) {
    case "DRAFT":
      return "Draft Planner";
    case "SUBMITTED":
      return "Diajukan";
    case "APPROVED":
      return "Siap Mulai";
    case "REJECTED":
      return "Ditolak";
    case "ACTIVE":
      return "Berjalan";
    case "DONE":
      return "Selesai";
    case "PENDING":
      return "Menunggu";
    default:
      return value || "-";
  }
}

function formatHourValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const wholeHours = Math.floor(value);
  const minutes = Math.round((value - wholeHours) * 60);
  return `${wholeHours}:${String(minutes).padStart(2, "0")}`;
}

function buildAllocationKey(unitName: string, divisionName: string): string {
  return `${unitName.trim()}::${divisionName.trim()}`;
}

function buildClientId(seed?: string | null): string {
  if (seed) {
    return `row-${seed}`;
  }
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function toBreakdownRows(details: SpkDetailRecord[]): BreakdownRowState[] {
  return details.map((detail) => ({
    clientId: buildClientId(detail.detailId),
    detailId: detail.detailId,
    unitNameSnapshot: detail.unitNameSnapshot,
    divisionNameSnapshot: detail.divisionNameSnapshot,
    jobNameSnapshot: detail.jobNameSnapshot,
    picNameSnapshot: detail.picNameSnapshot,
    targetHoursInput: detail.targetHoursSnapshot.toFixed(2),
    targetDateSnapshot: detail.targetDateSnapshot,
  }));
}

function getAllocationCards(
  header: SpkHeaderRecord,
  details: SpkDetailRecord[],
): SpkPlannerAllocation[] {
  if (header.plannerMeta?.allocations?.length) {
    return header.plannerMeta.allocations;
  }

  const grouped = new Map<string, SpkPlannerAllocation>();
  for (const detail of details) {
    const allocationKey = buildAllocationKey(
      detail.unitNameSnapshot,
      detail.divisionNameSnapshot,
    );
    const existing = grouped.get(allocationKey);
    if (existing) {
      existing.targetHours = Number(
        (existing.targetHours + detail.targetHoursSnapshot).toFixed(2),
      );
      continue;
    }

    grouped.set(allocationKey, {
      allocationKey,
      carId: detail.unitNameSnapshot,
      unitName: detail.unitNameSnapshot,
      divisionId: 0,
      divisionName: detail.divisionNameSnapshot,
      targetHours: detail.targetHoursSnapshot,
    });
  }

  return Array.from(grouped.values());
}

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-lg text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-white/40">{helper}</p> : null}
    </div>
  );
}

export function SpkDetailShell({
  header,
  details,
  canStart,
  canEditBreakdown,
}: SpkDetailShellProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingBreakdown, setIsSavingBreakdown] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [draftRows, setDraftRows] = useState<BreakdownRowState[]>(() =>
    toBreakdownRows(details),
  );

  useEffect(() => {
    setDraftRows(toBreakdownRows(details));
    setSelectedRowIds([]);
    setMessage(null);
    setError(null);
  }, [details, header.spkId]);

  const allocationCards = useMemo(
    () => getAllocationCards(header, details),
    [details, header],
  );

  const budgetByAllocation = useMemo(
    () =>
      new Map(
        allocationCards.map((allocation) => [
          buildAllocationKey(allocation.unitName, allocation.divisionName),
          allocation.targetHours,
        ]),
      ),
    [allocationCards],
  );

  const usageByAllocation = useMemo(() => {
    const usage = new Map<string, number>();
    for (const row of draftRows) {
      const parsedHours = Number(row.targetHoursInput);
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        continue;
      }

      const allocationKey = buildAllocationKey(
        row.unitNameSnapshot,
        row.divisionNameSnapshot,
      );
      usage.set(
        allocationKey,
        Number(((usage.get(allocationKey) ?? 0) + parsedHours).toFixed(2)),
      );
    }
    return usage;
  }, [draftRows]);

  const groupedRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        allocation: SpkPlannerAllocation;
        rows: BreakdownRowState[];
      }
    >();

    for (const allocation of allocationCards) {
      grouped.set(buildAllocationKey(allocation.unitName, allocation.divisionName), {
        allocation,
        rows: [],
      });
    }

    for (const row of draftRows) {
      const allocationKey = buildAllocationKey(
        row.unitNameSnapshot,
        row.divisionNameSnapshot,
      );
      const bucket = grouped.get(allocationKey);
      if (bucket) {
        bucket.rows.push(row);
      }
    }

    return Array.from(grouped.values());
  }, [allocationCards, draftRows]);

  const totalRecommendedHours = useMemo(
    () =>
      Number(
        allocationCards
          .reduce((total, allocation) => total + allocation.targetHours, 0)
          .toFixed(2),
      ),
    [allocationCards],
  );

  const totalDetailedHours = useMemo(
    () =>
      Number(
        draftRows
          .reduce((total, row) => total + (Number(row.targetHoursInput) || 0), 0)
          .toFixed(2),
      ),
    [draftRows],
  );

  const overBudgetKeys = useMemo(
    () =>
      Array.from(usageByAllocation.entries())
        .filter(([allocationKey, usedHours]) => usedHours > (budgetByAllocation.get(allocationKey) ?? 0) + 0.001)
        .map(([allocationKey]) => allocationKey),
    [budgetByAllocation, usageByAllocation],
  );

  const hasInvalidRows = useMemo(
    () =>
      draftRows.some((row) => {
        const parsedHours = Number(row.targetHoursInput);
        return (
          !row.picNameSnapshot.trim() ||
          !row.jobNameSnapshot.trim() ||
          !row.targetDateSnapshot.trim() ||
          !Number.isFinite(parsedHours) ||
          parsedHours <= 0
        );
      }),
    [draftRows],
  );

  const isReadOnly = header.status === "ACTIVE" || header.status === "DONE";
  const canEditDraftBreakdown = canEditBreakdown && header.status === "DRAFT" && !isReadOnly;
  const canStartSpk =
    canStart &&
    !isReadOnly &&
    (header.status === "DRAFT" || header.status === "APPROVED");

  function updateDraftRow(
    clientId: string,
    field: keyof BreakdownRowState,
    value: string | null,
  ) {
    setDraftRows((currentValue) =>
      currentValue.map((row) =>
        row.clientId === clientId
          ? {
              ...row,
              [field]: value ?? "",
            }
          : row,
      ),
    );
  }

  function toggleSelectedRow(clientId: string) {
    setSelectedRowIds((currentValue) =>
      currentValue.includes(clientId)
        ? currentValue.filter((rowId) => rowId !== clientId)
        : [...currentValue, clientId],
    );
  }

  function addBreakdownRow(allocation: SpkPlannerAllocation) {
    setDraftRows((currentValue) => [
      ...currentValue,
      {
        clientId: buildClientId(),
        detailId: null,
        unitNameSnapshot: allocation.unitName,
        divisionNameSnapshot: allocation.divisionName,
        jobNameSnapshot: "Rincian kerja",
        picNameSnapshot: "",
        targetHoursInput: "",
        targetDateSnapshot: header.spkDate,
      },
    ]);
    setIsBreakdownOpen(true);
  }

  function removeSelectedRows() {
    if (selectedRowIds.length === 0) {
      return;
    }

    setDraftRows((currentValue) =>
      currentValue.filter((row) => !selectedRowIds.includes(row.clientId)),
    );
    setSelectedRowIds([]);
  }

  async function handleStartSpk() {
    setError(null);
    setMessage(null);
    setIsStarting(true);

    try {
      const result = await activateSpk(header.spkId);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("SPK sudah diterima dan langsung aktif.");
      router.refresh();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSaveBreakdown() {
    if (!canEditDraftBreakdown) {
      setError("Rincian mekanik hanya bisa diubah saat SPK masih draft.");
      return;
    }

    if (hasInvalidRows) {
      setError("Lengkapi PIC, rincian kerja, tanggal, dan jam kerja setiap baris.");
      return;
    }

    if (overBudgetKeys.length > 0) {
      setError("Total rincian mekanik melebihi rekomendasi jam kerja dari PM.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsSavingBreakdown(true);

    try {
      const result = await updateSpkDraftDetails(header.spkId, {
        rows: draftRows.map((row) => ({
          detailId: row.detailId,
          unitNameSnapshot: row.unitNameSnapshot,
          divisionNameSnapshot: row.divisionNameSnapshot,
          jobNameSnapshot: row.jobNameSnapshot.trim(),
          picNameSnapshot: row.picNameSnapshot.trim(),
          targetHoursSnapshot: Number(row.targetHoursInput),
          targetDateSnapshot: row.targetDateSnapshot,
        })),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Rincian distribusi mekanik berhasil disimpan.");
      router.refresh();
    } finally {
      setIsSavingBreakdown(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/spk?date=${header.spkDate}`}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55 ring-1 ring-white/[0.06] hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Daftar
        </Link>
        <div className="rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-amber-300 ring-1 ring-amber-500/25">
          {header.spkNumber}
        </div>
      </div>

      <section className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              SPK Lapangan
            </p>
            <h1 className="mt-2 text-2xl font-light text-white">
              Fokus utama: terima target kerja lalu mulai SPK
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/45">
              Halaman ini menyederhanakan target mingguan dari PM menjadi instruksi yang langsung
              bisa dijalankan oleh kepala divisi. Rincian pembagian mekanik tetap tersedia sebagai
              opsi lanjutan jika memang dibutuhkan.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoCard
                label="Status"
                value={formatStatusLabel(header.status)}
                helper={`Tanggal kerja ${header.spkDate}`}
              />
              <InfoCard
                label="Rekomendasi Jam"
                value={`${formatHourValue(totalRecommendedHours)} jam`}
                helper={`${header.totalUnits} unit · ${allocationCards.length} target divisi`}
              />
              <InfoCard
                label="Rincian Mekanik"
                value={`${formatHourValue(totalDetailedHours)} jam`}
                helper={
                  overBudgetKeys.length > 0
                    ? "Melebihi rekomendasi PM"
                    : "Masih dalam batas rekomendasi"
                }
              />
            </div>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-3">
            {canStartSpk ? (
              <button
                type="button"
                disabled={isStarting}
                onClick={() => {
                  void handleStartSpk();
                }}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-3xl bg-amber-500 px-6 py-4 text-base font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/40"
              >
                <Play className="h-5 w-5" />
                {isStarting ? "Memulai SPK..." : "Terima & Mulai SPK"}
              </button>
            ) : (
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                {isReadOnly
                  ? "SPK ini sudah berjalan atau selesai. Semua rincian sekarang hanya bisa dibaca."
                  : "SPK ini belum siap untuk langsung dimulai dari layar ini."}
              </div>
            )}

            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] px-4 py-4 text-sm text-white/45">
              Kepala divisi boleh langsung mulai tanpa harus mengisi rincian mekanik. Jika ingin
              membagi target ke beberapa mekanik, buka rincian opsional di bawah.
            </div>
          </div>
        </div>

        {message ? (
          <p className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-2xl border border-red-500/15 bg-red-500/[0.08] px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {allocationCards.map((allocation) => {
          const allocationKey = buildAllocationKey(
            allocation.unitName,
            allocation.divisionName,
          );
          const usedHours = usageByAllocation.get(allocationKey) ?? 0;
          const remainingHours = Number((allocation.targetHours - usedHours).toFixed(2));
          const isOverBudget = overBudgetKeys.includes(allocationKey);

          return (
            <div
              key={allocationKey}
              className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                    {allocation.divisionName}
                  </p>
                  <h3 className="mt-2 text-lg font-medium text-white">
                    {allocation.unitName}
                  </h3>
                  <p className="mt-2 text-sm text-white/45">
                    Rekomendasi jam kerja dari PM untuk divisi ini.
                  </p>
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-right ring-1 ${
                    isOverBudget
                      ? "bg-red-500/10 text-red-200 ring-red-500/25"
                      : "bg-amber-500/10 text-amber-200 ring-amber-500/25"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em]">
                    Rekomendasi Jam Kerja
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatHourValue(allocation.targetHours)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Rincian Saat Ini
                  </p>
                  <p className="mt-2 text-base text-white">{formatHourValue(usedHours)} jam</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Sisa Slot
                  </p>
                  <p className="mt-2 text-base text-white">
                    {remainingHours >= 0 ? formatHourValue(remainingHours) : "0:00"} jam
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Status Rincian
                  </p>
                  <p className="mt-2 text-base text-white">
                    {isOverBudget ? "Melebihi budget" : "Masih aman"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#050505] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <button
          type="button"
          onClick={() => setIsBreakdownOpen((currentValue) => !currentValue)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Opsional
            </p>
            <h3 className="mt-1 text-base font-medium text-white">
              Rincian Distribusi Mekanik
            </h3>
            <p className="mt-2 text-sm text-white/45">
              Gunakan jika kepala produksi ingin membagi target jam ke mekanik tertentu. Secara
              default fitur ini tertutup agar kepala divisi bisa fokus ke target utamanya.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-white/45 transition-transform ${isBreakdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isBreakdownOpen ? (
          <div className="border-t border-white/[0.06] px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/45">
                <ClipboardList className="h-4 w-4 text-amber-400" />
                <span>
                  Total rincian saat ini: <span className="text-white">{formatHourValue(totalDetailedHours)} jam</span>
                </span>
              </div>
              {canEditDraftBreakdown ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedRowIds.length === 0}
                    onClick={() => removeSelectedRows()}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Terpilih
                  </button>
                  <button
                    type="button"
                    disabled={isSavingBreakdown || hasInvalidRows || overBudgetKeys.length > 0 || draftRows.length === 0}
                    onClick={() => {
                      void handleSaveBreakdown();
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingBreakdown ? "Menyimpan..." : "Simpan Rincian"}
                  </button>
                </div>
              ) : (
                <span className="text-sm text-white/35">
                  {isReadOnly
                    ? "SPK sudah berjalan atau selesai, jadi rincian mekanik hanya bisa dibaca."
                    : "Hanya KP, PM, atau MP yang bisa mengubah rincian mekanik."}
                </span>
              )}
            </div>

            <div className="space-y-5">
              {groupedRows.map(({ allocation, rows }) => {
                const allocationKey = buildAllocationKey(
                  allocation.unitName,
                  allocation.divisionName,
                );
                const usedHours = usageByAllocation.get(allocationKey) ?? 0;
                const remainingHours = Number((allocation.targetHours - usedHours).toFixed(2));
                const isOverBudget = overBudgetKeys.includes(allocationKey);

                return (
                  <div
                    key={allocationKey}
                    className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                          {allocation.divisionName}
                        </p>
                        <h4 className="mt-1 text-base font-medium text-white">
                          {allocation.unitName}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-white/65">
                          Budget PM: <span className="text-white">{formatHourValue(allocation.targetHours)} jam</span>
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-white/65">
                          Dipakai: <span className="text-white">{formatHourValue(usedHours)} jam</span>
                        </span>
                        <span
                          className={`rounded-full px-3 py-1.5 ${
                            isOverBudget
                              ? "border border-red-500/20 bg-red-500/10 text-red-200"
                              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                          }`}
                        >
                          {isOverBudget
                            ? "Melebihi budget"
                            : `Sisa ${formatHourValue(Math.max(remainingHours, 0))} jam`}
                        </span>
                        {canEditDraftBreakdown ? (
                          <button
                            type="button"
                            onClick={() => addBreakdownRow(allocation)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 transition-colors hover:text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tambah Mekanik
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-sm text-white/75">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.16em] text-white/30">
                            <th className="w-10 text-left">#</th>
                            <th className="w-[18%] text-left">PIC / Mekanik</th>
                            <th className="text-left">Rincian Kerja</th>
                            <th className="w-[12%] text-left">Jam</th>
                            <th className="w-[16%] text-left">Target</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-4 text-sm text-white/35">
                                Belum ada rincian mekanik untuk unit dan divisi ini.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row) => (
                              <tr key={row.clientId}>
                                <td className="pr-2 align-top">
                                  <label className="inline-flex h-11 items-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedRowIds.includes(row.clientId)}
                                      onChange={() => toggleSelectedRow(row.clientId)}
                                      disabled={!canEditDraftBreakdown}
                                      className="h-4 w-4 rounded border-white/10 bg-transparent text-amber-400"
                                    />
                                  </label>
                                </td>
                                <td className="align-top">
                                  <input
                                    value={row.picNameSnapshot}
                                    onChange={(event) =>
                                      updateDraftRow(
                                        row.clientId,
                                        "picNameSnapshot",
                                        event.target.value,
                                      )
                                    }
                                    readOnly={!canEditDraftBreakdown}
                                    placeholder="Nama mekanik"
                                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/15 focus:border-amber-500/30 read-only:cursor-default read-only:opacity-70"
                                  />
                                </td>
                                <td className="align-top">
                                  <input
                                    value={row.jobNameSnapshot}
                                    onChange={(event) =>
                                      updateDraftRow(
                                        row.clientId,
                                        "jobNameSnapshot",
                                        event.target.value,
                                      )
                                    }
                                    readOnly={!canEditDraftBreakdown}
                                    placeholder="Rincian kerja"
                                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/15 focus:border-amber-500/30 read-only:cursor-default read-only:opacity-70"
                                  />
                                </td>
                                <td className="align-top">
                                  <input
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={row.targetHoursInput}
                                    onChange={(event) =>
                                      updateDraftRow(
                                        row.clientId,
                                        "targetHoursInput" as keyof BreakdownRowState,
                                        event.target.value,
                                      )
                                    }
                                    readOnly={!canEditDraftBreakdown}
                                    placeholder="0.00"
                                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/15 focus:border-amber-500/30 read-only:cursor-default read-only:opacity-70"
                                  />
                                </td>
                                <td className="align-top">
                                  <input
                                    type="date"
                                    value={row.targetDateSnapshot}
                                    onChange={(event) =>
                                      updateDraftRow(
                                        row.clientId,
                                        "targetDateSnapshot",
                                        event.target.value,
                                      )
                                    }
                                    readOnly={!canEditDraftBreakdown}
                                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors focus:border-amber-500/30 read-only:cursor-default read-only:opacity-70"
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {header.status === "ACTIVE" || header.status === "DONE" ? (
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                Rincian mekanik dikunci karena SPK sudah aktif atau sudah selesai.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
