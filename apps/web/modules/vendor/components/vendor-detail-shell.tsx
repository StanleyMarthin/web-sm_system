"use client";

import type { VendorRecord } from "@smsystem/contracts/vendor";
import { ArrowLeft, CheckCheck, RotateCcw, SendToBack, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  approveVendor,
  cancelVendor,
  receiveVendor,
  updateVendorStatus,
} from "@/shared/api/vendor";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface VendorDetailShellProps {
  ticket: VendorRecord;
  canApprove: boolean;
  canUpdateStatus: boolean;
  canReceive: boolean;
}

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">{label}</p>
      <p className="mt-3 text-lg text-foreground">{value}</p>
      {helper ? <p className="mt-2 text-sm text-foreground/40">{helper}</p> : null}
    </div>
  );
}

function getAllowedStatusOptions(status: VendorRecord["status"]) {
  switch (status) {
    case "OPEN":
      return ["SENT", "CANCELLED"];
    case "SENT":
      return ["PROSES_VENDOR", "DONE_VENDOR", "REWORK_VENDOR", "CANCELLED"];
    case "PROSES_VENDOR":
      return ["DONE_VENDOR", "REWORK_VENDOR", "CANCELLED"];
    case "DONE_VENDOR":
      return ["REWORK_VENDOR"];
    case "REWORK_VENDOR":
      return ["SENT", "PROSES_VENDOR", "DONE_VENDOR", "CANCELLED"];
    default:
      return [];
  }
}

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export function VendorDetailShell({
  ticket,
  canApprove,
  canUpdateStatus,
  canReceive,
}: VendorDetailShellProps) {
  const router = useRouter();
  const [approvalNotes, setApprovalNotes] = useState("");
  const [statusValue, setStatusValue] = useState(
    getAllowedStatusOptions(ticket.status)[0] ?? ticket.status,
  );
  const [statusNotes, setStatusNotes] = useState("");
  const [receiveDate, setReceiveDate] = useState(getTodayIsoDate());
  const [goodsConditionIn, setGoodsConditionIn] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPendingAction, setIsPendingAction] = useState(false);

  async function runMutation(
    action: () => Promise<{ success: true } | { success: false; message: string }>,
    successMessage: string,
  ) {
    setError(null);
    setMessage(null);
    setIsPendingAction(true);

    try {
      const result = await action();
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(successMessage);
      router.refresh();
    } finally {
      setIsPendingAction(false);
    }
  }

  const allowedStatuses = getAllowedStatusOptions(ticket.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/vendor"
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/55 ring-1 ring-white/[0.06] hover:text-foreground/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke WOV
        </Link>
        <div className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-app-accent-ink ring-1 ring-primary/25">
          {ticket.wovNumber}
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <InfoCard
          label="Approval"
          value={humanizeCodeLabel(ticket.accTracking)}
          helper={humanizeCodeLabel(ticket.status)}
        />
        <InfoCard label="Unit" value={ticket.unitName} helper={ticket.customerName} />
        <InfoCard label="Vendor" value={ticket.vendorName} helper={ticket.itemName} />
        <InfoCard
          label="Aging"
          value={`${ticket.agingDays} hari`}
          helper={`Risk score ${ticket.riskScore}`}
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Detail WOV
            </p>
            <h3 className="mt-1 text-lg font-medium text-foreground">
              {ticket.vendorName} · {ticket.itemName}
            </h3>
            <p className="mt-3 text-sm leading-6 text-foreground/45">
              Ticket vendor ini men-track approval header, progress pengerjaan eksternal, QC saat
              barang kembali, dan impact ke unit yang dikerjakan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canApprove && ticket.accTracking !== "APPROVED" ? (
              <button
                type="button"
                disabled={isPendingAction}
                onClick={() => {
                  void runMutation(
                    () => approveVendor(ticket.wovId, { notes: approvalNotes.trim() || null }),
                    "WOV berhasil disetujui.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-success px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-success/80 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Setujui
              </button>
            ) : null}

            {canUpdateStatus && ticket.accTracking === "APPROVED" && allowedStatuses.length > 0 ? (
              <button
                type="button"
                disabled={isPendingAction || !statusValue}
                onClick={() => {
                  void runMutation(
                    () =>
                      updateVendorStatus(ticket.wovId, {
                        status: statusValue as VendorRecord["status"],
                        remarks: statusNotes.trim() || null,
                        targetDateReturn: ticket.targetDateReturn,
                        actualCost: actualCost ? Number(actualCost) : ticket.actualCost,
                      }),
                    "Status Vendor WO berhasil diperbarui.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-white/90 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Perbarui Status
              </button>
            ) : null}

            {canReceive && ticket.accTracking === "APPROVED" && ["SENT", "PROSES_VENDOR", "DONE_VENDOR"].includes(ticket.status) ? (
              <button
                type="button"
                disabled={isPendingAction || !receiveDate}
                onClick={() => {
                  void runMutation(
                    () =>
                      receiveVendor(ticket.wovId, {
                        dateIn: receiveDate,
                        goodsConditionIn: goodsConditionIn.trim() || null,
                        qcStatus: "GOOD",
                        actualCost: actualCost ? Number(actualCost) : ticket.actualCost,
                        remarks: receiveNotes.trim() || null,
                      }),
                    "WOV berhasil ditandai sudah diterima.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary disabled:opacity-50"
              >
                <SendToBack className="h-3.5 w-3.5" />
                Terima Barang
              </button>
            ) : null}
          </div>
        </div>

        {message ? (
          <p className="mt-5 rounded-2xl border border-success/15 bg-success/[0.08] px-3 py-2 text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-2xl border border-destructive/15 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Catatan Persetujuan
            </p>
            <textarea
              value={approvalNotes}
              onChange={(event) => setApprovalNotes(event.target.value)}
              placeholder="Catatan persetujuan..."
              className="mt-3 min-h-28 w-full rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/15 focus:border-primary/30"
            />
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Progres Vendor
            </p>
            <div className="mt-3 grid gap-3">
              <select
                value={statusValue}
                onChange={(event) => setStatusValue(event.target.value)}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
              >
                {allowedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={receiveDate}
                onChange={(event) => setReceiveDate(event.target.value)}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
              />
              <input
                value={actualCost}
                onChange={(event) => setActualCost(event.target.value)}
                placeholder="Biaya aktual"
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
              />
              <textarea
                value={statusNotes}
                onChange={(event) => setStatusNotes(event.target.value)}
                placeholder="Catatan perubahan status"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/15 focus:border-primary/30"
              />
              <textarea
                value={goodsConditionIn}
                onChange={(event) => setGoodsConditionIn(event.target.value)}
                placeholder="Kondisi barang masuk"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/15 focus:border-primary/30"
              />
              <textarea
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                placeholder="Catatan penerimaan"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/15 focus:border-primary/30"
              />
            </div>
          </div>

          {canUpdateStatus && ticket.status !== "RECEIVED" && ticket.status !== "CANCELLED" ? (
            <div className="rounded-3xl border border-destructive/12 bg-destructive/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-destructive/75">
                Batalkan WOV
              </p>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Alasan pembatalan..."
                className="mt-3 min-h-28 w-full rounded-3xl border border-white/[0.06] bg-black/30 px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/15 focus:border-destructive/30"
              />
              <button
                type="button"
                disabled={isPendingAction || !cancelReason.trim()}
                onClick={() => {
                  void runMutation(
                    () => cancelVendor(ticket.wovId, { reason: cancelReason.trim() }),
                    "Vendor WO berhasil dibatalkan.",
                  );
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-destructive/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-destructive disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Batalkan
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
