"use client";

import { Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PlanOvertimeInput } from "@smsystem/contracts/calendar";
import type { WeeklyPlanOvertimeRecord } from "@/shared/api/planning";

interface DivisionOption {
  divisionId: number;
  divisionName: string;
}

interface PlanOvertimeTableProps {
  initialRows: WeeklyPlanOvertimeRecord[];
  divisionOptions: DivisionOption[];
  readOnly: boolean;
  onSave: (rows: PlanOvertimeInput[]) => Promise<{ success: boolean; message: string }>;
}

interface EditableOvertimeRow {
  key: string;
  divisionId: number;
  overtimeDate: string;
  dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY";
  overtimeHours: number;
  memberCount: number;
  includeHead: boolean;
  notes: string;
}

function createRowKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toEditableRows(rows: WeeklyPlanOvertimeRecord[], fallbackDivisionId: number): EditableOvertimeRow[] {
  if (rows.length === 0) {
    return [
      {
        key: createRowKey(),
        divisionId: fallbackDivisionId,
        overtimeDate: "",
        dayType: "WEEKDAY",
        overtimeHours: 1,
        memberCount: 1,
        includeHead: false,
        notes: "",
      },
    ];
  }

  return rows.map((row) => ({
    key: createRowKey(),
    divisionId: row.divisionId,
    overtimeDate: row.overtimeDate,
    dayType: row.dayType,
    overtimeHours: row.overtimeHours,
    memberCount: row.memberCount,
    includeHead: row.includeHead,
    notes: row.notes ?? "",
  }));
}

export function PlanOvertimeTable({
  initialRows,
  divisionOptions,
  readOnly,
  onSave,
}: PlanOvertimeTableProps) {
  const fallbackDivisionId = divisionOptions[0]?.divisionId ?? 0;
  const [rows, setRows] = useState<EditableOvertimeRow[]>(
    toEditableRows(initialRows, fallbackDivisionId),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(toEditableRows(initialRows, fallbackDivisionId));
    setMessage(null);
    setError(null);
  }, [initialRows, fallbackDivisionId]);

  const hasDivisionOptions = divisionOptions.length > 0;

  const totalHours = useMemo(
    () =>
      rows.reduce((total, row) => {
        const headCount = row.includeHead ? 1 : 0;
        return total + (row.memberCount + headCount) * row.overtimeHours;
      }, 0),
    [rows],
  );

  function updateRow(key: string, updater: (row: EditableOvertimeRow) => EditableOvertimeRow) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.key === key ? updater(row) : row)),
    );
  }

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      {
        key: createRowKey(),
        divisionId: fallbackDivisionId,
        overtimeDate: "",
        dayType: "WEEKDAY",
        overtimeHours: 1,
        memberCount: 1,
        includeHead: false,
        notes: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((currentRows) => currentRows.filter((row) => row.key !== key));
  }

  async function saveRows() {
    if (readOnly) {
      return;
    }

    if (!hasDivisionOptions) {
      setError("Data divisi teknis belum tersedia. Coba muat ulang halaman.");
      return;
    }

    const payload = rows
      .filter((row) => row.divisionId > 0 && row.overtimeDate && row.overtimeHours > 0 && row.memberCount > 0)
      .map(
        (row) =>
          ({
            divisionId: row.divisionId,
            overtimeDate: row.overtimeDate,
            dayType: row.dayType,
            overtimeHours: Number(row.overtimeHours),
            memberCount: Number(row.memberCount),
            includeHead: row.includeHead,
            notes: row.notes.trim() ? row.notes.trim() : undefined,
          }) satisfies PlanOvertimeInput,
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
          <h2 className="text-lg font-light text-white">Penyesuaian Lembur Manual</h2>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={readOnly}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-4 py-2 text-sm text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Baris
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-2 py-2">Divisi</th>
              <th className="px-2 py-2">Tanggal</th>
              <th className="px-2 py-2">Hari</th>
              <th className="px-2 py-2 text-right">Jam/Orang</th>
              <th className="px-2 py-2 text-right">Jumlah Orang</th>
              <th className="px-2 py-2 text-center">KD Ikut</th>
              <th className="px-2 py-2 text-right">Total Jam</th>
              <th className="px-2 py-2">Keterangan</th>
              <th className="px-2 py-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const headCount = row.includeHead ? 1 : 0;
              const totalRowHours = (row.memberCount + headCount) * row.overtimeHours;
              return (
                <tr key={row.key} className="border-t border-white/[0.06]">
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
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row.overtimeDate}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          overtimeDate: event.target.value,
                        }))
                      }
                      disabled={readOnly}
                      className="rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-sm text-white disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.dayType}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          dayType: event.target.value as EditableOvertimeRow["dayType"],
                        }))
                      }
                      disabled={readOnly}
                      className="rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-sm text-white disabled:opacity-60"
                    >
                      <option value="WEEKDAY">Hari Kerja</option>
                      <option value="SATURDAY">Sabtu</option>
                      <option value="SUNDAY">Minggu</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={row.overtimeHours}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          overtimeHours: Number(event.target.value),
                        }))
                      }
                      disabled={readOnly}
                      className="w-20 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-right text-sm text-white disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.memberCount}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          memberCount: Number(event.target.value),
                        }))
                      }
                      disabled={readOnly}
                      className="w-20 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-right text-sm text-white disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.includeHead}
                      onChange={(event) =>
                        updateRow(row.key, (currentRow) => ({
                          ...currentRow,
                          includeHead: event.target.checked,
                        }))
                      }
                      disabled={readOnly}
                      className="h-4 w-4 accent-amber-500 disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-amber-300">
                    {totalRowHours.toFixed(2)}
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
                      disabled={readOnly || rows.length === 1}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          Total rencana lembur minggu ini:{" "}
          <span className="font-medium text-amber-300">{totalHours.toFixed(2)} jam</span>
        </p>
        <button
          type="button"
          onClick={saveRows}
          disabled={readOnly || isSaving}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${isSaving ? "animate-spin" : ""}`} />
          Hitung Ulang Kapasitas
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
