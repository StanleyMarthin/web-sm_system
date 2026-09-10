"use client";

import type { UnitPanelActivity, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { WoCreateRequest } from "@smsystem/contracts/wo";
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createWo } from "@/shared/api/wo";
import { SmartSelectCellEditor, type SmartSelectOption } from "./master-panel-smart-select-editor";

const ICON_STROKE_WIDTH = 2.4;

interface MasterPanelWoGridProps {
  detail: UnitPanelDetail;
  canCreateWo: boolean;
  onCreated: () => Promise<void>;
}

interface WoGridRow {
  clientId: string;
  id: string | null;
  isNew: boolean;
  woNumber: string;
  requestDate: string;
  toDivisionId: string;
  toDivisionName: string;
  jobDetail: string;
  estimatedHours: number | null;
  isPriority: boolean;
  notes: string;
  status: string;
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

function singleValue(options: SmartSelectOption[]): string {
  return options.length === 1 ? options[0].value : "";
}

function makeDraftRow(divisionOptions: SmartSelectOption[]): WoGridRow {
  return {
    clientId: `draft-${crypto.randomUUID()}`,
    id: null,
    isNew: true,
    woNumber: "",
    requestDate: today(),
    toDivisionId: singleValue(divisionOptions),
    toDivisionName: "",
    jobDetail: "",
    estimatedHours: null,
    isPriority: false,
    notes: "",
    status: "Draft",
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
      requestDate: textMetadata(activity, "requestDate") || activity.date?.slice(0, 10) || "",
      toDivisionId: "",
      toDivisionName: textMetadata(activity, "toDivisionName") || "-",
      jobDetail: textMetadata(activity, "jobDetail") || activity.title,
      estimatedHours: numberMetadata(activity, "estimatedHours"),
      isPriority: boolMetadata(activity, "isPriority"),
      notes: "",
      status: activity.status ?? "-",
      error: null,
    }));
}

function validateDraft(row: WoGridRow): string | null {
  if (!row.toDivisionId) return "Divisi tujuan wajib dipilih.";
  if (!row.requestDate) return "Tanggal request wajib diisi.";
  if (!row.jobDetail.trim()) return "Detail pekerjaan wajib diisi.";
  if (row.jobDetail.trim().length > 1000) return "Detail pekerjaan maksimal 1000 karakter.";
  if (row.estimatedHours !== null && (!Number.isFinite(row.estimatedHours) || row.estimatedHours <= 0 || row.estimatedHours > 72)) {
    return "Estimasi jam harus 1 sampai 72.";
  }
  if (row.notes.trim().length > 1000) return "Catatan maksimal 1000 karakter.";
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
      estimatedHours: row.estimatedHours,
      notes: row.notes.trim() || null,
    }],
  };
}

function ActionRenderer(params: ICellRendererParams<WoGridRow>) {
  const row = params.data;
  if (!row?.isNew) return null;
  return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
}

export function MasterPanelWoGrid({ detail, canCreateWo, onCreated }: MasterPanelWoGridProps) {
  const existingRows = useMemo(() => toExistingRows(detail.activities), [detail.activities]);
  const divisionOptions = useMemo<SmartSelectOption[]>(
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
    {
      headerName: "Divisi Tujuan",
      field: "toDivisionId",
      editable: ({ data }) => Boolean(data?.isNew),
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: divisionOptions },
      valueFormatter: ({ value, data }) => data?.isNew
        ? divisionOptions.find((option) => option.value === String(value ?? ""))?.label ?? ""
        : data?.toDivisionName ?? "",
      minWidth: 160,
      flex: 0.9,
    },
    { headerName: "Pekerjaan", field: "jobDetail", editable: ({ data }) => Boolean(data?.isNew), flex: 1.5, minWidth: 220 },
    { headerName: "Estimasi", field: "estimatedHours", editable: ({ data }) => Boolean(data?.isNew), minWidth: 95, width: 105, valueParser: ({ newValue }) => newValue === "" || newValue === null ? null : Number(newValue) },
    { headerName: "Tanggal", field: "requestDate", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 120 },
    { headerName: "Prioritas", field: "isPriority", editable: ({ data }) => Boolean(data?.isNew), cellRenderer: "agCheckboxCellRenderer", cellEditor: "agCheckboxCellEditor", minWidth: 105, valueFormatter: ({ value }) => value ? "Tinggi" : "Normal" },
    { headerName: "Status", field: "status", editable: false, minWidth: 120 },
    { headerName: "Catatan", field: "notes", editable: ({ data }) => Boolean(data?.isNew), minWidth: 160, flex: 0.8 },
    { headerName: "Tindakan", field: "error", editable: false, cellRenderer: ActionRenderer, minWidth: 130, pinned: "right" },
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
              onClick={() => setDraftRows((current) => [...current, makeDraftRow(divisionOptions)])}
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
