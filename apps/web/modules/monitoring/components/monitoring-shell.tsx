"use client";

import { useMemo, useState } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
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
import { createJobPlanCommandId, mutateJobPlanApproval } from "@/shared/api/job-plan/job-plan-runtime";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, CompactDateRangeInput, EmptyRow, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

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

function addDaysIso(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split("-").map((value) => Number.parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
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

function isReviewState(value: string | null | undefined) {
  return value === "DIVISION_REVIEW" || value === "UNIT_REVIEW" || value === "MANAGEMENT_REVIEW";
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

function MonitoringDetailDrawer({ row, onClose }: { row: MonitoringTaskRecord; onClose: () => void }) {
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <DetailSection title="Unit Information">
            <DetailField label="Unit" value={row.unitName} />
            <DetailField label="Customer" value={textValue(row.customerName)} />
            <DetailField label="Division" value={textValue(row.divisionName)} />
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
  const canApprove = user.permissions.includes(permissionCodes.reviewTask);
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

  const columns = useMemo<ColDef<MonitoringTaskRecord>[]>(
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
      p.set("dateTo", state.dateTo && state.dateTo !== state.date ? state.dateTo : addDaysIso(state.date, 1));
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
  const selectedApprovalStage = approvableSelectedRows[0]?.approvalState ?? null;
  const selectedStageLabel = optionValue(approvalStateOptions, selectedApprovalStage);
  const canBulkReviewSelected = approvableSelectedRows.length > 0 && sameApprovalStage(approvableSelectedRows);

  async function runBulkReview(action: "approve" | "reject", rejectReason?: string) {
    if (!canApprove || !canBulkReviewSelected || isBulkApproving) return;

    setIsBulkApproving(true);
    const failures: string[] = [];
    for (const row of approvableSelectedRows) {
      const result = await mutateJobPlanApproval(row.planId, {
        action,
        userId: user.employeeId,
        commandId: createJobPlanCommandId(`monitoring-${action}`),
        expectedVersion: row.version ?? 0,
        rejectReason: rejectReason || undefined,
      });
      if (!result.success) failures.push(`${row.unitName} - ${row.jobDescription}: ${result.message}`);
    }
    setIsBulkApproving(false);
    setRejectDialogOpen(false);
    setSelectedRows([]);
    router.refresh();
    if (failures.length > 0) {
      sweetAlert.notifyError("Sebagian approval gagal", failures.join("\n"));
      return;
    }
    sweetAlert.notifySuccess("Approval tersimpan", `${approvableSelectedRows.length} job plan berhasil diproses.`);
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
    await runBulkReview("approve");
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
          Smart View
          <select value={smartView} onChange={(event) => setSmartView(event.target.value as "scope" | "custom")} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none">
            <option value="scope">Default My Scope</option>
            <option value="custom">Custom</option>
          </select>
        </label>
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
        {canApprove ? (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Selected: {selectedRows.length}
            </span>
            <button type="button" disabled={!canBulkReviewSelected || isBulkApproving} onClick={() => void bulkApprove()} className="inline-flex h-8 items-center gap-1 border border-success/30 px-2 text-[12px] text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-40">
              Approve {approvableSelectedRows.length > 0 ? `(${approvableSelectedRows.length})` : ""}
            </button>
            <button type="button" disabled={!canBulkReviewSelected || isBulkApproving} onClick={() => setRejectDialogOpen(true)} className="inline-flex h-8 items-center gap-1 border border-destructive/30 px-2 text-[12px] text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40">
              Reject
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
      <SmsAgGrid<MonitoringTaskRecord>
        heightClassName="h-[calc(100svh-340px)] min-h-[28rem]"
        rowData={filteredRows}
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
        emptyMessage="Belum ada data monitoring."
      />

      {/* ── Board lists ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <BoardList title="No Start"  rows={noStartRows}  emptyMessage="Semua plan sudah mulai." />
        <BoardList title="No Submit" rows={noSubmitRows} emptyMessage="Tidak ada task tertahan." />
      </div>

      {selectedRow ? (
        <MonitoringDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      ) : null}

      {rejectDialogOpen ? (
        <RejectReasonDialog
          count={approvableSelectedRows.length}
          stage={selectedStageLabel}
          isSaving={isBulkApproving}
          onCancel={() => setRejectDialogOpen(false)}
          onSubmit={(reason) => void runBulkReview("reject", reason)}
        />
      ) : null}
    </div>
  );
}
