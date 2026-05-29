"use client";

import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PlanUnitInput } from "@smsystem/contracts/calendar";
import type {
  WeeklyPlanUnitAllocationRecord,
  WeeklyPlanUnitRiskRecord,
} from "@/shared/api/planning";

interface DivisionOption {
  divisionId: number;
  divisionName: string;
}

interface PlanUnitsTableProps {
  planningUnits: WeeklyPlanUnitRiskRecord[];
  initialRows: WeeklyPlanUnitAllocationRecord[];
  divisionOptions: DivisionOption[];
  readOnly: boolean;
  onSave: (rows: PlanUnitInput[]) => Promise<{ success: boolean; message: string }>;
  title?: string;
  description?: string;
}

type EditableUnitRow = {
  key: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number;
  isMargin: boolean;
  divisionId: number;
  allocatedHours: number;
  priorityRank: number | null;
  notes: string;
};

function createRowKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `unit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function estimateEtaDays(remainingHours: number, allocatedHours: number): number | null {
  if (allocatedHours <= 0) {
    return null;
  }

  const dailyAllocation = allocatedHours / 5;
  if (dailyAllocation <= 0) {
    return null;
  }

  const remainingAfterAllocation = Math.max(0, remainingHours - allocatedHours);
  return Math.ceil(remainingAfterAllocation / dailyAllocation);
}

function normalizeRows(
  initialRows: WeeklyPlanUnitAllocationRecord[],
  planningUnits: WeeklyPlanUnitRiskRecord[],
  fallbackDivisionId: number,
): EditableUnitRow[] {
  const rows: EditableUnitRow[] = initialRows.map((row) => ({
    key: createRowKey(),
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    targetDeliveryDate: row.targetDeliveryDate,
    remainingHours: row.remainingHours,
    isMargin: row.isMargin,
    divisionId: row.divisionId,
    allocatedHours: row.allocatedHours,
    priorityRank: row.priorityRank,
    notes: row.notes ?? "",
  }));

  const existingCars = new Set(rows.map((row) => row.carId));
  for (const unit of planningUnits) {
    if (existingCars.has(unit.carId)) {
      continue;
    }

    rows.push({
      key: createRowKey(),
      carId: unit.carId,
      unitName: unit.unitName,
      customerName: unit.customerName,
      targetDeliveryDate: unit.targetDeliveryDate,
      remainingHours: unit.remainingHours,
      isMargin: unit.isMargin,
      divisionId: fallbackDivisionId,
      allocatedHours: 0,
      priorityRank: null,
      notes: "",
    });
  }

  return rows;
}

function comparePriority(left: EditableUnitRow, right: EditableUnitRow): number {
  const leftRank = left.priorityRank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.priorityRank ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.unitName.localeCompare(right.unitName);
}

function swapPriority(rows: EditableUnitRow[], indexA: number, indexB: number): EditableUnitRow[] {
  const nextRows = [...rows];
  const rowA = nextRows[indexA];
  const rowB = nextRows[indexB];
  if (!rowA || !rowB) {
    return rows;
  }

  const rankA = rowA.priorityRank ?? indexA + 1;
  const rankB = rowB.priorityRank ?? indexB + 1;
  nextRows[indexA] = { ...rowA, priorityRank: rankB };
  nextRows[indexB] = { ...rowB, priorityRank: rankA };
  return nextRows;
}

export function PlanUnitsTable({
  planningUnits,
  initialRows,
  divisionOptions,
  readOnly,
  onSave,
  title = "Penyesuaian Fokus Unit",
  description = "",
}: PlanUnitsTableProps) {
  const fallbackDivisionId = divisionOptions[0]?.divisionId ?? initialRows[0]?.divisionId ?? 0;
  const [rows, setRows] = useState<EditableUnitRow[]>(
    normalizeRows(initialRows, planningUnits, fallbackDivisionId),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(normalizeRows(initialRows, planningUnits, fallbackDivisionId));
    setMessage(null);
    setError(null);
  }, [initialRows, planningUnits, fallbackDivisionId]);

  const sortedRows = useMemo(() => [...rows].sort(comparePriority), [rows]);
  const rowIndexMap = useMemo(
    () => new Map(rows.map((row, index) => [row.key, index])),
    [rows],
  );

  const totalAllocatedHours = useMemo(
    () => rows.reduce((total, row) => total + row.allocatedHours, 0),
    [rows],
  );

  const marginSummary = useMemo(() => {
    const total = rows.length;
    const nonMargin = rows.filter((row) => !row.isMargin).length;
    return { total, nonMargin };
  }, [rows]);

  function updateRow(key: string, updater: (row: EditableUnitRow) => EditableUnitRow) {
    setRows((currentRows) => currentRows.map((row) => (row.key === key ? updater(row) : row)));
  }

  function removeRow(key: string) {
    setRows((currentRows) => currentRows.filter((row) => row.key !== key));
  }

  function movePriority(key: string, direction: "up" | "down") {
    const ordered = [...rows].sort(comparePriority);
    const position = ordered.findIndex((row) => row.key === key);
    if (position === -1) {
      return;
    }

    const targetPosition = direction === "up" ? position - 1 : position + 1;
    if (targetPosition < 0 || targetPosition >= ordered.length) {
      return;
    }

    const source = ordered[position];
    const target = ordered[targetPosition];
    if (!source || !target) {
      return;
    }

    const sourceIndex = rowIndexMap.get(source.key);
    const targetIndex = rowIndexMap.get(target.key);
    if (sourceIndex === undefined || targetIndex === undefined) {
      return;
    }

    setRows((currentRows) => swapPriority(currentRows, sourceIndex, targetIndex));
  }

  async function saveRows() {
    if (readOnly) {
      return;
    }

    if (divisionOptions.length === 0) {
      setError("Data divisi teknis belum tersedia. Coba muat ulang halaman.");
      return;
    }

    const payload = rows
      .filter((row) => row.divisionId > 0 && row.allocatedHours > 0)
      .map(
        (row) =>
          ({
            carId: row.carId,
            divisionId: row.divisionId,
            allocatedHours: Number(row.allocatedHours.toFixed(2)),
            priorityRank: row.priorityRank ?? undefined,
            notes: row.notes.trim() ? row.notes.trim() : undefined,
          }) satisfies PlanUnitInput,
      );

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onSave(payload);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-light text-white">{title}</h2>
          {description ? null : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Unit</th>
              <th className="px-2 py-2">Deadline</th>
              <th className="px-2 py-2 text-right">Sisa Jam</th>
              <th className="px-2 py-2">Divisi</th>
              <th className="px-2 py-2 text-right">Jam Dorong</th>
              <th className="px-2 py-2">Perkiraan Selesai</th>
              <th className="px-2 py-2">Keterangan</th>
              <th className="px-2 py-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const etaDays = estimateEtaDays(row.remainingHours, row.allocatedHours);
              return (
                <tr key={row.key} className="border-t border-white/[0.06]">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 text-center text-xs text-white/70">
                        {row.priorityRank ?? index + 1}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => movePriority(row.key, "up")}
                          disabled={readOnly || index === 0}
                          className="rounded border border-white/[0.1] p-1 text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePriority(row.key, "down")}
                          disabled={readOnly || index === sortedRows.length - 1}
                          className="rounded border border-white/[0.1] p-1 text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div>
                      <p className="font-medium text-white">{row.unitName}</p>
                      <p className="text-[11px] text-white/35">
                        {row.customerName ?? "Customer belum diisi"} • {row.carId}
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-2">{row.targetDeliveryDate ?? "-"}</td>
                  <td className="px-2 py-2 text-right">{row.remainingHours.toFixed(2)}</td>
                  <td className="px-2 py-2">
                    <select
                      value={row.divisionId}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          divisionId: Number(event.target.value),
                        }))
                      }
                      disabled={readOnly}
                      className="w-44 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-sm text-white disabled:opacity-60"
                    >
                      {divisionOptions.map((division) => (
                        <option key={division.divisionId} value={division.divisionId}>
                          {division.divisionName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={row.allocatedHours}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          allocatedHours: Number(event.target.value),
                        }))
                      }
                      disabled={readOnly}
                      className="w-24 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-right text-sm text-white disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2">
                    {etaDays === null ? (
                      <span className="text-white/35">Belum ada alokasi</span>
                    ) : (
                      <span className="text-amber-300">{etaDays} hari kerja</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.notes}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          notes: event.target.value,
                        }))
                      }
                      disabled={readOnly}
                      placeholder="Opsional"
                      className="w-48 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-sm text-white placeholder:text-white/35 disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={readOnly || sortedRows.length === 1}
                      className="rounded-full border border-white/[0.1] p-2 text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/45">
        <p>
          Total unit: <span className="text-white">{marginSummary.total}</span> • Non-margin:{" "}
          <span className="text-amber-300">{marginSummary.nonMargin}</span>
        </p>
        <p>
          Total alokasi minggu ini:{" "}
          <span className="font-medium text-amber-300">{totalAllocatedHours.toFixed(2)} jam</span>
        </p>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={saveRows}
          disabled={readOnly || isSaving}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan Alokasi Unit"}
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
