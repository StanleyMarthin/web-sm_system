"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown";
import { fetchJobPlanGrid } from "@/shared/api/job-plan";
import { fetchJobPlanV2List } from "@/shared/api/job-plan-v2";
import { fetchMonitoringToday } from "@/shared/api/monitoring";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, MetricBar, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";
import { CountdownActualSection } from "./countdown-actual-section";
import { CountdownDocumentationSection } from "./countdown-documentation-section";
import { CountdownJobPlanSection } from "./countdown-job-plan-section";
import { CountdownMasterPanel } from "./countdown-master-panel";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  currentUserId: string;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
  canManagePlan?: boolean;
  canInputActual?: boolean;
}

interface EmployeeOption {
  label: string;
  value: string;
}

function toLocalDateValue(value = new Date()) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function HeadlineField({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] text-muted-foreground">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </p>
  );
}

export function CountdownDetailShell({
  countdown,
  currentUserId,
  canRequestRevision = false,
  canApproveRevision = false,
  canApproveMoRevision = false,
  canManagePlan = false,
  canInputActual = false,
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
  const hasRevisionHistory = Boolean(countdown.extensionRequestStatus) || (countdown.countRevision ?? 0) > 0;

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
      sweetAlert.notifySuccess("Berhasil", "Perubahan deadline berhasil diajukan.");
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
      title: isApproved ? `Setujui perubahan deadline sebagai ${approvalRole}?` : `Tolak perubahan deadline sebagai ${approvalRole}?`,
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
      sweetAlert.notifySuccess("Berhasil", isApproved ? "Perubahan deadline disetujui." : "Perubahan deadline ditolak.");
      router.refresh();
    } catch {
      sweetAlert.notifyError("Persetujuan gagal", "Layanan countdown tidak dapat dihubungi.");
    } finally {
      setIsDecidingRevision(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {sweetAlert.alertElement}

      <header className="flex flex-col gap-3 border border-border bg-card p-3 dark:border-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/units/${encodeURIComponent(countdown.carId)}?tab=countdown`}
                title="Kembali ke Countdown Unit"
                aria-label="Kembali ke Countdown Unit"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-[15px] font-semibold text-foreground">{countdown.unitName}</h1>
              {countdown.customerName ? (
                <span className="truncate text-[12px] text-muted-foreground">· {countdown.customerName}</span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6">
              <HeadlineField label="KP" value={countdown.kpName ?? "-"} />
              <HeadlineField label="KD" value={countdown.kdName ?? "-"} />
            </div>
          </div>
        </div>

        <MetricBar items={[
          { label: "Target", value: `${countdown.targetHoursRevised.toFixed(2)} jam` },
          { label: "Aktual", value: `${countdown.totalActualHours.toFixed(2)} jam` },
          { label: "Sisa", value: `${countdown.remainingHours.toFixed(2)} jam`, tone: countdown.remainingHours <= 0 ? "down" : "warn" },
          { label: "Progress", value: `${countdown.actualProgressPercent.toFixed(0)}%`, tone: countdown.isOverdue ? "warn" : "up" },
        ]} />
      </header>

      <CountdownMasterPanel
        countdown={countdown}
        revisionAction={revisionActions.canRequest ? (
          <button
            type="button"
            onClick={() => setRevisionOpen(true)}
            className="inline-flex h-7 items-center gap-1 border border-primary/30 bg-primary/[0.06] px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3 w-3" />Ajukan Perubahan
          </button>
        ) : null}
      />

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

      <CountdownDocumentationSection countdown={countdown} />

      {hasRevisionHistory ? (
        <SectionCard label="Revisi deadline" collapsible defaultOpen>
          <dl className="border border-border dark:border-white/[0.06]">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2 dark:border-white/[0.06]">
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Deadline aktif</dt>
              <dd className="text-[13px] text-foreground">{countdown.deadlineDate ?? "-"}</dd>
            </div>
            {countdown.requestedDeadline ? (
              <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2 dark:border-white/[0.06]">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Deadline diajukan</dt>
                <dd className="text-[13px] text-foreground">{countdown.requestedDeadline}</dd>
              </div>
            ) : null}
            {countdown.requestedExtensionHours ? (
              <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2 dark:border-white/[0.06]">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tambahan jam</dt>
                <dd className="text-[13px] text-foreground">{countdown.requestedExtensionHours} jam</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status</dt>
              <dd className="text-[13px] text-foreground">{formatCountdownRevisionStatus(countdown.extensionRequestStatus)}</dd>
            </div>
          </dl>

          {countdown.revisionReason ? (
            <p className="border-t border-border pt-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
              <span className="font-medium text-foreground">Alasan:</span> {countdown.revisionReason}
            </p>
          ) : null}

          {/* Persetujuan hanya muncul untuk pemegang wewenang; tidak ada visualisasi workflow. */}
          {approvalRole ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border pt-2 dark:border-white/[0.06]">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Peran: {approvalRole}</span>
              <ActionButton variant="success" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(true)}>
                <Check className="h-3.5 w-3.5" />Setujui
              </ActionButton>
              <ActionButton variant="danger" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(false)}>
                <X className="h-3.5 w-3.5" />Tolak
              </ActionButton>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <dialog
        ref={revisionDialogRef}
        onClose={() => setRevisionOpen(false)}
        onCancel={() => setRevisionOpen(false)}
        aria-labelledby="countdown-revision-title"
        className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[1px]"
      >
        <div className="flex max-h-[calc(100svh-2rem)] w-full flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p id="countdown-revision-title" className="text-sm font-semibold text-foreground">Ajukan Perubahan Deadline</p>
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
              <RotateCcw className="h-3 w-3" />{isSubmittingRevision ? "Mengajukan…" : "Ajukan Perubahan"}
            </ActionButton>
          </div>
        </div>
      </dialog>
    </div>
  );
}
