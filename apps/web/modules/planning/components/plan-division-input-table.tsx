"use client";

import type { PlanDivisionInput } from "@smsystem/contracts/calendar";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WeeklyPlanDetailPayload } from "@/shared/api/planning";

interface PlanDivisionInputTableProps {
  initialRows: WeeklyPlanDetailPayload["divisionInputs"];
  capacity: WeeklyPlanDetailPayload["capacity"];
  readOnly: boolean;
  onSave: (rows: PlanDivisionInput[]) => Promise<{ success: boolean; message: string }>;
}

type EditableDivisionRow = {
  divisionId: number;
  divisionName: string;
  autoMemberCount: number;
  memberCount: number;
};

function normalizeRows(
  initialRows: WeeklyPlanDetailPayload["divisionInputs"],
  capacity: WeeklyPlanDetailPayload["capacity"],
): EditableDivisionRow[] {
  if (initialRows.length > 0) {
    return initialRows.map((row) => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      autoMemberCount: row.autoMemberCount,
      memberCount: row.memberCount,
    }));
  }

  return capacity.map((row) => ({
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    autoMemberCount: row.memberCountActive,
    memberCount: row.memberCountActive,
  }));
}

export function PlanDivisionInputTable({
  initialRows,
  capacity,
  readOnly,
  onSave,
}: PlanDivisionInputTableProps) {
  const [rows, setRows] = useState<EditableDivisionRow[]>(normalizeRows(initialRows, capacity));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(normalizeRows(initialRows, capacity));
    setMessage(null);
    setError(null);
  }, [initialRows, capacity]);

  const capacityMap = useMemo(
    () => new Map(capacity.map((row) => [row.divisionId, row])),
    [capacity],
  );

  const totalMembers = useMemo(
    () => rows.reduce((total, row) => total + row.memberCount, 0),
    [rows],
  );

  async function handleSave() {
    if (readOnly) {
      return;
    }

    const payload = rows.map((row) => ({
      divisionId: row.divisionId,
      memberCount: Number.isFinite(row.memberCount) ? Math.max(0, row.memberCount) : 0,
    }));

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light text-white">Tim kerja per divisi</h2>
        </div>
        <p className="rounded-full border border-white/[0.12] px-3 py-1 text-sm text-white/70">
          Total tim: <span className="text-white">{totalMembers}</span> orang
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-2 py-2">Divisi</th>
              <th className="px-2 py-2 text-right">Hitung sistem</th>
              <th className="px-2 py-2 text-right">Dipakai minggu ini</th>
              <th className="px-2 py-2 text-right">Tersedia setelah absensi</th>
              <th className="px-2 py-2 text-right">Jam normal</th>
              <th className="px-2 py-2 text-right">Jam bersih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const capacityRow = capacityMap.get(row.divisionId);
              return (
                <tr key={row.divisionId} className="border-t border-white/[0.06]">
                  <td className="px-2 py-3">
                    <p className="text-white">{row.divisionName}</p>
                  </td>
                  <td className="px-2 py-3 text-right">{row.autoMemberCount}</td>
                  <td className="px-2 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.memberCount}
                      onChange={(event) =>
                        setRows((current) => {
                          const parsedValue = Number.parseInt(event.target.value, 10);
                          const nextValue = Number.isFinite(parsedValue)
                            ? Math.max(0, parsedValue)
                            : 0;

                          return current.map((item) =>
                            item.divisionId === row.divisionId
                              ? {
                                  ...item,
                                  memberCount: nextValue,
                                }
                              : item,
                          );
                        })
                      }
                      disabled={readOnly}
                      className="w-24 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-right text-sm text-white disabled:opacity-60"
                    />
                  </td>
                  <td className="px-2 py-3 text-right text-white/65">
                    {capacityRow?.memberCountActive ?? 0}
                  </td>
                  <td className="px-2 py-3 text-right text-white/65">
                    {(capacityRow?.normalCapacityHours ?? 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-3 text-right font-medium text-amber-300">
                    {(capacityRow?.netCapacityHours ?? 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={readOnly || isSaving}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan tim divisi"}
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
