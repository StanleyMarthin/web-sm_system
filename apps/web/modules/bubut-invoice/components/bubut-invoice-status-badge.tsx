"use client";

import type { BubutInvoiceCombinedStatus } from "@smsystem/contracts/bubut-invoice";

const STATUS_LABEL: Record<BubutInvoiceCombinedStatus, string> = {
  BELUM_RILIS: "Belum Rilis",
  RILIS_DIREKSI: "Rilis Direksi",
  RILIS_CUSTOMER: "Rilis Customer",
  RILIS_KEDUANYA: "Rilis Keduanya",
  DIBATALKAN: "Dibatalkan",
};

const STATUS_CLASS: Record<BubutInvoiceCombinedStatus, string> = {
  BELUM_RILIS: "border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40",
  RILIS_DIREKSI: "border border-info/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-info",
  RILIS_CUSTOMER: "border border-success/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-success",
  RILIS_KEDUANYA: "border border-primary/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-app-accent-ink",
  DIBATALKAN: "border border-destructive/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-destructive",
};

export function BubutInvoiceStatusBadge({
  status,
}: {
  status: BubutInvoiceCombinedStatus;
}) {
  return (
    <span className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}
