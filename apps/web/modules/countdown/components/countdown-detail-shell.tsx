"use client";

// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench utilitarian · design.md

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { humanizeCodeLabel, fmtTime, fmtDateTime } from "@/shared/format/humanize";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { resolveCountdownPhotoUrl, resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

function ActivityUnavailable({ label }: { label: string }) {
  return (
    <div className="border border-border px-3 py-2 text-[12px] text-muted-foreground">
      <span className="block">{label}</span>
      <span className="mt-1 block text-[11px]">Belum ada relasi</span>
    </div>
  );
}

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Pengerjaan",
  AFTER: "Setelah",
  DEFECT: "Temuan",
} as const;

type CountdownActualEntry = CountdownDetail["details"][number];

// componentName belum dikirim API countdown; kolom disiapkan agar tinggal terisi saat payload menambahkannya.
type CountdownDetailRow = CountdownDetail & { componentName?: string | null };

const actualColumnDefs: ColDef<CountdownActualEntry>[] = [
  { headerName: "Tanggal", field: "workDate", minWidth: 110 },
  { headerName: "PIC", field: "employeeName", minWidth: 150, flex: 0.8 },
  { headerName: "Mulai", field: "startTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Selesai", field: "finishTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Durasi", field: "billedHours", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Progress", field: "progressPercent", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(0)}%` },
  { headerName: "Status", field: "taskStatus", minWidth: 130, cellRenderer: ({ value }: ICellRendererParams<CountdownActualEntry>) => <DataGridStatusBadge value={humanizeCodeLabel(value)} /> },
  { headerName: "Catatan", field: "dailyNotes", minWidth: 220, flex: 1 },
];

const detailColumnDefs: ColDef<CountdownDetailRow>[] = [
  { headerName: "Divisi", field: "divisionName", minWidth: 110, valueFormatter: ({ value }) => String(value ?? "Tanpa divisi") },
  { headerName: "Component", field: "componentName", minWidth: 140, valueFormatter: ({ value }) => String(value ?? "-") },
  { headerName: "Panel", field: "panelName", minWidth: 180, flex: 1, valueFormatter: ({ value }) => String(value ?? "Panel belum ditentukan") },
  { headerName: "Temuan Awal", field: "temuanAwal", minWidth: 160, flex: 1, valueFormatter: ({ value }) => String(value ?? "-") },
  { headerName: "Jobdesc", field: "jobTypeName", minWidth: 160, flex: 1, valueFormatter: ({ data, value }) => String(value ?? (data ? humanizeCodeLabel(data.taskCategory) : "-")) },
  { headerName: "Grade", field: "requiredGrade", minWidth: 90, valueFormatter: ({ value }) => String(value ?? "-") },
  { headerName: "Target Awal", field: "targetHoursInitial", minWidth: 105, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Target Hours", field: "targetHoursRevised", minWidth: 105, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Aktual", field: "totalActualHours", minWidth: 95, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Sisa Jam Kerja", field: "remainingHours", minWidth: 115, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "PIC", field: "picName", minWidth: 140, valueFormatter: ({ data, value }) => String(value ?? data?.picPlan ?? "-") },
  { headerName: "Keterangan", field: "keterangan", minWidth: 170, flex: 1, valueFormatter: ({ data, value }) => String(value ?? data?.note ?? "-") },
  { headerName: "Mulai", field: "startDate", minWidth: 100, valueFormatter: ({ value }) => String(value ?? "-") },
  { headerName: "Deadline", field: "deadlineDate", minWidth: 100, valueFormatter: ({ value }) => String(value ?? "-") },
  { headerName: "Status", field: "status", minWidth: 120, cellRenderer: ({ value }: ICellRendererParams<CountdownDetailRow>) => <DataGridStatusBadge value={humanizeCodeLabel(value)} /> },
];

function CountdownGallery({ countdown }: { countdown: CountdownDetail }) {
  const photos = countdown.details.flatMap((detail) => detail.photos.map((photo) => ({
    ...photo,
    workDate: detail.workDate,
    employeeName: detail.employeeName,
  }))).filter((photo) => resolveCountdownPhotoUrl(photo.url));
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex];
  const activeUrl = activePhoto ? resolveCountdownPhotoUrl(activePhoto.url) : null;

  if (!activePhoto || !activeUrl) {
    return (
      <section className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Dokumentasi</h2>
        </div>
        <p className="px-3 py-5 text-sm text-muted-foreground">Belum ada foto.</p>
      </section>
    );
  }

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + photos.length) % photos.length);
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
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="relative flex min-h-[18rem] items-center justify-center overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
          <img src={activeUrl} alt={activePhoto.caption || `Dokumentasi ${photoLabels[activePhoto.type]}`} className="max-h-[32rem] w-full object-contain" />
          {photos.length > 1 ? (
            <>
              <button type="button" onClick={() => move(-1)} className="absolute left-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(1)} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-y-auto">
          {photos.map((photo, index) => {
            const url = resolveCountdownPhotoUrl(photo.url);
            if (!url) return null;
            return (
              <button key={photo.photoId} type="button" onClick={() => setActiveIndex(index)} className={`block shrink-0 overflow-hidden border text-left ${index === activeIndex ? "border-primary" : "border-border hover:border-primary/50"}`} aria-label={`Pilih foto ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                <img src={url} alt="" className="h-16 w-20 object-cover lg:h-20 lg:w-full" />
                <span className="hidden px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground lg:block">{photoLabels[photo.type]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
        <span className="font-medium text-foreground">{photoLabels[activePhoto.type]}</span>
        {activePhoto.caption ? ` · ${activePhoto.caption}` : ""}
        {activePhoto.workDate ? ` · ${activePhoto.workDate}` : ""}
      </div>
    </section>
  );
}

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
            </p>
            <p className="truncate pl-6 text-xs text-muted-foreground">{countdown.customerName || "-"}</p>
            <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">KP: {countdown.kpName || "-"}</p>
            <p className="truncate pl-6 text-xs text-muted-foreground">KD: {countdown.kdName || "-"}</p>
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

        <div className="flex flex-wrap items-stretch border-t border-border dark:border-white/[0.06]">
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Target Jam</p>
            <p className="font-mono text-[16px] font-semibold leading-none tabular-nums text-foreground">{countdown.targetHoursRevised.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Jam Aktual</p>
            <p className="font-mono text-[16px] font-semibold leading-none tabular-nums text-foreground">{countdown.totalActualHours.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Jam Tersisa</p>
            <p className={`font-mono text-[16px] font-semibold leading-none tabular-nums ${countdown.remainingHours <= 0 ? "text-destructive" : "text-app-accent-ink"}`}>{countdown.remainingHours.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Progress</p>
            <p className={`font-mono text-[16px] font-semibold leading-none tabular-nums ${countdown.isOverdue ? "text-app-accent-ink" : "text-success"}`}>{countdown.actualProgressPercent.toFixed(0)}%</p>
          </div>
        </div>

        <div className="border-t border-border px-3 py-2.5 dark:border-white/[0.06]">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Progress pekerjaan</span>
            <span className="font-mono text-muted-foreground">{countdown.actualProgressPercent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-muted" role="progressbar" aria-label="Progress pekerjaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(countdown.actualProgressPercent)}>
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, countdown.actualProgressPercent))}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{countdown.isOverdue ? "Terlambat" : "Sesuai jadwal"}</p>
        </div>
      </header>

      {sweetAlert.alertElement}

      <CountdownGallery countdown={countdown} />

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

      <SectionCard label="Detail pekerjaan">
        <SmsAgGrid<CountdownDetailRow>
          heightClassName="h-28"
          className="[&_.ag-row]:cursor-pointer"
          rowData={[countdown]}
          columnDefs={detailColumnDefs}
          enableCellTextSelection
          ensureDomOrder
          onRowClicked={() => router.push(`/countdown/${encodeURIComponent(countdown.countdownId)}`)}
        />
      </SectionCard>

      <SectionCard label="Linimasa pekerjaan">
        <ol className="space-y-3 border-l border-border pl-4 dark:border-white/[0.08]">
          {countdown.createdAt ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-primary">
              <p className="font-medium">Countdown dibuat</p>
              <p className="mt-0.5 text-muted-foreground">{fmtDateTime(countdown.createdAt)}</p>
            </li>
          ) : null}
          <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-muted-foreground">
            <p className="font-medium">Job Plan</p>
            <p className="mt-0.5 text-muted-foreground">Status belum tersedia dari detail Countdown.</p>
          </li>
          {countdown.details.length > 0 ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-success">
              <p className="font-medium">Aktual tercatat</p>
              <p className="mt-0.5 text-muted-foreground">{countdown.details.length} catatan aktual terakhir pada {countdown.details[0]?.workDate}</p>
            </li>
          ) : null}
          {(countdown.status === "QC_READY" || countdown.status === "DONE") ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-info">
              <p className="font-medium">Pemeriksaan kualitas</p>
              <p className="mt-0.5 text-muted-foreground"><DataGridStatusBadge value={humanizeCodeLabel(countdown.status)} /></p>
            </li>
          ) : null}
        </ol>
      </SectionCard>

      <div id="hasil-pekerjaan">
        <SectionCard label="Hasil pekerjaan" count={countdown.details.length}>
        {countdown.details.length > 0 ? (
          <SmsAgGrid<CountdownActualEntry>
            heightClassName="h-72"
            rowData={countdown.details}
            columnDefs={actualColumnDefs}
            getRowId={(params) => params.data.detailId}
            emptyMessage="Belum ada hasil pekerjaan."
          />
        ) : <p className="text-sm text-muted-foreground">Belum ada hasil pekerjaan.</p>}
        </SectionCard>
      </div>

      <SectionCard label="Aktivitas terkait">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Link href={buildJobPlanHref("normal")} className="border border-border px-3 py-2 text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
            <span className="block text-muted-foreground">Job Plan</span>
            <span className="mt-1 block font-medium">Buka rencana kerja</span>
          </Link>
          {countdown.refWoId ? (
            <Link href={`/wo/${encodeURIComponent(countdown.refWoId)}`} className="border border-border px-3 py-2 text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
              <span className="block text-muted-foreground">Work Order</span>
              <span className="mt-1 block font-medium">Buka WO</span>
            </Link>
          ) : <ActivityUnavailable label="Work Order" />}
          <ActivityUnavailable label="Purchase Request" />
          <ActivityUnavailable label="Vendor WO" />
          <div className="border border-border px-3 py-2 text-[12px] text-foreground">
            <span className="block text-muted-foreground">QC</span>
            <span className="mt-1 block font-medium">{countdown.status === "QC_READY" || countdown.status === "DONE" ? humanizeCodeLabel(countdown.status) : "Belum ada data"}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard label="Informasi tambahan">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Kategori" value={humanizeCodeLabel(countdown.taskCategory)} />
          <DetailField label="Mulai" value={countdown.startDate ?? "-"} />
          <DetailField label="Deadline" value={countdown.deadlineDate ?? "-"} />
          <DetailField label="Diperbarui" value={countdown.updatedAt ? fmtDateTime(countdown.updatedAt) : "-"} />
          <DetailField label="Temuan awal" value={countdown.temuanAwal ?? "-"} />
          <DetailField label="Keterangan" value={countdown.keterangan ?? "-"} />
        </dl>
      </SectionCard>

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
