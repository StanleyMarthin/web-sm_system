"use client";

import type { JobPlanRuntimeReadItem } from "@smsystem/contracts/job-plan-runtime";
import type { JobPlanMode, JobPlanRecord } from "@smsystem/contracts/job-plan";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent, TabToNextCellParams } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import {
  createJobPlanCommandId,
  fetchJobPlanRuntimeList,
  mutateJobPlanApproval,
} from "@/shared/api/job-plan/job-plan-runtime";
import { createJobPlanAdditionalCountdown, fetchJobPlanOptions, saveJobPlanDraft } from "@/shared/api/job-plan/job-plan";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SmartSelectCellEditor, type SmartSelectOption } from "@/modules/units/components/master-panel-smart-select-editor";
import {
  buildCountdownPanelOptions,
  buildJobPlanDraftRecord,
  buildEditDraftJobPlanRuntimePayload,
  createJobPlanRuntimeDraft,
  createEditDraftFromRow,
  findJobPlanPanelValue,
  isJobPlanCountdownPlannable,
  jobPlanBreakMinutesForWindow,
  jobPlanComponentNames,
  jobPlanPanelNames,
  jobPlanPartNames,
  jobPlanWindowMinutes,
  minutesToDuration,
  minutesToTime,
  resolveJobPlanDivisionName,
  toLocalDateValue,
  toJobPlanRuntimeDisplayRows,
  toJobPlanDraftDisplayRows,
  validateJobPlanRuntimeDraft,
  type JobPlanRuntimeDisplayRow,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanJobTypeOption,
  type JobPlanPanelOption,
  type JobPlanRuntimePlannerDraft,
} from "../job-plan-planner";
import { parseClipboardTsv } from "@/shared/datagrid/clipboard";
import { parseSmsDurationMinutes, parseSmsReference } from "@/shared/datagrid/parsers";

type PlannerMode = "planner" | "approval";
type WorkMode = "normal" | "overtime";
type PlannerRow = JobPlanRuntimeDisplayRow | (JobPlanRuntimeDisplayRow & JobPlanRuntimePlannerDraft & { editPlanId?: string; editVersion?: number });

interface AdditionalJobFormState {
  divisionId: string;
  carId: string;
  componentName: string;
  panelName: string;
  partName: string;
  panelId: string;
  jobTypeText: string;
  employeeId: string;
  jobDescription: string;
  targetText: string;
  breakText: string;
  startTime: string;
  finishTime: string;
  initialFinding: string;
  note: string;
}

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
  initialWorkMode: string | null;
  initialDraftRows?: JobPlanRecord[];
  defaultDivisionName?: string | null;
  countdowns: JobPlanCountdownOption[];
  employees: JobPlanEmployeeOption[];
  divisions: JobPlanDivisionOption[];
  panels: JobPlanPanelOption[];
  jobTypes: JobPlanJobTypeOption[];
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

function contextForDraft(countdowns: JobPlanCountdownOption[], draft: Pick<JobPlanRuntimePlannerDraft, "coreId" | "divisionId" | "carId" | "panelId">) {
  return contextForCore(countdowns, draft.coreId)
    ?? countdowns.find((item) =>
      item.divisionId === draft.divisionId
      && item.carId === draft.carId
      && item.panelId === draft.panelId
    )
    ?? null;
}

function additionalJobValue(jobTypeId: string) {
  return `additional:${jobTypeId}`;
}

function parseAdditionalJobValue(value: string) {
  return value.startsWith("additional:") ? value.slice("additional:".length) : "";
}

function startTimeForWorkMode(workMode: WorkMode) {
  if (workMode === "overtime") return "17:00";
  return "08:00";
}

function isOvertimeMode(workMode: WorkMode) {
  return workMode !== "normal";
}

function draftToDisplay(
  draft: JobPlanRuntimePlannerDraft,
  countdowns: JobPlanCountdownOption[],
  employees: JobPlanEmployeeOption[],
  divisions: JobPlanDivisionOption[],
  panels: JobPlanPanelOption[],
  jobTypes: JobPlanJobTypeOption[],
): PlannerRow {
  const countdown = contextForDraft(countdowns, draft);
  const employee = employees.find((item) => item.value === draft.employeeId);
  const panel = panels.find((item) => item.value === String(draft.panelId ?? "") && (!item.carId || item.carId === draft.carId));
  const jobType = jobTypes.find((item) => item.value === draft.jobTypeId);
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
    panelName: countdown?.panelName ?? panel?.panelName ?? "-",
    instructionText: draft.note,
    employeeName: employee?.label ?? "",
    divisionName: resolveJobPlanDivisionName(draft.divisionId, divisions, employees, countdowns, countdown?.divisionName ?? jobType?.divisionName),
    jobDescription: draft.jobDescription || jobType?.jobName || draft.jobDescription,
    finishTime: minutesToTime(startMinute + duration),
    durationText: draft.durationText,
    targetTotalText: countdown?.targetTotalHours
      ? minutesToDuration(Math.round(countdown.targetTotalHours * 60))
      : draft.targetTotalText?.trim() || minutesToDuration(duration),
    remainingText: minutesToDuration(Math.round((countdown?.remainingHours ?? 0) * 60)),
    approval: "Belum Disimpan",
    approvalState: "DRAFT",
    execution: "Belum Mulai",
    executionState: "NOT_STARTED",
    ledger: "Belum Diproses",
    ledgerState: "UNMATERIALIZED",
    sync: "Draft",
    createdBy: null,
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

function initialWorkModeFilter(value: string | null): JobPlanMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "normal") return "normal";
  if (normalized === "overtime" || normalized === "lembur") return "overtime";
  return "all";
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

function uniqueByValue<T extends { value: string; label: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function isOperationalDivisionLabel(label: string) {
  const normalized = label.trim().toUpperCase();
  if (!normalized || /^\d+$/.test(normalized)) return false;
  return !["QA", "MP", "MANAGEMENT", "ADMIN", "MIS"].includes(normalized);
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

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function optionDisplayName(option: SmartSelectOption | undefined) {
  if (!option) return "";
  const parts = option.label.split(" · ");
  if (parts[0] === "Normal" || parts[0] === "Lembur") return parts[1] ?? option.label;
  if (parts[0] === "Tambahan") return parts[1] ?? option.label;
  return option.label;
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
        <th rowspan="2">INSTRUKSI / SPOK</th>
        <th colspan="4" class="plan-group">PLAN</th>
        <th rowspan="2" class="target-today">TARGET</th>
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

const lastDraftEntryFields = new Set(["durationText", "note"]);

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

function SearchSelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  allowCustom = false,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  options: SmartSelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const selectedLabel = allowCustom ? value : options.find((option) => option.value === value)?.label ?? "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = options
    .filter((option) => !normalizedQuery || option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery))
    .slice(0, 12);

  const selectOption = (option: SmartSelectOption) => {
    onChange(allowCustom ? option.label : option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <label className={`relative block text-[11px] text-muted-foreground ${className}`}>
      {label}
      <input
        value={open ? query : selectedLabel}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery(selectedLabel);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          if (disabled) return;
          setQuery(event.target.value);
          if (allowCustom) onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Tab" && open && visibleOptions[0]) {
            selectOption(visibleOptions[0]);
          }
        }}
        className="mt-1 h-9 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/45 disabled:cursor-not-allowed disabled:opacity-40"
        placeholder={placeholder}
      />
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-[95] mt-1 max-h-56 overflow-y-auto border border-border bg-card shadow-xl">
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              className="block w-full border-b border-border px-2 py-2 text-left text-[12px] text-foreground last:border-b-0 hover:bg-muted"
            >
              {option.label}
            </button>
          ))}
          {visibleOptions.length === 0 ? <div className="px-2 py-2 text-[12px] text-muted-foreground">{allowCustom ? "Tekan simpan untuk membuat baru." : "Tidak ada pilihan."}</div> : null}
        </div>
      ) : null}
    </label>
  );
}

function AdditionalJobDialog({
  value,
  divisionOptions,
  unitOptions,
  componentOptions,
  componentDisabled,
  panelOptions,
  partOptions,
  jobTypeOptions,
  employeeOptions,
  onChange,
  onDivisionChange,
  onUnitChange,
  onPanelChange,
  onPartChange,
  onTimeChange,
  onCancel,
  onSubmit,
}: {
  value: AdditionalJobFormState;
  divisionOptions: SmartSelectOption[];
  unitOptions: SmartSelectOption[];
  componentOptions: SmartSelectOption[];
  componentDisabled: boolean;
  panelOptions: SmartSelectOption[];
  partOptions: SmartSelectOption[];
  jobTypeOptions: SmartSelectOption[];
  employeeOptions: SmartSelectOption[];
  onChange: (value: AdditionalJobFormState) => void;
  onDivisionChange: (divisionId: string) => void;
  onUnitChange: (carId: string) => void;
  onPanelChange: (panelName: string) => void;
  onPartChange: (partName: string) => void;
  onTimeChange: (patch: { startTime?: string; finishTime?: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const update = (patch: Partial<AdditionalJobFormState>) => onChange({ ...value, ...patch });
  const windowMinutes = jobPlanWindowMinutes(value.startTime, value.finishTime);
  const breakMinutes = parseSmsDurationMinutes(value.breakText || "00:00", "Jam istirahat").value ?? 0;
  const dailyMinutes = windowMinutes === null ? null : windowMinutes - breakMinutes;
  const dailyText = dailyMinutes !== null && dailyMinutes > 0 ? minutesToDuration(dailyMinutes) : "";
  const breakTooLong = windowMinutes !== null && dailyMinutes !== null && dailyMinutes <= 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-5 sm:items-center">
      <div className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-3xl flex-col border border-border bg-background shadow-2xl">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Pekerjaan Tambahan</p>
          <h2 className="mt-1 text-[16px] font-semibold text-foreground">Tambah pekerjaan baru</h2>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <SearchSelectField
            label="Team"
            value={value.divisionId}
            options={divisionOptions}
            placeholder="Cari team"
            onChange={onDivisionChange}
          />
          <SearchSelectField
            label="PIC"
            value={value.employeeId}
            options={employeeOptions}
            placeholder="Cari PIC"
            onChange={(employeeId) => update({ employeeId })}
          />
          <SearchSelectField
            label="Unit"
            value={value.carId}
            options={unitOptions}
            placeholder={value.divisionId ? "Cari unit di team ini" : "Cari unit"}
            onChange={onUnitChange}
          />
          <SearchSelectField
            label="Component"
            value={value.componentName}
            options={componentOptions}
            placeholder={componentDisabled ? "Pilih unit dulu" : "Cari component"}
            disabled={componentDisabled}
            onChange={(componentName) => update({ componentName, panelName: "", partName: "", panelId: "" })}
          />
          <SearchSelectField
            label="Panel"
            value={value.panelName}
            options={panelOptions}
            placeholder={value.carId ? "Cari panel" : "Pilih unit dulu"}
            disabled={!value.carId || panelOptions.length === 0}
            onChange={onPanelChange}
          />
          <SearchSelectField
            label="Part"
            value={value.partName}
            options={partOptions}
            placeholder={value.panelName ? "Cari part" : "Pilih panel dulu"}
            disabled={!value.panelName || partOptions.length === 0}
            onChange={onPartChange}
          />
          <div className="sm:col-span-2">
            <SearchSelectField
              label="Jobdesc"
              value={value.jobTypeText}
              options={jobTypeOptions}
              placeholder="Pilih atau ketik jobdesc baru"
              onChange={(jobTypeText) => update({ jobTypeText })}
              allowCustom
            />
          </div>
          <label className="sm:col-span-2 text-[11px] text-muted-foreground">
            Instruksi / detail pekerjaan
            <input
              value={value.jobDescription}
              onChange={(event) => update({ jobDescription: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="Contoh: repair list bawah pintu"
            />
          </label>
          <label className="sm:col-span-2 text-[11px] text-muted-foreground">
            Temuan awal
            <textarea
              value={value.initialFinding}
              onChange={(event) => update({ initialFinding: event.target.value })}
              className="mt-1 min-h-16 w-full resize-y border border-border bg-background px-2 py-2 text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="Opsional, contoh: retak halus di panel bawah"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Target awal (total sampai beres)
            <input
              value={value.targetText}
              onChange={(event) => update({ targetText: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="Contoh: 16:00"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Jam mulai
            <input
              value={value.startTime}
              onChange={(event) => onTimeChange({ startTime: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="08:00"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Jam selesai
            <input
              value={value.finishTime}
              onChange={(event) => onTimeChange({ finishTime: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="09:00"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Jam istirahat
            <input
              value={value.breakText}
              onChange={(event) => update({ breakText: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="01:00"
            />
          </label>
          <div className="border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
            Total target hari ini
            <div className="mt-1 font-mono text-[16px] font-semibold text-foreground">{dailyText || "-"}</div>
            {breakTooLong ? <div className="mt-1 text-destructive">Jam istirahat melebihi rentang jam kerja.</div> : null}
          </div>
          <label className="text-[11px] text-muted-foreground">
            Instruksi / SPOK
            <input
              value={value.note}
              onChange={(event) => update({ note: event.target.value })}
              className="mt-1 h-9 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/45"
              placeholder="Opsional, contoh: cek dan ukur ulang"
            />
          </label>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-4 py-3">
          <ActionButton onClick={onCancel}>Batal</ActionButton>
          <ActionButton variant="primary" onClick={onSubmit}>Tambah ke Rencana</ActionButton>
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
  initialWorkMode,
  initialDraftRows = [],
  defaultDivisionName = null,
  countdowns,
  employees,
  divisions,
  panels,
  jobTypes,
}: JobPlanPlannerShellProps) {
  const [items, setItems] = useState<JobPlanRuntimeReadItem[]>([]);
  const [drafts, setDrafts] = useState<JobPlanRuntimePlannerDraft[]>([]);
  const [editDrafts, setEditDrafts] = useState<Array<JobPlanRuntimePlannerDraft & { editPlanId: string; editVersion: number }>>([]);
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
  const [divisionFilter, setDivisionFilter] = useState(defaultDivisionName ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState<JobPlanMode>(() => initialWorkModeFilter(initialWorkMode));
  const [additionalJobOpen, setAdditionalJobOpen] = useState(false);
  const [additionalJobForm, setAdditionalJobForm] = useState<AdditionalJobFormState>({
    divisionId: "",
    carId: "",
    componentName: "",
    panelName: "",
    partName: "",
    panelId: "",
    jobTypeText: "",
    employeeId: "",
    jobDescription: "",
    targetText: "",
    breakText: "00:00",
    startTime: "08:00",
    finishTime: "09:00",
    initialFinding: "",
    note: "",
  });
  const [lazyEmployees, setLazyEmployees] = useState<Record<string, JobPlanEmployeeOption[]>>({});
  const [lazyUnitOptions, setLazyUnitOptions] = useState<Record<string, Array<{ value: string; label: string; unitName: string }>>>({});
  const [lazyPanels, setLazyPanels] = useState<Record<string, JobPlanPanelOption[]>>({});
  const [lazyJobs, setLazyJobs] = useState<Record<string, JobPlanCountdownOption[]>>({});
  const sweetAlert = useSweetAlert();
  const activeCountdowns = useMemo(
    () => uniqueByValue([...countdowns, ...Object.values(lazyJobs).flat()]),
    [countdowns, lazyJobs],
  );
  const selectedContext = useMemo(() => contextForCore(activeCountdowns, initialCoreId), [activeCountdowns, initialCoreId]);
  const planableCountdowns = useMemo(() => activeCountdowns.filter(isJobPlanCountdownPlannable), [activeCountdowns]);
  const technicalDivisionOptions = useMemo(() => {
    const fromReferences = divisions
      .filter((item) => item.isTechnical === true || item.isTeknis === true)
      .map((item) => ({ value: item.value, label: item.label }));
    const fallback = [
      ...employees.map((item) => ({ value: String(item.divisionId ?? ""), label: item.divisionName ?? "" })),
      ...activeCountdowns.map((item) => ({ value: String(item.divisionId ?? ""), label: item.divisionName })),
    ];
    return uniqueByValue([...fromReferences, ...fallback].filter((item) => item.value && isOperationalDivisionLabel(item.label)));
  }, [activeCountdowns, divisions, employees]);

  function teamOptions() {
    return technicalDivisionOptions;
  }

  function updateAdditionalJobForm(patch: Partial<AdditionalJobFormState>) {
    setAdditionalJobForm((current) => ({ ...current, ...patch }));
  }

  function unitsForDivision(divisionId: number | null) {
    const cached = lazyUnitOptions[String(divisionId ?? "all")];
    if (cached) return cached;
    return uniqueByValue(
      activeCountdowns
        .filter((item) => divisionId === null || item.divisionId === divisionId)
        .map((item) => ({ value: item.carId, label: item.unitName, unitName: item.unitName })),
    );
  }

  function divisionsForUnit(carId: string) {
    const divisions = new Set<number>();
    for (const item of activeCountdowns) {
      if (item.carId === carId && item.divisionId) divisions.add(item.divisionId);
    }
    for (const [key, units] of Object.entries(lazyUnitOptions)) {
      if (key === "all" || !units.some((unit) => unit.value === carId)) continue;
      const divisionId = numberValue(key);
      if (divisionId) divisions.add(divisionId);
    }
    return [...divisions];
  }

  function rowDivisionId(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    return numberValue(row?.divisionId);
  }

  function rowCarId(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    return String(row?.carId ?? "");
  }

  function rowPanelId(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    return numberValue(row?.panelId);
  }

  function personOptions(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const cached = lazyEmployees[String(divisionId ?? "all")];
    if (cached) return toOptions(cached);
    const source = divisionId === null ? employees : employees.filter((item) => item.divisionId === divisionId);
    return toOptions(source);
  }

  function unitOptions(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    return unitsForDivision(rowDivisionId(row));
  }

  function panelOptions(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const carId = rowCarId(row);
    return buildCountdownPanelOptions(activeCountdowns, { divisionId, carId });
  }

  function additionalJobOptions(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    return jobTypes
      .filter((item) =>
        divisionId === null
        || item.divisionId === null
        || item.divisionId === divisionId
        || item.divisionParentId === divisionId
      )
      .map((item) => ({
        value: additionalJobValue(item.value),
        label: item.jobName ?? item.label,
        code: item.value,
      }));
  }

  function jobOptions(row: Partial<PlannerRow> | Partial<JobPlanRuntimePlannerDraft> | null | undefined) {
    const divisionId = rowDivisionId(row);
    const carId = rowCarId(row);
    const panelId = rowPanelId(row);
    const workMode = String(row?.workMode ?? "normal") as WorkMode;
    const modeLabel = workMode === "normal" ? "Normal" : "Lembur";
    const cacheKey = `${divisionId ?? "all"}:${carId}:${panelId ?? "all"}`;
    const sourceCountdowns = lazyJobs[cacheKey] ?? activeCountdowns;
    const countdownOptions = sourceCountdowns
      .filter((item) =>
        isJobPlanCountdownPlannable(item)
        && (divisionId === null || item.divisionId === divisionId)
        && (!carId || item.carId === carId)
        && (panelId === null || item.panelId === panelId)
      )
      .map((item) => ({
        value: item.value,
        label: `${modeLabel} · ${item.jobName ?? item.label} · ${minutesToDuration(Math.round((item.availablePlanHours ?? item.remainingHours) * 60))}`,
      }));
    return [...countdownOptions, ...additionalJobOptions(row)];
  }

  function additionalDialogDivisionId() {
    return numberValue(additionalJobForm.divisionId);
  }

  function additionalDialogPanelRows() {
    const carId = additionalJobForm.carId;
    if (!carId) return [];
    const perUnit = lazyPanels[`all:${carId}`];
    if (perUnit) return perUnit;
    const perComponent = additionalJobForm.componentName ? lazyPanels[`all:${carId}:${additionalJobForm.componentName}`] : null;
    return perComponent ?? [];
  }

  function changeAdditionalTeam(divisionId: string) {
    const nextDivisionId = numberValue(divisionId);
    const unit = additionalJobForm.carId;
    const unitDivisions = unit ? divisionsForUnit(unit) : [];
    const unitFits = !unit || unitDivisions.length === 0 || (nextDivisionId !== null && unitDivisions.includes(nextDivisionId));

    updateAdditionalJobForm(unitFits
      ? { divisionId, employeeId: "", jobTypeText: "" }
      : { divisionId, employeeId: "", jobTypeText: "", carId: "", componentName: "", panelName: "", partName: "", panelId: "" });
  }

  function changeAdditionalUnit(carId: string) {
    const candidates = divisionsForUnit(carId)
      .filter((divisionId) => teamOptions().some((option) => option.value === String(divisionId)));
    const inferredDivision = !additionalJobForm.divisionId && candidates.length === 1 ? String(candidates[0]) : "";

    updateAdditionalJobForm({
      carId,
      componentName: "",
      panelName: "",
      partName: "",
      panelId: "",
      ...(inferredDivision ? { divisionId: inferredDivision, employeeId: "", jobTypeText: "" } : {}),
    });
  }

  function changeAdditionalPanel(panelName: string) {
    const rows = additionalDialogPanelRows();
    const partNames = jobPlanPartNames(rows, panelName);
    const partName = partNames.length === 1 ? partNames[0] : "";
    const panelId = partName ? findJobPlanPanelValue(rows, panelName, partName) : null;
    setAdditionalJobForm((current) => ({ ...current, panelName, partName, panelId: panelId ?? "" }));
  }

  function changeAdditionalPart(partName: string) {
    const rows = additionalDialogPanelRows();
    const panelId = findJobPlanPanelValue(rows, additionalJobForm.panelName, partName);
    setAdditionalJobForm((current) => ({ ...current, partName, panelId: panelId ?? "" }));
  }

  function changeAdditionalTime(patch: { startTime?: string; finishTime?: string }) {
    const next = { ...additionalJobForm, ...patch };
    setAdditionalJobForm({
      ...next,
      breakText: minutesToDuration(jobPlanBreakMinutesForWindow(dateFilter, next.startTime, next.finishTime)),
    });
  }

  const additionalDialogUnitOptions = useMemo(
    () => unitsForDivision(additionalDialogDivisionId()),
    [additionalJobForm.divisionId, activeCountdowns, lazyUnitOptions],
  );

  const additionalDialogComponentOptions = useMemo(() => {
    const carId = additionalJobForm.carId;
    const source = carId ? lazyPanels[`all:${carId}`] : null;
    return toOptions(jobPlanComponentNames(source ?? []).map((name) => ({ value: name, label: name })));
  }, [additionalJobForm.carId, lazyPanels]);

  const additionalDialogComponentDisabled = !additionalJobForm.carId || !lazyPanels[`all:${additionalJobForm.carId}`];

  const additionalDialogPanelOptions = useMemo(
    () => toOptions(jobPlanPanelNames(additionalDialogPanelRows(), additionalJobForm.componentName).map((name) => ({ value: name, label: name }))),
    [additionalJobForm.carId, additionalJobForm.componentName, lazyPanels],
  );

  const additionalDialogPartOptions = useMemo(
    () => toOptions(jobPlanPartNames(additionalDialogPanelRows(), additionalJobForm.panelName).map((name) => ({ value: name, label: name }))),
    [additionalJobForm.carId, additionalJobForm.componentName, additionalJobForm.panelName, lazyPanels],
  );

  const additionalDialogJobOptions = useMemo(
    () => additionalJobOptions({ divisionId: additionalDialogDivisionId() }),
    [additionalJobForm.divisionId, jobTypes],
  );
  const additionalDialogEmployeeOptions = useMemo(
    () => personOptions({ divisionId: additionalDialogDivisionId() }),
    [additionalJobForm.divisionId, employees, lazyEmployees],
  );

  const workModeOptions = useMemo<SmartSelectOption[]>(() => [
    { value: "normal", label: "Normal 08:00-17:00" },
    { value: "overtime", label: "Lembur 17:00-22:00" },
  ], []);

  useEffect(() => {
    let cancelled = false;
    if (additionalJobOpen && !lazyUnitOptions.all) {
      void fetchJobPlanOptions("units", {}).then((result) => {
        if (!cancelled && result.success) setLazyUnitOptions((current) => ({ ...current, all: result.data as Array<{ value: string; label: string; unitName: string }> }));
      });
    }
    if (additionalJobOpen && additionalJobForm.carId && !lazyPanels[`all:${additionalJobForm.carId}`]) {
      void fetchJobPlanOptions("panels", { unitId: additionalJobForm.carId }).then((result) => {
        if (!cancelled && result.success) setLazyPanels((current) => ({ ...current, [`all:${additionalJobForm.carId}`]: result.data as JobPlanPanelOption[] }));
      });
    }
    const componentPanelKey = `all:${additionalJobForm.carId}:${additionalJobForm.componentName}`;
    if (additionalJobOpen && additionalJobForm.carId && additionalJobForm.componentName && !lazyPanels[componentPanelKey]) {
      void fetchJobPlanOptions("panels", {
        unitId: additionalJobForm.carId,
        componentName: additionalJobForm.componentName,
      }).then((result) => {
        if (!cancelled && result.success) setLazyPanels((current) => ({ ...current, [componentPanelKey]: result.data as JobPlanPanelOption[] }));
      });
    }
    const rowsForOptions = [
      ...drafts,
      ...editDrafts,
      additionalJobForm,
    ];

    const divisionIds = uniqueByValue(rowsForOptions
      .map((row) => ({ value: String(numberValue(row.divisionId) ?? ""), label: String(numberValue(row.divisionId) ?? "") }))
      .filter((item) => item.value))
      .map((item) => Number(item.value));
    const panelKeys = uniqueByValue(rowsForOptions
      .map((row) => {
        const divisionId = numberValue(row.divisionId);
        const carId = "carId" in row ? String(row.carId ?? "") : "";
        return { value: carId ? `${divisionId ?? "all"}:${carId}` : "", label: carId };
      })
      .filter((item) => item.value));
    const jobKeys = uniqueByValue(rowsForOptions
      .map((row) => {
        const divisionId = numberValue(row.divisionId);
        const carId = "carId" in row ? String(row.carId ?? "") : "";
        const panelId = numberValue(row.panelId);
        return { value: carId && panelId ? `${divisionId ?? "all"}:${carId}:${panelId}` : "", label: carId };
      })
      .filter((item) => item.value));

    for (const divisionId of divisionIds) {
      const key = String(divisionId);
      if (!lazyEmployees[key]) {
        void fetchJobPlanOptions("employees", { divisionId }).then((result) => {
          if (!cancelled && result.success) setLazyEmployees((current) => ({ ...current, [key]: result.data as JobPlanEmployeeOption[] }));
        });
      }
      if (!lazyUnitOptions[key]) {
        void fetchJobPlanOptions("units", { divisionId }).then((result) => {
          if (!cancelled && result.success) setLazyUnitOptions((current) => ({ ...current, [key]: result.data as Array<{ value: string; label: string; unitName: string }> }));
        });
      }
    }

    for (const item of panelKeys) {
      if (lazyPanels[item.value]) continue;
      const [divisionText, unitId] = item.value.split(":");
      const divisionId = divisionText === "all" ? null : Number(divisionText);
      void fetchJobPlanOptions("panels", { divisionId, unitId }).then((result) => {
        if (!cancelled && result.success) setLazyPanels((current) => ({ ...current, [item.value]: result.data as JobPlanPanelOption[] }));
      });
    }

    for (const item of jobKeys) {
      if (lazyJobs[item.value]) continue;
      const [divisionText, unitId, panelText] = item.value.split(":");
      const divisionId = divisionText === "all" ? null : Number(divisionText);
      const panelId = Number(panelText);
      void fetchJobPlanOptions("jobdesc", { divisionId, unitId, panelId }).then((result) => {
        if (!cancelled && result.success) setLazyJobs((current) => ({ ...current, [item.value]: result.data as JobPlanCountdownOption[] }));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [additionalJobForm, additionalJobOpen, drafts, editDrafts, lazyEmployees, lazyJobs, lazyPanels, lazyUnitOptions]);

  function normalizeDraftSelection(row: JobPlanRuntimePlannerDraft): JobPlanRuntimePlannerDraft {
    let next = { ...row };
    const divisionOptionsForRow = teamOptions();
    if (next.divisionId !== null && !divisionOptionsForRow.some((option) => option.value === String(next.divisionId))) {
      next = { ...next, divisionId: null, carId: "", panelId: null, coreId: "", employeeId: "", jobDescription: "", initialFinding: "" };
    }

    const availableEmployees = personOptions(next);
    if (next.employeeId && !availableEmployees.some((option) => option.value === next.employeeId)) next.employeeId = "";

    const availableUnits = unitOptions(next);
    if (next.carId && !availableUnits.some((option) => option.value === next.carId)) {
      next = { ...next, carId: "", panelId: null, coreId: "", jobDescription: "", initialFinding: "" };
    }

    const availablePanels = panelOptions(next);
    if (next.panelId !== null && !availablePanels.some((option) => option.value === String(next.panelId))) {
      next = { ...next, panelId: null, coreId: "", jobDescription: "", initialFinding: "" };
    }

    const availableJobs = jobOptions(next);
    if (next.coreId && !availableJobs.some((option) => option.value === next.coreId)) {
      next = { ...next, sourceType: "countdown", coreId: "", jobTypeId: "", jobTypeName: "", jobDescription: "", initialFinding: "" };
    }

    const countdown = contextForCore(activeCountdowns, next.coreId);
    const additionalJobTypeId = parseAdditionalJobValue(next.coreId);
    if (additionalJobTypeId) {
      const jobType = jobTypes.find((item) => item.value === additionalJobTypeId);
      next = {
        ...next,
        sourceType: "additional",
        jobTypeId: additionalJobTypeId,
        jobTypeName: "",
        jobDescription: jobType?.jobName ?? jobType?.label ?? next.jobDescription,
      };
    }
    if (countdown) {
      next = {
        ...next,
        sourceType: "countdown",
        jobTypeId: "",
        jobTypeName: "",
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
    const result = await fetchJobPlanRuntimeList({
      userId,
      view: viewForMode(mode),
      date: dateFilter,
      coreId: initialCoreId ?? undefined,
      workMode: workModeFilter,
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
  }, [userId, initialCoreId, dateFilter, mode, workModeFilter]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (drafts.length === 0 && editDrafts.length === 0) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts.length, editDrafts.length]);

  const rows = useMemo<PlannerRow[]>(() => {
    const runtimeRows = toJobPlanRuntimeDisplayRows(items, activeCountdowns, employees).map((row) => {
      const draft = editDrafts.find((item) => item.editPlanId === row.planId);
      return draft ? { ...draftToDisplay(draft, activeCountdowns, employees, divisions, panels, jobTypes), editPlanId: draft.editPlanId, editVersion: draft.editVersion } : row;
    });
    const runtimePlanIds = new Set(runtimeRows.map((row) => row.planId).filter(Boolean));
    const legacyDraftRows = toJobPlanDraftDisplayRows(initialDraftRows, activeCountdowns, employees)
      .filter((row) => !runtimePlanIds.has(row.planId));

    return [
      ...legacyDraftRows,
      ...runtimeRows,
      ...drafts.map((draft) => draftToDisplay(draft, activeCountdowns, employees, divisions, panels, jobTypes)),
    ];
  }, [activeCountdowns, drafts, editDrafts, employees, divisions, initialDraftRows, items, jobTypes, panels]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (dateFilter && row.taskDate !== dateFilter) return false;
    if (kpFilter && row.kpId !== kpFilter) return false;
    if (qaFilter && !row.qaIds.includes(qaFilter)) return false;
    if (divisionFilter && row.divisionName !== divisionFilter) return false;
    if (statusFilter && row.approvalState !== statusFilter && row.executionState !== statusFilter) return false;
    if (workModeFilter !== "all" && row.workMode !== workModeFilter) return false;
    return true;
  }), [dateFilter, divisionFilter, kpFilter, qaFilter, rows, statusFilter, workModeFilter]);

  const kpOptions = useMemo(() => uniqueByValue(activeCountdowns.map((item) => ({
    value: item.kpId ?? "",
    label: item.kpName ?? item.kpId ?? "",
  }))), [activeCountdowns]);

  const qaOptions = useMemo(() => uniqueByValue(activeCountdowns.flatMap((item) => (item.qaIds ?? []).map((value, index) => ({
    value,
    label: item.qaNames?.[index] ?? value,
  })))), [activeCountdowns]);

  const divisionOptions = useMemo(() => uniqueByValue(rows.map((row) => ({
    value: row.divisionName,
    label: row.divisionName,
  }))), [rows]);

  const statusOptions = [
    ["DRAFT", "Draft"],
    ["DIVISION_REVIEW", "Review QA"],
    ["UNIT_REVIEW", "Review KP"],
    ["MANAGEMENT_REVIEW", "Review PM"],
    ["APPROVED", "Disetujui"],
    ["REJECTED", "Ditolak"],
    ["RUNNING", "Berjalan"],
    ["HOLD", "Ditahan"],
    ["FINISHED_PENDING_VALIDATION", "Selesai"],
    ["VALIDATED", "Tervalidasi"],
  ] as const;
  const defaultDraftWorkMode: WorkMode = workModeFilter === "overtime" ? "overtime" : "normal";

  const isRejectedOwnerRow = (row: PlannerRow) =>
    !row.isNew
    && !row.editPlanId
    && row.approvalState === "REJECTED"
    && row.planId
    && row.version
    && row.createdBy === userId;
  const isEditablePersistedRow = (row: PlannerRow) =>
    !row.isNew
    && !row.editPlanId
    && row.planId
    && row.version
    && (row.approvalState === "DRAFT" || isRejectedOwnerRow(row));
  const isCancellablePlannerRow = (row: PlannerRow) =>
    (row.approvalState === "DRAFT" && (row.planId || row.editPlanId) && (row.version || row.editVersion))
    || isRejectedOwnerRow(row);

  const approvableSelectedRows = selectedRows.filter((row) => !row.isNew && !row.editPlanId && isReviewState(row.approvalState));
  const submittableSelectedRows = selectedRows.filter((row) => !row.isNew && !row.editPlanId && row.approvalState === "DRAFT" && row.planId && row.version);
  const editableSelectedRows = selectedRows.filter(isEditablePersistedRow);
  const cancellableSelectedRows = selectedRows.filter(isCancellablePlannerRow);
  const rejectedOwnerSelectedRows = selectedRows.filter((row) =>
    isRejectedOwnerRow(row)
  );
  const canBulkReviewSelected = canApprove
    && approvableSelectedRows.length > 0
    && sameApprovalStage(approvableSelectedRows);

  const summaryItems = useMemo(() => {
    const persistedRows = rows.filter((row) => !row.isNew && !row.editPlanId);
    const draftCount = persistedRows.filter((row) => row.approvalState === "DRAFT").length;
    const reviewCount = persistedRows.filter((row) => isReviewState(row.approvalState)).length;
    const approvedCount = persistedRows.filter((row) => row.approvalState === "APPROVED").length;
    const actualInputCount = persistedRows.filter((row) => row.executionState === "FINISHED_PENDING_VALIDATION" || row.executionState === "VALIDATED").length;
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
      cellEditorParams: { values: teamOptions(), inline: true },
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
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: personOptions(data), inline: true }),
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? personOptions(data).find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.employeeName ?? "",
      minWidth: 155,
      flex: 0.8,
    },
    {
      headerName: "NAMA UNIT",
      field: "carId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && unitOptions(data).length > 0,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: unitOptions(data), inline: true }),
      filterValueGetter: ({ data }) => data?.unitName ?? "",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? unitOptions(data).find((option) => option.value === String(value ?? ""))?.label ?? data?.unitName ?? ""
        : data?.unitName ?? "",
      minWidth: 120,
    },
    {
      headerName: "NAMA PANEL / PART",
      field: "panelId",
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && panelOptions(data).length > 0,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: panelOptions(data), inline: true }),
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
      editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId) && jobOptions(data).length > 0,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: ({ data }: { data?: PlannerRow }) => ({ values: jobOptions(data), inline: true }),
      filterValueGetter: ({ data }) => data?.jobDescription ?? "",
      valueFormatter: ({ value, data }) => data?.isNew || data?.editPlanId
        ? optionDisplayName(jobOptions(data).find((option) => option.value === String(value ?? ""))) || data?.jobDescription || ""
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
    { headerName: "TOTAL TARGET", field: "targetTotalText", editable: false, minWidth: 115 },
    { headerName: "SISA TARGET", field: "remainingText", editable: false, minWidth: 110 },
    { headerName: "TOTAL TARGET HARI INI", field: "durationText", editable: ({ data }) => Boolean(data?.isNew || data?.editPlanId), minWidth: 150 },
    {
      headerName: "START",
      field: "startTime",
      editable: false,
      minWidth: 135,
      filterValueGetter: ({ data }) => data?.startTime ?? "",
      valueFormatter: ({ data }) => data?.startTime ?? "",
    },
    {
      headerName: "FINISH",
      field: "finishTime",
      editable: false,
      minWidth: 135,
      filterValueGetter: ({ data }) => data?.finishTime ?? "",
      valueFormatter: ({ data }) => data?.finishTime ?? "",
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
  ], [activeCountdowns, employees, jobTypes, lazyEmployees, lazyJobs, lazyPanels, lazyUnitOptions, panels, technicalDivisionOptions]);

  function addDraft() {
    if (planableCountdowns.length === 0) {
      setError("Belum ada countdown yang bisa dibuat plan. Countdown DONE, CANCEL, REJECTED, atau butuh QC tidak ditampilkan.");
      return;
    }
    const draft = createJobPlanRuntimeDraft(selectedContext && isJobPlanCountdownPlannable(selectedContext) ? selectedContext : null);
    const nextDraft = {
      ...draft,
      taskDate: initialDate ?? draft.taskDate,
      workMode: defaultDraftWorkMode,
      isOvertime: isOvertimeMode(defaultDraftWorkMode),
    };
    setDrafts((current) => [...current, normalizeDraftSelection(nextDraft)]);
    window.setTimeout(() => gridApi?.deselectAll(), 0);
  }

  function removeLocalDraftRows(rowsToRemove: PlannerRow[]) {
    const clientIds = new Set(rowsToRemove.map((row) => row.clientId).filter(Boolean));
    if (clientIds.size === 0) return 0;
    setDrafts((current) => current.filter((draft) => !clientIds.has(draft.clientId)));
    setEditDrafts((current) => current.filter((draft) => !clientIds.has(draft.clientId)));
    setSelectedRows([]);
    setError(null);
    window.setTimeout(() => gridApi?.deselectAll(), 0);
    return clientIds.size;
  }

  function addAdditionalJobDraft() {
    const divisionId = numberValue(additionalJobForm.divisionId);
    const panelId = numberValue(additionalJobForm.panelId);
    const jobText = additionalJobForm.jobTypeText.trim();
    const matchedJobType = additionalDialogJobOptions.find((option) =>
      option.label.toLowerCase() === jobText.toLowerCase()
      || option.code?.toLowerCase() === jobText.toLowerCase()
      || option.value.toLowerCase() === jobText.toLowerCase()
    );
    const jobName = matchedJobType ? optionDisplayName(matchedJobType) : jobText;
    const description = additionalJobForm.jobDescription.trim() || jobName;
    if (!divisionId || !additionalJobForm.employeeId || !additionalJobForm.carId || !panelId || !jobName || !description) {
      setError("Team, PIC, unit, panel/part, dan jobdesc tambahan wajib diisi.");
      return;
    }
    const target = parseSmsDurationMinutes(additionalJobForm.targetText.trim(), "Target awal");
    if (!additionalJobForm.targetText.trim() || target.error || !target.value) {
      setError(target.error ?? "Target awal wajib diisi.");
      return;
    }
    const windowMinutes = jobPlanWindowMinutes(additionalJobForm.startTime, additionalJobForm.finishTime);
    if (windowMinutes === null) {
      setError("Jam selesai harus lebih besar dari jam mulai.");
      return;
    }
    const breakMinutes = parseSmsDurationMinutes(additionalJobForm.breakText.trim() || "00:00", "Jam istirahat").value ?? 0;
    const dailyMinutes = windowMinutes - breakMinutes;
    if (dailyMinutes <= 0) {
      setError("Jam istirahat melebihi rentang jam kerja.");
      return;
    }
    if (target.value < dailyMinutes) {
      setError("Target awal tidak boleh lebih kecil dari total target hari ini.");
      return;
    }
    const durationText = minutesToDuration(dailyMinutes);
    const draft = normalizeDraftSelection({
      ...createJobPlanRuntimeDraft(null),
      sourceType: "additional",
      workMode: defaultDraftWorkMode,
      divisionId,
      carId: additionalJobForm.carId,
      panelId,
      coreId: matchedJobType?.value ?? "",
      jobTypeId: matchedJobType ? parseAdditionalJobValue(matchedJobType.value) : "",
      jobTypeName: matchedJobType ? "" : jobName,
      employeeId: additionalJobForm.employeeId,
      taskDate: dateFilter,
      startTime: additionalJobForm.startTime,
      durationText,
      targetTotalText: minutesToDuration(target.value),
      jobDescription: description,
      initialFinding: additionalJobForm.initialFinding.trim(),
      note: additionalJobForm.note.trim(),
      isOvertime: isOvertimeMode(defaultDraftWorkMode),
    });
    setDrafts((current) => [...current, draft]);
    setAdditionalJobOpen(false);
    setAdditionalJobForm({
      divisionId: "",
      carId: "",
      componentName: "",
      panelName: "",
      partName: "",
      panelId: "",
      jobTypeText: "",
      employeeId: "",
      jobDescription: "",
      targetText: "",
      breakText: "00:00",
      startTime: "08:00",
      finishTime: "09:00",
      initialFinding: "",
      note: "",
    });
    setError(null);
    window.setTimeout(() => gridApi?.deselectAll(), 0);
  }

  function addDraftAfter(row: PlannerRow, focusField = "divisionId") {
    addDraft();
    window.setTimeout(() => {
      const rowCount = gridApi?.getDisplayedRowCount() ?? 0;
      if (rowCount <= 0) return;
      const currentIndex = row.clientId ? filteredRows.findIndex((item) => item.clientId === row.clientId) : -1;
      const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, rowCount - 1) : rowCount - 1;
      gridApi?.setFocusedCell(nextIndex, focusField);
      gridApi?.startEditingCell({ rowIndex: nextIndex, colKey: focusField });
    }, 0);
  }

  function tabToNextCell(params: TabToNextCellParams<PlannerRow>) {
    const field = params.previousCellPosition.column.getColId();
    const row = filteredRows[params.previousCellPosition.rowIndex];
    if (!params.backwards && row?.isNew && (field === "note" || (field === "durationText" && !params.nextCellPosition))) {
      addDraftAfter(row, "divisionId");
      return false;
    }
    return params.nextCellPosition ?? false;
  }

  function updateDraft(event: CellValueChangedEvent<PlannerRow>) {
    const row = event.data;
    if (!row.isNew && !row.editPlanId) return;
    const field = event.column.getColId();
    const selectedCoreId = String(row.coreId ?? "");
    const selectedJobTypeId = parseAdditionalJobValue(selectedCoreId);
    const next = {
      sourceType: (selectedJobTypeId ? "additional" : "countdown") as JobPlanRuntimePlannerDraft["sourceType"],
      workMode: (String(row.workMode ?? "normal") as WorkMode),
      coreId: selectedCoreId,
      divisionId: numberValue(row.divisionId),
      carId: String(row.carId ?? ""),
      panelId: numberValue(row.panelId),
      jobTypeId: selectedJobTypeId,
      jobTypeName: "",
      employeeId: String(row.employeeId ?? ""),
      taskDate: String(row.taskDate ?? ""),
      startTime: String(row.startTime ?? ""),
      durationText: String(row.durationText ?? ""),
      targetTotalText: String(row.targetTotalText ?? ""),
      jobDescription: String(row.jobDescription ?? ""),
      initialFinding: String(row.initialFinding ?? ""),
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
      next.sourceType = "countdown";
      next.jobTypeId = "";
      next.jobTypeName = "";
      next.employeeId = "";
      next.jobDescription = "";
    }
    if (field === "carId") {
      next.panelId = null;
      next.coreId = "";
      next.sourceType = "countdown";
      next.jobTypeId = "";
      next.jobTypeName = "";
      next.jobDescription = "";
    }
    if (field === "panelId") {
      next.coreId = "";
      next.sourceType = "countdown";
      next.jobTypeId = "";
      next.jobTypeName = "";
      next.jobDescription = "";
    }
    if (row.editPlanId) {
      const currentDraft = editDrafts.find((draft) => draft.clientId === row.clientId);
      const normalized = normalizeDraftSelection({
        ...(currentDraft ?? createJobPlanRuntimeDraft(contextForCore(activeCountdowns, row.coreId))),
        ...next,
      });
      setEditDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? { ...draft, ...normalized } : draft));
      return;
    }
    const currentDraft = drafts.find((draft) => draft.clientId === row.clientId);
    const normalized = normalizeDraftSelection({
      ...(currentDraft ?? createJobPlanRuntimeDraft(contextForCore(activeCountdowns, row.coreId))),
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
    const isDeleteKey = keyboardEvent.key === "Delete" || keyboardEvent.key === "Backspace";
    if (isDeleteKey && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey && !keyboardEvent.altKey && !isTextEditingTarget(keyboardEvent.target)) {
      const selected = event.api.getSelectedRows();
      const targetRows = selected.length > 0 ? selected : event.data ? [event.data] : [];
      const localRows = targetRows.filter((row) => row.isNew || row.editPlanId);
      const persistedDraftRows = targetRows.filter((row) => !row.isNew && !row.editPlanId && isCancellablePlannerRow(row));

      if (localRows.length > 0 || persistedDraftRows.length > 0) {
        keyboardEvent.preventDefault();
        removeLocalDraftRows(localRows);
        if (persistedDraftRows.length > 0) {
          await cancelDraftRows(persistedDraftRows);
        }
        return;
      }
    }

    const isDraftAppendKey = keyboardEvent.key === "Enter" || (keyboardEvent.key === "Tab" && !keyboardEvent.shiftKey);
    if (isDraftAppendKey && canCreate && mode === "planner" && event.data?.isNew && lastDraftEntryFields.has(field)) {
      keyboardEvent.preventDefault();
      addDraftAfter(event.data, "divisionId");
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
    const editableFields = ["divisionId", "employeeId", "carId", "panelId", "coreId", "note", "durationText"];
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
      if (!nextDrafts[draftIndex]) nextDrafts[draftIndex] = normalizeDraftSelection(createJobPlanRuntimeDraft(countdownContext));
      let draft: JobPlanRuntimePlannerDraft = { ...nextDrafts[draftIndex], error: null };

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
            initialFinding: "",
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
            initialFinding: "",
          };
        }
        if (targetField === "panelId") {
          const parsed = resolveOption(rawValue, panelOptions(draft), "Panel");
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            panelId: numberValue(parsed.value),
            coreId: "",
            jobDescription: "",
            initialFinding: "",
          };
        }
        if (targetField === "coreId") {
          const parsed = resolveOption(rawValue, jobOptions(draft), "Jobdesc");
          const jobValue = parsed.value ?? "";
          const jobTypeId = parseAdditionalJobValue(jobValue);
          draft = parsed.error ? { ...draft, error: parsed.error } : {
            ...draft,
            sourceType: jobTypeId ? "additional" : "countdown",
            coreId: jobValue,
            jobTypeId,
            jobTypeName: "",
          };
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

    const validated = drafts.map((row) => ({ ...row, error: validateJobPlanRuntimeDraft(row) }));
    const validatedEdits = editDrafts.map((row) => ({ ...row, error: validateJobPlanRuntimeDraft(row) }));
    const firstError = [...validated, ...validatedEdits].find((row) => row.error);
    if (firstError) {
      setDrafts(validated);
      setEditDrafts(validatedEdits);
      setError(firstError.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    const failed: JobPlanRuntimePlannerDraft[] = [];
    const failedEdits: Array<JobPlanRuntimePlannerDraft & { editPlanId: string; editVersion: number }> = [];
    let createdAdditionalCountdown = false;
    let savedSharedDraft = false;

    for (const row of validated) {
      let rowToCreate = row;
      if (row.sourceType === "additional") {
        const durationMinutes = parseSmsDurationMinutes(row.durationText, "Durasi").value;
        const targetMinutes = parseSmsDurationMinutes(row.targetTotalText?.trim() || row.durationText, "Target awal").value ?? durationMinutes;
        const countdownResult = durationMinutes == null || targetMinutes == null
          ? { success: false as const, message: "Durasi tidak valid." }
          : await createJobPlanAdditionalCountdown({
            carId: row.carId,
            divisionId: Number(row.divisionId),
            panelId: Number(row.panelId),
            jobTypeId: row.jobTypeId || null,
            jobTypeName: row.jobTypeName.trim() || null,
            taskDate: row.taskDate,
            deadlineDate: row.taskDate,
            targetHours: targetMinutes / 60,
            jobDescription: row.jobDescription,
            initialFinding: row.initialFinding.trim() || null,
            note: row.note.trim() || null,
            picPlan: row.employeeId,
            requiredGrade: null,
          });

        if (!countdownResult.success) {
          failed.push({ ...row, error: countdownResult.message });
          continue;
        }

        createdAdditionalCountdown = true;
        rowToCreate = {
          ...row,
          sourceType: "countdown",
          coreId: countdownResult.result.coreId,
        };
      }

      const result = await saveJobPlanDraft({
        replaceItems: false,
        items: [buildJobPlanDraftRecord(rowToCreate, {
          countdowns: activeCountdowns,
          employees,
          divisions,
          panels,
          jobTypes,
        })],
      });
      if (!result.success) {
        failed.push({ ...row, error: result.message });
      } else {
        savedSharedDraft = true;
      }
    }
    for (const row of validatedEdits) {
      const result = await mutateJobPlanApproval(row.editPlanId, buildEditDraftJobPlanRuntimePayload(row, userId, createJobPlanCommandId("web-edit-draft"), row.editVersion));
      if (!result.success) {
        failedEdits.push({ ...row, error: result.message });
      }
    }

    setDrafts(failed);
    setEditDrafts(failedEdits);
    await load();
    setIsSaving(false);
    if ((createdAdditionalCountdown || savedSharedDraft) && failed.length + failedEdits.length === 0) {
      window.location.reload();
      return;
    }
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
      const result = await mutateJobPlanApproval(row.planId as string, {
        action,
        userId,
        commandId: createJobPlanCommandId(`web-${action}`),
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
      description: "Rencana akan masuk ke Review QA.",
      confirmLabel: "Ajukan",
    });
    if (!confirmed) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanApproval((row.planId ?? row.editPlanId) as string, {
        action: "submit",
        userId,
        commandId: createJobPlanCommandId("web-submit"),
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
      sweetAlert.notifySuccess("Rencana diajukan", `${validRows.length} draft masuk Review QA.`);
      setSelectedRows([]);
    }
  }

  function editRows(rowsToEdit: PlannerRow[]) {
    const validRows = rowsToEdit.filter(isEditablePersistedRow);
    if (validRows.length !== rowsToEdit.length) {
      setError("Pilih draft tersimpan atau plan ditolak milik pengaju.");
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

  function editRejectedRows(rowsToEdit: PlannerRow[]) {
    const validRows = rowsToEdit.filter((row) =>
      row.planId
      && row.version
      && row.approvalState === "REJECTED"
      && row.createdBy === userId
    );
    if (validRows.length !== rowsToEdit.length) {
      setError("Hanya plan rejected milik pengaju yang bisa diedit.");
      return;
    }
    setEditDrafts((current) => {
      const currentIds = new Set(current.map((row) => row.editPlanId));
      return [
        ...current,
        ...validRows.filter((row) => !currentIds.has(row.planId as string)).map(createEditDraftFromRow),
      ];
    });
    setMode("planner");
    setSelectedRows([]);
    setError(null);
  }

  async function cancelDraftRows(rowsToCancel: PlannerRow[]) {
    if (rowsToCancel.length === 0 || isSaving) return;
    const validRows = rowsToCancel.filter(isCancellablePlannerRow);
    if (validRows.length !== rowsToCancel.length) {
      setError("Hanya draft tersimpan atau plan ditolak milik pengaju yang bisa dihapus.");
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: `Hapus ${validRows.length} draft/rejected?`,
      description: "Draft/rejected akan dibatalkan dan tidak tampil di daftar operasional.",
      confirmLabel: "Hapus",
      tone: "error",
    });
    if (!confirmed) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanApproval(row.planId as string, {
        action: "cancel",
        userId,
        commandId: createJobPlanCommandId("web-cancel-draft"),
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
      sweetAlert.notifySuccess("Draft/rejected dihapus", `${validRows.length} rencana dibatalkan.`);
      setSelectedRows([]);
    }
  }

  async function cancelRejectedRows(rowsToCancel: PlannerRow[]) {
    if (rowsToCancel.length === 0 || isSaving) return;
    const validRows = rowsToCancel.filter((row) =>
      row.planId
      && row.version
      && row.approvalState === "REJECTED"
      && row.createdBy === userId
    );
    if (validRows.length !== rowsToCancel.length) {
      setError("Hanya plan rejected milik pengaju yang bisa dihapus.");
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: `Hapus ${validRows.length} plan rejected?`,
      description: "Plan akan dibatalkan dan tidak tampil di daftar approval.",
      confirmLabel: "Hapus",
      tone: "error",
    });
    if (!confirmed) return;
    setIsSaving(true);
    let failed = 0;
    for (const row of validRows) {
      const result = await mutateJobPlanApproval(row.planId as string, {
        action: "cancel",
        userId,
        commandId: createJobPlanCommandId("web-cancel-rejected"),
        expectedVersion: row.version as number,
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
      sweetAlert.notifySuccess("Plan rejected dihapus", `${validRows.length} plan dibatalkan.`);
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
            <div className="flex flex-wrap items-center gap-2">
              {mode === "planner" ? (
                <div className="inline-flex h-9 border border-border bg-background" aria-label="Mode pekerjaan">
                  {([
                    ["all", "Semua", "Tampilkan semua mode"],
                    ["normal", "Normal", "Normal 08-17"],
                    ["overtime", "Lembur", "Lembur 17-22"],
                  ] as const).map(([value, label, title]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkModeFilter((current) => current === value && value !== "all" ? "all" : value)}
                      title={title}
                      className={`border-r border-border px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] last:border-r-0 ${
                        workModeFilter === value
                          ? "bg-primary/15 text-app-accent-ink"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                {(["planner", "approval"] as const).map((nextMode) => (
                  <ActionButton key={nextMode} variant={mode === nextMode ? "primary" : "default"} onClick={() => setMode(nextMode)}>
                    {nextMode === "planner" ? "Perencanaan" : "Persetujuan"}
                  </ActionButton>
                ))}
              </div>
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
          setWorkModeFilter("all");
        }}>Reset</ActionButton>
        <ActionButton onClick={openReportPrint}>Print</ActionButton>
      </div>
      {error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "planner" && canCreate ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex border border-border bg-card">
              <button type="button" onClick={addDraft} className="border-r border-border px-3 py-2 font-mono text-[12px] uppercase text-foreground hover:bg-muted">
                Buat Plan
              </button>
              <button
                type="button"
                onClick={() => {
                  const startTime = startTimeForWorkMode(defaultDraftWorkMode);
                  setAdditionalJobForm((current) => ({ ...current, startTime, finishTime: minutesToTime((Number(startTime.slice(0, 2)) * 60) + 60) }));
                  setAdditionalJobOpen(true);
                }}
                className="px-3 py-2 font-mono text-[12px] uppercase text-app-accent-ink hover:bg-primary/10"
              >
                + Jobdesc Tambahan
              </button>
            </div>
            {drafts.length + editDrafts.length > 0 ? (
              <div className="inline-flex border border-primary/30 bg-primary/[0.04]">
                <button type="button" disabled={isSaving} onClick={() => void saveDrafts()} className="border-r border-primary/20 px-3 py-2 font-mono text-[12px] uppercase text-app-accent-ink hover:bg-primary/10 disabled:opacity-40">
                  {isSaving ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setDrafts([]);
                    setEditDrafts([]);
                    setError(null);
                  }}
                  className="px-3 py-2 font-mono text-[12px] uppercase text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  Batal
                </button>
              </div>
            ) : null}
          </div>
        ) : <span />}
        {mode === "approval" && canApprove ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{selectedRows.length} dipilih</span>
            <ActionButton variant="success" disabled={!canBulkReviewSelected || isSaving} onClick={() => void reviewRows(approvableSelectedRows, "approve")}>Setujui</ActionButton>
            <ActionButton variant="danger" disabled={!canBulkReviewSelected || isSaving} onClick={() => setRejectDialogOpen(true)}>Tolak</ActionButton>
            {approvableSelectedRows.length > 0 && !sameApprovalStage(approvableSelectedRows) ? <span className="text-destructive">Tahap persetujuan harus sama.</span> : null}
          </div>
        ) : null}
        {mode === "approval" && canCreate && rejectedOwnerSelectedRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{rejectedOwnerSelectedRows.length} rejected dipilih</span>
            <ActionButton disabled={isSaving} onClick={() => editRejectedRows(rejectedOwnerSelectedRows)}>Edit Draft</ActionButton>
            <ActionButton variant="danger" disabled={isSaving} onClick={() => void cancelRejectedRows(rejectedOwnerSelectedRows)}>Hapus Rejected</ActionButton>
          </div>
        ) : null}
        {mode === "planner" && canCreate && selectedRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{selectedRows.length} dipilih</span>
            <ActionButton disabled={editableSelectedRows.length === 0 || isSaving} onClick={() => editRows(editableSelectedRows)}>Edit Draft</ActionButton>
            <ActionButton variant="success" disabled={submittableSelectedRows.length === 0 || isSaving} onClick={() => void submitRows(submittableSelectedRows)}>Ajukan</ActionButton>
            <ActionButton variant="danger" disabled={cancellableSelectedRows.length === 0 || isSaving} onClick={() => void cancelDraftRows(cancellableSelectedRows)}>Hapus Draft</ActionButton>
          </div>
        ) : null}
      </div>
      {additionalJobOpen ? (
        <AdditionalJobDialog
          value={additionalJobForm}
          divisionOptions={teamOptions()}
          unitOptions={additionalDialogUnitOptions}
          componentOptions={additionalDialogComponentOptions}
          componentDisabled={additionalDialogComponentDisabled}
          panelOptions={additionalDialogPanelOptions}
          partOptions={additionalDialogPartOptions}
          jobTypeOptions={additionalDialogJobOptions}
          employeeOptions={additionalDialogEmployeeOptions}
          onChange={updateAdditionalJobForm}
          onDivisionChange={changeAdditionalTeam}
          onUnitChange={changeAdditionalUnit}
          onPanelChange={changeAdditionalPanel}
          onPartChange={changeAdditionalPart}
          onTimeChange={changeAdditionalTime}
          onCancel={() => setAdditionalJobOpen(false)}
          onSubmit={addAdditionalJobDraft}
        />
      ) : null}
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
        singleClickEdit
        enterNavigatesVertically
        enterNavigatesVerticallyAfterEdit
        tabToNextCell={tabToNextCell}
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
