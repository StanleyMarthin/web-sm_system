"use client";

import type {
  WoLinkedCountdown,
  WoRecord,
} from "@smsystem/contracts/wo";
import { ArrowLeft, CheckCheck, Link2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveWo, markWoDone, rejectWo } from "@/shared/api/wo";
import { humanizeCodeLabel, fmtDateTime } from "@/shared/format/humanize";

interface WoDetailShellProps {
  ticket: WoRecord;
  linkedCountdowns: WoLinkedCountdown[];
  canApprove: boolean;
  canReject: boolean;
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

export function WoDetailShell({
  ticket,
  linkedCountdowns,
  canApprove,
  canReject,
}: WoDetailShellProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPendingAction, setIsPendingAction] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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
          href="/wo"
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55 ring-1 ring-white/[0.06] hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke WO
        </Link>
        <div className="rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-amber-300 ring-1 ring-amber-500/25">
          {ticket.woNumber}
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <InfoCard
          label="Status"
          value={humanizeCodeLabel(ticket.status)}
          helper={`Permintaan ${ticket.requestDate}`}
        />
        <InfoCard
          label="Aging"
          value={`${ticket.agingHours} jam`}
          helper={`Risk score ${ticket.agingScore}`}
        />
        <InfoCard
          label="Tujuan"
          value={ticket.toDivisionName}
          helper={`Dari ${ticket.fromDivisionName}`}
        />
        <InfoCard
          label="Countdown Linked"
          value={String(linkedCountdowns.length)}
          helper={ticket.linkedCountdownId ?? "Belum ada countdown"}
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Detail WO
            </p>
            <h3 className="mt-1 text-lg font-medium text-white">
              {ticket.unitName} · {ticket.customerName}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/45">
              {ticket.jobDetail}
            </p>
            <div className="mt-5 grid gap-3 text-sm text-white/65 xl:grid-cols-2">
              <div>
                <p className="text-white/35">Panel</p>
                <p className="mt-1">{ticket.panelName ?? "-"}</p>
              </div>
              <div>
                <p className="text-white/35">Estimasi</p>
                <p className="mt-1">{ticket.estimatedHours ?? 0} jam</p>
              </div>
              <div>
                <p className="text-white/35">Prioritas</p>
                <p className="mt-1">{ticket.isPriority ? "Tinggi" : "Normal"}</p>
              </div>
              <div>
                <p className="text-white/35">Notes</p>
                <p className="mt-1">{ticket.notes ?? "-"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canApprove && ["OPEN", "SUBMITTED"].includes(ticket.status) ? (
              <button
                type="button"
                disabled={isPendingAction}
                onClick={() => {
                  void runMutation(
                    () => approveWo(ticket.woId),
                    "WO berhasil diapprove.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-emerald-300 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Setujui
              </button>
            ) : null}

            {canApprove && ticket.status === "APPROVED" ? (
              <button
                type="button"
                disabled={isPendingAction}
                onClick={() => {
                  void runMutation(
                    () => markWoDone(ticket.woId),
                    "WO berhasil ditandai selesai.",
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-white/90 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai Selesai
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

        {canReject && ["OPEN", "SUBMITTED"].includes(ticket.status) ? (
          <div className="mt-5 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Tolak WO
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Alasan penolakan..."
              className="mt-3 min-h-24 w-full rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/15 focus:border-amber-500/30"
            />
            <button
              type="button"
              disabled={isPendingAction || !rejectReason.trim()}
              onClick={() => {
                void runMutation(
                  () => rejectWo(ticket.woId, { reason: rejectReason.trim() }),
                  "WO berhasil direject.",
                );
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-red-400 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Tolak
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#050505] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <Link2 className="h-4 w-4 text-amber-400" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Countdown Terkait
            </p>
            <p className="text-sm text-white/40">
              Countdown dicari dari relasi `sm_jobdesc_countdown.ref_taks_id = woId`.
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {linkedCountdowns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-white/35">
              Belum ada countdown yang terhubung.
            </div>
          ) : (
            linkedCountdowns.map((row) => (
              <div
                key={row.coreId}
                className="grid grid-cols-[1fr_0.9fr_0.8fr_0.8fr] gap-3 px-5 py-4 text-sm text-white/75"
              >
                <Link
                  href={`/countdown/${row.coreId}`}
                  className="font-mono text-amber-400 transition-colors hover:text-amber-300"
                >
                  {row.coreId}
                </Link>
                <span>{row.divisionName}</span>
                <span>{row.status}</span>
                <span className="text-white/35">{fmtDateTime(row.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
