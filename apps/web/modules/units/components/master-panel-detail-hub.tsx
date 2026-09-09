"use client";

import type { UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { MasterPanelActivityGrid } from "./master-panel-activity-grid";
import { MasterPanelPhotoGallery } from "./master-panel-photo-gallery";

const ICON_STROKE_WIDTH = 2.4;

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function MasterPanelDetailHub({ detail }: { detail: UnitPanelDetail }) {
  const router = useRouter();
  const panel = detail.panel;
  const backHref = `/units/${encodeURIComponent(detail.unitId)}?tab=master-panel`;
  const hasExtraInfo = Boolean(panel.location || panel.notes);

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
        Kembali ke Struktur Panel Unit
      </button>

      <header className="border border-border bg-card px-4 py-4">
        <p className="text-[12px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {displayValue(panel.category)} / {displayValue(panel.section)}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold text-foreground">{panel.name}</h1>
            {panel.aliasName ? <p className="mt-1 text-[14px] text-muted-foreground">Alias: {panel.aliasName}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="border border-border px-2 py-1 text-muted-foreground">Kondisi: <strong className="font-mono text-foreground">{displayValue(panel.initialCondition ?? panel.defaultConditionType)}</strong></span>
            <span className="border border-border px-2 py-1 text-muted-foreground">Status: <strong className="font-mono text-foreground">{displayValue(panel.currentStatus ?? panel.defaultStockStatus)}</strong></span>
            <span className="border border-border px-2 py-1 text-muted-foreground">Qty: <strong className="font-mono text-foreground">{formatNumber(panel.qty)}</strong></span>
          </div>
        </div>
      </header>

      <MasterPanelPhotoGallery detail={detail} />

      <section className="border border-border bg-card">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-5 sm:divide-y-0">
          {[
            ["Countdown", detail.summary.countdown],
            ["Job Plan", detail.summary.jobdesc],
            ["PR", detail.summary.pr],
            ["WO", detail.summary.wo],
            ["WOV", detail.summary.wov],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <p className="text-[12px] font-mono uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-[22px] font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 border-t border-border text-[13px] text-muted-foreground">
          <div className="px-4 py-2">Total Jam: <strong className="font-mono text-foreground">{formatNumber(detail.summary.totalHours)}</strong></div>
          <div className="px-4 py-2">Sisa Jam: <strong className="font-mono text-foreground">{formatNumber(detail.summary.remainingHours)}</strong></div>
          <div className="px-4 py-2">Progress: <strong className="font-mono text-foreground">{formatNumber(detail.summary.progressPercent)}%</strong></div>
        </div>
      </section>

      <MasterPanelActivityGrid detail={detail} />

      {hasExtraInfo ? (
        <section className="border border-border bg-card px-4 py-3">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Informasi Tambahan</h2>
          {panel.location ? <p className="mt-2 text-[14px] text-muted-foreground">Lokasi: <span className="text-foreground">{panel.location}</span></p> : null}
          {panel.notes ? <p className="mt-2 whitespace-pre-wrap text-[14px] text-muted-foreground">{panel.notes}</p> : null}
        </section>
      ) : null}
    </section>
  );
}
