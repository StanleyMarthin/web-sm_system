"use client";

import type {
  PlanDivisionInput,
  PlanUnitInput,
  PlanningMaterialStatus,
} from "@smsystem/contracts/calendar";
import { ArrowLeft, ArrowRight, CalendarRange, CheckCircle2, Save, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  publishWeeklyPlan,
  setWeeklyPlanDivisions,
  setWeeklyPlanUnits,
  snapshotWeeklyPlanAbsence,
  upsertWeeklyPlan,
  type WeeklyPlanDetailPayload,
} from "@/shared/api/planning";

interface WeeklyPlanShellProps {
  weekStartDate: string;
  data: WeeklyPlanDetailPayload;
  canManage: boolean;
  title?: string;
  description?: string;
}

type WizardStep = 1 | 2 | 3;

type EditableDivisionRow = {
  divisionId: number;
  divisionName: string;
  autoMemberCount: number;
  memberCount: number;
  absenceLostHours: number;
  normalCapacityHours: number;
  netCapacityHours: number;
};

type EditableBudgetRow = {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  divisionId: number;
  divisionName: string;
  targetHoursInput: string;
  remainingHours: number;
  isMargin: boolean;
  materialStatus: PlanningMaterialStatus;
  materialReady: boolean;
  materialNote: string | null;
  lockReason: string | null;
  focusReason: string;
};

function formatHours(value: number): string {
  return `${value.toFixed(2)} jam`;
}

function formatCompactHours(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const wholeHours = Math.floor(safeValue);
  const minutes = Math.round((safeValue - wholeHours) * 60);
  return `${wholeHours}:${String(minutes).padStart(2, "0")}`;
}

function statusStyle(status: "DRAFT" | "PUBLISHED" | "CLOSED"): string {
  if (status === "PUBLISHED") {
    return "border-emerald-500/30 text-emerald-200";
  }
  if (status === "CLOSED") {
    return "border-white/20 text-gray-800 dark:text-white/70";
  }
  return "border-amber-500/30 text-amber-200";
}

function statusLabel(status: "DRAFT" | "PUBLISHED" | "CLOSED"): string {
  if (status === "PUBLISHED") {
    return "Sudah dipublish";
  }
  if (status === "CLOSED") {
    return "Ditutup";
  }
  return "Draft planner";
}

function materialStatusLabel(status: PlanningMaterialStatus): string {
  switch (status) {
    case "HUNTING":
      return "Masih hunting";
    case "ORDERED":
      return "Sedang dipesan";
    case "VENDOR":
      return "Masih di vendor";
    default:
      return "Siap";
  }
}

function normalizeDivisionRows(data: WeeklyPlanDetailPayload): EditableDivisionRow[] {
  if (data.divisionInputs.length > 0) {
    return data.divisionInputs.map((row) => {
      const capacity = data.capacity.find((item) => item.divisionId === row.divisionId);
      return {
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        autoMemberCount: row.autoMemberCount,
        memberCount: row.memberCount,
        absenceLostHours: capacity?.absenceLostHours ?? 0,
        normalCapacityHours: capacity?.normalCapacityHours ?? 0,
        netCapacityHours: capacity?.netCapacityHours ?? 0,
      };
    });
  }

  return data.capacity.map((row) => ({
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    autoMemberCount: row.memberCountActive,
    memberCount: row.memberCountActive,
    absenceLostHours: row.absenceLostHours,
    normalCapacityHours: row.normalCapacityHours,
    netCapacityHours: row.netCapacityHours,
  }));
}

function normalizeBudgetRows(data: WeeklyPlanDetailPayload): EditableBudgetRow[] {
  const currentAllocations = new Map(
    data.units.map((row) => [`${row.carId}::${row.divisionId}`, row]),
  );
  const recommendationMap = new Map(
    (data.recommendations?.units ?? []).map((unit) => [unit.carId, unit]),
  );

  return data.planningUnits.map((unit) => {
    const recommendation = recommendationMap.get(unit.carId);
    const recommendedDivision =
      recommendation?.divisions.find((division) => division.isFocus) ??
      recommendation?.divisions
        .filter((division) => division.recommendedHours > 0)
        .sort((left, right) => right.recommendedHours - left.recommendedHours)[0];
    const currentAllocation = recommendedDivision
      ? currentAllocations.get(`${unit.carId}::${recommendedDivision.divisionId}`)
      : data.units.find((row) => row.carId === unit.carId);

    const divisionId = currentAllocation?.divisionId ?? recommendedDivision?.divisionId ?? 0;
    const divisionName =
      currentAllocation?.divisionName ??
      recommendedDivision?.divisionName ??
      unit.lockedDivisionName ??
      "Belum ditentukan";
    const targetHours =
      currentAllocation?.allocatedHours ??
      recommendedDivision?.recommendedHours ??
      0;
    const isLocked = !unit.isMargin || !unit.materialReady;

    return {
      carId: unit.carId,
      unitName: unit.unitName,
      customerName: unit.customerName,
      targetDeliveryDate: unit.targetDeliveryDate,
      divisionId,
      divisionName,
      targetHoursInput: targetHours > 0 ? targetHours.toFixed(2) : "",
      remainingHours: unit.remainingHours,
      isMargin: unit.isMargin,
      materialStatus: unit.materialStatus,
      materialReady: unit.materialReady,
      materialNote: unit.materialNote,
      lockReason: !unit.isMargin
        ? "⛔ Unit non-margin. Tidak dibudget di planner mingguan."
        : !unit.materialReady
          ? `⛔ ${unit.materialNote ?? "Material belum siap."}`
          : null,
      focusReason: recommendation?.focusReason ?? "Belum ada alasan fokus dari sistem.",
    };
  });
}

export function WeeklyPlanShell({
  weekStartDate,
  data,
  canManage,
  title = "Weekly planner",
  description = "Planner mingguan untuk mengunci kapasitas, menentukan target jam kerja per unit, lalu menerbitkan draft SPK otomatis.",
}: WeeklyPlanShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const plan = data.plan;
  const plannerLocked = plan?.status === "PUBLISHED" || plan?.status === "CLOSED";
  const canEdit = canManage && !plannerLocked;
  const [step, setStep] = useState<WizardStep>(1);
  const [divisionRows, setDivisionRows] = useState<EditableDivisionRow[]>(
    normalizeDivisionRows(data),
  );
  const [budgetRows, setBudgetRows] = useState<EditableBudgetRow[]>(
    normalizeBudgetRows(data),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setDivisionRows(normalizeDivisionRows(data));
    setBudgetRows(normalizeBudgetRows(data));
    setMessage(null);
    setError(null);
  }, [data, weekStartDate]);

  const totalNetCapacity = Number(data.gap.totalNetCapacity.toFixed(2));
  const totalTargetHours = useMemo(
    () =>
      Number(
        budgetRows.reduce((total, row) => {
          const parsedValue = Number(row.targetHoursInput);
          return total + (Number.isFinite(parsedValue) ? parsedValue : 0);
        }, 0).toFixed(2),
      ),
    [budgetRows],
  );
  const liveCountdown = Number((totalNetCapacity - totalTargetHours).toFixed(2));

  const totalAttendance = useMemo(
    () => divisionRows.reduce((total, row) => total + row.memberCount, 0),
    [divisionRows],
  );

  const editableBudgetRows = budgetRows.filter((row) => !row.lockReason);
  const blockedBudgetRows = budgetRows.filter((row) => Boolean(row.lockReason));

  const hasInvalidBudgetRows = editableBudgetRows.some((row) => {
    const parsedValue = Number(row.targetHoursInput);
    return !row.divisionId || !Number.isFinite(parsedValue) || parsedValue < 0;
  });

  const autoOvertimePreviewRows = useMemo(
    () =>
      (data.recommendations?.divisions ?? []).flatMap((division) =>
        division.schedule
          .filter((row) => row.extraHoursRecommended > 0)
          .map((row) => ({
            divisionId: division.divisionId,
            divisionName: division.divisionName,
            overtimeDate: row.date,
            dayName: row.dayName,
            overtimeHours: row.extraHoursRecommended,
          })),
      ),
    [data.recommendations],
  );

  function pushWeekStart(nextWeekStart: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextWeekStart) {
      nextParams.set("weekStart", nextWeekStart);
    } else {
      nextParams.delete("weekStart");
    }

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function ensurePlanRecord(targetHours: number) {
    const result = await upsertWeeklyPlan({
      weekStartDate,
      targetHours: Number(targetHours.toFixed(2)),
      labourRate: plan?.labourRate ?? undefined,
      notes: plan?.notes ?? undefined,
    });
    return result;
  }

  async function persistDivisionRows() {
    const draftResult = await ensurePlanRecord(totalTargetHours);
    if (!draftResult.success) {
      return {
        success: false as const,
        message: draftResult.message,
      };
    }

    const result = await setWeeklyPlanDivisions(
      draftResult.result.planId,
      divisionRows.map(
        (row) =>
          ({
            divisionId: row.divisionId,
            memberCount: Math.max(0, Number(row.memberCount)),
          }) satisfies PlanDivisionInput,
      ),
    );
    if (!result.success) {
      return result;
    }

    return {
      success: true as const,
      planId: draftResult.result.planId,
      message: "Kapasitas bersih minggu ini berhasil dikunci.",
    };
  }

  async function persistBudgetRows() {
    if (editableBudgetRows.length === 0) {
      return {
        success: false as const,
        message: "Belum ada unit margin yang siap dibudget minggu ini.",
      };
    }

    if (hasInvalidBudgetRows) {
      return {
        success: false as const,
        message: "Periksa kembali target jam kerja. Nilainya harus angka dan tidak boleh negatif.",
      };
    }

    const draftResult = await ensurePlanRecord(totalTargetHours);
    if (!draftResult.success) {
      return {
        success: false as const,
        message: draftResult.message,
      };
    }

    const payload = budgetRows
      .filter((row) => !row.lockReason)
      .map((row) => ({
        carId: row.carId,
        divisionId: row.divisionId,
        allocatedHours: Number((Number(row.targetHoursInput) || 0).toFixed(2)),
        notes: row.focusReason,
      }))
      .filter((row) => row.divisionId > 0 && row.allocatedHours > 0) satisfies PlanUnitInput[];

    const result = await setWeeklyPlanUnits(draftResult.result.planId, payload);
    if (!result.success) {
      return result;
    }

    return {
      success: true as const,
      planId: draftResult.result.planId,
      message: "Target jam kerja per unit berhasil disimpan.",
    };
  }

  async function handleSaveCapacity(moveNext = false) {
    if (!canEdit) {
      setError("Anda belum memiliki izin untuk mengubah planner mingguan.");
      return;
    }

    setIsSavingCapacity(true);
    setMessage(null);
    setError(null);
    try {
      const result = await persistDivisionRows();
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      if (moveNext) {
        setStep(2);
      }
      router.refresh();
    } finally {
      setIsSavingCapacity(false);
    }
  }

  async function handleSnapshotAbsence() {
    if (!canEdit) {
      setError("Anda belum memiliki izin untuk mengambil data absensi.");
      return;
    }

    setIsSnapshotting(true);
    setMessage(null);
    setError(null);
    try {
      const draftResult = await ensurePlanRecord(totalTargetHours);
      if (!draftResult.success) {
        setError(draftResult.message);
        return;
      }

      const result = await snapshotWeeklyPlanAbsence(draftResult.result.planId);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(`Absensi minggu ini berhasil dimuat (${result.result.snapshotCount} baris).`);
      router.refresh();
    } finally {
      setIsSnapshotting(false);
    }
  }

  async function handleSaveBudget(moveNext = false) {
    if (!canEdit) {
      setError("Anda belum memiliki izin untuk mengubah target jam kerja.");
      return;
    }

    setIsSavingBudget(true);
    setMessage(null);
    setError(null);
    try {
      const result = await persistBudgetRows();
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      if (moveNext) {
        setStep(3);
      }
      router.refresh();
    } finally {
      setIsSavingBudget(false);
    }
  }

  async function handlePublish() {
    if (!canEdit) {
      setError("Anda belum memiliki izin untuk publish planner.");
      return;
    }

    setIsPublishing(true);
    setMessage(null);
    setError(null);
    try {
      const saveResult = await persistBudgetRows();
      if (!saveResult.success) {
        setError(saveResult.message);
        return;
      }

      const result = await publishWeeklyPlan(saveResult.planId);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Planner berhasil dipublish dan draft SPK sudah dibuat.");
      router.push(`/spk/${result.result.spkDraftId}`);
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Planner Mingguan
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-gray-950 dark:text-white">{title}</h2>
            {description ? null : null}
            {plan ? (
              <div className="mt-3 inline-flex border border-gray-300 dark:border-white/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-900 dark:text-white/80">
                <span className={`border px-2 py-0.5 ${statusStyle(plan.status)}`}>
                  {statusLabel(plan.status)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-white/65">
            <CalendarRange className="h-4 w-4" />
            <span>Minggu mulai</span>
            <input
              type="date"
              value={weekStartDate}
              onChange={(event) => pushWeekStart(event.target.value)}
              className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {([
            {
              stepNumber: 1,
              title: "Capacity",
              helper: "Konfirmasi jumlah mekanik hadir dan kunci kapasitas bersih.",
            },
            {
              stepNumber: 2,
              title: "Hard-Lock & Budgeting",
              helper: "Isi target jam kerja hanya untuk unit margin yang benar-benar siap.",
            },
            {
              stepNumber: 3,
              title: "Reality Check & Auto-Draft",
              helper: "Lihat backlog vs kapasitas, preview lembur, lalu publish draft SPK.",
            },
          ] as const).map((item) => {
            const active = step === item.stepNumber;
            const done = step > item.stepNumber;
            return (
              <button
                key={item.stepNumber}
                type="button"
                onClick={() => setStep(item.stepNumber)}
                className={`border px-3 py-3 text-left transition-colors ${
                  active
                    ? "border-amber-500/30 bg-transparent"
                    : "border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] hover:bg-gray-100 dark:hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                      Langkah {item.stepNumber}
                    </p>
                    <h3 className="mt-1 text-[12px] text-gray-950 dark:text-white">{item.title}</h3>
                    {item.helper ? null : null}
                  </div>
                  <div
                    className={`flex h-7 w-7 items-center justify-center border font-mono text-[10px] font-semibold ${
                      done
                        ? "border-emerald-500/30 text-emerald-300"
                        : active
                          ? "border-amber-500/30 text-amber-300"
                          : "border-gray-300 dark:border-white/[0.08] text-gray-600 dark:text-white/45"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : item.stepNumber}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {message ? (
          <p className="mt-3 border border-emerald-500/30 px-3 py-2 text-[11px] text-emerald-300">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 border border-red-500/30 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
      </section>

      {step === 1 ? (
        <section className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Mekanik hadir</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{totalAttendance}</p>
            </div>
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Jam normal</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">
                {formatCompactHours(
                  Number(
                    divisionRows.reduce((total, row) => total + row.normalCapacityHours, 0).toFixed(2),
                  ),
                )}
              </p>
            </div>
            <div className="border border-amber-500/30 bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300/70">Total net capacity</p>
              <p className="mt-1 font-mono text-[13px] text-amber-200">{formatCompactHours(totalNetCapacity)}</p>
            </div>
          </div>

          <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-light text-gray-950 dark:text-white">Konfirmasi jumlah mekanik hadir</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleSnapshotAbsence();
                }}
                disabled={!canEdit || isSnapshotting}
                className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-800 dark:text-white/70 transition-colors hover:text-gray-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSnapshotting ? "Memuat absensi..." : "Muat absensi terbaru"}
              </button>
            </div>

            <div className="mt-3 overflow-x-auto border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c]">
              <table className="min-w-full text-[12px] text-gray-900 dark:text-white/80">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  <tr>
                    <th className="px-3 py-2">Divisi</th>
                    <th className="px-3 py-2 text-right">Hitung sistem</th>
                    <th className="px-3 py-2 text-right">Dipakai minggu ini</th>
                    <th className="px-3 py-2 text-right">Absensi</th>
                    <th className="px-3 py-2 text-right">Jam bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionRows.map((row) => (
                    <tr key={row.divisionId} className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-gray-950 dark:text-white">{row.divisionName}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-white/60">{row.autoMemberCount}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.memberCount}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setDivisionRows((currentValue) =>
                              currentValue.map((item) =>
                                item.divisionId === row.divisionId
                                  ? {
                                      ...item,
                                      memberCount: Math.max(
                                        0,
                                        Number.parseInt(event.target.value || "0", 10) || 0,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 w-24 border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-right font-mono text-[11px] text-gray-950 dark:text-white disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-white/60">{formatHours(row.absenceLostHours)}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-amber-300">
                        {formatHours(row.netCapacityHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveCapacity(false);
                  }}
                  disabled={!canEdit || isSavingCapacity}
                  className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-800 dark:text-white/70 transition-colors hover:text-gray-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingCapacity ? "Menyimpan..." : "Simpan kapasitas"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveCapacity(true);
                  }}
                  disabled={!canEdit || isSavingCapacity}
                  className="inline-flex h-8 items-center gap-2 border border-amber-500/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Lanjut ke budgeting
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Net capacity</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{formatCompactHours(totalNetCapacity)}</p>
            </div>
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Total target jam</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{formatCompactHours(totalTargetHours)}</p>
            </div>
            <div
              className={`border px-3 py-3 ${
                liveCountdown < 0
                  ? "border-red-500/30 bg-white dark:bg-[#111114]"
                  : "border-emerald-500/30 bg-white dark:bg-[#111114]"
              }`}
            >
              <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${liveCountdown < 0 ? "text-red-200/70" : "text-emerald-200/70"}`}>
                Live countdown
              </p>
              <p className={`mt-1 font-mono text-[13px] ${liveCountdown < 0 ? "text-red-100" : "text-emerald-100"}`}>
                {liveCountdown < 0 ? "-" : ""}
                {formatCompactHours(Math.abs(liveCountdown))}
              </p>
            </div>
          </div>

          <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-light text-gray-950 dark:text-white">Hard-lock & budgeting</h3>
              </div>
              <p className="border border-gray-300 dark:border-white/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-700 dark:text-white/60">
                {blockedBudgetRows.length} unit terkunci otomatis
              </p>
            </div>

            <div className="mt-3 overflow-x-auto border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c]">
              <table className="min-w-full text-[12px] text-gray-900 dark:text-white/80">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  <tr>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Divisi fokus</th>
                    <th className="px-3 py-2 text-right">Sisa kerja</th>
                    <th className="px-3 py-2 text-right">Target jam kerja</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row) => (
                    <tr key={`${row.carId}::${row.divisionId}::${row.divisionName}`} className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <p className="text-gray-950 dark:text-white">{row.unitName}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-white/35">
                          {row.customerName ?? "Customer belum diisi"}{row.targetDeliveryDate ? ` • target ${row.targetDeliveryDate}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-950 dark:text-white">{row.divisionName}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-white/35">{row.focusReason}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatHours(row.remainingHours)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={row.targetHoursInput}
                          disabled={!canEdit || Boolean(row.lockReason)}
                          onChange={(event) =>
                            setBudgetRows((currentValue) =>
                              currentValue.map((item) =>
                                item.carId === row.carId && item.divisionId === row.divisionId
                                  ? {
                                      ...item,
                                      targetHoursInput: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 w-28 border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-right font-mono text-[11px] text-gray-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                            row.lockReason
                              ? "border-red-500/30 text-red-300"
                              : "border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          {row.lockReason ? "Terkunci" : materialStatusLabel(row.materialStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/55">
                        {row.lockReason ?? "Siap dibudget. Isi target jam kerja untuk minggu ini."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-800 dark:text-white/70 transition-colors hover:text-gray-950 dark:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveBudget(false);
                  }}
                  disabled={!canEdit || isSavingBudget}
                  className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-800 dark:text-white/70 transition-colors hover:text-gray-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingBudget ? "Menyimpan..." : "Simpan budgeting"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveBudget(true);
                  }}
                  disabled={!canEdit || isSavingBudget || hasInvalidBudgetRows}
                  className="inline-flex h-8 items-center gap-2 border border-amber-500/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reality check
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Backlog</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">
                {data.recommendations ? formatCompactHours(data.recommendations.summary.totalDemandHours) : "0:00"}
              </p>
            </div>
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Kapasitas bersih</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{formatCompactHours(totalNetCapacity)}</p>
            </div>
            <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Tekanan ETA</p>
              <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">
                {data.recommendations?.summary.bottleneckDivisionName ?? "-"}
              </p>
            </div>
          </div>

          <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-light text-gray-950 dark:text-white">Reality check</h3>
              </div>
              <div
                className={`border px-3 py-2 text-[11px] ${
                  liveCountdown < 0
                    ? "border-red-500/30 text-red-200"
                    : "border-emerald-500/30 text-emerald-200"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.12em]">Net capacity - total target</p>
                <p className="mt-1 font-mono text-[13px] font-semibold">
                  {liveCountdown < 0 ? "-" : ""}
                  {formatCompactHours(Math.abs(liveCountdown))}
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c]">
              <table className="min-w-full text-[12px] text-gray-900 dark:text-white/80">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  <tr>
                    <th className="px-3 py-2">Metrik</th>
                    <th className="px-3 py-2 text-right">Nilai</th>
                    <th className="px-3 py-2">Makna</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2">Backlog</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {data.recommendations ? formatHours(data.recommendations.summary.totalDemandHours) : "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-white/55">Sisa kerja aktual yang belum selesai.</td>
                  </tr>
                  <tr className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2">Kapasitas bersih</td>
                    <td className="px-3 py-2 text-right font-mono">{formatHours(totalNetCapacity)}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-white/55">Kapasitas kerja normal setelah absensi.</td>
                  </tr>
                  <tr className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2">ETA pressure</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {data.recommendations ? formatHours(data.recommendations.summary.uncoveredHours) : "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-white/55">Jam yang belum tertutup dan berpotensi mendorong keterlambatan.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-3">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Auto-draft lembur</h4>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-[12px] text-gray-900 dark:text-white/80">
                  <thead className="text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                    <tr>
                        <th className="px-3 py-2">Divisi</th>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Hari</th>
                        <th className="px-3 py-2 text-right">Jam tambahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoOvertimePreviewRows.length > 0 ? (
                      autoOvertimePreviewRows.map((row) => (
                        <tr key={`${row.divisionId}-${row.overtimeDate}`} className="border-t border-gray-300 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                          <td className="px-3 py-2">{row.divisionName}</td>
                          <td className="px-3 py-2 font-mono">{row.overtimeDate}</td>
                          <td className="px-3 py-2">{row.dayName}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-100">
                            {formatHours(row.overtimeHours)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-gray-300 dark:border-white/[0.06]">
                        <td colSpan={4} className="px-3 py-4 text-sm text-gray-600 dark:text-white/45">
                          Belum perlu draft lembur baru. Kapasitas masih cukup untuk target saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {data.alerts.length > 0 ? (
              <div className="mt-3 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-3">
                <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Alert planner</h4>
                <div className="mt-3 space-y-2">
                  {data.alerts.slice(0, 6).map((alert, index) => (
                    <div
                      key={`${alert.type}-${alert.divisionId ?? alert.carId ?? index}`}
                      className={`border px-3 py-2 text-[11px] ${
                        alert.severity === "CRITICAL"
                          ? "border-red-500/30 text-red-300"
                          : alert.severity === "WARNING"
                            ? "border-amber-500/30 text-amber-300"
                            : "border-gray-300 dark:border-white/[0.08] text-gray-800 dark:text-white/70"
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-800 dark:text-white/70 transition-colors hover:text-gray-950 dark:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handlePublish();
                  }}
                  disabled={!canEdit || isPublishing || totalTargetHours <= 0}
                  className="inline-flex h-8 items-center gap-2 border border-amber-500/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {isPublishing ? "Menerbitkan..." : "Publish & Buat Draft SPK"}
                </button>
              </div>
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
