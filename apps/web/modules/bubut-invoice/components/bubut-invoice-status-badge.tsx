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
  BELUM_RILIS: "border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40",
  RILIS_DIREKSI: "border border-blue-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-blue-400",
  RILIS_CUSTOMER: "border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-400",
  RILIS_KEDUANYA: "border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-500",
  DIBATALKAN: "border border-red-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-red-400",
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
