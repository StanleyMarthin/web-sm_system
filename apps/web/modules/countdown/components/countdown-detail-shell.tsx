"use client";

// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench utilitarian · design.md

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { getProxiedImageUrl } from "@/shared/api/config";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, MetricBar, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { resolveCountdownPhotoUrl, resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";
import { CountdownJobHistory } from "./countdown-job-history";

interface CountdownJobHistoryData {
  items: JobPlanV2ReadItem[];
  employeeNames: Record<string, string>;
  error: string | null;
}

interface CountdownQcSummary {
  resultStatus: "LOLOS" | "TIDAK_LOLOS" | null;
  level: string | null;
  inspectedAt: string | null;
}

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
  canManage?: boolean;
  jobHistory: CountdownJobHistoryData;
  qcSummary: CountdownQcSummary | null;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Pengerjaan",
  AFTER: "Setelah",
  DEFECT: "Temuan",
} as const;

function countdownImageSrc(value: string): string | null {
  const url = resolveCountdownPhotoUrl(value);
  if (!url) return null;

  const driveFile = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view(?:\?|$)/u);
  if (driveFile) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile[1])}&sz=w2000`;
  }

  return getProxiedImageUrl(url) ?? url;
}

function CountdownGallery({ countdown }: { countdown: CountdownDetail }) {
  const photos = countdown.details.flatMap((detail) => detail.photos.map((photo) => ({
    ...photo,
    workDate: detail.workDate,
    employeeName: detail.employeeName,
  }))).filter((photo) => resolveCountdownPhotoUrl(photo.url));
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(() => new Set());
  const availablePhotos = photos.filter((photo) => !failedPhotoIds.has(photo.photoId));
  const safeActiveIndex = availablePhotos.length > 0 ? Math.min(activeIndex, availablePhotos.length - 1) : 0;
  const activePhoto = availablePhotos[safeActiveIndex];
  const activeUrl = activePhoto ? countdownImageSrc(activePhoto.url) : null;

  function markPhotoFailed(photoId: string) {
    setFailedPhotoIds((current) => {
      const next = new Set(current);
      next.add(photoId);
      return next;
    });
  }

  if (!activePhoto || !activeUrl) {
    return (
      <section className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Dokumentasi</h2>
        </div>
        <p className="px-3 py-5 text-sm text-muted-foreground">{photos.length > 0 ? "Foto tidak dapat dimuat." : "Belum ada foto."}</p>
      </section>
    );
  }

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + availablePhotos.length) % availablePhotos.length);
  }

  return (
    <section className="border border-border bg-card dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Dokumentasi</h2>
        </div>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{photos.length} foto</span>
      </div>
      <div className="space-y-3 p-3">
        <div className="relative flex aspect-[16/9] min-h-[14rem] max-h-[24rem] items-center justify-center overflow-hidden border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
          <img src={activeUrl} alt={activePhoto.caption || `Dokumentasi ${photoLabels[activePhoto.type]}`} className="h-full w-full object-contain" onError={() => markPhotoFailed(activePhoto.photoId)} />
          {availablePhotos.length > 1 ? (
            <>
              <button type="button" onClick={() => move(-1)} className="absolute left-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(1)} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : null}
        </div>
        {availablePhotos.length > 1 ? (
          <div className="grid max-h-32 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
            {availablePhotos.map((photo, index) => {
              const url = countdownImageSrc(photo.url);
              if (!url) return null;
              return (
                <button key={photo.photoId} type="button" onClick={() => setActiveIndex(index)} className={`relative h-14 min-w-0 overflow-hidden border bg-background ${index === safeActiveIndex ? "border-primary" : "border-border hover:border-primary/50"}`} aria-label={`Pilih foto ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                  <img src={url} alt="" className="h-full w-full object-cover" onError={() => markPhotoFailed(photo.photoId)} />
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5 text-left font-mono text-[9px] uppercase text-white">{photoLabels[photo.type]}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
        <span className="font-medium text-foreground">{photoLabels[activePhoto.type]}</span>
        {activePhoto.caption ? ` · ${activePhoto.caption}` : ""}
        {activePhoto.workDate ? ` · ${activePhoto.workDate}` : ""}
      </div>
    </section>
  );
}

function QcStatusLine({ countdown, qcSummary }: { countdown: CountdownDetail; qcSummary: CountdownQcSummary | null }) {
  const passed = qcSummary?.resultStatus === "LOLOS";
  const failed = qcSummary?.resultStatus === "TIDAK_LOLOS";
  const label = passed ? "Lolos" : failed ? "Tidak Lolos" : "Menunggu";

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-3 py-2.5 dark:border-white/[0.06]">
      <div className="flex items-center gap-2">
        <p className="text-sm text-foreground"><span className="font-semibold">QC Status:</span></p>
        <DataGridStatusBadge value={label} />
        {qcSummary?.inspectedAt ? (
          <span className="text-xs text-muted-foreground">Inspeksi {qcSummary.inspectedAt}</span>
        ) : null}
      </div>
      <Link href="/qc" className="inline-flex h-9 items-center gap-1.5 border border-primary/35 px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10">
        Lihat QC
      </Link>
    </section>
  );
}

export function CountdownDetailShell({
  countdown,
  canRequestRevision = false,
  canApproveRevision = false,
  canApproveMoRevision = false,
  canManage = false,
  jobHistory,
  qcSummary,
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
    const jobPlanParams = new URLSearchParams({ coreId: countdown.countdownId, mode });
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
              <Link href={`/units/${encodeURIComponent(countdown.carId)}?tab=countdown`} title="Kembali ke Countdown Unit" aria-label="Kembali ke Countdown Unit" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-lg font-semibold text-foreground">{countdown.unitName}</h1>
              <span className="shrink-0"><DataGridStatusBadge value={humanizeCodeLabel(countdown.status)} /></span>
            </div>
            <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">
              {countdown.panelName ?? "Panel belum ditentukan"}
              {countdown.divisionName ? ` · ${countdown.divisionName}` : ""}
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
          </div>
        </div>
      </header>

      {sweetAlert.alertElement}

      <SectionCard label="Countdown Progress Summary">
        <MetricBar items={[
          { label: "Target", value: `${countdown.targetHoursRevised.toFixed(2)} Jam` },
          { label: "Aktual", value: `${countdown.totalActualHours.toFixed(2)} Jam` },
          { label: "Sisa", value: `${countdown.remainingHours.toFixed(2)} Jam`, tone: countdown.remainingHours <= 0 ? "down" : "warn" },
          { label: "Progress", value: `${countdown.actualProgressPercent.toFixed(0)}%`, tone: countdown.isOverdue ? "warn" : "up" },
        ]} />
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
        {countdown.picPlan ? (
          <p className="border-t border-border pt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">PIC Plan:</span> {countdown.picPlan}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard label="Informasi Countdown">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Panel" value={countdown.panelName ?? "Panel belum ditentukan"} />
          <DetailField label="Divisi" value={countdown.divisionName ?? "Tanpa divisi"} />
          <DetailField label="Jenis Pekerjaan" value={countdown.jobTypeName ?? humanizeCodeLabel(countdown.taskCategory)} />
          <DetailField label="Bagian" value={countdown.sectionName ?? "Bagian belum ditentukan"} />
          <DetailField label="Temuan Awal" value={countdown.temuanAwal ?? "-"} />
          <DetailField label="Target Awal" value={`${countdown.targetHoursInitial.toFixed(2)} Jam`} />
          <DetailField label="Target Jam" value={`${countdown.targetHoursRevised.toFixed(2)} Jam`} />
          <DetailField label="Mulai" value={countdown.startDate ?? "-"} />
          <DetailField label="Deadline" value={countdown.deadlineDate ?? "-"} />
          <DetailField label="Keterangan" value={countdown.keterangan ?? "-"} />
        </dl>
      </SectionCard>

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

      <CountdownJobHistory
        carId={countdown.carId}
        divisionId={countdown.divisionId}
        divisionName={countdown.divisionName}
        items={jobHistory.items}
        employeeNames={jobHistory.employeeNames}
        error={jobHistory.error}
        canCreate={canManage}
        jobPlanHref={buildJobPlanHref}
      />

      <QcStatusLine countdown={countdown} qcSummary={qcSummary} />

      <CountdownGallery countdown={countdown} />

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
