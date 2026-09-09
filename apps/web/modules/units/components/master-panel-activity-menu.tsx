"use client";

import { Clock3, FileText, MoreVertical, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";

const ICON_STROKE_WIDTH = 2.4;

export function MasterPanelActivityMenu({
  canCreateCountdown,
  canCreateWo,
  onCreateCountdown,
  onCreateWo,
}: {
  canCreateCountdown: boolean;
  canCreateWo: boolean;
  onCreateCountdown: () => void;
  onCreateWo: () => void;
}) {
  const [open, setOpen] = useState(false);

  function selectCountdown() {
    if (!canCreateCountdown) return;
    setOpen(false);
    onCreateCountdown();
  }

  function selectWo() {
    if (!canCreateWo) return;
    setOpen(false);
    onCreateWo();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 border border-primary/35 bg-primary/[0.06] px-3 py-2 text-[12px] font-mono uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10"
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
        Aktivitas
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 border border-border bg-card shadow-xl">
          <button
            type="button"
            onClick={selectCountdown}
            disabled={!canCreateCountdown}
            className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left text-[13px] transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Clock3 className="mt-0.5 h-4 w-4 text-app-accent-ink" strokeWidth={ICON_STROKE_WIDTH} />
            <span>
              <span className="block font-medium text-foreground">Countdown</span>
              <span className="block text-[12px] text-muted-foreground">{canCreateCountdown ? "Buat rencana kerja awal" : "Tidak ada akses buat countdown"}</span>
            </span>
          </button>
          <button type="button" disabled className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left text-[13px] opacity-45">
            <ShoppingCart className="mt-0.5 h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
            <span>
              <span className="block font-medium text-foreground">Purchase Request</span>
              <span className="block text-[12px] text-muted-foreground">Read only pada Phase 1</span>
            </span>
          </button>
          <button
            type="button"
            onClick={selectWo}
            disabled={!canCreateWo}
            className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left text-[13px] transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <FileText className="mt-0.5 h-4 w-4 text-app-accent-ink" strokeWidth={ICON_STROKE_WIDTH} />
            <span>
              <span className="block font-medium text-foreground">Work Order</span>
              <span className="block text-[12px] text-muted-foreground">{canCreateWo ? "Buat request dari Master Panel" : "Tidak ada akses buat WO"}</span>
            </span>
          </button>
          <button type="button" disabled className="flex w-full items-start gap-3 px-3 py-3 text-left text-[13px] opacity-45">
            <Truck className="mt-0.5 h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
            <span>
              <span className="block font-medium text-foreground">Vendor WO</span>
              <span className="block text-[12px] text-muted-foreground">Melalui Countdown atau PR</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
