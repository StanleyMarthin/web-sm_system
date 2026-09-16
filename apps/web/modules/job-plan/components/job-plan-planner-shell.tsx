"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createJobPlanV2,
  createJobPlanV2CommandId,
  fetchJobPlanV2List,
  manualExecuteJobPlanV2,
  mutateJobPlanV2Approval,
} from "@/shared/api/job-plan-v2";
import { SmsAgGrid, SmsGridDraftActions } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, MetricBar, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SmartSelectCellEditor, type SmartSelectOption } from "@/modules/units/components/master-panel-smart-select-editor";
import {
  buildCreateJobPlanV2Payload,
  buildEditDraftJobPlanV2Payload,
  buildManualExecutionJobPlanV2Payload,
  createManualExecutionDraft,
  createJobPlanV2Draft,
  minutesToDuration,
  minutesToTime,
  toJobPlanV2DisplayRows,
  validateManualExecutionDraft,
  validateJobPlanV2Draft,
  type JobPlanV2DisplayRow,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanV2ManualExecutionDraft,
  type JobPlanV2PlannerDraft,
} from "../job-plan-planner";
import { parseClipboardTsv } from "@/shared/datagrid/clipboard";
import { parseSmsDate, parseSmsDurationMinutes, parseSmsReference, parseSmsTime } from "@/shared/datagrid/parsers";

type PlannerMode = "planner" | "approval" | "execution";
type PlannerRow = JobPlanV2DisplayRow | (JobPlanV2DisplayRow & JobPlanV2PlannerDraft & { editPlanId?: string; editVersion?: number });
type SmartView = "default" | "draft" | "approval" | "execution";

interface JobPlanPlannerShellProps {
  userId: string;
  canCreate: boolean;
  canApprove: boolean;
  canExecute: boolean;
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
    unitName: countdown?.unitName ?? "-",
    panelName: countdown?.panelName ?? "-",
    employeeName: employee?.label ?? "",
    divisionName: countdown?.divisionName ?? "-",
    finishTime: minutesToTime(startMinute + duration),
    durationText: draft.durationText,
    approval: "Draft",
    approvalState: "DRAFT",
    execution: "Belum Mulai",
    executionState: "NOT_STARTED",
    ledger: "Belum Diproses",
    ledgerState: "UNMATERIALIZED",
    sync: "Draft",
    version: null,
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
  if (mode === "execution") return "execution";
  return "browse";
}

function initialPlannerMode(value: string | null): PlannerMode {
  if (value === "approval") return "approval";
  if (value === "execution") return "execution";
  return "planner";
}

function isReviewState(value: string) {
  return value === "DIVISION_REVIEW" || value === "UNIT_REVIEW" || value === "MANAGEMENT_REVIEW";
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
  canExecute,
  initialCoreId,
  initialDate,
  initialMode,
  countdowns,
  employees,
}: JobPlanPlannerShellProps) {
  const [items, setItems] = useState<JobPlanV2ReadItem[]>([]);
  const [drafts, setDrafts] = useState<JobPlanV2PlannerDraft[]>([]);
  const [editDrafts, setEditDrafts] = useState<Array<JobPlanV2PlannerDraft & { editPlanId: string; editVersion: number }>>([]);
  const [manualDraft, setManualDraft] = useState<JobPlanV2ManualExecutionDraft | null>(null);
  const [selectedRow, setSelectedRow] = useState<PlannerRow | null>(null);
  const [mode, setMode] = useState<PlannerMode>(() => initialPlannerMode(initialMode));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<PlannerRow[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [smartView, setSmartView] = useState<SmartView>("default");
  const [dateFilter, setDateFilter] = useState(initialDate ?? "");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
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
      date: initialDate ?? undefined,
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
  }, [userId, initialCoreId, initialDate, mode]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (drafts.length === 0 && editDrafts.length === 0 && !manualDraft) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts.length, editDrafts.length, manualDraft]);

  const rows = useMemo<PlannerRow[]>(() => [
    ...toJobPlanV2DisplayRows(items, countdowns, employees).map((row) => {
      const draft = editDrafts.find((item) => item.editPlanId === row.planId);
      return draft ? { ...draftToDisplay(draft, countdowns, employees), editPlanId: draft.editPlanId, editVersion: draft.editVersion } : row;
    }),
    ...drafts.map((draft) => draftToDisplay(draft, countdowns, employees)),
  ], [countdowns, drafts, editDrafts, employees, items]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (dateFilter && row.taskDate !== dateFilter) return false;
    if (divisionFilter && row.divisionName !== divisionFilter) return false;
    if (employeeFilter && row.employeeId !== employeeFilter) return false;
    if (statusFilter && row.approvalState !== statusFilter && row.executionState !== statusFilter) return false;
    if (smartView === "draft" && row.approvalState !== "DRAFT") return false;
    if (smartView === "approval" && !isReviewState(row.approvalState)) return false;
    if (smartView === "execution" && row.approvalState !== "APPROVED") return false;
    return true;
  }), [dateFilter, divisionFilter, employeeFilter, rows, smartView, statusFilter]);

  const divisionOptions = useMemo(() => [...new Set(rows
    .map((row) => row.divisionName)
    .filter((value) => value && value !== "-"))].sort((a, b) => a.localeCompare(b)), [rows]);

  const statusOptions = [
    ["DRAFT", "Draft"],
    ["DIVISION_REVIEW", "Review Divisi"],
    ["UNIT_REVIEW", "Review Unit"],
    ["MANAGEMENT_REVIEW", "Review Manajemen"],
    ["APPROVED", "Disetujui"],
    ["REJECTED", "Ditolak"],
    ["CANCELLED", "Dibatalkan"],
    ["NOT_STARTED", "Belum Mulai"],
    ["RUNNING", "Berjalan"],
    ["HOLD", "Ditahan"],
    ["FINISHED_PENDING_VALIDATION", "Menunggu Validasi"],
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
    { headerName: "Unit", field: "unitName", editable: false, minWidth: 125, pinned: "left" },
    { headerName: "Panel", field: "panelName", editable: false, minWidth: 150, flex: 0.9 },
    {
      headerName: "Pekerjaan",
      field: "jobDescription",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 220,
      flex: 1.15,
    },
    {
      headerName: "Instruksi",
      field: "note",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      minWidth: 180,
      flex: 0.9,
    },
    { headerName: "Divisi", field: "divisionName", editable: false, minWidth: 115 },
    {
      headerName: "PIC",
      field: "employeeId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && employeeOptions.length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: employeeOptions },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value, data }) => data?.isNew
        ? employeeOptions.find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.employeeName ?? "",
      minWidth: 140,
      flex: 0.8,
    },
    { headerName: "Tanggal", field: "taskDate", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), cellEditor: "agDateStringCellEditor", minWidth: 115 },
    { headerName: "Mulai", field: "startTime", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), minWidth: 85 },
    { headerName: "Target Jam", field: "durationText", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), minWidth: 105 },
    { headerName: "Estimasi Selesai", field: "finishTime", editable: false, minWidth: 125 },
    {
      headerName: "Status",
      field: "approval",
      editable: false,
      minWidth: 140,
      cellRenderer: ({ data }: ICellRendererParams<PlannerRow>) => data ? (
        <DataGridStatusBadge value={mode === "execution" ? data.execution : data.approval} />
      ) : null,
    },
    {
      headerName: "Tindakan",
      field: "error",
      editable: false,
      minWidth: 230,
      pinned: "right",
      cellRenderer: ({ data }: ICellRendererParams<PlannerRow>) => {
        if (!data) return null;
        if (data.isNew || data.editPlanId) {
          return data.error ? <span className="text-[12px] text-destructive">{data.error}</span> : <span className="text-[12px] text-muted-foreground">Belum disimpan</span>;
        }
        return (
          <div className="flex h-full items-center gap-1">
            <button type="button" className="border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted" onClick={() => setSelectedRow(data)}>Detail</button>
            {canCreate && data.approvalState === "DRAFT" ? (
              <>
                <button type="button" className="border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted" onClick={() => startEditDraft(data)}>Ubah</button>
                <button type="button" className="border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted" onClick={() => void submitDraft(data)}>Ajukan</button>
              </>
            ) : null}
            {canApprove && ["DIVISION_REVIEW", "UNIT_REVIEW", "MANAGEMENT_REVIEW"].includes(data.approvalState) ? (
              <>
                <button type="button" className="border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted" onClick={() => void reviewDraft(data, "approve")}>Setujui</button>
                <button type="button" className="border border-border px-2 py-1 text-[11px] text-destructive hover:bg-muted" onClick={() => void reviewDraft(data, "reject")}>Tolak</button>
              </>
            ) : null}
            {canExecute && data.approvalState === "APPROVED" && data.executionState === "NOT_STARTED" ? (
              <button type="button" className="border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted" onClick={() => setManualDraft(createManualExecutionDraft(data))}>Input Hasil</button>
            ) : null}
          </div>
        );
      },
    },
  ], [canApprove, canCreate, canExecute, employeeOptions, mode]);

  const manualColumnDefs = useMemo<ColDef<JobPlanV2ManualExecutionDraft>[]>(() => [
    { headerName: "Mulai Aktual", field: "actualStart", editable: true, minWidth: 160, flex: 0.8 },
    { headerName: "Selesai Aktual", field: "actualFinish", editable: true, minWidth: 160, flex: 0.8 },
    { headerName: "Durasi Aktual", field: "actualMinutesText", editable: true, minWidth: 105 },
    { headerName: "Hasil", field: "result", editable: true, minWidth: 180, flex: 1 },
    { headerName: "Catatan", field: "note", editable: true, minWidth: 180, flex: 1 },
    { headerName: "Lampiran", field: "attachmentRef", editable: true, minWidth: 150, flex: 0.8 },
    {
      headerName: "Status",
      field: "error",
      editable: false,
      minWidth: 170,
      cellRenderer: ({ data }: ICellRendererParams<JobPlanV2ManualExecutionDraft>) => (
        data?.error ? <span className="text-[12px] text-destructive">{data.error}</span> : <span className="text-[12px] text-muted-foreground">Draft hasil</span>
      ),
    },
  ], []);

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

  function startEditDraft(row: PlannerRow) {
    if (!row.planId || !row.version) return;
    const planId = row.planId;
    const version = row.version;
    if (editDrafts.some((draft) => draft.editPlanId === planId)) return;
    setEditDrafts((current) => [...current, {
      clientId: `edit-${planId}`,
      isNew: true,
      editPlanId: planId,
      editVersion: version,
      coreId: row.coreId,
      employeeId: row.employeeId,
      taskDate: row.taskDate,
      startTime: row.startTime,
      durationText: row.durationText,
      jobDescription: row.jobDescription,
      note: row.note,
      isOvertime: false,
      isRework: false,
      isPriority: row.isPriority,
      error: null,
    }]);
  }

  async function submitDraft(row: PlannerRow) {
    if (!row.planId || !row.version || isSaving) return;
    setIsSaving(true);
    const result = await mutateJobPlanV2Approval(row.planId, {
      action: "submit",
      userId,
      commandId: createJobPlanV2CommandId("web-submit"),
      expectedVersion: row.version,
    });
    if (!result.success) setError(result.message);
    await load();
    setIsSaving(false);
  }

  async function cancelDraft(row: PlannerRow) {
    if (!row.planId || !row.version || isSaving) return;
    const reason = window.prompt("Alasan cancel draft");
    if (!reason?.trim()) return;
    setIsSaving(true);
    const result = await mutateJobPlanV2Approval(row.planId, {
      action: "cancel",
      userId,
      commandId: createJobPlanV2CommandId("web-cancel"),
      expectedVersion: row.version,
      reason,
    });
    if (!result.success) setError(result.message);
    await load();
    setIsSaving(false);
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

  async function reviewDraft(row: PlannerRow, action: "approve" | "reject") {
    if (!row.planId || !row.version || isSaving) return;
    if (action === "reject") {
      setSelectedRows([row]);
      setRejectDialogOpen(true);
      return;
    }
    await reviewRows([row], action);
  }

  async function submitRejectReason(reason: string) {
    setRejectDialogOpen(false);
    await reviewRows(selectedRows, "reject", reason);
  }

  async function saveManualExecution() {
    if (!manualDraft || isSaving) return;
    const errorMessage = validateManualExecutionDraft(manualDraft);
    if (errorMessage) {
      setManualDraft({ ...manualDraft, error: errorMessage });
      return;
    }
    setIsSaving(true);
    const result = await manualExecuteJobPlanV2(
      manualDraft.planId,
      buildManualExecutionJobPlanV2Payload(manualDraft, userId, createJobPlanV2CommandId("web-manual-exec")),
    );
    if (!result.success) {
      setManualDraft({ ...manualDraft, error: result.message });
      setError(result.message);
    } else {
      setManualDraft(null);
      await load();
    }
    setIsSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="border border-border bg-card px-4 py-3">
        <PageHeader
          eyebrow="Perencanaan Kerja"
          title="Rencana Pekerjaan"
          actions={(
            <div className="flex items-center gap-1">
              {(["planner", "approval", "execution"] as const).map((nextMode) => (
                <ActionButton key={nextMode} variant={mode === nextMode ? "primary" : "default"} onClick={() => setMode(nextMode)}>
                  {nextMode === "planner" ? "Perencanaan" : nextMode === "approval" ? "Persetujuan" : "Pelaksanaan"}
                </ActionButton>
              ))}
            </div>
          )}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
          {selectedContext ? (
            <p className="text-[13px] text-muted-foreground">
              {selectedContext.unitName} · {selectedContext.panelName ?? "-"} · {selectedContext.jobName ?? selectedContext.label}
            </p>
          ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">{filteredRows.length} dari {rows.length} baris</p>
        </div>
      </div>
      <MetricBar items={summaryItems} />
      <div className="flex flex-wrap items-end gap-2 border border-border bg-card px-3 py-3">
        <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
          Tampilan
          <select value={smartView} onChange={(event) => setSmartView(event.target.value as SmartView)} className="mt-1 h-9 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="default">Semua rencana</option>
            <option value="draft">Draft saya</option>
            <option value="approval">Menunggu persetujuan</option>
            <option value="execution">Siap dikerjakan</option>
          </select>
        </label>
        <div className="min-w-[10rem] flex-1">
          <span className="text-[11px] text-muted-foreground">Tanggal</span>
          <CompactDateInput value={dateFilter} onChange={setDateFilter} className="mt-1" />
        </div>
        <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
          Divisi
          <select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)} className="mt-1 h-9 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua divisi</option>
            {divisionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
          PIC
          <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="mt-1 h-9 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua PIC</option>
            {employees.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-9 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua status</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <ActionButton onClick={() => {
          setSmartView("default");
          setDateFilter(initialDate ?? "");
          setDivisionFilter("");
          setEmployeeFilter("");
          setStatusFilter("");
        }}>Reset</ActionButton>
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
      {manualDraft ? (
        <div className="space-y-2 border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Input Hasil Cadangan</p>
              <h2 className="text-sm font-semibold text-foreground">Input Hasil Pekerjaan</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="border border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted" onClick={() => setManualDraft(null)}>Batal</button>
              <button type="button" className="border border-primary px-3 py-2 text-[12px] text-primary hover:bg-primary/10 disabled:opacity-50" disabled={isSaving} onClick={() => void saveManualExecution()}>
                {isSaving ? "Menyimpan..." : "Simpan Hasil"}
              </button>
            </div>
          </div>
          <SmsAgGrid<JobPlanV2ManualExecutionDraft>
            heightClassName="h-44"
            rowData={[manualDraft]}
            columnDefs={manualColumnDefs}
            getRowId={(params) => params.data.clientId}
            onCellValueChanged={(event) => setManualDraft({ ...event.data, error: null })}
        emptyMessage="Belum ada hasil pekerjaan."
          />
        </div>
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
