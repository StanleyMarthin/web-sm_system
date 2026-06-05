"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import { ArrowLeft, Clock3, Layers3, Moon, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-lg text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-white/40">{helper}</p> : null}
    </div>
  );
}

export function CountdownDetailShell({ countdown }: CountdownDetailShellProps) {
  const buildJobPlanHref = (mode: "normal" | "overtime") => {
    const jobPlanParams = new URLSearchParams({
    countdownId: countdown.countdownId,
    carId: countdown.carId,
    autoOpenCreate: "1",
      mode,
    });
    if (countdown.divisionId !== null) {
      jobPlanParams.set("divisionId", String(countdown.divisionId));
      jobPlanParams.append(
        "filter",
        encodeGridFilterToken({
          field: "divisionId",
          operator: "eq",
          value: String(countdown.divisionId),
        }),
      );
    }
    return `/job-plan?${jobPlanParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">
              Countdown Detail
            </p>
            <h1 className="mt-3 text-2xl font-light text-white">{countdown.unitName}</h1>
            <p className="mt-2 text-sm text-white/45">
              {countdown.sectionName ?? "-"} · {countdown.countdownId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildJobPlanHref("normal")}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              Draft Normal
            </Link>
            <Link
              href={buildJobPlanHref("overtime")}
              className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/20"
            >
              <Moon className="h-4 w-4" />
              Draft Lembur
            </Link>
            <Link
              href="/countdown"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] px-4 py-2 text-sm text-white/65 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Kategori" value={humanizeCodeLabel(countdown.taskCategory)} />
        <SummaryCard label="Status" value={humanizeCodeLabel(countdown.status)} />
        <SummaryCard label="Deadline" value={countdown.deadlineDate ?? "-"} />
        <SummaryCard label="Sisa" value={`${countdown.remainingHours.toFixed(2)} jam`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Target Awal" value={countdown.targetHoursInitial.toFixed(2)} />
        <SummaryCard label="Tambahan Jam" value={countdown.timeExtensionHours.toFixed(2)} />
        <SummaryCard label="Target Revisi" value={countdown.targetHoursRevised.toFixed(2)} />
        <SummaryCard label="Progress" value={`${countdown.actualProgressPercent.toFixed(0)}%`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm uppercase tracking-[0.18em] text-white/45">
              Ringkasan
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/70">
            <p>Divisi: {countdown.divisionName ?? "-"}</p>
            <p>Panel: {countdown.panelName ?? "-"}</p>
            <p>Mulai: {countdown.startDate ?? "-"}</p>
            <p>Diperbarui: {countdown.updatedAt ?? "-"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <Layers3 className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm uppercase tracking-[0.18em] text-white/45">
              Cakupan
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/70">
            <p>Unit: {countdown.carId}</p>
            <p>Jenis Kerja: {countdown.jobTypeName ?? "-"}</p>
            <p>Customer: {countdown.customerName ?? "-"}</p>
            <p>Terlambat: {countdown.isOverdue ? "Ya" : "Tidak"}</p>
            <p>Temuan Awal: {countdown.temuanAwal ?? "-"}</p>
            <p>Keterangan: {countdown.keterangan ?? "-"}</p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/45">
            Riwayat Pengerjaan
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-black/30 text-left text-[11px] uppercase tracking-[0.16em] text-white/35">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jam</th>
                <th className="px-4 py-3">Durasi</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {countdown.details.map((detail) => (
                <tr key={detail.detailId} className="border-t border-white/[0.06] text-sm text-white/70">
                  <td className="px-4 py-3">{detail.employeeName}</td>
                  <td className="px-4 py-3">{detail.employeeRole ?? "-"}</td>
                  <td className="px-4 py-3">{detail.workDate}</td>
                  <td className="px-4 py-3">
                    {detail.startTime} - {detail.finishTime}
                  </td>
                  <td className="px-4 py-3">{detail.billedHours.toFixed(2)}</td>
                  <td className="px-4 py-3">{detail.progressPercent.toFixed(0)}%</td>
                  <td className="px-4 py-3">{detail.taskStatus}</td>
                </tr>
              ))}
              {countdown.details.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-white/45" colSpan={7}>
                    Belum ada history detail.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
