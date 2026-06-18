"use client";

import type { BomPlanningSnapshot } from "@/modules/planning/types/planning.types";

interface BomPlanningPanelProps {
  snapshots: BomPlanningSnapshot[];
}

function statusLabel(status: string): string {
  if (status === "ORDER_PR") return "Tunggu Material";
  if (status === "AT_VENDOR") return "Tunggu Vendor";
  if (status === "QC_REJECT") return "QC Reject";
  if (status === "READY_GUDANG") return "Siap Gudang";
  if (status === "INSTALLED") return "Terpasang";
  if (status === "IN_DIVISION") return "Di Divisi";
  if (status === "CANNIBALIZED") return "Donor";
  return "Tunggu Divisi";
}

export function BomPlanningPanel({ snapshots }: BomPlanningPanelProps) {
  const readyHours = snapshots.reduce((sum, row) => sum + row.readyHours, 0);
  const blockedHours = snapshots.reduce((sum, row) => sum + row.blockedHours, 0);
  const blockers = snapshots.filter((row) => row.blockerType);

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">BOM / Panel</p>
        <h3 className="mt-1 font-mono text-[14px] text-foreground">Jam siap dan tertahan dari status part</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        <div className="border border-border bg-background px-3 py-2">
          <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Ready</p>
          <p className="mt-1 font-mono text-[18px] text-success">{readyHours.toFixed(1)} jam</p>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Blocked</p>
          <p className="mt-1 font-mono text-[18px] text-app-accent-ink">{blockedHours.toFixed(1)} jam</p>
        </div>
      </div>
      <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
        {blockers.length > 0 ? blockers.map((snapshot) => (
          <div key={`${snapshot.panelId}:${snapshot.partId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <p className="font-mono text-[15px] text-foreground">{snapshot.partId}</p>
            <span className="border border-primary/25 bg-primary/[0.06] px-2 py-1 font-mono text-[15px] uppercase tracking-[0.12em] text-app-accent-ink">
              {statusLabel(snapshot.status)} · {snapshot.blockedHours.toFixed(1)}j
            </span>
          </div>
        )) : (
          <div className="px-4 py-6 text-[14px] text-muted-foreground">Tidak ada part blocker dari BOM unit terpilih.</div>
        )}
      </div>
    </section>
  );
}
