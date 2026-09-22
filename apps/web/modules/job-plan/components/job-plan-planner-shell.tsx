"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createJobPlanV2,
  createJobPlanV2CommandId,
  fetchJobPlanV2List,
  mutateJobPlanV2Approval,
} from "@/shared/api/job-plan-v2";
import { SmsAgGrid, SmsGridDraftActions } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SmartSelectCellEditor, type SmartSelectOption } from "@/modules/units/components/master-panel-smart-select-editor";
import {
  buildCreateJobPlanV2Payload,
  buildEditDraftJobPlanV2Payload,
  createJobPlanV2Draft,
  minutesToDuration,
  minutesToTime,
  toLocalDateValue,
  toJobPlanV2DisplayRows,
  validateJobPlanV2Draft,
  type JobPlanV2DisplayRow,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanV2PlannerDraft,
} from "../job-plan-planner";
import { parseClipboardTsv } from "@/shared/datagrid/clipboard";
import { parseSmsDate, parseSmsDurationMinutes, parseSmsReference, parseSmsTime } from "@/shared/datagrid/parsers";

type PlannerMode = "planner" | "approval";
type PlannerRow = JobPlanV2DisplayRow | (JobPlanV2DisplayRow & JobPlanV2PlannerDraft & { editPlanId?: string; editVersion?: number });

interface JobPlanPlannerShellProps {
  userId: string;
  canCreate: boolean;
  canApprove: boolean;
  initialCoreId: string | null;
  initialDate: string | null;
  initialMode: string | null;
  countdowns: JobPlanCountdownOption[];
  employees: JobPlanEmployeeOption[];
}

function toOptions(items: Array<{ value: string; label: string; code?: string | null }>): SmartSelectOption[] {
  return items.map((item) => ({
    value: item.value,
    label: item.label,
    code: item.code,
  }));
}

function contextForCore(countdowns: JobPlanCountdownOption[], coreId: string | null) {
  return countdowns.find((item) => item.value === coreId) ?? null;
}

function draftToDisplay(
  draft: JobPlanV2PlannerDraft,
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
): PlannerRow {
  const countdown = contextForCore(countdowns, draft.coreId);
  const employee = employees.find((item) => item.value === draft.employeeId);
  const startMinute = Number(draft.startTime.slice(0, 2)) * 60 + Number(draft.startTime.slice(3, 5));
  const durationHour = Number(draft.durationText.slice(0, 2));
  const durationMinute = Number(draft.durationText.slice(3, 5));
  const duration = Number.isFinite(durationHour) && Number.isFinite(durationMinute)
    ? (durationHour * 60) + durationMinute
    : 0;

  return {
    ...draft,
    planId: null,
    kpId: countdown?.kpId ?? null,
    kpName: countdown?.kpName ?? null,
    qaIds: countdown?.qaIds ?? [],
    qaNames: countdown?.qaNames ?? [],
    unitName: countdown?.unitName ?? "-",
    panelName: countdown?.panelName ?? "-",
    instructionText: draft.note,
    employeeName: employee?.label ?? "",
    divisionName: countdown?.divisionName ?? "-",
    finishTime: minutesToTime(startMinute + duration),
    durationText: draft.durationText,
    targetTotalText: minutesToDuration(Math.round((countdown?.targetTotalHours ?? duration / 60) * 60)),
    remainingText: minutesToDuration(Math.round((countdown?.remainingHours ?? 0) * 60)),
    approval: "Draft",
    approvalState: "DRAFT",
    execution: "Belum Mulai",
    executionState: "NOT_STARTED",
    ledger: "Belum Diproses",
    ledgerState: "UNMATERIALIZED",
    sync: "Draft",
    version: null,
    accumulatedWorkMinutes: 0,
    persistedWorkMinutes: 0,
    unverifiedWorkMinutes: 0,
    isPriority: draft.isPriority,
  };
}

function resolveOption(value: string, options: SmartSelectOption[], label: string) {
  return parseSmsReference(value, options, label);
}

function copyPlannerValue(row: PlannerRow, field: string) {
  if (field === "coreId") return row.jobDescription;
  if (field === "employeeId") return row.employeeName;
  const value = row[field as keyof PlannerRow];
  return value == null ? "" : String(value);
}

function viewForMode(mode: PlannerMode) {
  if (mode === "approval") return "approval_queue";
  return "browse";
}

function initialPlannerMode(value: string | null): PlannerMode {
  if (value === "approval") return "approval";
  return "planner";
}

function isReviewState(value: string) {
  return value === "DIVISION_REVIEW" || value === "UNIT_REVIEW" || value === "MANAGEMENT_REVIEW";
}

function formatReportDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function uniqueByValue(options: Array<{ value: string; label: string }>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function statusLabel(row: PlannerRow) {
  if (row.executionState === "RUNNING") return "Berjalan";
  if (row.executionState === "HOLD") return "Hold";
  if (row.executionState === "FINISHED_PENDING_VALIDATION") return "Selesai";
  if (row.executionState === "VALIDATED") return "Tervalidasi";
  return row.approval;
}

function joinDistinct(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].join(" · ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildReportTableHtml(rows: PlannerRow[], meta: { date: string; kp: string; qa: string }) {
  const body = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.divisionName)}</td>
      <td>${escapeHtml(row.employeeName)}</td>
      <td>${escapeHtml(row.unitName)}</td>
      <td>${escapeHtml(row.panelName)}</td>
      <td>${escapeHtml(row.jobDescription)}</td>
      <td>${escapeHtml(row.instructionText || row.note || "")}</td>
      <td>${escapeHtml(row.targetTotalText)}</td>
      <td>${escapeHtml(row.remainingText)}</td>
      <td>${escapeHtml(`${row.taskDate} ${row.startTime}`)}</td>
      <td>${escapeHtml(`${row.taskDate} ${row.finishTime}`)}</td>
      <td>${escapeHtml(row.durationText)}</td>
      <td>${escapeHtml(joinDistinct([row.note, row.instructionText]))}</td>
      <td><span class="badge">${escapeHtml(statusLabel(row))}</span></td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laporan Job Plan</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #1f2933; font-size: 9px; }
    h1 { margin: 0 0 8px; font-size: 16px; letter-spacing: .04em; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #2b2b2b; color: #fff; padding: 5px; text-align: left; }
    td { border: 1px solid #d7d7d7; padding: 4px; vertical-align: top; }
    tr:nth-child(even) td { background: #f6f6f6; }
    .badge { display: inline-block; border-radius: 3px; background: #e9b872; color: #1f2933; padding: 2px 5px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>LAPORAN JOB PLAN</h1>
  <div class="meta">
    <div><strong>Tanggal:</strong> ${escapeHtml(formatReportDate(meta.date))}</div>
    <div><strong>KP:</strong> ${escapeHtml(meta.kp || "Semua KP")}</div>
    <div><strong>QA:</strong> ${escapeHtml(meta.qa || "Semua QA")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>TEAM</th><th>PERSONIL</th><th>UNIT</th><th>PANEL / PART</th><th>JOB DESCRIPTION</th><th>INTRUKSI</th><th>TOTAL TARGET</th><th>SISA TARGET</th><th>START</th><th>FINISH</th><th>TARGET HARI INI</th><th>CATATAN</th><th>STATUS</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="13">Belum ada data.</td></tr>`}</tbody>
  </table>
</body>
</html>`;
}

function sameApprovalStage(rows: PlannerRow[]) {
  const first = rows[0]?.approvalState;
  return Boolean(first) && rows.every((row) => row.approvalState === first);
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</div>
    </div>
  );
}

function JobPlanDetailDrawer({ row, onClose }: { row: PlannerRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="job-plan-detail-title" className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Detail Rencana</p>
            <h2 id="job-plan-detail-title" className="mt-1 truncate text-[16px] font-semibold text-foreground">{row.jobDescription}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{row.unitName} · {row.panelName}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup detail rencana">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <section className="border border-border bg-card p-3">
            <p className="border-b border-border pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Perencanaan</p>
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <DetailField label="Unit" value={row.unitName} />
              <DetailField label="Panel" value={row.panelName} />
              <DetailField label="Pekerjaan" value={row.jobDescription} />
              <DetailField label="Instruksi" value={row.note} />
              <DetailField label="Divisi" value={row.divisionName} />
              <DetailField label="PIC" value={row.employeeName} />
              <DetailField label="Tanggal" value={row.taskDate} />
              <DetailField label="Jadwal" value={`${row.startTime} - ${row.finishTime}`} />
            </div>
          </section>
          <section className="border border-border bg-card p-3">
            <p className="border-b border-border pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <DetailField label="Approval" value={<DataGridStatusBadge value={row.approval} />} />
              <DetailField label="Execution" value={<DataGridStatusBadge value={row.execution} />} />
              <DetailField label="Ledger" value={<DataGridStatusBadge value={row.ledger} />} />
              <DetailField label="Sync" value={<DataGridStatusBadge value={row.sync} />} />
            </div>
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
      <div role="dialog" aria-modal="true" aria-labelledby="job-plan-reject-title" className="w-full max-w-md border border-border bg-card p-4 shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tolak Approval</p>
        <h2 id="job-plan-reject-title" className="mt-1 text-[16px] font-semibold text-foreground">Tolak {count} rencana?</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">Tahap: {stage}. Alasan wajib diisi.</p>
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
            {isSaving ? "Menyimpan..." : "Tolak"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function JobPlanPlannerShell({
  userId,
  canCreate,
  canApprove,
  initialCoreId,
  initialDate,
  initialMode,
  countdowns,
  employees,
}: JobPlanPlannerShellProps) {
  const [items, setItems] = useState<JobPlanV2ReadItem[]>([]);
  const [drafts, setDrafts] = useState<JobPlanV2PlannerDraft[]>([]);
  const [editDrafts, setEditDrafts] = useState<Array<JobPlanV2PlannerDraft & { editPlanId: string; editVersion: number }>>([]);
  const [selectedRow, setSelectedRow] = useState<PlannerRow | null>(null);
  const [gridApi, setGridApi] = useState<GridApi<PlannerRow> | null>(null);
  const [mode, setMode] = useState<PlannerMode>(() => initialPlannerMode(initialMode));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<PlannerRow[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(initialDate ?? toLocalDateValue());
  const [kpFilter, setKpFilter] = useState("");
  const [qaFilter, setQaFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const sweetAlert = useSweetAlert();
  const selectedContext = useMemo(() => contextForCore(countdowns, initialCoreId), [countdowns, initialCoreId]);
  const countdownOptions = useMemo(() => toOptions(countdowns), [countdowns]);
  const employeeOptions = useMemo(() => toOptions(employees), [employees]);
  async function load() {
    setIsLoading(true);
    const result = await fetchJobPlanV2List({
      userId,
      view: viewForMode(mode),
      date: dateFilter,
      coreId: initialCoreId ?? undefined,
    });
    if (!result.success) {
      setError(result.message);
      setIsLoading(false);
      return;
    }
    setItems(result.result.items);
    setError(null);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
  }, [userId, initialCoreId, dateFilter, mode]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (drafts.length === 0 && editDrafts.length === 0) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts.length, editDrafts.length]);

  const rows = useMemo<PlannerRow[]>(() => [
    ...toJobPlanV2DisplayRows(items, countdowns, employees).map((row) => {
      const draft = editDrafts.find((item) => item.editPlanId === row.planId);
      return draft ? { ...draftToDisplay(draft, countdowns, employees), editPlanId: draft.editPlanId, editVersion: draft.editVersion } : row;
    }),
    ...drafts.map((draft) => draftToDisplay(draft, countdowns, employees)),
  ], [countdowns, drafts, editDrafts, employees, items]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (dateFilter && row.taskDate !== dateFilter) return false;
    if (kpFilter && row.kpId !== kpFilter) return false;
    if (qaFilter && !row.qaIds.includes(qaFilter)) return false;
    if (divisionFilter && row.divisionName !== divisionFilter) return false;
    if (statusFilter && row.approvalState !== statusFilter && row.executionState !== statusFilter) return false;
    return true;
  }), [dateFilter, divisionFilter, kpFilter, qaFilter, rows, statusFilter]);

  const kpOptions = useMemo(() => uniqueByValue(countdowns.map((item) => ({
    value: item.kpId ?? "",
    label: item.kpName ?? item.kpId ?? "",
  }))), [countdowns]);

  const qaOptions = useMemo(() => uniqueByValue(countdowns.flatMap((item) => (item.qaIds ?? []).map((value, index) => ({
    value,
    label: item.qaNames?.[index] ?? value,
  })))), [countdowns]);

  const divisionOptions = useMemo(() => uniqueByValue(rows.map((row) => ({
    value: row.divisionName,
    label: row.divisionName,
  }))), [rows]);

  const statusOptions = [
    ["DRAFT", "Draft"],
    ["DIVISION_REVIEW", "Review Divisi"],
    ["UNIT_REVIEW", "Review Unit"],
    ["MANAGEMENT_REVIEW", "Review Manajemen"],
    ["APPROVED", "Disetujui"],
    ["RUNNING", "Berjalan"],
    ["HOLD", "Ditahan"],
    ["FINISHED_PENDING_VALIDATION", "Selesai"],
    ["VALIDATED", "Tervalidasi"],
  ] as const;

  const approvableSelectedRows = selectedRows.filter((row) => !row.isNew && !row.editPlanId && isReviewState(row.approvalState));
  const canBulkReviewSelected = canApprove
    && approvableSelectedRows.length > 0
    && sameApprovalStage(approvableSelectedRows);

  const summaryItems = useMemo(() => {
    const draftCount = rows.filter((row) => row.approvalState === "DRAFT").length;
    const reviewCount = rows.filter((row) => isReviewState(row.approvalState)).length;
    const approvedCount = rows.filter((row) => row.approvalState === "APPROVED").length;
    const actualInputCount = rows.filter((row) => row.executionState === "FINISHED_PENDING_VALIDATION" || row.executionState === "VALIDATED").length;
    return [
      { label: "Draft", value: draftCount, tone: draftCount > 0 ? "warn" as const : undefined },
      { label: "Review", value: reviewCount, tone: reviewCount > 0 ? "warn" as const : undefined },
      { label: "Disetujui", value: approvedCount, tone: "up" as const },
      { label: "Hasil", value: actualInputCount, tone: "muted" as const },
    ];
  }, [rows]);

  const columnDefs = useMemo<ColDef<PlannerRow>[]>(() => [
    {
      headerName: "",
      width: 44,
      pinned: "left",
      sortable: false,
      filter: false,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { headerName: "TEAM", field: "divisionName", editable: false, minWidth: 125, pinned: "left" },
    {
      headerName: "PERSONIL",
      field: "employeeId",
      filterValueGetter: ({ data }) => data?.employeeName ?? "",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && employeeOptions.length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: employeeOptions },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? employeeOptions.find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.employeeName ?? "",
      minWidth: 155,
      flex: 0.8,
    },
    { headerName: "NAMA UNIT", field: "unitName", editable: false, minWidth: 120 },
    { headerName: "NAMA PANEL / PART", field: "panelName", editable: false, minWidth: 160, flex: 0.9 },
    {
      headerName: "JOB DESCRIPTION",
      field: "jobDescription",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 220,
      flex: 1.15,
    },
    {
      headerName: "INTRUKSI",
      field: "note",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 180,
      flex: 0.9,
      filterValueGetter: ({ data }) => data ? joinDistinct([data.instructionText, data.note]) : "",
      valueFormatter: ({ data }) => data ? joinDistinct([data.instructionText, data.note]) : "",
    },
    { headerName: "TOTAL TARGET", field: "targetTotalText", editable: false, minWidth: 115 },
    { headerName: "SISA TARGET", field: "remainingText", editable: false, minWidth: 110 },
    {
      headerName: "START",
      field: "startTime",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 135,
      filterValueGetter: ({ data }) => data ? `${formatReportDate(data.taskDate)} ${data.startTime}` : "",
      valueFormatter: ({ data }) => data ? `${formatReportDate(data.taskDate)} ${data.startTime}` : "",
    },
    {
      headerName: "FINISH",
      field: "finishTime",
      editable: false,
      minWidth: 135,
      filterValueGetter: ({ data }) => data ? `${formatReportDate(data.taskDate)} ${data.finishTime}` : "",
      valueFormatter: ({ data }) => data ? `${formatReportDate(data.taskDate)} ${data.finishTime}` : "",
    },
    { headerName: "TOTAL TARGET HARI INI", field: "durationText", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), minWidth: 150 },
    {
      headerName: "CATATAN / KETERANGAN",
      field: "note",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 190,
      flex: 0.9,
      filterValueGetter: ({ data }) => data ? joinDistinct([data.note, data.instructionText]) : "",
      valueFormatter: ({ data }) => data ? joinDistinct([data.note, data.instructionText]) : "",
    },
    {
      headerName: "STATUS",
      field: "approval",
      editable: false,
      minWidth: 140,
      filterValueGetter: ({ data }) => data ? statusLabel(data) : "",
      cellRenderer: ({ data }: ICellRendererParams<PlannerRow>) => data ? (
        <DataGridStatusBadge value={statusLabel(data)} />
      ) : null,
      pinned: "right",
    },
  ], [employeeOptions]);

  function addDraft() {
    const draft = createJobPlanV2Draft(selectedContext);
    const employeeId = employees.length === 1 ? employees[0].value : "";
    setDrafts((current) => [...current, {
      ...draft,
      employeeId,
      taskDate: initialDate ?? draft.taskDate,
      isOvertime: initialMode === "overtime",
    }]);
  }

  function updateDraft(event: CellValueChangedEvent<PlannerRow>) {
    const row = event.data;
    if (!row.isNew && !row.editPlanId) return;
    const next = {
      coreId: String(row.coreId ?? ""),
      employeeId: String(row.employeeId ?? ""),
      taskDate: String(row.taskDate ?? ""),
      startTime: String(row.startTime ?? ""),
      durationText: String(row.durationText ?? ""),
      jobDescription: String(row.jobDescription ?? ""),
      note: String(row.note ?? ""),
      isPriority: Boolean(row.isPriority),
      error: null,
    };
    if (row.editPlanId) {
      setEditDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? { ...draft, ...next } : draft));
      return;
    }
    setDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? {
      ...draft,
      ...next,
    } : draft));
  }

  async function handleGridKeyDown(event: CellKeyDownEvent<PlannerRow>) {
    const keyboardEvent = event.event as KeyboardEvent | undefined;
    if (!keyboardEvent || (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey)) return;

    const field = event.column.getColId();
    if (keyboardEvent.key.toLowerCase() === "c" && event.data) {
      const selectedRows = event.api.getSelectedRows();
      const copyRows = selectedRows.length > 1 ? selectedRows : [event.data];
      const text = copyRows.map((row) => copyPlannerValue(row, field)).join("\n");
      await navigator.clipboard?.writeText(text);
      keyboardEvent.preventDefault();
      return;
    }

    if (keyboardEvent.key.toLowerCase() !== "v" || !canCreate) return;
    const text = await navigator.clipboard?.readText();
    if (!text) return;

    keyboardEvent.preventDefault();
    const editableFields = ["coreId", "employeeId", "taskDate", "startTime", "durationText", "jobDescription"];
    const startField = editableFields.includes(field) ? field : "employeeId";
    const startFieldIndex = Math.max(0, editableFields.indexOf(startField));
    const matrix = parseClipboardTsv(text);
    const countdownContext = selectedContext;
    const baseDraftIndex = event.data?.isNew
      ? drafts.findIndex((draft) => draft.clientId === event.data?.clientId)
      : drafts.length;
    const nextDrafts = [...drafts];

    for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
      const draftIndex = (baseDraftIndex < 0 ? drafts.length : baseDraftIndex) + rowOffset;
      if (!nextDrafts[draftIndex]) nextDrafts[draftIndex] = createJobPlanV2Draft(countdownContext);
      let draft: JobPlanV2PlannerDraft = { ...nextDrafts[draftIndex], error: null };

      for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset += 1) {
        const targetField = editableFields[startFieldIndex + columnOffset];
        if (!targetField) break;
        const rawValue = matrix[rowOffset][columnOffset] ?? "";
        if (targetField === "coreId") {
          const parsed = resolveOption(rawValue, countdownOptions, "Countdown");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, coreId: parsed.value ?? "" };
        }
        if (targetField === "employeeId") {
          const parsed = resolveOption(rawValue, employeeOptions, "PIC");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, employeeId: parsed.value ?? "" };
        }
        if (targetField === "taskDate") {
          const parsed = parseSmsDate(rawValue, "Tanggal");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, taskDate: parsed.value ?? "" };
        }
        if (targetField === "startTime") {
          const parsed = parseSmsTime(rawValue, "Mulai");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, startTime: parsed.value ?? "" };
        }
        if (targetField === "durationText") {
          const parsed = parseSmsDurationMinutes(rawValue, "Durasi");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, durationText: rawValue.trim() };
        }
        if (targetField === "jobDescription") {
          draft = { ...draft, jobDescription: rawValue.trim() };
        }
      }
      nextDrafts[draftIndex] = draft;
    }

    setDrafts(nextDrafts);
  }

  async function saveDrafts() {
    if ((drafts.length === 0 && editDrafts.length === 0) || isSaving) return;

    const validated = drafts.map((row) => ({ ...row, error: validateJobPlanV2Draft(row) }));
    const validatedEdits = editDrafts.map((row) => ({ ...row, error: validateJobPlanV2Draft(row) }));
    const firstError = [...validated, ...validatedEdits].find((row) => row.error);
    if (firstError) {
      setDrafts(validated);
      setEditDrafts(validatedEdits);
      setError(firstError.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    const failed: JobPlanV2PlannerDraft[] = [];
    const failedEdits: Array<JobPlanV2PlannerDraft & { editPlanId: string; editVersion: number }> = [];

    for (const row of validated) {
      const result = await createJobPlanV2(buildCreateJobPlanV2Payload(row, userId, createJobPlanV2CommandId("web-job-plan")));
      if (!result.success) {
        failed.push({ ...row, error: result.message });
      }
    }
    for (const row of validatedEdits) {
      const result = await mutateJobPlanV2Approval(row.editPlanId, buildEditDraftJobPlanV2Payload(row, userId, createJobPlanV2CommandId("web-edit-draft"), row.editVersion));
      if (!result.success) {
        failedEdits.push({ ...row, error: result.message });
      }
    }

    setDrafts(failed);
    setEditDrafts(failedEdits);
    await load();
    setIsSaving(false);
    if (failed.length + failedEdits.length > 0) setError(`${failed.length + failedEdits.length} rencana belum tersimpan.`);
  }

  async function reviewRows(rowsToReview: PlannerRow[], action: "approve" | "reject", rejectReason?: string) {
    if (rowsToReview.length === 0 || isSaving) return;
    const validRows = rowsToReview.filter((row) => row.planId && row.version && isReviewState(row.approvalState));
    if (validRows.length !== rowsToReview.length || !sameApprovalStage(validRows)) {
      setError("Pilih rencana pada tahap persetujuan yang sama.");
      sweetAlert.notifyWarning("Persetujuan belum diproses", "Tahap persetujuan pada baris terpilih harus sama.");
      return;
    }
    if (action === "approve") {
      const confirmed = await sweetAlert.confirm({
        title: `Setujui ${validRows.length} rencana?`,
        description: "Data akan diteruskan ke tahap persetujuan berikutnya.",
        confirmLabel: "Setujui",
      });
      if (!confirmed) return;
    }
    if (action === "reject" && !rejectReason?.trim()) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanV2Approval(row.planId as string, {
        action,
        userId,
        commandId: createJobPlanV2CommandId(`web-${action}`),
        expectedVersion: row.version as number,
        rejectReason: rejectReason || undefined,
      });
      if (!result.success) {
        failed += 1;
        setError(result.message);
      }
    }
    await load();
    setIsSaving(false);
    if (failed === 0) {
      sweetAlert.notifySuccess(action === "approve" ? "Rencana disetujui" : "Rencana ditolak", `${validRows.length} baris berhasil diproses.`);
      setSelectedRows([]);
    }
  }

  async function submitRejectReason(reason: string) {
    setRejectDialogOpen(false);
    await reviewRows(selectedRows, "reject", reason);
  }

  function openReportPrint() {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      setError("Popup browser ditahan. Izinkan popup untuk mencetak laporan.");
      return;
    }
    const visibleRows: PlannerRow[] = [];
    gridApi?.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) visibleRows.push(node.data);
    });
    const kpLabel = kpOptions.find((option) => option.value === kpFilter)?.label ?? "";
    const qaLabel = qaOptions.find((option) => option.value === qaFilter)?.label ?? "";
    popup.document.write(buildReportTableHtml(gridApi ? visibleRows : filteredRows, { date: dateFilter, kp: kpLabel, qa: qaLabel }));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="space-y-3">
      <div className="border border-border bg-card px-3 py-2 shadow-sm">
        <PageHeader
          eyebrow="PERENCANAAN KERJA"
          title="Rencana Pekerjaan"
          actions={(
            <div className="flex items-center gap-1">
              {(["planner", "approval"] as const).map((nextMode) => (
                <ActionButton key={nextMode} variant={mode === nextMode ? "primary" : "default"} onClick={() => setMode(nextMode)}>
                  {nextMode === "planner" ? "Perencanaan" : "Persetujuan"}
                </ActionButton>
              ))}
            </div>
          )}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
          {selectedContext ? (
            <p className="text-[12px] text-muted-foreground">
              {selectedContext.unitName} · {selectedContext.panelName ?? "-"} · {selectedContext.jobName ?? selectedContext.label}
            </p>
          ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">{filteredRows.length} dari {rows.length} baris</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summaryItems.slice(0, 3).map((item) => {
            const toneClass = item.tone === "warn"
              ? "text-app-accent-ink"
              : item.tone === "up"
                ? "text-success"
                : "text-foreground";
            return (
              <span key={item.label} className="border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                {item.label}: <strong className={`font-mono ${toneClass}`}>{item.value}</strong>
              </span>
            );
          })}
        </div>
      </div>
      <div className="relative z-40 flex flex-wrap items-end gap-2 border border-border bg-card px-3 py-2">
        <div className="min-w-[9rem] flex-1">
          <span className="text-[11px] text-muted-foreground">Tanggal</span>
          <CompactDateInput value={dateFilter} onChange={setDateFilter} className="mt-1" panelClassName="z-[100] w-[17rem]" />
        </div>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          KP
          <select value={kpFilter} onChange={(event) => setKpFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua KP</option>
            {kpOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          QA
          <select value={qaFilter} onChange={(event) => setQaFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua QA</option>
            {qaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Divisi
          <select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua divisi</option>
            {divisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua status</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <ActionButton onClick={() => {
          setDateFilter(initialDate ?? toLocalDateValue());
          setKpFilter("");
          setQaFilter("");
          setDivisionFilter("");
          setStatusFilter("");
        }}>Reset</ActionButton>
        <ActionButton onClick={openReportPrint}>Print</ActionButton>
      </div>
      {error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SmsGridDraftActions
          canCreate={canCreate && mode === "planner"}
          hasDrafts={drafts.length + editDrafts.length > 0}
          isSaving={isSaving}
          onAdd={addDraft}
          onSave={() => void saveDrafts()}
          onCancel={() => {
            setDrafts([]);
            setEditDrafts([]);
            setError(null);
          }}
        />
        {mode === "approval" && canApprove ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{selectedRows.length} dipilih</span>
            <ActionButton variant="success" disabled={!canBulkReviewSelected || isSaving} onClick={() => void reviewRows(approvableSelectedRows, "approve")}>Setujui</ActionButton>
            <ActionButton variant="danger" disabled={!canBulkReviewSelected || isSaving} onClick={() => setRejectDialogOpen(true)}>Tolak</ActionButton>
            {approvableSelectedRows.length > 0 && !sameApprovalStage(approvableSelectedRows) ? <span className="text-destructive">Tahap persetujuan harus sama.</span> : null}
          </div>
        ) : null}
      </div>
      {canCreate && employees.length === 0 ? (
        <p className="border border-warning/25 bg-warning/[0.06] px-3 py-2 text-sm text-warning">
          Referensi PIC belum tersedia. Pembuatan rencana ditahan agar tidak menebak PIC.
        </p>
      ) : null}
      <SmsAgGrid<PlannerRow>
        heightClassName="h-[calc(100vh-330px)] min-h-[28rem]"
        rowData={filteredRows}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.clientId}
        loading={isLoading}
        rowSelection="multiple"
        defaultColDef={{
          floatingFilter: true,
          filter: "agTextColumnFilter",
          filterParams: {
            trimInput: true,
            debounceMs: 150,
          },
        }}
        onGridReady={(event: GridReadyEvent<PlannerRow>) => setGridApi(event.api)}
        onSelectionChanged={(event: SelectionChangedEvent<PlannerRow>) => setSelectedRows(event.api.getSelectedRows())}
        onCellValueChanged={updateDraft}
        onCellKeyDown={(event) => {
          if ("column" in event) void handleGridKeyDown(event);
        }}
        onRowDoubleClicked={(event) => setSelectedRow(event.data ?? null)}
        emptyMessage="Belum ada Job Plan."
      />
      {selectedRow && !selectedRow.isNew && !selectedRow.editPlanId ? (
        <JobPlanDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      ) : null}
      {rejectDialogOpen ? (
        <RejectReasonDialog
          count={approvableSelectedRows.length}
          stage={approvableSelectedRows[0]?.approval ?? "-"}
          isSaving={isSaving}
          onCancel={() => setRejectDialogOpen(false)}
          onSubmit={(reason) => void submitRejectReason(reason)}
        />
      ) : null}
      {sweetAlert.alertElement}
    </div>
  );
}
