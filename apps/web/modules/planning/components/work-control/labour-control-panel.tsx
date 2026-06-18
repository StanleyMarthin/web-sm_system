"use client";

import { useState, useTransition } from "react";
import type { LabourSummary } from "@/modules/planning/types/planning.types";

interface LabourControlPanelProps {
  summaries: LabourSummary[];
  divisionRows: Array<{
    divisionId: string;
    divisionName: string;
    targetHours: number;
    actualHours: number;
    billableHours: number;
    lostHours: number;
  }>;
  unitNames: Record<string, string>;
  onSaveOverride?: (input: {
    unitId: string;
    billableHours: number;
    nonBillableHours: number;
    warrantyHours: number;
  }) => Promise<void>;
}

function hours(value: number): string {
  return `${value.toFixed(1)}j`;
}

export function LabourControlPanel({
  summaries,
  divisionRows,
  unitNames,
  onSaveOverride,
}: LabourControlPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, { billableHours: string; warrantyHours: string }>>({});
  const [savedUnitId, setSavedUnitId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalActual = summaries.reduce((sum, row) => sum + row.actualHours, 0);
  const totalBillable = summaries.reduce((sum, row) => sum + row.billableHours, 0);
  const totalLost = summaries.reduce((sum, row) => sum + row.lostHours, 0);

  function saveOverride(summary: LabourSummary) {
    if (!onSaveOverride) return;
    const draft = drafts[summary.unitId];
    const billableHours = Math.max(0, Number(draft?.billableHours ?? summary.billableHours));
    const warrantyHours = Math.max(0, Number(draft?.warrantyHours ?? summary.warrantyHours));
    const nonBillableHours = Math.max(0, summary.actualHours - billableHours);
    startTransition(async () => {
      await onSaveOverride({
        unitId: summary.unitId,
        billableHours,
        nonBillableHours,
        warrantyHours,
      });
      setSavedUnitId(summary.unitId);
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Labour Control</p>
          <h3 className="mt-1 font-mono text-[14px] text-foreground">Target vs aktual per unit</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          {[
            { label: "Aktual", value: hours(totalActual), tone: "text-foreground" },
            { label: "Tertagih", value: hours(totalBillable), tone: "text-success" },
            { label: "Lost", value: hours(totalLost), tone: totalLost > 0 ? "text-app-accent-ink" : "text-muted-foreground" },
          ].map((item) => (
            <div key={item.label} className="border border-border bg-background px-3 py-2">
              <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
              <p className={`mt-1 font-mono text-[16px] ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
          {summaries.length > 0 ? summaries.map((summary) => (
            <div key={summary.unitId} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_repeat(4,minmax(70px,auto))]">
              <p className="font-mono text-[14px] text-foreground">{unitNames[summary.unitId] ?? summary.unitId}</p>
              <p className="font-mono text-[15px] text-muted-foreground">Target {hours(summary.targetHours)}</p>
              <p className="font-mono text-[15px] text-muted-foreground">Aktual {hours(summary.actualHours)}</p>
              <label className="grid gap-1 font-mono text-[14px] uppercase tracking-[0.08em] text-muted-foreground">
                Billable
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={drafts[summary.unitId]?.billableHours ?? summary.billableHours}
                  onChange={(event) => {
                    setDrafts((current) => ({
                      ...current,
                      [summary.unitId]: {
                        billableHours: event.target.value,
                        warrantyHours: current[summary.unitId]?.warrantyHours ?? String(summary.warrantyHours),
                      },
                    }));
                  }}
                  className="h-8 w-full border border-border bg-background px-2 font-mono text-[15px] text-success outline-none focus:border-primary/40"
                />
              </label>
              <div className="flex items-end gap-2">
                <p className="pb-2 font-mono text-[15px] text-app-accent-ink">Lost {hours(summary.lostHours)}</p>
                <button
                  type="button"
                  disabled={!onSaveOverride || isPending}
                  onClick={() => saveOverride(summary)}
                  className="h-8 border border-primary/25 bg-primary/[0.06] px-2 font-mono text-[15px] uppercase tracking-[0.1em] text-app-accent-ink disabled:opacity-40"
                >
                  {savedUnitId === summary.unitId ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          )) : (
            <div className="px-4 py-8 text-[14px] text-muted-foreground">Belum ada labour untuk unit terpilih.</div>
          )}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Per Divisi</p>
          <h3 className="mt-1 font-mono text-[14px] text-foreground">Ringkasan periode aktif</h3>
        </div>
        <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
          {divisionRows.length > 0 ? divisionRows.map((row) => (
            <div key={row.divisionId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[14px] text-foreground">{row.divisionName}</p>
                <p className="font-mono text-[15px] text-muted-foreground">{hours(row.actualHours)} aktual</p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <span className="border border-border bg-background px-2 py-1 font-mono text-[14px] text-muted-foreground">Target {hours(row.targetHours)}</span>
                <span className="border border-border bg-background px-2 py-1 font-mono text-[14px] text-success">Billable {hours(row.billableHours)}</span>
                <span className="border border-border bg-background px-2 py-1 font-mono text-[14px] text-app-accent-ink">Lost {hours(row.lostHours)}</span>
              </div>
            </div>
          )) : (
            <div className="px-4 py-8 text-[14px] text-muted-foreground">Data divisi muncul setelah progress unit dibaca.</div>
          )}
        </div>
      </div>
    </section>
  );
}
