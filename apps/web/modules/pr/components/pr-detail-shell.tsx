"use client";

import type {
  PrItemRecord,
  PrRecord,
} from "@smsystem/contracts/pr";
import { ArrowLeft, CheckCheck, PackageOpen, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  approvePr,
  cancelPr,
  orderPr,
  receivePr,
} from "@/shared/api/pr";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface PrDetailShellProps {
  header: PrRecord;
  items: PrItemRecord[];
  canApprove: boolean;
  canOrder: boolean;
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
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-lg text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-white/40">{helper}</p> : null}
    </div>
  );
}

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export function PrDetailShell({
  header,
  items,
  canApprove,
  canOrder,
  canReceive,
}: PrDetailShellProps) {
  const router = useRouter();
  const [approvalNotes, setApprovalNotes] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [actualPrice, setActualPrice] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [arrivalDate, setArrivalDate] = useState(getTodayIsoDate());
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/pr"
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55 ring-1 ring-white/[0.06] hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke PR
        </Link>
        <div className="rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-amber-300 ring-1 ring-amber-500/25">
          {header.prNumber}
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <InfoCard
          label="Approval"
          value={humanizeCodeLabel(header.accTracking)}
          helper={humanizeCodeLabel(header.status)}
        />
        <InfoCard label="Unit" value={header.unitName} helper={header.customerName} />
        <InfoCard label="Divisi" value={header.divisionName} helper={header.requestedByName} />
        <InfoCard
          label="Aging"
          value={`${header.agingDays} hari`}
          helper={`Risk score ${header.riskScore}`}
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Detail PR
            </p>
            <h3 className="mt-1 text-lg font-medium text-white">
              {header.unitName} · {header.divisionName}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/45">
              Vendor summary saat ini: {header.vendorSummary}. Total item {header.totalItems} dengan
              total estimasi Rp {header.totalEstimatedPrice.toLocaleString("id-ID")}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canApprove && header.accTracking !== "APPROVED" ? (
              <button
                type="button"
                disabled={isPendingAction}
                onClick={() => {
                  void runMutation(
                    () => approvePr(header.prId, { notes: approvalNotes.trim() || null }),
                    "PR berhasil disetujui.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-emerald-300 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Setujui
              </button>
            ) : null}

            {canOrder && header.accTracking === "APPROVED" && ["OPEN", "HUNTING", "ORDERED"].includes(header.status) ? (
              <button
                type="button"
                disabled={isPendingAction || !vendorName.trim()}
                onClick={() => {
                  void runMutation(
                    () =>
                      orderPr(header.prId, {
                        notes: orderNotes.trim() || null,
                        items: items.map((item) => ({
                          itemId: item.itemId,
                          vendorId: item.vendorId,
                          vendorName: vendorName.trim(),
                          actualPrice: actualPrice ? Number(actualPrice) : null,
                          notes: orderNotes.trim() || null,
                        })),
                      }),
                    "PR berhasil ditandai ordered.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-white/90 disabled:opacity-50"
              >
                <PackageOpen className="h-3.5 w-3.5" />
                Pesan
              </button>
            ) : null}

            {canReceive && header.accTracking === "APPROVED" && ["HUNTING", "ORDERED"].includes(header.status) ? (
              <button
                type="button"
                disabled={isPendingAction || !arrivalDate}
                onClick={() => {
                  void runMutation(
                    () =>
                      receivePr(header.prId, {
                        notes: receiveNotes.trim() || null,
                        items: items.map((item) => ({
                          itemId: item.itemId,
                          arrivalDate,
                          actualPrice: actualPrice ? Number(actualPrice) : item.actualPrice,
                          notes: receiveNotes.trim() || null,
                        })),
                      }),
                    "PR berhasil ditandai datang.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                <PackageOpen className="h-3.5 w-3.5" />
                Terima
              </button>
            ) : null}
          </div>
        </div>

        {message ? (
          <p className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-2xl border border-red-500/15 bg-red-500/[0.08] px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Catatan Persetujuan
            </p>
            <textarea
              value={approvalNotes}
              onChange={(event) => setApprovalNotes(event.target.value)}
              placeholder="Catatan persetujuan..."
              className="mt-3 min-h-24 w-full rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/15 focus:border-amber-500/30"
            />
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Pesan / Terima
            </p>
            <div className="mt-3 grid gap-3">
              <input
                value={vendorName}
                onChange={(event) => setVendorName(event.target.value)}
                placeholder="Nama vendor"
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
              />
              <input
                value={actualPrice}
                onChange={(event) => setActualPrice(event.target.value)}
                placeholder="Harga aktual"
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
              />
              <input
                type="date"
                value={arrivalDate}
                onChange={(event) => setArrivalDate(event.target.value)}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30"
              />
              <textarea
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                placeholder="Catatan pemesanan"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/15 focus:border-amber-500/30"
              />
              <textarea
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                placeholder="Catatan penerimaan"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/15 focus:border-amber-500/30"
              />
            </div>
          </div>

          {canOrder && header.status !== "ARRIVED" && header.status !== "CANCELLED" ? (
            <div className="rounded-3xl border border-red-500/12 bg-red-500/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-300/75">
                Batalkan PR
              </p>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Alasan pembatalan..."
                className="mt-3 min-h-28 w-full rounded-3xl border border-white/[0.06] bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/15 focus:border-red-400/30"
              />
              <button
                type="button"
                disabled={isPendingAction || !cancelReason.trim()}
                onClick={() => {
                  void runMutation(
                    () => cancelPr(header.prId, { reason: cancelReason.trim() }),
                    "PR berhasil dibatalkan.",
                  );
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-red-400 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Batalkan
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm text-white">Status terkunci</p>
                  <p className="text-sm text-white/40">
                    Pembatalan tidak tersedia untuk PR yang sudah datang atau ditutup.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#050505] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
            Rincian Item
          </p>
          <p className="text-sm text-white/40">
            Semua aksi pesan dan terima di halaman ini diterapkan ke item yang dipilih.
          </p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <div
              key={item.itemId}
              className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-3 px-5 py-4 text-sm text-white/75"
            >
              <div>
                <div className="flex items-start gap-3">
                  {item.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => window.open(item.photoUrl!, "_blank", "noopener,noreferrer")}
                      className="group flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.photoUrl}
                        alt={item.itemName}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.05]"
                      />
                    </button>
                  ) : null}
                  <div>
                    <p className="font-medium text-white">{item.itemName}</p>
                    <p className="mt-1 text-xs text-white/35">{item.description ?? "-"}</p>
                  </div>
                </div>
              </div>
              <span>{item.originType}</span>
              <span>{item.qty} {item.uom}</span>
              <span>{item.vendorName ?? "-"}</span>
              <span>{item.status ?? "-"}</span>
              <span className="text-white/35">{item.arrivalDate ?? "-"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
