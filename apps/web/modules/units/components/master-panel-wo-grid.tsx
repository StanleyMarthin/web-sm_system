"use client";

import type { UnitPanelActivity, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { WoCreateRequest } from "@smsystem/contracts/wo";
import type { CellValueChangedEvent, ColDef, ICellEditorParams, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, X } from "lucide-react";
import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { createWo } from "@/shared/api/wo";

const ICON_STROKE_WIDTH = 2.4;

interface MasterPanelWoGridProps {
  detail: UnitPanelDetail;
  canCreateWo: boolean;
  onCreated: () => Promise<void>;
}

interface DivisionOption {
  label: string;
  value: string;
}

interface WoGridRow {
  clientId: string;
  id: string | null;
  isNew: boolean;
  woNumber: string;
  unitName: string;
  requestDate: string;
  fromDivisionName: string;
  toDivisionId: string;
  toDivisionName: string;
  jobDetail: string;
  isPriority: boolean;
  status: string;
  agingHours: number | null;
  agingScore: number | null;
  linkedCountdownId: string;
  error: string | null;
}

function textMetadata(activity: UnitPanelActivity, key: string): string {
  const value = activity.metadata[key];
  return typeof value === "string" ? value : "";
}

function numberMetadata(activity: UnitPanelActivity, key: string): number | null {
  const value = activity.metadata[key];
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function boolMetadata(activity: UnitPanelActivity, key: string): boolean {
  return activity.metadata[key] === true;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeDraftRow(detail: UnitPanelDetail): WoGridRow {
  return {
    clientId: `draft-${crypto.randomUUID()}`,
    id: null,
    isNew: true,
    woNumber: "",
    unitName: detail.panel.carId,
    requestDate: today(),
    fromDivisionName: "Divisi user",
    toDivisionId: "",
    toDivisionName: "",
    jobDetail: "",
    isPriority: false,
    status: "Draft",
    agingHours: null,
    agingScore: null,
    linkedCountdownId: "",
    error: null,
  };
}

function toExistingRows(activities: UnitPanelActivity[]): WoGridRow[] {
  return activities
    .filter((activity) => activity.type === "WO")
    .map((activity) => ({
      clientId: `wo-${activity.id}`,
      id: activity.id,
      isNew: false,
      woNumber: textMetadata(activity, "woNumber") || activity.title,
      unitName: textMetadata(activity, "unitName") || "-",
      requestDate: textMetadata(activity, "requestDate") || activity.date?.slice(0, 10) || "",
      fromDivisionName: textMetadata(activity, "fromDivisionName") || "-",
      toDivisionId: "",
      toDivisionName: textMetadata(activity, "toDivisionName") || "-",
      jobDetail: textMetadata(activity, "jobDetail") || activity.title,
      isPriority: boolMetadata(activity, "isPriority"),
      status: activity.status ?? "-",
      agingHours: numberMetadata(activity, "agingHours"),
      agingScore: numberMetadata(activity, "agingScore"),
      linkedCountdownId: textMetadata(activity, "linkedCountdownId"),
      error: null,
    }));
}

function validateDraft(row: WoGridRow): string | null {
  if (!row.toDivisionId) return "Divisi tujuan wajib dipilih.";
  if (!row.requestDate) return "Tanggal request wajib diisi.";
  if (!row.jobDetail.trim()) return "Detail pekerjaan wajib diisi.";
  if (row.jobDetail.trim().length > 1000) return "Detail pekerjaan maksimal 1000 karakter.";
  return null;
}

function buildPayload(detail: UnitPanelDetail, row: WoGridRow): WoCreateRequest {
  return {
    carId: detail.unitId,
    masterPanelId: detail.panel.id,
    panelName: null,
    toDivisionId: Number(row.toDivisionId),
    requestDate: row.requestDate,
    isPriority: row.isPriority,
    jobDetail: null,
    estimatedHours: null,
    notes: null,
    items: [{
      jobDetail: row.jobDetail.trim(),
      panelName: null,
      sectionName: null,
      panelCategory: null,
      addPanelToMaster: false,
      estimatedHours: null,
      notes: null,
    }],
  };
}

const DivisionCellEditor = forwardRef(function DivisionCellEditor(
  props: ICellEditorParams<WoGridRow, string> & { values?: DivisionOption[] },
  ref,
) {
  const [value, setValue] = useState(String(props.value ?? ""));
  useImperativeHandle(ref, () => ({ getValue: () => value }));
  return (
    <select
      autoFocus
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="h-full w-full bg-card px-2 text-[13px] text-foreground outline-none"
    >
      <option value="">Pilih divisi</option>
      {(props.values ?? []).map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
});

function ActionRenderer(params: ICellRendererParams<WoGridRow>) {
  const row = params.data;
  if (!row?.isNew) return null;
  return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
}

export function MasterPanelWoGrid({ detail, canCreateWo, onCreated }: MasterPanelWoGridProps) {
  const existingRows = useMemo(() => toExistingRows(detail.activities), [detail.activities]);
  const divisionOptions = useMemo<DivisionOption[]>(
    () => detail.countdownReferences.divisions.map((division) => ({
      label: division.label,
      value: String(division.value),
    })),
    [detail.countdownReferences.divisions],
  );
  const [draftRows, setDraftRows] = useState<WoGridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => [...existingRows, ...draftRows], [draftRows, existingRows]);

  const columnDefs = useMemo<ColDef<WoGridRow>[]>(() => [
    { headerName: "WO", field: "woNumber", editable: false, minWidth: 130 },
    { headerName: "Unit", field: "unitName", editable: false, minWidth: 130 },
    { headerName: "Dari", field: "fromDivisionName", editable: false, minWidth: 130 },
    {
      headerName: "Ke",
      field: "toDivisionId",
      editable: ({ data }) => Boolean(data?.isNew),
      cellEditor: DivisionCellEditor,
      cellEditorParams: { values: divisionOptions },
      valueFormatter: ({ value, data }) => data?.isNew
        ? divisionOptions.find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.toDivisionName ?? "",
      minWidth: 150,
    },
    { headerName: "Pekerjaan", field: "jobDetail", editable: ({ data }) => Boolean(data?.isNew), flex: 1, minWidth: 220 },
    { headerName: "Status", field: "status", editable: false, minWidth: 130 },
    { headerName: "Tanggal", field: "requestDate", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 120 },
    { headerName: "Aging", field: "agingHours", editable: false, minWidth: 95 },
    { headerName: "Risk", field: "agingScore", editable: false, minWidth: 90 },
    { headerName: "Prioritas", field: "isPriority", editable: ({ data }) => Boolean(data?.isNew), cellRenderer: "agCheckboxCellRenderer", cellEditor: "agCheckboxCellEditor", minWidth: 110, valueFormatter: ({ value }) => value ? "Tinggi" : "Normal" },
    { headerName: "Countdown Terkait", field: "linkedCountdownId", editable: false, minWidth: 170 },
    { headerName: "Action", field: "error", editable: false, cellRenderer: ActionRenderer, minWidth: 150 },
  ], [divisionOptions]);

  function updateDraft(event: CellValueChangedEvent<WoGridRow>) {
    const row = event.data;
    if (!row.isNew) return;
    setDraftRows((current) => current.map((draft) => draft.clientId === row.clientId ? { ...row, error: null } : draft));
  }

  async function saveDrafts() {
    if (draftRows.length === 0 || isSaving) return;

    const validated = draftRows.map((row) => ({ ...row, error: validateDraft(row) }));
    const firstError = validated.find((row) => row.error);
    if (firstError) {
      setDraftRows(validated);
      setError(firstError.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    for (const row of validated) {
      const result = await createWo(buildPayload(detail, row));
      if (!result.success) {
        setDraftRows((current) => current.map((draft) => draft.clientId === row.clientId ? { ...draft, error: result.message } : draft));
        setError(result.message);
        setIsSaving(false);
        return;
      }
    }
    setDraftRows([]);
    await onCreated();
    setIsSaving(false);
  }

  return (
    <div className="space-y-3 border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Work Order</p>
          {error ? <p className="mt-1 text-[13px] text-destructive">{error}</p> : null}
        </div>
        {canCreateWo ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraftRows((current) => [...current, makeDraftRow(detail)])}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-foreground hover:bg-muted disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Row
            </button>
            <button
              type="button"
              onClick={() => void saveDrafts()}
              disabled={draftRows.length === 0 || isSaving}
              className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/[0.06] px-2 py-1 text-[12px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftRows([]);
                setError(null);
              }}
              disabled={draftRows.length === 0 || isSaving}
              className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> Batal
            </button>
          </div>
        ) : null}
      </div>
      <div className="ag-theme-alpine sms-ag-grid h-[18rem] w-full">
        <AgGridReact<WoGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true,
            suppressHeaderMenuButton: true,
          }}
          getRowId={({ data }) => data.clientId}
          rowHeight={42}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          suppressMovableColumns
          onCellValueChanged={updateDraft}
          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada Work Order untuk part ini.</span>"
        />
      </div>
    </div>
  );
}
