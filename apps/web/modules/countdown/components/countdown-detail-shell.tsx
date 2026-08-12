"use client";

// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench utilitarian · design.md

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import { ArrowLeft, Camera, Check, ChevronDown, Moon, Plus, RotateCcw, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { humanizeCodeLabel, fmtTime, fmtDateTime } from "@/shared/format/humanize";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { formatCountdownStatus } from "../countdown-copy";
import { resolveCountdownPhotoUrl, resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border px-3 py-2.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-white/[0.06]">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>{value}</p>
    </div>
  );
}

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Pengerjaan",
  AFTER: "Setelah",
  DEFECT: "Temuan",
} as const;

export function CountdownDetailShell({
  countdown,
  canRequestRevision = false,
  canApproveRevision = false,
  canApproveMoRevision = false,
}: CountdownDetailShellProps) {
  const router = useRouter();
  const revisionDialogRef = useRef<HTMLDialogElement>(null);
  const sweetAlert = useSweetAlert();
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [requestedHours, setRequestedHours] = useState("");
  const [requestedDeadline, setRequestedDeadline] = useState(countdown.deadlineDate ?? "");
  const [revisionReason, setRevisionReason] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [isDecidingRevision, setIsDecidingRevision] = useState(false);
  const revisionActions = resolveCountdownRevisionActions({
    status: countdown.status,
    extensionRequestStatus: countdown.extensionRequestStatus ?? null,
    canRequestRevision,
    canApproveRevision,
    canApproveMoRevision,
  });
  const approvalRole = revisionActions.canApprove ? "KP" : revisionActions.canApproveMo ? "MO" : null;

  useEffect(() => {
    const dialog = revisionDialogRef.current;
    if (revisionOpen && dialog && !dialog.open) dialog.showModal();
    if (!revisionOpen && dialog?.open) dialog.close();
  }, [revisionOpen]);

  async function handleRevisionRequest() {
    const hours = Number(requestedHours);
    if (!Number.isFinite(hours) || hours <= 0 || !requestedDeadline || !revisionReason.trim()) {
      sweetAlert.notifyError("Pengajuan belum lengkap", "Jam tambahan, deadline, dan alasan wajib diisi.");
      return;
    }
    setIsSubmittingRevision(true);
    try {
      const result = await requestCountdownRevision(countdown.countdownId, {
        requestedHours: hours,
        requestedDeadline,
        reason: revisionReason.trim(),
      });
      if (!result.success) return sweetAlert.notifyError("Pengajuan gagal", result.message);
      setRevisionOpen(false);
      sweetAlert.notifySuccess("Berhasil", "Revisi countdown berhasil diajukan.");
      router.refresh();
    } catch {
      sweetAlert.notifyError("Pengajuan gagal", "Layanan countdown tidak dapat dihubungi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  }

  async function handleRevisionDecision(isApproved: boolean) {
    const hours = countdown.requestedExtensionHours ?? 0;
    const deadline = countdown.requestedDeadline ?? countdown.deadlineDate ?? "";
    const confirmed = await sweetAlert.confirm({
      title: isApproved ? `Setujui revisi sebagai ${approvalRole}?` : `Tolak revisi sebagai ${approvalRole}?`,
      description: isApproved ? `${hours} jam dengan deadline ${deadline}.` : "Pengajuan akan dikembalikan sebagai ditolak.",
      tone: isApproved ? "info" : "warning",
      confirmLabel: isApproved ? "Setujui" : "Tolak",
    });
    if (!confirmed) return;
    setIsDecidingRevision(true);
    try {
      const result = await approveCountdownRevision(countdown.countdownId, {
        isApproved,
        approvedHours: hours,
        approvedDeadline: deadline,
      });
      if (!result.success) return sweetAlert.notifyError("Persetujuan gagal", result.message);
      sweetAlert.notifySuccess("Berhasil", isApproved ? "Revisi disetujui." : "Revisi ditolak.");
      router.refresh();
    } catch {
      sweetAlert.notifyError("Persetujuan gagal", "Layanan countdown tidak dapat dihubungi.");
    } finally {
      setIsDecidingRevision(false);
    }
  }
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
    <div className="flex flex-col gap-3">
      <header className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/countdown" aria-label="Kembali ke daftar countdown" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-lg font-semibold text-foreground">{countdown.unitName}</h1>
              <span className="shrink-0"><DataGridStatusBadge value={countdown.status} /></span>
            </div>
            <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">
              {countdown.divisionName ?? "Tanpa divisi"} · {countdown.sectionName ?? "Bagian belum ditentukan"} · {countdown.panelName ?? "Tanpa panel"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {revisionActions.canRequest ? (
              <ActionButton variant="primary" onClick={() => setRevisionOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" />Ajukan Revisi
              </ActionButton>
            ) : null}
            {approvalRole ? (
              <>
                <ActionButton variant="success" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(true)}>
                  <Check className="h-3.5 w-3.5" />Setujui ({approvalRole})
                </ActionButton>
                <ActionButton variant="danger" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(false)}>
                  <X className="h-3.5 w-3.5" />Tolak ({approvalRole})
                </ActionButton>
              </>
            ) : null}
            <details className="group relative">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 border border-success/30 bg-success/10 px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-success transition-colors hover:bg-success/20">
                <Plus className="h-3.5 w-3.5" />
                Buat Jobdesc
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-20 mt-1 min-w-44 border border-border bg-card p-1 shadow-xl">
                <Link
                  href={buildJobPlanHref("normal")}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4 text-success" />
                  Normal
                </Link>
                <Link
                  href={buildJobPlanHref("overtime")}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Moon className="h-4 w-4 text-info" />
                  Lembur
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      {sweetAlert.alertElement}

      <section aria-label="Ringkasan countdown" className="grid border border-border bg-card sm:grid-cols-3 xl:grid-cols-6 dark:border-white/[0.06]">
        <SummaryItem label="Kategori" value={humanizeCodeLabel(countdown.taskCategory)} />
        <SummaryItem label="Mulai" value={countdown.startDate ?? "-"} />
        <SummaryItem label="Deadline" value={countdown.deadlineDate ?? "-"} />
        <SummaryItem label="Target" value={`${countdown.targetHoursRevised.toFixed(2)} jam`} />
        <SummaryItem label="Terpakai" value={`${countdown.totalActualHours.toFixed(2)} jam`} />
        <SummaryItem label="Sisa" value={`${countdown.remainingHours.toFixed(2)} jam`} />
      </section>

      <section className="border border-border bg-card p-3 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Progress pekerjaan</span>
              <span className="font-mono text-muted-foreground">{countdown.actualProgressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden bg-muted" role="progressbar" aria-label="Progress pekerjaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(countdown.actualProgressPercent)}>
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, countdown.actualProgressPercent))}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{countdown.isOverdue ? "Terlambat" : "Sesuai jadwal"}</span>
        </div>
      </section>

      {countdown.extensionRequestStatus || countdown.countRevision > 0 ? (
        <section className="border border-border bg-card px-3 py-2.5 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground"><span className="font-semibold">Revisi:</span> {formatCountdownRevisionStatus(countdown.extensionRequestStatus)}</p>
            <span className="text-xs text-muted-foreground">{countdown.countRevision ?? 0} kali</span>
          </div>
          {countdown.extensionRequestStatus ? (
            <div className="mt-2 grid gap-1 border-t border-border pt-2 text-xs text-muted-foreground md:grid-cols-[auto_auto_1fr] md:gap-4 dark:border-white/[0.06]">
              <p>Tambahan jam: {countdown.requestedExtensionHours ?? 0} jam</p>
              <p>Deadline diminta: {countdown.requestedDeadline ?? "-"}</p>
              <p>Alasan: {countdown.revisionReason ?? "-"}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="order-last border border-border bg-card dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-app-accent-ink" />
            <h2 className="text-sm font-semibold text-foreground">Riwayat Pekerjaan</h2>
          </div>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{countdown.details.length} catatan</span>
        </div>
        <div className="divide-y divide-border dark:divide-white/[0.06]">
          {countdown.details.map((detail) => (
            <details key={detail.detailId} className="group px-3 py-2.5">
              <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="grid gap-2 lg:grid-cols-[minmax(11rem,1.4fr)_minmax(12rem,2fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_4rem_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{detail.employeeName}</p>
                  <p className="truncate text-xs text-muted-foreground">{detail.employeeRole ?? "Peran tidak tersedia"}</p>
                </div>
                <p className="line-clamp-2 text-xs text-foreground">
                  {detail.dailyNotes ?? (detail.actualId ? "Tidak ada catatan aktual." : "Pekerjaan belum memiliki aktual.")}
                </p>
                <p className="text-xs text-foreground"><span className="text-muted-foreground lg:hidden">Tanggal: </span>{detail.workDate}</p>
                <p className="text-xs text-foreground"><span className="text-muted-foreground lg:hidden">Jam: </span>{fmtTime(detail.startTime)}–{fmtTime(detail.finishTime)} · {detail.billedHours.toFixed(2)} jam</p>
                <p className="font-mono text-xs text-foreground"><span className="text-muted-foreground lg:hidden">Progress: </span>{detail.progressPercent.toFixed(0)}%</p>
                <span className="flex items-center gap-2 justify-self-start lg:justify-self-end">
                  <span className="w-fit"><DataGridStatusBadge value={detail.taskStatus} /></span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                </span>
              </div>
              </summary>

              <div className="mt-3 border-t border-border pt-3 dark:border-white/[0.06]">
                <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-[7rem_1fr]">
                  <dt className="text-muted-foreground">Catatan aktual</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{detail.dailyNotes ?? "Tidak ada catatan yang diberikan."}</dd>
                </dl>
              {detail.photos.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground"><Camera className="h-3.5 w-3.5" />Dokumentasi</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {detail.photos.map((photo) => {
                      const url = resolveCountdownPhotoUrl(photo.url);
                      const content = (
                        <>
                          <div className="aspect-[4/3] overflow-hidden bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                            <img src={url ?? undefined} alt={photo.caption || `Dokumentasi ${photoLabels[photo.type]}`} loading="lazy" className="h-full w-full object-cover transition-opacity hover:opacity-90" />
                          </div>
                          <div className="p-2">
                            <p className="font-mono text-[10px] font-semibold uppercase text-app-accent-ink">{photoLabels[photo.type]}</p>
                            {photo.caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{photo.caption}</p> : null}
                          </div>
                        </>
                      );
                      return url ? (
                        <a key={photo.photoId} href={url} target="_blank" rel="noreferrer" className="overflow-hidden border border-border bg-background transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.08]" aria-label={`Buka dokumentasi ${photoLabels[photo.type]}`}>{content}</a>
                      ) : (
                        <div key={photo.photoId} className="overflow-hidden border border-border bg-background opacity-60 dark:border-white/[0.08]">{content}</div>
                      );
                    })}
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">Belum ada dokumentasi foto untuk aktual ini.</p>}
              </div>
            </details>
          ))}
          {countdown.details.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada riwayat pekerjaan.</p>
          ) : null}
        </div>
      </section>

      <details className="border border-border bg-card dark:border-white/[0.06]">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Informasi Countdown</summary>
        <dl className="grid gap-x-6 gap-y-2 border-t border-border px-3 py-3 text-xs sm:grid-cols-2 lg:grid-cols-3 dark:border-white/[0.06]">
          {[
            ["ID", countdown.countdownId], ["ID unit", countdown.carId], ["Pelanggan", countdown.customerName ?? "-"],
            ["Jenis kerja", countdown.jobTypeName ?? "-"], ["Target awal", `${countdown.targetHoursInitial.toFixed(2)} jam`],
            ["Tambahan jam", `${countdown.timeExtensionHours.toFixed(2)} jam`], ["Temuan awal", countdown.temuanAwal ?? "-"],
            ["Keterangan", countdown.keterangan ?? "-"], ["Diperbarui", countdown.updatedAt ? fmtDateTime(countdown.updatedAt) : "-"],
          ].map(([label, value]) => <div key={label} className="grid grid-cols-[6rem_1fr] gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-foreground">{value}</dd></div>)}
        </dl>
      </details>

      <dialog
        ref={revisionDialogRef}
        onClose={() => setRevisionOpen(false)}
        onCancel={() => setRevisionOpen(false)}
        aria-labelledby="countdown-revision-title"
        className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[1px]"
      >
          <div
            className="flex max-h-[calc(100svh-2rem)] w-full flex-col overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p id="countdown-revision-title" className="text-sm font-semibold text-foreground">Ajukan Revisi Countdown</p>
              <ActionButton onClick={() => setRevisionOpen(false)} disabled={isSubmittingRevision}>
                <X className="h-3 w-3" />Tutup
              </ActionButton>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <FieldLabel required>Tambahan Jam</FieldLabel>
                <CompactInput aria-label="Tambahan jam" autoFocus type="number" min="0.01" step="0.01" value={requestedHours} onChange={(event) => setRequestedHours(event.target.value)} />
              </div>
              <div>
                <FieldLabel required>Deadline Baru</FieldLabel>
                <CompactInput aria-label="Deadline baru" type="date" value={requestedDeadline} onChange={(event) => setRequestedDeadline(event.target.value)} />
              </div>
              <div>
                <FieldLabel required>Alasan</FieldLabel>
                <CompactTextarea aria-label="Alasan revisi" rows={4} maxLength={1000} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} />
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
              <ActionButton variant="primary" disabled={isSubmittingRevision} onClick={() => void handleRevisionRequest()}>
                <RotateCcw className="h-3 w-3" />{isSubmittingRevision ? "Mengajukan…" : "Ajukan Revisi"}
              </ActionButton>
            </div>
          </div>
      </dialog>
    </div>
  );
}
