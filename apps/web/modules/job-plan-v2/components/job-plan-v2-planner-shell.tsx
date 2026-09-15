"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createJobPlanV2,
  createJobPlanV2CommandId,
  fetchJobPlanV2List,
} from "@/shared/api/job-plan-v2";
import { SmsAgGrid, SmsGridDraftActions } from "@/shared/datagrid/sms-ag-grid";
import { SmartSelectCellEditor, type SmartSelectOption } from "@/modules/units/components/master-panel-smart-select-editor";
import {
  buildCreateJobPlanV2Payload,
  createJobPlanV2Draft,
  minutesToDuration,
  minutesToTime,
  toJobPlanV2DisplayRows,
  validateJobPlanV2Draft,
  type JobPlanV2DisplayRow,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanV2PlannerDraft,
} from "../job-plan-v2-planner";
import { parseClipboardTsv } from "@/shared/datagrid/clipboard";
import { parseSmsDate, parseSmsDurationMinutes, parseSmsReference, parseSmsTime } from "@/shared/datagrid/parsers";

type PlannerRow = JobPlanV2DisplayRow | (JobPlanV2DisplayRow & JobPlanV2PlannerDraft);

interface JobPlanV2PlannerShellProps {
  userId: string;
  canCreate: boolean;
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
    execution: "Belum Mulai",
    ledger: "Belum Materialized",
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

function ActionCell(params: ICellRendererParams<PlannerRow>) {
  const row = params.data;
  if (!row) return null;
  if (row.isNew) {
    return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
  }
  return <span className="text-[12px] text-muted-foreground">Read only</span>;
}

export function JobPlanV2PlannerShell({
  userId,
  canCreate,
  initialCoreId,
  initialDate,
  initialMode,
  countdowns,
  employees,
}: JobPlanV2PlannerShellProps) {
  const [items, setItems] = useState<JobPlanV2ReadItem[]>([]);
  const [drafts, setDrafts] = useState<JobPlanV2PlannerDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedContext = useMemo(() => contextForCore(countdowns, initialCoreId), [countdowns, initialCoreId]);
  const countdownOptions = useMemo(() => toOptions(countdowns), [countdowns]);
  const employeeOptions = useMemo(() => toOptions(employees), [employees]);

  async function load() {
    setIsLoading(true);
    const result = await fetchJobPlanV2List({
      userId,
      view: "browse",
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
  }, [userId, initialCoreId, initialDate]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (drafts.length === 0) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts.length]);

  const rows = useMemo<PlannerRow[]>(() => [
    ...toJobPlanV2DisplayRows(items, countdowns, employees),
    ...drafts.map((draft) => draftToDisplay(draft, countdowns, employees)),
  ], [countdowns, drafts, employees, items]);

  const columnDefs = useMemo<ColDef<PlannerRow>[]>(() => [
    { headerName: "Unit", field: "unitName", editable: false, minWidth: 125 },
    { headerName: "Panel", field: "panelName", editable: false, minWidth: 150, flex: 0.9 },
    {
      headerName: "Jobdesc",
      field: "coreId",
      editable: ({ data }) => Boolean(data?.isNew) && !initialCoreId && countdownOptions.length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: countdownOptions },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value, data }) => data?.isNew
        ? countdownOptions.find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.jobDescription ?? "",
      minWidth: 220,
      flex: 1.25,
    },
    {
      headerName: "PIC",
      field: "employeeId",
      editable: ({ data }) => Boolean(data?.isNew) && employeeOptions.length > 1,
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
    { headerName: "Divisi", field: "divisionName", editable: false, minWidth: 115 },
    { headerName: "Tanggal", field: "taskDate", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 115 },
    { headerName: "Mulai", field: "startTime", editable: ({ data }) => Boolean(data?.isNew), minWidth: 85 },
    { headerName: "Selesai", field: "finishTime", editable: false, minWidth: 85 },
    { headerName: "Durasi", field: "durationText", editable: ({ data }) => Boolean(data?.isNew), minWidth: 85 },
    { headerName: "Approval", field: "approval", editable: false, minWidth: 130 },
    { headerName: "Execution", field: "execution", editable: false, minWidth: 135 },
    { headerName: "Ledger", field: "ledger", editable: false, minWidth: 130 },
    { headerName: "Sync", field: "sync", editable: false, minWidth: 105 },
    { headerName: "Tindakan", field: "error", editable: false, cellRenderer: ActionCell, minWidth: 130, pinned: "right" },
  ], [countdownOptions, employeeOptions, initialCoreId]);

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
    if (!row.isNew) return;
    setDrafts((current) => current.map((draft) => draft.clientId === row.clientId ? {
      ...draft,
      coreId: String(row.coreId ?? ""),
      employeeId: String(row.employeeId ?? ""),
      taskDate: String(row.taskDate ?? ""),
      startTime: String(row.startTime ?? ""),
      durationText: String(row.durationText ?? ""),
      jobDescription: String(row.jobDescription ?? ""),
      note: String(row.note ?? ""),
      isPriority: Boolean(row.isPriority),
      error: null,
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
    const editableFields = ["coreId", "employeeId", "taskDate", "startTime", "durationText"];
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
      }
      nextDrafts[draftIndex] = draft;
    }

    setDrafts(nextDrafts);
  }

  async function saveDrafts() {
    if (drafts.length === 0 || isSaving) return;

    const validated = drafts.map((row) => ({ ...row, error: validateJobPlanV2Draft(row) }));
    const firstError = validated.find((row) => row.error);
    if (firstError) {
      setDrafts(validated);
      setError(firstError.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    const failed: JobPlanV2PlannerDraft[] = [];

    for (const row of validated) {
      const result = await createJobPlanV2(buildCreateJobPlanV2Payload(row, userId, createJobPlanV2CommandId("web-job-plan")));
      if (!result.success) {
        failed.push({ ...row, error: result.message });
      }
    }

    setDrafts(failed);
    await load();
    setIsSaving(false);
    if (failed.length > 0) setError(`${failed.length} draft belum tersimpan.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
        <div>
          <p className="text-[12px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Job Plan V2</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Planner</h1>
          {selectedContext ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedContext.unitName} · {selectedContext.panelName ?? "-"} · {selectedContext.jobName ?? selectedContext.label}
            </p>
          ) : null}
          {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/job-plan" className="border border-border px-3 py-1.5 text-[12px] font-mono uppercase text-muted-foreground hover:text-foreground">
            Legacy
          </Link>
          <SmsGridDraftActions
            canCreate={canCreate}
            hasDrafts={drafts.length > 0}
            isSaving={isSaving}
            onAdd={addDraft}
            onSave={() => void saveDrafts()}
            onCancel={() => {
              setDrafts([]);
              setError(null);
            }}
          />
        </div>
      </div>
      {canCreate && employees.length === 0 ? (
        <p className="border border-warning/25 bg-warning/[0.06] px-3 py-2 text-sm text-warning">
          Referensi PIC belum tersedia. Pembuatan Job Plan V2 ditahan agar tidak menebak employeeId.
        </p>
      ) : null}
      <SmsAgGrid<PlannerRow>
        heightClassName="h-[calc(100vh-245px)] min-h-[28rem]"
        rowData={rows}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.clientId}
        loading={isLoading}
        onCellValueChanged={updateDraft}
        onCellKeyDown={(event) => {
          if ("column" in event) void handleGridKeyDown(event);
        }}
        emptyMessage="Belum ada Job Plan V2."
      />
    </div>
  );
}
