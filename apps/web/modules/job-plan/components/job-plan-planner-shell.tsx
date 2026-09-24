"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
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
  createEditDraftFromRow,
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
import { parseSmsDurationMinutes, parseSmsReference } from "@/shared/datagrid/parsers";

type PlannerMode = "planner" | "approval";
type WorkMode = "normal" | "overtime" | "holiday_overtime";
type PlannerRow = JobPlanV2DisplayRow | (JobPlanV2DisplayRow & JobPlanV2PlannerDraft & { editPlanId?: string; editVersion?: number });

interface JobPlanDivisionOption {
  value: string;
  label: string;
  code?: string | null;
  isTeknis?: boolean | null;
  isTechnical?: boolean | null;
}

interface JobPlanPlannerShellProps {
  userId: string;
  canCreate: boolean;
  canApprove: boolean;
  initialCoreId: string | null;
  initialDate: string | null;
  initialMode: string | null;
  countdowns: JobPlanCountdownOption[];
  employees: JobPlanEmployeeOption[];
  divisions: JobPlanDivisionOption[];
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

function contextForDraft(countdowns: JobPlanCountdownOption[], draft: Pick<JobPlanV2PlannerDraft, "coreId" | "divisionId" | "carId" | "panelId">) {
  return contextForCore(countdowns, draft.coreId)
    ?? countdowns.find((item) =>
      item.divisionId === draft.divisionId
      && item.carId === draft.carId
      && item.panelId === draft.panelId
    )
    ?? null;
}

function startTimeForWorkMode(workMode: WorkMode) {
  if (workMode === "overtime") return "17:00";
  return "08:00";
}

function isOvertimeMode(workMode: WorkMode) {
  return workMode !== "normal";
}

function draftToDisplay(
  draft: JobPlanV2PlannerDraft,
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
): PlannerRow {
  const countdown = contextForDraft(countdowns, draft);
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
    workMode: draft.workMode,
    kpId: countdown?.kpId ?? null,
    kpName: countdown?.kpName ?? null,
    qaIds: countdown?.qaIds ?? [],
    qaNames: countdown?.qaNames ?? [],
    unitName: countdown?.unitName ?? draft.carId ?? "-",
    panelName: countdown?.panelName ?? "-",
    instructionText: draft.note,
    employeeName: employee?.label ?? "",
    divisionName: countdown?.divisionName ?? countdowns.find((item) => item.divisionId === draft.divisionId)?.divisionName ?? "-",
    finishTime: minutesToTime(startMinute + duration),
    durationText: draft.durationText,
    targetTotalText: minutesToDuration(Math.round((countdown?.targetTotalHours ?? duration / 60) * 60)),
    remainingText: minutesToDuration(Math.round((countdown?.remainingHours ?? 0) * 60)),
    approval: "Belum Disimpan",
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
  const exact = parseSmsReference(value, options, label);
  if (!exact.error) return exact;
  const query = value.trim().toLowerCase();
  if (!query) return exact;
  const matches = options.filter((option) => `${option.label} ${option.code ?? ""} ${option.value}`.toLowerCase().includes(query));
  if (matches.length === 1) return { value: matches[0].value } as const;
  if (matches.length > 1) return { value: null, error: `${label} "${value}" cocok ke beberapa pilihan.` } as const;
  return exact;
}

function copyPlannerValue(row: PlannerRow, field: string) {
  if (field === "coreId") return row.jobDescription;
  if (field === "employeeId") return row.employeeName;
  if (field === "divisionId") return row.divisionName;
  if (field === "carId") return row.unitName;
  if (field === "panelId") return row.panelName;
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

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusLabel(row: PlannerRow) {
  if (row.isNew || row.editPlanId) return "Belum Disimpan";
  if (row.executionState === "RUNNING") return "Berjalan";
  if (row.executionState === "HOLD") return "Hold";
  if (row.executionState === "FINISHED_PENDING_VALIDATION") return "Selesai";
  if (row.executionState === "VALIDATED") return "Tervalidasi";
  return row.approval;
}

function joinDistinct(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].join(" · ");
}

function reportMonthTitle(value: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date).toUpperCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function printTeamColor(team: string) {
  const normalized = team.toUpperCase();
  if (normalized.includes("BODY WORK")) return { background: "#f47c2c", color: "#111827" };
  if (normalized.includes("BODY PAINT")) return { background: "#d98795", color: "#111827" };
  if (normalized.includes("MECHANIC")) return { background: "#ef7373", color: "#111827" };
  if (normalized.includes("INTERIOR")) return { background: "#f5c95c", color: "#111827" };
  if (normalized.includes("CHROME")) return { background: "#9fb7c9", color: "#111827" };
  return { background: "#73c7df", color: "#111827" };
}

function buildReportTableHtml(rows: PlannerRow[], meta: { date: string; kp: string; qa: string }) {
  const title = `MONITORING PLAN & ACTUAL KINERJA HARIAN ALL TEAM ( ${reportMonthTitle(meta.date)} ) - Google Spreadsheet`;
  const sortedRows = [...rows].sort((left, right) =>
    left.divisionName.localeCompare(right.divisionName)
    || left.employeeName.localeCompare(right.employeeName)
    || left.unitName.localeCompare(right.unitName)
    || left.startTime.localeCompare(right.startTime)
  );
  const body = sortedRows.map((row) => {
    const color = printTeamColor(row.divisionName);
    return `
    <tr>
      <td class="team-cell" style="background:${color.background};color:${color.color}">${escapeHtml(row.divisionName)}</td>
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
    </tr>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; color: #111827; font-size: 8.5px; }
    .titlebar {
      position: relative;
      margin-bottom: 5px;
      background: #075f75;
      color: #fff;
      padding: 8px 44px;
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .02em;
    }
    .titlebar img { position: absolute; left: 10px; top: 5px; width: 24px; height: 24px; object-fit: contain; }
    .date-title { margin: 0 0 6px; color: #ff0000; text-align: center; font-size: 13px; font-weight: 800; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 6px; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #13aee0; background: #75c9dd; color: #000; padding: 5px 4px; text-align: center; font-size: 8px; font-weight: 800; }
    th.plan-group { background: #75c9dd; }
    th.target-today { background: #339638; color: #fff; }
    td { border: 1px solid #62c4e8; padding: 4px 3px; vertical-align: middle; }
    td:nth-child(8) { background: #0878bd; color: #fff; font-weight: 800; text-align: center; }
    td:nth-child(9), td:nth-child(10), td:nth-child(11) { text-align: center; font-weight: 700; }
    td:nth-child(11) { background: #339638; color: #fff; }
    .team-cell { font-weight: 800; text-align: center; }
  </style>
</head>
<body>
  <div class="titlebar">
    <img src="/favicon.ico" alt="" />
    MONITORING LAPORAN PLAN & ACTUAL KINERJA HARIAN ALL TEAM
  </div>
  <p class="date-title">JOB DESCRIPTIONS : ${escapeHtml(formatReportDate(meta.date))}</p>
  <div class="meta">
    <div><strong>Tanggal:</strong> ${escapeHtml(formatReportDate(meta.date))}</div>
    <div><strong>KP:</strong> ${escapeHtml(meta.kp || "Semua KP")}</div>
    <div><strong>QA:</strong> ${escapeHtml(meta.qa || "Semua QA")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th rowspan="2">TEAM</th>
        <th rowspan="2">PERSONIL</th>
        <th rowspan="2">NAMA UNIT</th>
        <th rowspan="2">NAMA PANEL / PART</th>
        <th rowspan="2">JOB DESCRIPTION</th>
        <th rowspan="2">KETERANGAN</th>
        <th colspan="4" class="plan-group">PLAN</th>
        <th rowspan="2" class="target-today">TARGET</th>
        <th rowspan="2">CATATAN / KETERANGAN</th>
      </tr>
      <tr>
        <th>TARGET AWAL</th>
        <th>SISA TARGET AWAL</th>
        <th>START</th>
        <th>FINISH</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="12">Belum ada data.</td></tr>`}</tbody>
  </table>
</body>
</html>`;
}

function sameApprovalStage(rows: PlannerRow[]) {
  const first = rows[0]?.approvalState;
  return Boolean(first) && rows.every((row) => row.approvalState === first);
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
  divisions,
}: JobPlanPlannerShellProps) {
  const [items, setItems] = useState<JobPlanV2ReadItem[]>([]);
  const [drafts, setDrafts] = useState<JobPlanV2PlannerDraft[]>([]);
  const [editDrafts, setEditDrafts] = useState<Array<JobPlanV2PlannerDraft & { editPlanId: string; editVersion: number }>>([]);
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
  const technicalDivisionOptions = useMemo(() => {
    const fromReferences = divisions
      .filter((item) => item.isTechnical === true || item.isTeknis === true)
      .map((item) => ({ value: item.value, label: item.label }));
    const fallback = [
      ...employees.map((item) => ({ value: String(item.divisionId ?? ""), label: item.divisionName ?? "" })),
      ...countdowns.map((item) => ({ value: String(item.divisionId ?? ""), label: item.divisionName })),
    ];
    return uniqueByValue((fromReferences.length > 0 ? fromReferences : fallback).filter((item) => item.value && item.label));
  }, [countdowns, divisions, employees]);

  function teamOptions() {
    return technicalDivisionOptions;
  }

  function rowDivisionId(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    return numberValue(row?.divisionId);
  }

  function rowCarId(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    return String(row?.carId ?? "");
  }

  function rowPanelId(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    return numberValue(row?.panelId);
  }

  function personOptions(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const source = divisionId === null ? employees : employees.filter((item) => item.divisionId === divisionId);
    return toOptions(source);
  }

  function unitOptions(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    return uniqueByValue(countdowns
      .filter((item) => divisionId === null || item.divisionId === divisionId)
      .map((item) => ({ value: item.carId, label: item.unitName })));
  }

  function panelOptions(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const carId = rowCarId(row);
    return uniqueByValue(countdowns
      .filter((item) => (divisionId === null || item.divisionId === divisionId) && (!carId || item.carId === carId))
      .map((item) => ({ value: String(item.panelId ?? ""), label: item.panelName ?? "-" })));
  }

  function jobOptions(row: Partial<PlannerRow> | Partial<JobPlanV2PlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const carId = rowCarId(row);
    const panelId = rowPanelId(row);
    return countdowns
      .filter((item) =>
        (divisionId === null || item.divisionId === divisionId)
        && (!carId || item.carId === carId)
        && (panelId === null || item.panelId === panelId)
      )
      .map((item) => ({
        value: item.value,
        label: `${item.jobName ?? item.label} · ${minutesToDuration(Math.round((item.availablePlanHours ?? item.remainingHours) * 60))}`,
      }));
  }

  const workModeOptions = useMemo<SmartSelectOption[]>(() => [
    { value: "normal", label: "Normal 08:00-17:00" },
    { value: "overtime", label: "Lembur 17:00-22:00" },
    { value: "holiday_overtime", label: "Lembur Libur 08:00-16:00" },
  ], []);

  function normalizeDraftSelection(row: JobPlanV2PlannerDraft): JobPlanV2PlannerDraft {
    let next = { ...row };
    const divisionOptionsForRow = teamOptions();
    if (next.divisionId === null && divisionOptionsForRow.length === 1) next.divisionId = numberValue(divisionOptionsForRow[0].value);
    if (next.divisionId !== null && !divisionOptionsForRow.some((option) => option.value === String(next.divisionId))) {
      next = { ...next, divisionId: null, carId: "", panelId: null, coreId: "", employeeId: "", jobDescription: "" };
    }

    const availableEmployees = personOptions(next);
    if (next.employeeId && !availableEmployees.some((option) => option.value === next.employeeId)) next.employeeId = "";
    if (!next.employeeId && availableEmployees.length === 1) next.employeeId = availableEmployees[0].value;

    const availableUnits = unitOptions(next);
    if (next.carId && !availableUnits.some((option) => option.value === next.carId)) {
      next = { ...next, carId: "", panelId: null, coreId: "", jobDescription: "" };
    }
    if (!next.carId && availableUnits.length === 1) next.carId = availableUnits[0].value;

    const availablePanels = panelOptions(next);
    if (next.panelId !== null && !availablePanels.some((option) => option.value === String(next.panelId))) {
      next = { ...next, panelId: null, coreId: "", jobDescription: "" };
    }
    if (next.panelId === null && availablePanels.length === 1) next.panelId = numberValue(availablePanels[0].value);

    const availableJobs = jobOptions(next);
    if (next.coreId && !availableJobs.some((option) => option.value === next.coreId)) next = { ...next, coreId: "", jobDescription: "" };
    if (!next.coreId && availableJobs.length === 1) next.coreId = availableJobs[0].value;

    const countdown = contextForCore(countdowns, next.coreId);
    if (countdown) {
      next = {
        ...next,
        divisionId: countdown.divisionId,
        carId: countdown.carId,
        panelId: countdown.panelId ?? null,
        jobDescription: countdown.jobName ?? countdown.label,
      };
    }
    return {
      ...next,
      startTime: startTimeForWorkMode(next.workMode),
      isOvertime: isOvertimeMode(next.workMode),
    };
  }

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
  const submittableSelectedRows = selectedRows.filter((row) => !row.isNew && !row.editPlanId && row.approvalState === "DRAFT" && row.planId && row.version);
  const editableSelectedRows = selectedRows.filter((row) => !row.isNew && !row.editPlanId && row.approvalState === "DRAFT" && row.planId && row.version);
  const cancellableSelectedRows = selectedRows.filter((row) => row.approvalState === "DRAFT" && (row.planId || row.editPlanId) && (row.version || row.editVersion));
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
    {
      headerName: "TEAM",
      field: "divisionId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && teamOptions().length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: teamOptions() },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      filterValueGetter: ({ data }) => data?.divisionName ?? "",
      valueFormatter: ({ data, value }) => data?.isNew || data?.editPlanId
        ? teamOptions().find((option) => option.value === String(value ?? ""))?.label ?? data?.divisionName ?? ""
        : data?.divisionName ?? "",
      minWidth: 125,
      pinned: "left",
    },
    {
      headerName: "PERSONIL",
      field: "employeeId",
      filterValueGetter: ({ data }) => data?.employeeName ?? "",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && personOptions(data).length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: personOptions(data) }),
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? personOptions(data).find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.employeeName ?? "",
      minWidth: 155,
      flex: 0.8,
    },
    {
      headerName: "NAMA UNIT",
      field: "carId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && unitOptions(data).length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: unitOptions(data) }),
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      filterValueGetter: ({ data }) => data?.unitName ?? "",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? unitOptions(data).find((option) => option.value === String(value ?? ""))?.label ?? data?.unitName ?? ""
        : data?.unitName ?? "",
      minWidth: 120,
    },
    {
      headerName: "NAMA PANEL / PART",
      field: "panelId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && panelOptions(data).length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: panelOptions(data) }),
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      filterValueGetter: ({ data }) => data?.panelName ?? "",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? panelOptions(data).find((option) => option.value === String(value ?? ""))?.label ?? data?.panelName ?? ""
        : data?.panelName ?? "",
      minWidth: 160,
      flex: 0.9,
    },
    {
      headerName: "JOB DESCRIPTION",
      field: "coreId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && jobOptions(data).length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: jobOptions(data) }),
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      filterValueGetter: ({ data }) => data?.jobDescription ?? "",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? jobOptions(data).find((option) => option.value === String(value ?? ""))?.label?.split(" · ")[0] ?? data?.jobDescription ?? ""
        : data?.jobDescription ?? "",
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
    {
      headerName: "MODE",
      field: "workMode",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId),
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: workModeOptions },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value }) => workModeOptions.find((option) => option.value === String(value ?? ""))?.label ?? "Normal 08:00-17:00",
      minWidth: 135,
    },
    { headerName: "TOTAL TARGET", field: "targetTotalText", editable: false, minWidth: 115 },
    { headerName: "SISA TARGET", field: "remainingText", editable: false, minWidth: 110 },
    { headerName: "TOTAL TARGET HARI INI", field: "durationText", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), minWidth: 150 },
    {
      headerName: "START",
      field: "startTime",
      editable: false,
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
  ], [countdowns, employees, technicalDivisionOptions, workModeOptions]);

  function addDraft() {
    const draft = createJobPlanV2Draft(selectedContext);
    const nextDraft = {
      ...draft,
      taskDate: initialDate ?? draft.taskDate,
      workMode: initialMode === "overtime" ? "overtime" : draft.workMode,
      isOvertime: initialMode === "overtime",
    };
    setDrafts((current) => [...current, normalizeDraftSelection(nextDraft)]);
  }

  function updateDraft(event: CellValueChangedEvent<PlannerRow>) {
    const row = event.data;
    if (!row.isNew && !row.editPlanId) return;
    const field = event.column.getColId();
    const next = {
      workMode: (String(row.workMode ?? "normal") as WorkMode),
      coreId: String(row.coreId ?? ""),
      divisionId: numberValue(row.divisionId),
      carId: String(row.carId ?? ""),
      panelId: numberValue(row.panelId),
      employeeId: String(row.employeeId ?? ""),
      taskDate: String(row.taskDate ?? ""),
      startTime: String(row.startTime ?? ""),
      durationText: String(row.durationText ?? ""),
      jobDescription: String(row.jobDescription ?? ""),
      note: String(row.note ?? ""),
      isOvertime: isOvertimeMode(String(row.workMode ?? "normal") as WorkMode),
      isRework: false,
      isPriority: Boolean(row.isPriority),
      error: null,
    };
    if (field === "workMode") {
      next.startTime = startTimeForWorkMode(next.workMode);
      next.isOvertime = isOvertimeMode(next.workMode);
    }
    if (field === "divisionId") {
      next.carId = "";
      next.panelId = null;
      next.coreId = "";
      next.employeeId = "";
      next.jobDescription = "";
    }
    if (field === "carId") {
      next.panelId = null;
      next.coreId = "";
      next.jobDescription = "";
    }
    if (field === "panelId") {
      next.coreId = "";
      next.jobDescription = "";
    }
    if (row.editPlanId) {
      const currentDraft = editDrafts.find((draft) => draft.clientId === row.clientId);
      const normalized = normalizeDraftSelection({
        ...(currentDraft ?? createJobPlanV2Draft(contextForCore(countdowns, row.coreId))),
        ...next,
      });
      setEditDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? { ...draft, ...normalized } : draft));
      return;
    }
    const currentDraft = drafts.find((draft) => draft.clientId === row.clientId);
    const normalized = normalizeDraftSelection({
      ...(currentDraft ?? createJobPlanV2Draft(contextForCore(countdowns, row.coreId))),
      ...next,
    });
    setDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? {
      ...draft,
      ...normalized,
    } : draft));
  }

  async function handleGridKeyDown(event: CellKeyDownEvent<PlannerRow>) {
    const keyboardEvent = event.event as KeyboardEvent | undefined;
    if (!keyboardEvent) return;

    const field = event.column.getColId();
    if (keyboardEvent.key === "Enter" && canCreate && mode === "planner" && event.data?.isNew && (field === "durationText" || field === "note")) {
      keyboardEvent.preventDefault();
      addDraft();
      return;
    }

    if (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey) return;

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
    const editableFields = ["divisionId", "employeeId", "carId", "panelId", "coreId", "note", "workMode", "durationText"];
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
      if (!nextDrafts[draftIndex]) nextDrafts[draftIndex] = normalizeDraftSelection(createJobPlanV2Draft(countdownContext));
      let draft: JobPlanV2PlannerDraft = { ...nextDrafts[draftIndex], error: null };

      for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset += 1) {
        const targetField = editableFields[startFieldIndex + columnOffset];
        if (!targetField) break;
        const rawValue = matrix[rowOffset][columnOffset] ?? "";
        if (targetField === "divisionId") {
          const parsed = resolveOption(rawValue, teamOptions(), "Team");
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            divisionId: numberValue(parsed.value),
            carId: "",
            panelId: null,
            coreId: "",
            employeeId: "",
            jobDescription: "",
          };
        }
        if (targetField === "carId") {
          const parsed = resolveOption(rawValue, unitOptions(draft), "Unit");
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            carId: parsed.value ?? "",
            panelId: null,
            coreId: "",
            jobDescription: "",
          };
        }
        if (targetField === "panelId") {
          const parsed = resolveOption(rawValue, panelOptions(draft), "Panel");
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            panelId: numberValue(parsed.value),
            coreId: "",
            jobDescription: "",
          };
        }
        if (targetField === "coreId") {
          const parsed = resolveOption(rawValue, jobOptions(draft), "Jobdesc");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, coreId: parsed.value ?? "" };
        }
        if (targetField === "employeeId") {
          const parsed = resolveOption(rawValue, personOptions(draft), "PIC");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, employeeId: parsed.value ?? "" };
        }
        if (targetField === "durationText") {
          const parsed = parseSmsDurationMinutes(rawValue, "Durasi");
          draft = parsed.error ? { ...draft, error: parsed.error } : { ...draft, durationText: rawValue.trim() };
        }
        if (targetField === "workMode") {
          const parsed = resolveOption(rawValue, workModeOptions, "Mode");
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            workMode: (parsed.value ?? "normal") as WorkMode,
          };
        }
        if (targetField === "note") {
          draft = { ...draft, note: rawValue.trim() };
        }
      }
      nextDrafts[draftIndex] = normalizeDraftSelection(draft);
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

  async function submitRows(rowsToSubmit: PlannerRow[]) {
    if (rowsToSubmit.length === 0 || isSaving) return;
    const validRows = rowsToSubmit.filter((row) => row.planId && row.version && row.approvalState === "DRAFT");
    if (validRows.length !== rowsToSubmit.length) {
      setError("Pilih rencana draft yang sudah tersimpan.");
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: `Ajukan ${validRows.length} rencana?`,
      description: "Rencana akan masuk ke Review Divisi.",
      confirmLabel: "Ajukan",
    });
    if (!confirmed) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanV2Approval((row.planId ?? row.editPlanId) as string, {
        action: "submit",
        userId,
        commandId: createJobPlanV2CommandId("web-submit"),
        expectedVersion: row.version as number,
      });
      if (!result.success) {
        failed += 1;
        setError(result.message);
      }
    }
    await load();
    setIsSaving(false);
    if (failed === 0) {
      sweetAlert.notifySuccess("Rencana diajukan", `${validRows.length} draft masuk Review Divisi.`);
      setSelectedRows([]);
    }
  }

  function editRows(rowsToEdit: PlannerRow[]) {
    const validRows = rowsToEdit.filter((row) => row.planId && row.version && row.approvalState === "DRAFT");
    if (validRows.length !== rowsToEdit.length) {
      setError("Pilih rencana draft yang sudah tersimpan.");
      return;
    }
    setEditDrafts((current) => {
      const currentIds = new Set(current.map((row) => row.editPlanId));
      return [
        ...current,
        ...validRows.filter((row) => !currentIds.has(row.planId as string)).map(createEditDraftFromRow),
      ];
    });
    setSelectedRows([]);
    setError(null);
  }

  async function cancelDraftRows(rowsToCancel: PlannerRow[]) {
    if (rowsToCancel.length === 0 || isSaving) return;
    const validRows = rowsToCancel.filter((row) => row.approvalState === "DRAFT" && (row.planId || row.editPlanId) && (row.version || row.editVersion));
    if (validRows.length !== rowsToCancel.length) {
      setError("Hanya draft tersimpan yang bisa dihapus.");
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: `Hapus ${validRows.length} draft?`,
      description: "Draft akan dibatalkan dan tidak tampil di daftar operasional.",
      confirmLabel: "Hapus",
      tone: "error",
    });
    if (!confirmed) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanV2Approval(row.planId as string, {
        action: "cancel",
        userId,
        commandId: createJobPlanV2CommandId("web-cancel-draft"),
        expectedVersion: (row.version ?? row.editVersion) as number,
        reason: "Dihapus dari Web Job Plan",
      });
      if (!result.success) {
        failed += 1;
        setError(result.message);
      }
    }
    await load();
    setIsSaving(false);
    if (failed === 0) {
      sweetAlert.notifySuccess("Draft dihapus", `${validRows.length} draft dibatalkan.`);
      setSelectedRows([]);
    }
  }

  async function submitRejectReason(reason: string) {
    setRejectDialogOpen(false);
    await reviewRows(selectedRows, "reject", reason);
  }

  function openReportPrint() {
    const visibleRows: PlannerRow[] = [];
    gridApi?.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) visibleRows.push(node.data);
    });
    const kpLabel = kpOptions.find((option) => option.value === kpFilter)?.label ?? "";
    const qaLabel = qaOptions.find((option) => option.value === qaFilter)?.label ?? "";
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      setError("Gagal menyiapkan halaman print.");
      return;
    }
    doc.open();
    doc.write(buildReportTableHtml(gridApi ? visibleRows : filteredRows, { date: dateFilter, kp: kpLabel, qa: qaLabel }));
    doc.close();
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    }, 100);
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
        {mode === "planner" && canCreate ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{selectedRows.length} dipilih</span>
            <ActionButton disabled={editableSelectedRows.length === 0 || isSaving} onClick={() => editRows(editableSelectedRows)}>Edit Draft</ActionButton>
            <ActionButton variant="success" disabled={submittableSelectedRows.length === 0 || isSaving} onClick={() => void submitRows(submittableSelectedRows)}>Ajukan</ActionButton>
            <ActionButton variant="danger" disabled={cancellableSelectedRows.length === 0 || isSaving} onClick={() => void cancelDraftRows(cancellableSelectedRows)}>Hapus Draft</ActionButton>
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
        emptyMessage="Belum ada Job Plan."
      />
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
