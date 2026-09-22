"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { JobPlanRecord } from "@smsystem/contracts/job-plan";
import type { CellValueChangedEvent, ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import {
  createJobPlanV2CommandId,
  fetchJobPlanV2List,
  manualExecuteJobPlanV2,
  monitorJobPlanV2,
  validateJobPlanV2,
} from "@/shared/api/job-plan-v2";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactDateInput, MetricBar, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import {
  buildManualExecutionJobPlanV2Payload,
  createManualExecutionDraft,
  minutesToDuration,
  toJobPlanV2DisplayRows,
  toLocalDateValue,
  validateManualExecutionDraft,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanV2DisplayRow,
  type JobPlanV2ManualExecutionDraft,
} from "../job-plan-planner";

interface JobActualShellProps {
  userId: string;
  canInput: boolean;
  canMonitor: boolean;
  canValidate: boolean;
  initialDate: string | null;
  countdowns: JobPlanCountdownOption[];
  employees: JobPlanEmployeeOption[];
  actualRows: JobPlanRecord[];
}

function monitoringStatus(row: JobPlanV2DisplayRow) {
  if (row.persistedWorkMinutes > 0) return "Tercatat";
  if (row.unverifiedWorkMinutes > 0) return "Menunggu monitoring";
  return "Belum ada hasil";
}

function qcStatus(row: JobPlanV2DisplayRow, actual?: JobPlanRecord) {
  if (actual?.actualValidationStatus === "done") return "QC selesai";
  if (actual?.actualValidationStatus === "hold") return "QC hold";
  if (actual?.actualValidationStatus === "onprogress") return "Monitoring";
  if (row.executionState === "VALIDATED") return "QC selesai";
  if (row.executionState === "FINISHED_PENDING_VALIDATION") return "Menunggu QC";
  return "Belum QC";
}

function dateTimeText(date: string, time: string) {
  return `${date} ${time}`;
}

function createActualDraft(row: JobPlanV2DisplayRow): JobPlanV2ManualExecutionDraft {
  return {
    ...createManualExecutionDraft(row),
    actualStart: `${row.taskDate}T${row.startTime}`,
    actualFinish: `${row.taskDate}T${row.finishTime}`,
  };
}

export function JobActualShell({
  userId,
  canInput,
  canMonitor,
  canValidate,
  initialDate,
  countdowns,
  employees,
  actualRows,
}: JobActualShellProps) {
  const [items, setItems] = useState<JobPlanV2ReadItem[]>([]);
  const [dateFilter, setDateFilter] = useState(initialDate ?? toLocalDateValue());
  const [divisionFilter, setDivisionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<JobPlanV2ManualExecutionDraft | null>(null);
  const [selectedRows, setSelectedRows] = useState<JobPlanV2DisplayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sweetAlert = useSweetAlert();

  async function load() {
    setIsLoading(true);
    const result = await fetchJobPlanV2List({ userId, view: "execution", date: dateFilter });
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
  }, [userId, dateFilter]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!draft) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft]);

  const rows = useMemo(() => toJobPlanV2DisplayRows(items, countdowns, employees), [countdowns, employees, items]);
  const actualByPlanId = useMemo(() => new Map(actualRows.map((row) => [row.planId, row])), [actualRows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (dateFilter && row.taskDate !== dateFilter) return false;
    if (divisionFilter && row.divisionName !== divisionFilter) return false;
    if (statusFilter && row.executionState !== statusFilter && row.approvalState !== statusFilter) return false;
    return true;
  }), [dateFilter, divisionFilter, rows, statusFilter]);

  const divisionOptions = useMemo(() => [...new Set(rows.map((row) => row.divisionName).filter(Boolean))].sort(), [rows]);
  const summaryItems = useMemo(() => [
    { label: "Siap Input", value: rows.filter((row) => row.approvalState === "APPROVED" && row.executionState === "NOT_STARTED").length },
    { label: "Menunggu QC", value: rows.filter((row) => row.executionState === "FINISHED_PENDING_VALIDATION").length, tone: "warn" as const },
    { label: "QC Selesai", value: rows.filter((row) => row.executionState === "VALIDATED").length, tone: "up" as const },
  ], [rows]);

  const columnDefs = useMemo<ColDef<JobPlanV2DisplayRow>[]>(() => [
    { headerName: "", width: 44, pinned: "left", sortable: false, filter: false, checkboxSelection: true, headerCheckboxSelection: true },
    { headerName: "TEAM", field: "divisionName", minWidth: 125, pinned: "left" },
    { headerName: "PERSONIL", field: "employeeName", minWidth: 155, flex: 0.8 },
    { headerName: "NAMA UNIT", field: "unitName", minWidth: 120 },
    { headerName: "NAMA PANEL / PART", field: "panelName", minWidth: 160, flex: 0.9 },
    { headerName: "JOB DESCRIPTION", field: "jobDescription", minWidth: 220, flex: 1.1 },
    { headerName: "INTRUKSI", field: "instructionText", minWidth: 180, flex: 0.9 },
    { headerName: "PLAN START", field: "startTime", minWidth: 135, valueFormatter: ({ data }) => data ? dateTimeText(data.taskDate, data.startTime) : "" },
    { headerName: "PLAN FINISH", field: "finishTime", minWidth: 135, valueFormatter: ({ data }) => data ? dateTimeText(data.taskDate, data.finishTime) : "" },
    { headerName: "ACTUAL START", minWidth: 125, valueGetter: ({ data }) => data?.planId ? actualByPlanId.get(data.planId)?.actualStartTime ?? "-" : "-" },
    { headerName: "ACTUAL FINISH", minWidth: 125, valueGetter: ({ data }) => data?.planId ? actualByPlanId.get(data.planId)?.actualFinishTime ?? "-" : "-" },
    {
      headerName: "DURASI AKTUAL",
      field: "accumulatedWorkMinutes",
      minWidth: 120,
      valueFormatter: ({ data, value }) => {
        const actual = data?.planId ? actualByPlanId.get(data.planId) : null;
        return actual?.actualProgressPercent != null
          ? `${minutesToDuration(Number(value ?? 0))} · ${actual.actualProgressPercent}%`
          : minutesToDuration(Number(value ?? 0));
      },
    },
    { headerName: "MONITORING", minWidth: 145, valueGetter: ({ data }) => data ? monitoringStatus(data) : "", cellRenderer: ({ data }: ICellRendererParams<JobPlanV2DisplayRow>) => data ? <DataGridStatusBadge value={monitoringStatus(data)} /> : null },
    { headerName: "QC", minWidth: 120, valueGetter: ({ data }) => data ? qcStatus(data, data.planId ? actualByPlanId.get(data.planId) : undefined) : "", cellRenderer: ({ data }: ICellRendererParams<JobPlanV2DisplayRow>) => data ? <DataGridStatusBadge value={qcStatus(data, data.planId ? actualByPlanId.get(data.planId) : undefined)} /> : null },
    { headerName: "CATATAN", field: "note", minWidth: 180, flex: 0.8, valueGetter: ({ data }) => data?.planId ? actualByPlanId.get(data.planId)?.actualValidationNote ?? data.note : data?.note ?? "" },
    {
      headerName: "AKSI",
      width: 230,
      pinned: "right",
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<JobPlanV2DisplayRow>) => data ? (
        <div className="flex h-full items-center gap-1">
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canInput || !data.planId || !data.version} onClick={() => setDraft(createActualDraft(data))}>Input</button>
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canMonitor || !data.planId || !data.version || data.accumulatedWorkMinutes <= 0} onClick={() => void monitorRow(data)}>Monitor</button>
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canValidate || !data.planId || !data.version || data.accumulatedWorkMinutes <= 0} onClick={() => void validateRow(data)}>QC</button>
        </div>
      ) : null,
    },
  ], [actualByPlanId, canInput, canMonitor, canValidate]);

  const draftColumns = useMemo<ColDef<JobPlanV2ManualExecutionDraft>[]>(() => [
    { headerName: "ACTUAL START", field: "actualStart", editable: true, minWidth: 165, flex: 0.8 },
    { headerName: "ACTUAL FINISH", field: "actualFinish", editable: true, minWidth: 165, flex: 0.8 },
    { headerName: "DURASI", field: "actualMinutesText", editable: true, minWidth: 105 },
    { headerName: "HASIL", field: "result", editable: true, minWidth: 180, flex: 1 },
    { headerName: "CATATAN", field: "note", editable: true, minWidth: 180, flex: 1 },
    { headerName: "DOKUMENTASI", field: "attachmentRef", editable: true, minWidth: 180, flex: 0.9 },
    { headerName: "STATUS", field: "error", minWidth: 170, cellRenderer: ({ data }: ICellRendererParams<JobPlanV2ManualExecutionDraft>) => data?.error ? <span className="text-[12px] text-destructive">{data.error}</span> : <span className="text-[12px] text-muted-foreground">Draft hasil</span> },
  ], []);

  async function saveActual() {
    if (!draft || isSaving) return;
    const message = validateManualExecutionDraft(draft);
    if (message) {
      setDraft({ ...draft, error: message });
      return;
    }
    setIsSaving(true);
    const result = await manualExecuteJobPlanV2(draft.planId, buildManualExecutionJobPlanV2Payload(draft, userId, createJobPlanV2CommandId("web-actual")));
    if (!result.success) {
      setDraft({ ...draft, error: result.message });
      setError(result.message);
    } else {
      setDraft(null);
      await load();
    }
    setIsSaving(false);
  }

  async function monitorRow(row: JobPlanV2DisplayRow) {
    if (!row.planId || !row.version || isSaving) return;
    setIsSaving(true);
    const result = await monitorJobPlanV2(row.planId, {
      userId,
      commandId: createJobPlanV2CommandId("web-monitor"),
      expectedVersion: row.version,
      verifiedTotalMinutes: row.accumulatedWorkMinutes,
      progressSeen: 100,
      note: null,
    });
    if (!result.success) setError(result.message);
    await load();
    setIsSaving(false);
  }

  async function validateRow(row: JobPlanV2DisplayRow) {
    if (!row.planId || !row.version || isSaving) return;
    const confirmed = await sweetAlert.confirm({
      title: "QC hasil pekerjaan?",
      description: `${row.unitName} · ${row.jobDescription}`,
      confirmLabel: "QC",
    });
    if (!confirmed) return;
    setIsSaving(true);
    const result = await validateJobPlanV2(row.planId, {
      userId,
      commandId: createJobPlanV2CommandId("web-qc"),
      expectedVersion: row.version,
      verifiedTotalMinutes: row.accumulatedWorkMinutes,
      progressSeen: 100,
      note: null,
    });
    if (!result.success) setError(result.message);
    await load();
    setIsSaving(false);
  }

  function bulkValidate() {
    const validRows = selectedRows.filter((row) => row.planId && row.version && row.accumulatedWorkMinutes > 0);
    void (async () => {
      if (validRows.length === 0 || isSaving) return;
      const confirmed = await sweetAlert.confirm({
        title: `QC ${validRows.length} hasil pekerjaan?`,
        description: "Semua baris terpilih yang valid akan diproses.",
        confirmLabel: "QC",
      });
      if (!confirmed) return;
      setIsSaving(true);
      for (const row of validRows) {
        if (!row.planId || !row.version) continue;
        const result = await validateJobPlanV2(row.planId, {
          userId,
          commandId: createJobPlanV2CommandId("web-qc-bulk"),
          expectedVersion: row.version,
          verifiedTotalMinutes: row.accumulatedWorkMinutes,
          progressSeen: 100,
          note: null,
        });
        if (!result.success) setError(result.message);
      }
      await load();
      setIsSaving(false);
    })();
  }

  return (
    <div className="space-y-3">
      {sweetAlert.alertElement}
      <div className="border border-border bg-card px-3 py-2 shadow-sm">
        <PageHeader eyebrow="JOB ACTUAL" title="Hasil Pekerjaan" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <MetricBar items={summaryItems} />
          <p className="text-[11px] text-muted-foreground">{filteredRows.length} dari {rows.length} baris</p>
        </div>
      </div>

      <div className="relative z-40 flex flex-wrap items-end gap-2 border border-border bg-card px-3 py-2">
        <div className="min-w-[9rem] flex-1">
          <span className="text-[11px] text-muted-foreground">Tanggal</span>
          <CompactDateInput value={dateFilter} onChange={setDateFilter} className="mt-1" panelClassName="z-[100] w-[17rem]" />
        </div>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Divisi
          <select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua divisi</option>
            {divisionOptions.map((division) => <option key={division} value={division}>{division}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua status</option>
            <option value="APPROVED">Siap input</option>
            <option value="RUNNING">Berjalan</option>
            <option value="HOLD">Ditahan</option>
            <option value="FINISHED_PENDING_VALIDATION">Menunggu QC</option>
            <option value="VALIDATED">QC selesai</option>
          </select>
        </label>
        <ActionButton onClick={() => {
          setDateFilter(initialDate ?? toLocalDateValue());
          setDivisionFilter("");
          setStatusFilter("");
        }}>Reset</ActionButton>
      </div>

      {error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {draft ? (
        <div className="space-y-2 border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Input Hasil</p>
              <h2 className="text-sm font-semibold text-foreground">Start, finish, durasi, hasil, dan dokumentasi</h2>
            </div>
            <div className="flex gap-2">
              <ActionButton onClick={() => setDraft(null)}>Batal</ActionButton>
              <ActionButton variant="primary" disabled={isSaving} onClick={() => void saveActual()}>{isSaving ? "Menyimpan..." : "Simpan Hasil"}</ActionButton>
            </div>
          </div>
          <SmsAgGrid<JobPlanV2ManualExecutionDraft>
            heightClassName="h-44"
            rowData={[draft]}
            columnDefs={draftColumns}
            getRowId={(params) => params.data.clientId}
            onCellValueChanged={(event: CellValueChangedEvent<JobPlanV2ManualExecutionDraft>) => setDraft({ ...event.data, error: null })}
            emptyMessage="Belum ada draft hasil."
          />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <ActionButton disabled={!canValidate || selectedRows.length === 0 || isSaving} onClick={bulkValidate}>QC Terpilih</ActionButton>
      </div>

      <SmsAgGrid<JobPlanV2DisplayRow>
        heightClassName="h-[calc(100vh-330px)] min-h-[28rem]"
        rowData={filteredRows}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.clientId}
        loading={isLoading}
        rowSelection="multiple"
        defaultColDef={{ floatingFilter: true, filter: "agTextColumnFilter", filterParams: { trimInput: true, debounceMs: 150 } }}
        onSelectionChanged={(event: SelectionChangedEvent<JobPlanV2DisplayRow>) => setSelectedRows(event.api.getSelectedRows())}
        emptyMessage="Belum ada Job Actual."
      />
    </div>
  );
}
