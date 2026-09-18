"use client";

// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench utilitarian · design.md

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { QcQueueRecord } from "@smsystem/contracts/qc";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown";
import { fetchJobPlanGrid } from "@/shared/api/job-plan";
import { fetchJobPlanV2List } from "@/shared/api/job-plan-v2";
import { fetchMonitoringToday } from "@/shared/api/monitoring";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { fmtDateTime, humanizeCodeLabel } from "@/shared/format/humanize";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, MetricBar, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";
import { CountdownActualSection } from "./countdown-actual-section";
import { CountdownJobPlanSection } from "./countdown-job-plan-section";
import { CountdownMasterPanel } from "./countdown-master-panel";
import { CountdownPrSection } from "./countdown-pr-section";
import { CountdownQcSection } from "./countdown-qc-section";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  currentUserId: string;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
  canManagePlan?: boolean;
  canInputActual?: boolean;
  canViewQc?: boolean;
  qc?: QcQueueRecord | null;
}

interface EmployeeOption {
  label: string;
  value: string;
}

function ResponsibleField({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 text-[12px] text-muted-foreground">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </p>
  );
}

function toLocalDateValue(value = new Date()) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function CountdownDetailShell({
  countdown,
  currentUserId,
  canRequestRevision = false,
  canApproveRevision = false,
  canApproveMoRevision = false,
  canManagePlan = false,
  canInputActual = false,
  canViewQc = false,
  qc = null,
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
  const [plans, setPlans] = useState<JobPlanV2ReadItem[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeLoadState, setEmployeeLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const revisionActions = resolveCountdownRevisionActions({
    status: countdown.status,
    extensionRequestStatus: countdown.extensionRequestStatus ?? null,
    canRequestRevision,
    canApproveRevision,
    canApproveMoRevision,
  });
  const approvalRole = revisionActions.canApprove ? "KP" : revisionActions.canApproveMo ? "MO" : null;

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    const result = await fetchJobPlanV2List({
      userId: currentUserId,
      coreId: countdown.countdownId,
      view: "browse",
    });
    if (!result.success) {
      setPlans([]);
      setPlansError(result.message);
      setPlansLoading(false);
      return;
    }
    setPlans(result.result.items);
    setPlansError(null);
    setPlansLoading(false);
  }, [countdown.countdownId, currentUserId]);

  const loadEmployeeOptions = useCallback(async () => {
    if (employeeLoadState === "loading" || employeeLoadState === "ready") return;
    setEmployeeLoadState("loading");
    const today = toLocalDateValue();

    if (canManagePlan) {
      const grid = await fetchJobPlanGrid("", { date: today }, "normal");
      if (grid.payload) {
        setEmployeeOptions(grid.payload.references.employees.map(({ label, value }) => ({ label, value })));
        setEmployeeLoadState("ready");
        return;
      }
    }

    const monitoring = await fetchMonitoringToday("", { date: today, limit: "1" });
    if (monitoring.payload) {
      setEmployeeOptions(monitoring.payload.references.employees.map(({ label, value }) => ({ label, value })));
      setEmployeeLoadState("ready");
      return;
    }

    setEmployeeLoadState("error");
  }, [canManagePlan, employeeLoadState]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

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

  // Ringkasan status per rencana ada di section Rencana pekerjaan; linimasa hanya mencatat jumlahnya.
  const planStatusSummary = plansLoading
    ? "Memuat rencana…"
    : plans.length > 0
      ? `${plans.length} rencana tercatat.`
      : "Belum ada rencana pekerjaan.";

  return (
    <div className="flex flex-col gap-3">
      <header className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link href={`/units/${encodeURIComponent(countdown.carId)}?tab=countdown`} title="Kembali ke Countdown Unit" aria-label="Kembali ke Countdown Unit" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-lg font-semibold text-foreground">{countdown.unitName}</h1>
              <span className="shrink-0"><DataGridStatusBadge value={humanizeCodeLabel(countdown.status)} /></span>
              <span className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${countdown.isOverdue ? "border-destructive/30 bg-destructive/[0.06] text-destructive" : "border-success/25 bg-success/[0.06] text-success"}`}>
                {countdown.isOverdue ? "Terlambat" : "Sesuai jadwal"}
              </span>
            </div>
            <div className="mt-1 flex flex-col gap-0.5 pl-6">
              <p className="truncate text-[13px] font-medium text-foreground">
                {countdown.panelName ?? "Panel belum ditentukan"}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {countdown.divisionName ?? "Tanpa divisi"}
                {countdown.jobTypeName ? ` · ${countdown.jobTypeName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href="#job-plan"
              onClick={() => document.getElementById("job-plan")?.setAttribute("open", "")}
              className="inline-flex h-9 items-center gap-1.5 border border-success/25 bg-success/[0.06] px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Rencana pekerjaan
            </a>
            <a
              href="#actual"
              onClick={() => document.getElementById("actual")?.setAttribute("open", "")}
              className="inline-flex h-9 items-center gap-1.5 border border-border px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.08]"
            >
              Aktual
            </a>
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

      <MetricBar items={[
        { label: "Target Jam", value: `${countdown.targetHoursRevised.toFixed(2)} jam` },
        { label: "Jam Aktual", value: `${countdown.totalActualHours.toFixed(2)} jam` },
        { label: "Jam Tersisa", value: `${countdown.remainingHours.toFixed(2)} jam`, tone: countdown.remainingHours <= 0 ? "down" : "warn" },
        { label: "Progress", value: `${countdown.actualProgressPercent.toFixed(0)}%`, tone: countdown.isOverdue ? "warn" : "up" },
      ]} />

      <div className="flex items-center gap-3 border border-t-0 border-border bg-card px-3 py-1.5 dark:border-white/[0.06]">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden bg-muted" role="progressbar" aria-label="Progress pekerjaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(countdown.actualProgressPercent)}>
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, countdown.actualProgressPercent))}%` }} />
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Progress pekerjaan</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border border-border bg-card px-3 py-2 dark:border-white/[0.06]">
        <ResponsibleField label="KP" value={countdown.kpName ?? "-"} />
        <ResponsibleField label="KD" value={countdown.kdName ?? "-"} />
        <ResponsibleField label="PIC rencana" value={countdown.picName ?? countdown.picPlan ?? "Belum ditentukan"} />
      </div>

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

      <CountdownMasterPanel countdown={countdown} />

      <CountdownJobPlanSection
        countdown={countdown}
        userId={currentUserId}
        plans={plans}
        isLoading={plansLoading}
        error={plansError}
        canManagePlan={canManagePlan}
        employeeOptions={employeeOptions}
        onReload={() => void loadPlans()}
        onRequestEmployeeOptions={() => void loadEmployeeOptions()}
      />

      <CountdownActualSection
        countdown={countdown}
        plans={plans}
        plansLoading={plansLoading}
        canInputActual={canInputActual}
        employeeOptions={employeeOptions}
        onRequestEmployeeOptions={() => void loadEmployeeOptions()}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <CountdownPrSection refWoId={countdown.refWoId ?? null} />
        <CountdownQcSection qc={qc} canViewQc={canViewQc} />
      </div>

      <SectionCard label="Linimasa & ledger" collapsible defaultOpen={false}>
        <ol className="space-y-3 border-l border-border pl-4 dark:border-white/[0.08]">
          {countdown.createdAt ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-primary">
              <p className="font-medium">Countdown dibuat</p>
              <p className="mt-0.5 text-muted-foreground">{fmtDateTime(countdown.createdAt)}</p>
            </li>
          ) : null}
          <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-muted-foreground">
            <p className="font-medium">Rencana pekerjaan</p>
            <p className="mt-0.5 text-muted-foreground">{planStatusSummary}</p>
          </li>
          <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-success">
            <p className="font-medium">Aktual tercatat</p>
            <p className="mt-0.5 text-muted-foreground">
              {countdown.details.length > 0
                ? `${countdown.details.length} catatan, terakhir ${countdown.details[0]?.workDate ?? "-"}`
                : "Belum ada catatan aktual."}
            </p>
          </li>
          {countdown.extensionRequestStatus ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-primary">
              <p className="font-medium">Revisi countdown</p>
              <p className="mt-0.5 text-muted-foreground">{formatCountdownRevisionStatus(countdown.extensionRequestStatus)}</p>
            </li>
          ) : null}
          {countdown.status === "QC_READY" || countdown.status === "DONE" || qc?.latestInspectionDate ? (
            <li className="relative text-[12px] text-foreground before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:bg-info">
              <p className="font-medium">Pemeriksaan kualitas</p>
              <p className="mt-0.5 text-muted-foreground">
                {qc?.latestInspectionDate ?? humanizeCodeLabel(countdown.status)}
              </p>
            </li>
          ) : null}
        </ol>
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
