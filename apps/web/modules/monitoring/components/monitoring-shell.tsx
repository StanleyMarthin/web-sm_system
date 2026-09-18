"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { JobPlanV2ApprovalState } from "@smsystem/contracts/job-plan-v2";
import { permissionCodes } from "@smsystem/permissions";
import type {
  MonitoringQuery,
  MonitoringReferences,
  MonitoringSummary,
  MonitoringTaskRecord,
} from "@smsystem/contracts/monitoring";
import { encodeGridFilterToken, parseGridFilterToken, type GridFilter } from "@smsystem/contracts/grid";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { RefreshCcw, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createJobPlanV2CommandId, mutateJobPlanV2Approval } from "@/shared/api/job-plan-v2";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, CompactDateRangeInput, EmptyRow, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import {
  addIsoDays,
  approvalStageOptions,
  filterApprovalQueueRows,
  filterExecutionRows,
  isReviewState,
  monitoringBoardViewOptions,
  resolveApprovalDateWindow,
  resolveDefaultApprovalStage,
  resolveMonitoringBoardView,
  summarizeExecutionSelection,
  type MonitoringBoardView,
} from "../monitoring-views";
import { parseTimeToMinutes } from "@/modules/job-plan/job-plan-planner";

interface MonitoringShellProps {
  activeMode: "all" | "normal" | "overtime";
  title: string;
  description: string;
  rows: MonitoringTaskRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: MonitoringQuery;
  references: MonitoringReferences;
  summary: MonitoringSummary;
  noStartRows: MonitoringTaskRecord[];
  noSubmitRows: MonitoringTaskRecord[];
  user: AuthUser;
}

/* ------------------------------------------------------------------ */
/*  Board list — compact task rows                                      */
/* ------------------------------------------------------------------ */

function BoardList({ title, rows, emptyMessage }: {
  title: string; rows: MonitoringTaskRecord[]; emptyMessage: string;
}) {
  return (
    <SectionCard label={title} count={rows.length}>
      <div className="space-y-0">
        {rows.length === 0
          ? <EmptyRow message={emptyMessage} />
          : rows.slice(0, 6).map((row) => (
            <div key={row.planId} className="border-b border-white/5 px-2 py-2 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-foreground dark:text-foreground">{row.unitName}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
                    {row.divisionName ?? "—"} · {row.panelName ?? row.jobDescription}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-foreground/40">
                    {row.employeeName ?? "Belum ada PIC"} · {row.taskDate}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] text-foreground dark:text-foreground/60">{row.remainingHours.toFixed(1)}j</p>
                  <p className="font-mono text-[10px] text-muted-foreground dark:text-foreground/30">{row.progressPercent.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );
}

function optionLabel(options: Array<{ value: string | number; label: string }>, value: string) {
  return options.find((option) => String(option.value) === value)?.label ?? value;
}

function filterValue(filters: GridFilter[], field: string) {
  return filters.find((filter) => filter.field === field)?.value ?? "";
}

function setFilter(filters: GridFilter[], field: string, value: string): GridFilter[] {
  const next = filters.filter((filter) => filter.field !== field);
  return value ? [...next, { field, operator: "eq", value }] : next;
}

function roleDefaultFilters(user: AuthUser): GridFilter[] {
  if (user.scope.canViewAllUnits) return [];
  const role = user.roleName.toUpperCase();
  if (role.includes("KP") && user.scope.unitIds[0]) return [{ field: "carId", operator: "eq", value: user.scope.unitIds[0] }];
  const divisionId = user.scope.divisionIds[0] ?? user.divisionId;
  if ((role.includes("KD") || role.includes("QA")) && divisionId !== null && divisionId !== undefined) {
    return [{ field: "divisionId", operator: "eq", value: String(divisionId) }];
  }
  return [];
}

const actualStatusOptions = [
  { label: "Plan", value: "PLAN" },
  { label: "Onprogress", value: "ONPROGRESS" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Ready QC", value: "READY_QC" },
  { label: "Done", value: "DONE" },
  { label: "Cancel", value: "CANCEL" },
];

const approvalStateOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Review Divisi", value: "DIVISION_REVIEW" },
  { label: "Review Unit", value: "UNIT_REVIEW" },
  { label: "Review Management", value: "MANAGEMENT_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const executionStateOptions = [
  { label: "Not Started", value: "NOT_STARTED" },
  { label: "Running", value: "RUNNING" },
  { label: "Hold", value: "HOLD" },
  { label: "Pending Validation", value: "FINISHED_PENDING_VALIDATION" },
  { label: "Validated", value: "VALIDATED" },
];

const ledgerStateOptions = [
  { label: "Unmaterialized", value: "UNMATERIALIZED" },
  { label: "Materialized", value: "MATERIALIZED" },
  { label: "Finalized", value: "FINALIZED" },
];

const qcStatusOptions = [
  { label: "Belum QC", value: "BELUM_QC" },
  { label: "Lolos", value: "LOLOS" },
  { label: "Tidak Lolos", value: "TIDAK_LOLOS" },
];

const syncStatusOptions = [
  { label: "Synced", value: "SYNCED" },
  { label: "Syncing", value: "SYNCING" },
  { label: "Unavailable", value: "UNAVAILABLE" },
];

function statusCell(field: keyof MonitoringTaskRecord) {
  function MonitoringStatusCell({ data }: ICellRendererParams<MonitoringTaskRecord>) {
    return <DataGridStatusBadge value={data?.[field] ? String(data[field]) : "-"} />;
  }

  return MonitoringStatusCell;
}

function textValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function humanMonitoringStatus(row: MonitoringTaskRecord | null | undefined) {
  if (!row) return "-";
  return optionValue(actualStatusOptions, row.executionStatus);
}

function optionValue(options: Array<{ value: string; label: string }>, value: string | null | undefined) {
  if (!value) return "-";
  return optionLabel(options, value);
}

function formatMonitoringDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hoursValue(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value.toFixed(1)} jam`;
}

function minutesValue(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value} menit`;
}

function timeValue(value: string | null | undefined) {
  if (!value) return "-";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function lastUpdateValue(row: MonitoringTaskRecord) {
  return row.actualFinishTime ?? row.latestFinishTime ?? row.actualStartTime ?? row.latestStartTime ?? row.taskDate;
}

function riskLabel(row: MonitoringTaskRecord) {
  if (row.hasDelayRisk) return "Delay Risk";
  if (row.isOvertime) return "Overtime";
  return "Normal";
}

function sameApprovalStage(rows: MonitoringTaskRecord[]) {
  const first = rows[0]?.approvalState;
  return Boolean(first) && rows.every((row) => row.approvalState === first);
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card dark:border-white/[0.06]">
      <div className="border-b border-border px-3 py-2 dark:border-white/[0.06]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">{title}</p>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/35">{label}</p>
      <div className="mt-1 break-words text-[13px] text-foreground dark:text-foreground/85">{value}</div>
    </div>
  );
}

function RelatedActivityField({ label, value, status }: { label: string; value?: string | null; status?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0 dark:border-white/[0.06]">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[13px] text-foreground">{textValue(value)}</p>
      </div>
      <span className="shrink-0 text-[12px] text-muted-foreground">{textValue(status)}</span>
    </div>
  );
}

function MonitoringDetailDrawer({
  row,
  onClose,
  actions,
  variant = "default",
}: {
  row: MonitoringTaskRecord;
  onClose: () => void;
  actions?: React.ReactNode;
  /** Execution Monitoring memakai ringkasan kerja/eksekusi/kualitas/validasi. */
  variant?: "default" | "execution";
}) {
  const approval = optionValue(approvalStateOptions, row.approvalState);
  const execution = optionValue(executionStateOptions, row.executionState);
  const visibleStatus = humanMonitoringStatus(row);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="monitoring-detail-title" className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl dark:border-white/[0.08]">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 dark:border-white/[0.08]">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Monitoring Detail</p>
            <h2 id="monitoring-detail-title" className="mt-1 truncate text-[16px] font-semibold text-foreground">{row.jobDescription || row.masterJobName || row.panelName || row.unitName}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{row.unitName} · {row.divisionName ?? "-"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <DataGridStatusBadge value={visibleStatus} />
              <DataGridStatusBadge value={riskLabel(row)} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup detail monitoring">
            <X className="h-4 w-4" />
          </button>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-border bg-muted/20 px-4 py-2 dark:border-white/[0.08]">
            {actions}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {variant === "execution" ? (
            <>
              <DetailSection title="Work Summary">
                <DetailField label="Unit" value={row.unitName} />
                <DetailField label="Panel" value={textValue(row.panelName)} />
                <DetailField label="Job Description" value={textValue(row.jobDescription || row.masterJobName)} />
                <DetailField label="PIC" value={textValue(row.employeeName ?? row.employeeId)} />
                <DetailField label="Target" value={hoursValue(row.targetTotalHours ?? row.countdownTargetHours)} />
                <DetailField label="Deadline" value={row.countdownDeadline ? formatMonitoringDate(row.countdownDeadline) : "-"} />
              </DetailSection>

              <DetailSection title="Execution">
                <DetailField label="Actual Start" value={timeValue(row.actualStartTime ?? row.latestStartTime)} />
                <DetailField label="Actual Finish" value={timeValue(row.actualFinishTime ?? row.latestFinishTime)} />
                <DetailField label="Actual Minutes" value={minutesValue(row.actualMinutes)} />
                <DetailField label="Progress" value={`${row.progressPercent.toFixed(0)}%`} />
              </DetailSection>

              <DetailSection title="Quality">
                <DetailField label="QC Status" value={<DataGridStatusBadge value={optionValue(qcStatusOptions, row.qcStatus)} />} />
              </DetailSection>

              <DetailSection title="Validation">
                <DetailField label="Ledger" value={<DataGridStatusBadge value={optionValue(ledgerStateOptions, row.ledgerState)} />} />
                <DetailField label="Validation Status" value={optionValue(executionStateOptions, row.executionState)} />
              </DetailSection>

              <DetailSection title="Technical">
                <DetailField label="Plan ID" value={textValue(row.planId)} />
                <DetailField label="Countdown ID" value={textValue(row.countdownId)} />
                <DetailField label="Version" value={textValue(row.version)} />
                <DetailField label="Sync" value={<DataGridStatusBadge value={optionValue(syncStatusOptions, row.syncStatus)} />} />
                <DetailField label="Current Approval" value={<DataGridStatusBadge value={optionValue(approvalStateOptions, row.approvalState)} />} />
              </DetailSection>
            </>
          ) : null}

          {variant === "default" ? (
            <>
          <DetailSection title="Unit Information">
            <DetailField label="Unit" value={row.unitName} />
            <DetailField label="Customer" value={textValue(row.customerName)} />
            <DetailField label="Division" value={textValue(row.divisionName)} />
            <DetailField label="PIC" value={textValue(row.employeeName ?? row.employeeId)} />
            <DetailField label="Master Panel ID" value={textValue(row.masterPanelId)} />
          </DetailSection>

          <DetailSection title="Panel">
            <DetailField label="Panel" value={textValue(row.panelName)} />
            <DetailField label="Plan ID" value={textValue(row.planId)} />
            <DetailField label="Countdown ID" value={textValue(row.countdownId)} />
            <DetailField label="Sync" value={<DataGridStatusBadge value={optionValue(syncStatusOptions, row.syncStatus)} />} />
          </DetailSection>

          <DetailSection title="Job Description">
            <DetailField label="Job Description" value={textValue(row.jobDescription)} />
            <DetailField label="Master Job" value={textValue(row.masterJobName)} />
          </DetailSection>

          <DetailSection title="Instruction">
            <DetailField label="Instruction / Description" value={textValue(row.instructionText)} />
            <DetailField label="Notes" value={textValue(row.monitoringResult ?? row.qcNotes ?? row.manualExecution?.note)} />
          </DetailSection>

          <DetailSection title="Target Hours">
            <DetailField label="Initial Target" value={hoursValue(row.targetTotalHours ?? row.countdownTargetHours)} />
            <DetailField label="Today's Target" value={hoursValue(row.targetDailyHours)} />
            <DetailField label="Countdown Deadline" value={textValue(row.countdownDeadline)} />
            <DetailField label="Plan Date" value={formatMonitoringDate(row.taskDate)} />
          </DetailSection>

          <DetailSection title="Remaining Hours">
            <DetailField label="Remaining" value={hoursValue(row.remainingHours ?? row.countdownRemainingHours)} />
            <DetailField label="Progress" value={`${row.progressPercent.toFixed(0)}%`} />
            <DetailField label="Delay / Priority" value={<DataGridStatusBadge value={riskLabel(row)} />} />
            <DetailField label="Last Update" value={textValue(lastUpdateValue(row))} />
          </DetailSection>

          <DetailSection title="Approval Status">
            <DetailField label="Current Approval" value={<DataGridStatusBadge value={approval} />} />
            <DetailField label="Waiting Stage" value={row.approvalState && row.approvalState !== "APPROVED" ? approval : "-"} />
            <DetailField label="Version" value={textValue(row.version)} />
            <DetailField label="Ledger" value={<DataGridStatusBadge value={optionValue(ledgerStateOptions, row.ledgerState)} />} />
          </DetailSection>

          <DetailSection title="Execution Status">
            <DetailField label="Execution State" value={<DataGridStatusBadge value={execution} />} />
            <DetailField label="Status" value={<DataGridStatusBadge value={visibleStatus} />} />
            <DetailField label="Start Time" value={timeValue(row.actualStartTime ?? row.latestStartTime)} />
            <DetailField label="Finish Time" value={timeValue(row.actualFinishTime ?? row.latestFinishTime)} />
          </DetailSection>

          <DetailSection title="Actual Summary">
            <DetailField label="Actual Minutes" value={minutesValue(row.actualMinutes)} />
            <DetailField label="Actual Hours" value={hoursValue(row.totalActualHours)} />
            <DetailField label="Input Source" value={textValue(row.inputSource)} />
            <DetailField label="Manual Summary" value={textValue(row.manualExecution?.result ?? row.manualExecution?.note)} />
          </DetailSection>

          <DetailSection title="QC Summary">
            <DetailField label="QC Status" value={<DataGridStatusBadge value={optionValue(qcStatusOptions, row.qcStatus)} />} />
            <DetailField label="Result" value={textValue(row.qcResult)} />
            <DetailField label="Notes" value={textValue(row.qcNotes)} />
          </DetailSection>

          <section className="border border-border bg-card p-3 dark:border-white/[0.06]">
            <p className="border-b border-border pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:border-white/[0.06] dark:text-foreground/45">Related Activity</p>
            <RelatedActivityField label="Countdown" value={row.countdownId} status={row.countdownStatus} />
            <RelatedActivityField label="PR" value="Belum tersedia di snapshot monitoring" />
            <RelatedActivityField label="WO" value="Belum tersedia di snapshot monitoring" />
            <RelatedActivityField label="WOV" value="Belum tersedia di snapshot monitoring" />
          </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function RejectReasonDialog({
  count,
  stage,
  isSaving,
  onCancel,
  onSubmit,
}: {
  count: number;
  stage: string;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]">
      <div role="dialog" aria-modal="true" aria-labelledby="monitoring-reject-title" className="w-full max-w-md border border-border bg-card p-4 shadow-2xl dark:border-white/[0.08]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Reject Approval</p>
        <h2 id="monitoring-reject-title" className="mt-1 text-[16px] font-semibold text-foreground">Tolak {count} job plan?</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">Stage: {stage}. Alasan reject wajib diisi.</p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-3 min-h-28 w-full border border-border bg-background p-3 text-[13px] text-foreground outline-none focus:border-primary/50"
          placeholder="Tulis alasan reject"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <ActionButton onClick={onCancel} disabled={isSaving}>Batal</ActionButton>
          <ActionButton variant="danger" onClick={() => onSubmit(trimmedReason)} disabled={!trimmedReason || isSaving}>
            {isSaving ? "Menyimpan..." : "Reject"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

interface CorrectionDraft {
  jobDescription: string;
  employeeId: string;
  taskDate: string;
  startTime: string;
  durationMinutes: string;
  note: string;
  reason: string;
}

function createCorrectionDraft(row: MonitoringTaskRecord): CorrectionDraft {
  const plannedHours = row.targetDailyHours ?? row.targetTotalHours ?? null;
  return {
    jobDescription: row.jobDescription ?? "",
    employeeId: row.employeeId ?? "",
    taskDate: row.taskDate ?? "",
    startTime: row.planStartTime ?? "",
    durationMinutes: plannedHours === null ? "" : String(Math.round(plannedHours * 60)),
    note: "",
    reason: "",
  };
}

function CorrectionDialog({
  row,
  references,
  isSaving,
  error,
  onCancel,
  onSubmit,
}: {
  row: MonitoringTaskRecord;
  references: MonitoringReferences;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (draft: CorrectionDraft) => void;
}) {
  const [draft, setDraft] = useState<CorrectionDraft>(() => createCorrectionDraft(row));
  const stageLabel = optionValue(approvalStateOptions, row.approvalState);
  const canSubmit = Boolean(draft.reason.trim()) && Boolean(draft.jobDescription.trim()) && !isSaving;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]">
      <div role="dialog" aria-modal="true" aria-labelledby="monitoring-correct-title" className="max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto border border-border bg-card p-4 shadow-2xl dark:border-white/[0.08]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Correct Job Plan</p>
        <h2 id="monitoring-correct-title" className="mt-1 text-[16px] font-semibold text-foreground">
          Koreksi {row.unitName} · {row.jobDescription}
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Stage: {stageLabel}. Perbaikan tetap lewat alur approval Job Plan.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Jobdesc</p>
            <input
              value={draft.jobDescription}
              onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">PIC</p>
            <select
              value={draft.employeeId}
              onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none"
            >
              <option value="">Belum ditentukan</option>
              {references.employees.map((option) => (
                <option key={option.value} value={String(option.value)}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tanggal</p>
            <input
              type="date"
              value={draft.taskDate}
              onChange={(event) => setDraft({ ...draft, taskDate: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Jam mulai</p>
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Durasi (menit)</p>
            <input
              type="number"
              min={1}
              max={1440}
              value={draft.durationMinutes}
              onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Catatan</p>
            <textarea
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              rows={2}
              className="mt-1 w-full border border-border bg-background p-3 text-[13px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Alasan koreksi (wajib)</p>
            <textarea
              value={draft.reason}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
              rows={2}
              className="mt-1 w-full border border-border bg-background p-3 text-[13px] text-foreground outline-none focus:border-primary/50"
              placeholder="Contoh: durasi tertukar dengan plan lembur"
            />
          </div>
        </div>

        {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <ActionButton onClick={onCancel} disabled={isSaving}>Batal</ActionButton>
          <ActionButton variant="primary" onClick={() => onSubmit(draft)} disabled={!canSubmit}>
            {isSaving ? "Menyimpan..." : "Simpan Koreksi"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function parseUrlFilters(searchParams: URLSearchParams) {
  return searchParams
    .getAll("filter")
    .map(parseGridFilterToken)
    .filter((filter): filter is GridFilter => filter !== null);
}

function rowMatchesFilter(row: MonitoringTaskRecord, filter: GridFilter) {
  const value = String(row[filter.field as keyof MonitoringTaskRecord] ?? "");
  return filter.operator === "contains"
    ? value.toLowerCase().includes(filter.value.toLowerCase())
    : value === filter.value;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function MonitoringShell({
  activeMode, title, rows, meta, state, references, summary, noStartRows, noSubmitRows, user,
}: MonitoringShellProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const sweetAlert = useSweetAlert();
  const [selectedRow, setSelectedRow] = useState<MonitoringTaskRecord | null>(null);
  const [selectedRows, setSelectedRows] = useState<MonitoringTaskRecord[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargets, setRejectTargets] = useState<MonitoringTaskRecord[]>([]);
  const [correctionRow, setCorrectionRow] = useState<MonitoringTaskRecord | null>(null);
  const canApprove = user.permissions.includes(permissionCodes.reviewTask);
  const boardView = resolveMonitoringBoardView(searchParams.get("board"));
  const defaultApprovalStage = useMemo(
    () => resolveDefaultApprovalStage(user.roleName, user.scope.canViewAllUnits),
    [user.roleName, user.scope.canViewAllUnits],
  );
  const [stageFilter, setStageFilter] = useState<string>(defaultApprovalStage ?? "");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const activeDateTo = state.dateTo ?? state.date;
  const isRangeMode = Boolean(state.dateTo && state.dateTo !== state.date);
  const defaultFilters = useMemo(() => roleDefaultFilters(user), [user]);
  const urlFilters = useMemo(() => parseUrlFilters(searchParams), [searchParams]);
  const activeFilters = urlFilters.length > 0 ? urlFilters : state.filters;
  const filteredRows = useMemo(
    () => rows.filter((row) => activeFilters.every((filter) => rowMatchesFilter(row, filter))),
    [activeFilters, rows],
  );
  const smartView = searchParams.get("smartView") === "custom" ? "custom" : "scope";
  const scopeLabel = defaultFilters.length === 0
    ? "Semua data"
    : defaultFilters.map((filter) => filter.field === "divisionId"
      ? optionLabel(references.divisions, filter.value)
      : optionLabel(references.units, filter.value)).join(", ");

  const operationalColumns = useMemo<ColDef<MonitoringTaskRecord>[]>(
    () => [
      {
        headerName: "",
        width: 44,
        pinned: "left",
        sortable: false,
        filter: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
      },
      {
        headerName: "Date",
        field: "taskDate",
        pinned: "left",
        minWidth: 135,
        valueFormatter: ({ value }) => formatMonitoringDate(String(value ?? "")),
      },
      { headerName: "Division", field: "divisionName", minWidth: 120 },
      {
        headerName: "Unit",
        field: "unitName",
        minWidth: 130,
        cellRenderer: ({ value, data }: ICellRendererParams<MonitoringTaskRecord>) => (
          data ? <Link href={`/units/${String(data.carId)}`} className="text-app-accent-ink hover:text-app-accent-ink">{String(value ?? "-")}</Link> : "-"
        ),
      },
      { headerName: "PIC", field: "employeeName", minWidth: 135 },
      { headerName: "Panel", field: "panelName", minWidth: 150, flex: 0.7 },
      { headerName: "Job Description", field: "jobDescription", minWidth: 190, flex: 1, valueFormatter: ({ data }) => String(data?.jobDescription || data?.masterJobName || "-") },
      { headerName: "Instruction / Description", field: "instructionText", minWidth: 210, flex: 1, valueFormatter: ({ value }) => textValue(value) },
      { headerName: "Initial Target Hours", field: "targetTotalHours", minWidth: 135, type: "rightAligned", valueFormatter: ({ data }) => hoursValue(data?.targetTotalHours ?? data?.countdownTargetHours) },
      { headerName: "Remaining Hours", field: "remainingHours", minWidth: 125, type: "rightAligned", valueFormatter: ({ data }) => hoursValue(data?.remainingHours ?? data?.countdownRemainingHours) },
      { headerName: "Today's Target", field: "targetDailyHours", minWidth: 120, type: "rightAligned", valueFormatter: ({ value }) => hoursValue(value == null ? null : Number(value)) },
      { headerName: "Start Time", field: "actualStartTime", minWidth: 105, valueFormatter: ({ data }) => timeValue(data?.actualStartTime ?? data?.latestStartTime) },
      { headerName: "Finish Time", field: "actualFinishTime", minWidth: 110, valueFormatter: ({ data }) => timeValue(data?.actualFinishTime ?? data?.latestFinishTime) },
      {
        headerName: "Status",
        field: "executionStatus",
        minWidth: 125,
        valueFormatter: ({ data }) => humanMonitoringStatus(data),
        cellRenderer: ({ data }: ICellRendererParams<MonitoringTaskRecord>) => data ? (
          <div className="flex items-center gap-1.5">
            <DataGridStatusBadge value={humanMonitoringStatus(data)} />
            {data.hasDelayRisk ? <DataGridStatusBadge value="Delay Risk" /> : null}
          </div>
        ) : null,
      },
      { headerName: "Progress Percentage", field: "progressPercent", minWidth: 145, type: "rightAligned", valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(0)}%` },
      { headerName: "Notes", field: "monitoringResult", minWidth: 180, flex: 0.8, valueFormatter: ({ data }) => textValue(data?.monitoringResult ?? data?.qcNotes ?? data?.manualExecution?.note) },
      {
        headerName: "Action",
        pinned: "right",
        width: 105,
        sortable: false,
        filter: false,
        cellRenderer: ({ data }: ICellRendererParams<MonitoringTaskRecord>) => data ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedRow(data);
            }}
            className="h-7 border border-border px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Detail
          </button>
        ) : null,
      },
    ],
    [],
  );

  // Fungsi aksi dideklarasikan (hoisted) sehingga kolom bisa merujuk handler yang sama.
  const approvalColumns: ColDef<MonitoringTaskRecord>[] = [
    {
      headerName: "",
      width: 44,
      pinned: "left",
      sortable: false,
      filter: false,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { headerName: "Unit", field: "unitName", pinned: "left", minWidth: 140, flex: 0.8 },
    { headerName: "Panel", field: "panelName", minWidth: 160, flex: 1 },
    { headerName: "Job Description", field: "jobDescription", minWidth: 200, flex: 1.2 },
    { headerName: "Divisi", field: "divisionName", minWidth: 120 },
    { headerName: "PIC", field: "employeeName", minWidth: 150 },
    {
      headerName: "Target Jam",
      field: "targetTotalHours",
      minWidth: 100,
      cellClass: "text-right tabular-nums",
      valueFormatter: ({ value, data }) => {
        const planned = value ?? data?.targetDailyHours ?? null;
        return planned === null ? "-" : `${Number(planned).toFixed(1)} jam`;
      },
    },
    {
      headerName: "Stage",
      field: "approvalState",
      minWidth: 150,
      cellRenderer: ({ value }: ICellRendererParams<MonitoringTaskRecord>) => {
        const state = String(value ?? "");
        const tone = state === "MANAGEMENT_REVIEW"
          ? "border-warning/25 bg-warning/15 text-warning"
          : state === "UNIT_REVIEW"
            ? "border-info/25 bg-info/15 text-info"
            : "border-primary/25 bg-primary/10 text-app-accent-ink";
        return (
          <span className={`inline-flex border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${tone}`}>
            {optionValue(approvalStateOptions, state)}
          </span>
        );
      },
    },
    {
      headerName: "Tanggal",
      field: "taskDate",
      minWidth: 135,
      valueFormatter: ({ value }) => formatMonitoringDate(String(value ?? "")),
    },
    {
      headerName: "Tindakan",
      colId: "action",
      pinned: "right",
      minWidth: 235,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<MonitoringTaskRecord>) => {
        if (!data) return null;
        const disabled = !canApprove || !data.version || isBulkApproving;
        return (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedRow(data)}
              className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Review
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void approveRow(data)}
              className="border border-success/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => openRejectDialog([data])}
              className="border border-destructive/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => openCorrection(data)}
              className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Correct
            </button>
          </div>
        );
      },
    },
  ];

  const viewRows = useMemo(() => {
    if (boardView === "approval") {
      return filterApprovalQueueRows(filteredRows, (stageFilter || null) as JobPlanV2ApprovalState | null);
    }
    if (boardView === "execution") return filterExecutionRows(filteredRows);
    return filteredRows;
  }, [boardView, filteredRows, stageFilter]);

  // Execution Monitoring: kolom operasional tanpa field teknis (planId/coreId/version/ledger/sync).
  const executionColumns = useMemo<ColDef<MonitoringTaskRecord>[]>(() => [
    {
      headerName: "",
      width: 44,
      pinned: "left",
      sortable: false,
      filter: false,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    {
      headerName: "Unit",
      field: "unitName",
      pinned: "left",
      minWidth: 140,
      cellRenderer: ({ value, data }: ICellRendererParams<MonitoringTaskRecord>) => (
        data ? <Link href={`/units/${String(data.carId)}`} className="text-app-accent-ink hover:text-app-accent-ink">{String(value ?? "-")}</Link> : "-"
      ),
    },
    { headerName: "Divisi", field: "divisionName", minWidth: 120 },
    { headerName: "Panel", field: "panelName", minWidth: 150, flex: 0.7 },
    { headerName: "Job Description", field: "jobDescription", minWidth: 190, flex: 1, valueFormatter: ({ data }) => String(data?.jobDescription || data?.masterJobName || "-") },
    { headerName: "PIC", field: "employeeName", minWidth: 135 },
    {
      headerName: "Target Jam",
      field: "targetTotalHours",
      minWidth: 105,
      type: "rightAligned",
      valueFormatter: ({ data }) => hoursValue(data?.targetTotalHours ?? data?.countdownTargetHours),
    },
    {
      headerName: "Aktual",
      field: "totalActualHours",
      minWidth: 95,
      type: "rightAligned",
      valueFormatter: ({ value }) => hoursValue(value == null ? null : Number(value)),
    },
    {
      headerName: "Sisa",
      field: "remainingHours",
      minWidth: 95,
      type: "rightAligned",
      valueFormatter: ({ data }) => hoursValue(data?.remainingHours ?? data?.countdownRemainingHours),
    },
    {
      headerName: "Progress %",
      field: "progressPercent",
      minWidth: 110,
      type: "rightAligned",
      valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(0)}%`,
    },
    {
      headerName: "Status Eksekusi",
      field: "executionStatus",
      minWidth: 140,
      cellRenderer: ({ data }: ICellRendererParams<MonitoringTaskRecord>) => (
        data ? <DataGridStatusBadge value={humanMonitoringStatus(data)} /> : null
      ),
    },
    {
      headerName: "Deadline",
      field: "countdownDeadline",
      minWidth: 125,
      valueFormatter: ({ value }) => (value ? formatMonitoringDate(String(value)) : "-"),
    },
    {
      headerName: "Risiko",
      colId: "risk",
      minWidth: 115,
      valueGetter: ({ data }) => (data ? riskLabel(data) : ""),
      cellRenderer: ({ value }: ICellRendererParams<MonitoringTaskRecord>) => <DataGridStatusBadge value={String(value ?? "Normal")} />,
    },
    {
      headerName: "Tindakan",
      pinned: "right",
      width: 105,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<MonitoringTaskRecord>) => data ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedRow(data);
          }}
          className="h-7 border border-border px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Detail
        </button>
      ) : null,
    },
  ], []);

  const columns = boardView === "approval"
    ? approvalColumns
    : boardView === "execution"
      ? executionColumns
      : operationalColumns;

  function pushDate(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", value);
    if (isRangeMode) {
      p.set("dateTo", activeDateTo < value ? value : activeDateTo);
    } else {
      p.delete("dateTo");
    }
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function pushBoard(value: MonitoringBoardView) {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "operational") {
      p.delete("board");
    } else {
      p.set("board", value);
    }
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  // Approval Queue tidak terikat "hari ini": tanpa filter tanggal eksplisit,
  // rentang dilebarkan otomatis sekali (API monitoring berbasis rentang).
  useEffect(() => {
    if (boardView !== "approval") return;
    const window = resolveApprovalDateWindow(
      state.date,
      Boolean(searchParams.get("date") || searchParams.get("dateTo")),
    );
    if (!window) return;

    const p = new URLSearchParams(searchParams.toString());
    p.set("date", window.from);
    p.set("dateTo", window.to);
    router.replace(`${pathname}?${p.toString()}`);
  }, [boardView, pathname, router, searchParams, state.date]);

  function pushDateRange(range: { from: string; to: string }) {
    const p = new URLSearchParams(searchParams.toString());
    const start = range.from;
    const end = range.to < start ? start : range.to;
    p.set("date", start);
    p.set("dateTo", end);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyDateSelection(range: { from: string; to: string }) {
    if (range.from === range.to) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("date", range.from);
      p.delete("dateTo");
      p.set("page", "1");
      router.push(`${pathname}?${p.toString()}`);
      return;
    }

    pushDateRange(range);
  }

  function pushDateMode(value: "daily" | "range") {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "range") {
      p.set("dateTo", state.dateTo && state.dateTo !== state.date ? state.dateTo : addIsoDays(state.date, 1));
    } else {
      p.delete("dateTo");
    }
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function pushMode(value: "all" | "normal" | "overtime") {
    const p = new URLSearchParams(searchParams.toString());
    p.set("mode", value);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function pushFilters(nextFilters: GridFilter[], nextSmartView = "custom") {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("filter");
    for (const filter of nextFilters) p.append("filter", encodeGridFilterToken(filter));
    p.set("smartView", nextSmartView);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function updateFilter(field: string, value: string) {
    pushFilters(setFilter(activeFilters, field, value), "custom");
  }

  function resetFilters() {
    pushFilters(defaultFilters, "scope");
  }

  function setSmartView(value: "scope" | "custom") {
    if (value === "scope") resetFilters();
    else pushFilters(activeFilters, "custom");
  }

  function activeFilterChips() {
    return activeFilters.map((filter) => {
      if (filter.field === "divisionId") return { label: "Scope", value: optionLabel(references.divisions, filter.value) };
      if (filter.field === "carId") return { label: "Unit", value: optionLabel(references.units, filter.value) };
      if (filter.field === "employeeId") return { label: "PIC", value: optionLabel(references.employees, filter.value) };
      if (filter.field === "executionStatus") return { label: "Status", value: optionLabel(actualStatusOptions, filter.value) };
      if (filter.field === "approvalState") return { label: "Approval", value: optionLabel(approvalStateOptions, filter.value) };
      if (filter.field === "executionState") return { label: "Execution", value: optionLabel(executionStateOptions, filter.value) };
      if (filter.field === "qcStatus") return { label: "QC", value: optionLabel(qcStatusOptions, filter.value) };
      if (filter.field === "syncStatus") return { label: "Sync", value: optionLabel(syncStatusOptions, filter.value) };
      return { label: filter.field, value: filter.value };
    });
  }

  const approvableSelectedRows = selectedRows.filter((row) => row.planId && row.version && isReviewState(row.approvalState));
  const executionSelection = summarizeExecutionSelection(selectedRows);
  const selectedApprovalStage = approvableSelectedRows[0]?.approvalState ?? null;
  const selectedStageLabel = optionValue(approvalStateOptions, selectedApprovalStage);
  const canBulkReviewSelected = approvableSelectedRows.length > 0 && sameApprovalStage(approvableSelectedRows);

  // Dipakai aksi per baris maupun bulk; mutation tetap Job Plan V2, bukan tulis DB langsung.
  async function runReviewRows(
    targets: MonitoringTaskRecord[],
    action: "approve" | "reject",
    rejectReason?: string,
  ) {
    const reviewable = targets.filter((row) => row.planId && row.version && isReviewState(row.approvalState));
    if (!canApprove || reviewable.length === 0 || isBulkApproving) return;

    setIsBulkApproving(true);
    const failures: string[] = [];
    for (const row of reviewable) {
      const result = await mutateJobPlanV2Approval(row.planId, {
        action,
        userId: user.employeeId,
        commandId: createJobPlanV2CommandId(`monitoring-${action}`),
        expectedVersion: row.version ?? 0,
        rejectReason: rejectReason || undefined,
      });
      if (!result.success) failures.push(`${row.unitName} - ${row.jobDescription}: ${result.message}`);
    }
    setIsBulkApproving(false);
    setRejectDialogOpen(false);
    setRejectTargets([]);
    setSelectedRows([]);
    router.refresh();

    if (failures.length > 0) {
      sweetAlert.notifyError("Sebagian approval gagal", failures.join("\n"));
      return;
    }
    sweetAlert.notifySuccess("Approval tersimpan", `${reviewable.length} job plan berhasil diproses.`);
  }

  async function approveRow(row: MonitoringTaskRecord) {
    const confirmed = await sweetAlert.confirm({
      title: "Approve job plan ini?",
      description: `${row.unitName} · ${row.jobDescription} (${optionValue(approvalStateOptions, row.approvalState)})`,
      tone: "info",
      confirmLabel: "Approve",
    });
    if (!confirmed) return;
    await runReviewRows([row], "approve");
  }

  function openRejectDialog(targets: MonitoringTaskRecord[]) {
    setRejectTargets(targets);
    setRejectDialogOpen(true);
  }

  function openCorrection(row: MonitoringTaskRecord) {
    setCorrectionError(null);
    setCorrectionRow(row);
  }

  async function submitCorrection(draft: CorrectionDraft) {
    if (!correctionRow?.planId || !correctionRow.version) return;

    const start = draft.startTime ? parseTimeToMinutes(draft.startTime) : { value: null, error: null };
    if (start.error) {
      setCorrectionError(start.error);
      return;
    }
    const durationMinutes = draft.durationMinutes ? Number(draft.durationMinutes) : null;
    if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
      setCorrectionError("Durasi harus lebih dari 0 menit.");
      return;
    }

    setIsBulkApproving(true);
    setCorrectionError(null);
    const result = await mutateJobPlanV2Approval(correctionRow.planId, {
      action: "correct",
      userId: user.employeeId,
      commandId: createJobPlanV2CommandId("monitoring-correct"),
      expectedVersion: correctionRow.version,
      employeeId: draft.employeeId || undefined,
      taskDate: draft.taskDate || undefined,
      plannedStartMinute: start.value ?? undefined,
      plannedWorkMinutes: durationMinutes ?? undefined,
      jobDescription: draft.jobDescription.trim() || undefined,
      note: draft.note.trim() || undefined,
      reason: draft.reason.trim() || undefined,
    });
    setIsBulkApproving(false);

    if (!result.success) {
      setCorrectionError(result.message);
      return;
    }

    const corrected = correctionRow;
    setCorrectionRow(null);
    sweetAlert.notifySuccess("Koreksi tersimpan", `${corrected.unitName} · ${corrected.jobDescription} diperbarui.`);
    router.refresh();
  }

  async function bulkApprove() {
    if (!canBulkReviewSelected) return;
    const confirmed = await sweetAlert.confirm({
      title: `Approve ${approvableSelectedRows.length} job plan?`,
      description: `Semua pilihan berada pada stage ${selectedStageLabel}.`,
      tone: "info",
      confirmLabel: "Approve",
    });
    if (!confirmed) return;
    await runReviewRows(approvableSelectedRows, "approve");
  }

  return (
    <div className="space-y-2">
      {sweetAlert.alertElement}
      {/* ── Header ── */}
      <PageHeader
        eyebrow="Job Monitoring"
        title={title}
        actions={
          <>
            <button
              type="button"
              onClick={() => pushDateMode("daily")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                !isRangeMode
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Harian
            </button>
            <button
              type="button"
              onClick={() => pushDateMode("range")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                isRangeMode
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Rentang
            </button>
            {isRangeMode ? (
              <CompactDateRangeInput
                from={state.date}
                to={activeDateTo}
                onChange={applyDateSelection}
                selectionBehavior="single-or-range"
                className="w-64"
              />
            ) : (
              <CompactDateInput
                value={state.date}
                onChange={pushDate}
                className="w-40"
              />
            )}
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={() => pushMode("all")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "all"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => pushMode("normal")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "normal"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => pushMode("overtime")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "overtime"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Lembur
            </button>
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />Refresh
            </ActionButton>
          </>
        }
      />

      {/* ── Metrics ── */}
      <MetricBar items={[
        { label: "Aktif",         value: summary.activeWork, tone: "up" },
        { label: "No Start",      value: summary.noStart,   tone: summary.noStart  > 0 ? "warn" : undefined },
        { label: "No Submit",     value: summary.noSubmit,  tone: summary.noSubmit > 0 ? "warn" : undefined },
        { label: "Lembur Aktif",  value: summary.overtimeCount, tone: summary.overtimeCount > 0 ? "warn" : undefined },
      ]} />

      <div className="flex flex-wrap items-center gap-2 border border-border bg-card px-3 py-2">
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Smart View</span>
          <select value={boardView} onChange={(event) => pushBoard(event.target.value as MonitoringBoardView)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
            {monitoringBoardViewOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {boardView === "approval" ? (
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            Stage
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
              <option value="">Semua stage</option>
              {approvalStageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          Scope
          <select value={smartView} onChange={(event) => setSmartView(event.target.value as "scope" | "custom")} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
            <option value="scope">Default My Scope</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <span className="mx-1 h-5 w-px bg-border" />
        <select value={filterValue(activeFilters, "divisionId")} onChange={(event) => updateFilter("divisionId", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
          <option value="">Semua Divisi</option>
          {references.divisions.map((option) => <option key={option.value} value={String(option.value)}>{option.label}</option>)}
        </select>
        <select value={filterValue(activeFilters, "carId")} onChange={(event) => updateFilter("carId", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
          <option value="">Semua Unit</option>
          {references.units.map((option) => <option key={option.value} value={String(option.value)}>{option.label}</option>)}
        </select>
        <select value={filterValue(activeFilters, "employeeId")} onChange={(event) => updateFilter("employeeId", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
          <option value="">Semua PIC</option>
          {references.employees.map((option) => <option key={option.value} value={String(option.value)}>{option.label}</option>)}
        </select>
        <select value={filterValue(activeFilters, "executionStatus")} onChange={(event) => updateFilter("executionStatus", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
          <option value="">Semua Status</option>
          {actualStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" onClick={resetFilters} className="inline-flex h-8 items-center gap-1 border border-border px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
          <RefreshCcw className="h-3 w-3" /> Reset Filter
        </button>
        {canApprove && boardView !== "execution" ? (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Selected: {selectedRows.length}
            </span>
            <button type="button" disabled={!canBulkReviewSelected || isBulkApproving} onClick={() => void bulkApprove()} className="inline-flex h-8 items-center gap-1 border border-success/30 px-2 text-[12px] text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-40">
              Approve Selected {approvableSelectedRows.length > 0 ? `(${approvableSelectedRows.length})` : ""}
            </button>
            <button type="button" disabled={!canBulkReviewSelected || isBulkApproving} onClick={() => openRejectDialog(approvableSelectedRows)} className="inline-flex h-8 items-center gap-1 border border-destructive/30 px-2 text-[12px] text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40">
              Reject Selected
            </button>
            {approvableSelectedRows.length > 1 && !sameApprovalStage(approvableSelectedRows) ? (
              <span className="text-[11px] text-destructive">Pilih stage approval yang sama.</span>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <span className="px-2 text-[11px] text-muted-foreground">Default: {scopeLabel}</span>
          {activeFilterChips().map((chip) => (
            <span key={`${chip.label}-${chip.value}`} className="border border-border bg-muted px-2 py-1 text-[11px] text-foreground">
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {boardView === "approval" ? (
        <div className="flex flex-wrap items-center gap-2 border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-app-accent-ink/70">Rentang approval</span>
          <span className="text-foreground">
            {formatMonitoringDate(state.date)}
            {activeDateTo !== state.date ? ` – ${formatMonitoringDate(activeDateTo)}` : ""}
          </span>
          <span>· {viewRows.length} plan menunggu di stage ini</span>
          <span className="text-muted-foreground/70">Ubah lewat filter tanggal (Harian / Rentang) di atas.</span>
        </div>
      ) : null}

      {boardView === "execution" && selectedRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border border-border bg-card px-3 py-2 text-[12px] dark:border-white/[0.06]">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-app-accent-ink/70">
            {executionSelection.count} plan dipilih
          </span>
          <span className="text-muted-foreground">Target: <span className="font-mono text-foreground">{executionSelection.targetHours} jam</span></span>
          <span className="text-muted-foreground">Aktual: <span className="font-mono text-foreground">{executionSelection.actualHours} jam</span></span>
          <span className="text-muted-foreground">Sisa: <span className="font-mono text-foreground">{executionSelection.remainingHours} jam</span></span>
          <span className="text-muted-foreground">Rata-rata progress: <span className="font-mono text-foreground">{executionSelection.averageProgressPercent}%</span></span>
          <button
            type="button"
            onClick={() => setSelectedRows([])}
            className="ml-auto inline-flex h-7 items-center gap-1 border border-border px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" /> Bersihkan pilihan
          </button>
        </div>
      ) : null}

      <SmsAgGrid<MonitoringTaskRecord>
        heightClassName="h-[calc(100svh-340px)] min-h-[28rem]"
        rowData={viewRows}
        columnDefs={columns}
        rowSelection="multiple"
        pagination
        paginationPageSize={meta.limit}
        getRowId={(params) => String(params.data.planId)}
        onSelectionChanged={(event: SelectionChangedEvent<MonitoringTaskRecord>) => {
          setSelectedRows(event.api.getSelectedRows());
        }}
        onRowDoubleClicked={(event) => {
          if (event.data) setSelectedRow(event.data);
        }}
        emptyMessage={boardView === "approval"
          ? "Tidak ada job plan yang menunggu approval pada stage ini."
          : boardView === "execution"
            ? "Belum ada job plan yang berjalan pada rentang ini."
            : "Belum ada data monitoring."}
      />

      {/* ── Board lists ── */}
      {boardView === "operational" ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <BoardList title="No Start"  rows={noStartRows}  emptyMessage="Semua plan sudah mulai." />
          <BoardList title="No Submit" rows={noSubmitRows} emptyMessage="Tidak ada task tertahan." />
        </div>
      ) : null}

      {selectedRow ? (
        <MonitoringDetailDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          variant={boardView === "execution" ? "execution" : "default"}
          actions={canApprove && isReviewState(selectedRow.approvalState) && selectedRow.version ? (
            <>
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Stage: {optionValue(approvalStateOptions, selectedRow.approvalState)}
              </span>
              <ActionButton
                variant="success"
                disabled={isBulkApproving}
                onClick={() => {
                  const row = selectedRow;
                  setSelectedRow(null);
                  void approveRow(row);
                }}
              >
                Approve
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={isBulkApproving}
                onClick={() => {
                  const row = selectedRow;
                  setSelectedRow(null);
                  openRejectDialog([row]);
                }}
              >
                Reject
              </ActionButton>
              <ActionButton
                disabled={isBulkApproving}
                onClick={() => {
                  const row = selectedRow;
                  setSelectedRow(null);
                  openCorrection(row);
                }}
              >
                Correct
              </ActionButton>
            </>
          ) : null}
        />
      ) : null}

      {rejectDialogOpen ? (
        <RejectReasonDialog
          count={rejectTargets.length}
          stage={optionValue(approvalStateOptions, rejectTargets[0]?.approvalState)}
          isSaving={isBulkApproving}
          onCancel={() => setRejectDialogOpen(false)}
          onSubmit={(reason) => void runReviewRows(rejectTargets, "reject", reason)}
        />
      ) : null}

      {correctionRow ? (
        <CorrectionDialog
          row={correctionRow}
          references={references}
          isSaving={isBulkApproving}
          error={correctionError}
          onCancel={() => setCorrectionRow(null)}
          onSubmit={(draft) => void submitCorrection(draft)}
        />
      ) : null}
    </div>
  );
}
