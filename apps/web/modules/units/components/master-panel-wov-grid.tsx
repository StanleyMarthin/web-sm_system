"use client";

import type { CreateVendorRequest } from "@smsystem/contracts/vendor";
import type { UnitPanelActivity, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { CellValueChangedEvent, ColDef, ICellEditorParams, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, X } from "lucide-react";
import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { createVendor } from "@/shared/api/vendor";

const ICON_STROKE_WIDTH = 2.4;

interface MasterPanelWovGridProps {
  detail: UnitPanelDetail;
  canCreateVendor: boolean;
  onCreated: () => Promise<void>;
}

interface Option {
  label: string;
  value: string;
}

interface WovGridRow {
  clientId: string;
  id: string | null;
  isNew: boolean;
  wovNumber: string;
  unitName: string;
  vendorName: string;
  itemName: string;
  accTracking: string;
  status: string;
  targetDateReturn: string;
  qcStatus: string;
  agingDays: number | null;
  riskScore: number | null;
  parentKey: string;
  quantity: number | null;
  uom: string;
  goodsConditionOut: string;
  estimatedCost: number | null;
  remarks: string;
  error: string | null;
}

function textMetadata(activity: UnitPanelActivity, key: string): string {
  const value = activity.metadata[key];
  return typeof value === "string" ? value : "";
}

function numberMetadata(activity: UnitPanelActivity, key: string): number | null {
  const value = Number(activity.metadata[key]);
  return Number.isFinite(value) ? value : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parentOptions(detail: UnitPanelDetail): Option[] {
  return detail.activities
    .filter((activity) => activity.type === "COUNTDOWN" || activity.type === "PR")
    .map((activity) => ({
      value: `${activity.type}:${activity.id}`,
      label: `${activity.type === "COUNTDOWN" ? "Countdown" : "PR"} - ${activity.title}`,
    }));
}

function makeDraftRow(detail: UnitPanelDetail): WovGridRow {
  const firstParent = parentOptions(detail)[0]?.value ?? "";
  return {
    clientId: `wov-draft-${crypto.randomUUID()}`,
    id: null,
    isNew: true,
    wovNumber: "",
    unitName: detail.panel.carId,
    vendorName: "",
    itemName: detail.panel.name,
    accTracking: "Draft",
    status: "OPEN",
    targetDateReturn: today(),
    qcStatus: "-",
    agingDays: null,
    riskScore: null,
    parentKey: firstParent,
    quantity: 1,
    uom: "pcs",
    goodsConditionOut: "",
    estimatedCost: null,
    remarks: "",
    error: null,
  };
}

function toExistingRows(detail: UnitPanelDetail): WovGridRow[] {
  return detail.activities
    .filter((activity) => activity.type === "WOV")
    .map((activity) => ({
      clientId: `wov-${activity.id}`,
      id: activity.id,
      isNew: false,
      wovNumber: textMetadata(activity, "wovNumber") || activity.title,
      unitName: textMetadata(activity, "unitName") || detail.unitId,
      vendorName: textMetadata(activity, "vendorName") || "-",
      itemName: textMetadata(activity, "itemName") || activity.title,
      accTracking: textMetadata(activity, "accTracking") || "-",
      status: activity.status ?? "-",
      targetDateReturn: textMetadata(activity, "targetDateReturn"),
      qcStatus: textMetadata(activity, "qcStatus") || "-",
      agingDays: numberMetadata(activity, "agingDays"),
      riskScore: numberMetadata(activity, "riskScore"),
      parentKey: "",
      quantity: null,
      uom: "",
      goodsConditionOut: "",
      estimatedCost: null,
      remarks: "",
      error: null,
    }));
}

function validateDraft(row: WovGridRow): string | null {
  if (!row.parentKey) return "Parent Countdown atau PR wajib dipilih.";
  if (!row.vendorName.trim()) return "Vendor wajib diisi.";
  if (!row.itemName.trim()) return "Item wajib diisi.";
  if (row.quantity !== null && (!Number.isFinite(row.quantity) || row.quantity <= 0)) return "Qty harus lebih dari 0.";
  if (row.estimatedCost !== null && (!Number.isFinite(row.estimatedCost) || row.estimatedCost < 0)) return "Estimasi biaya tidak valid.";
  return null;
}

function buildPayload(detail: UnitPanelDetail, row: WovGridRow): CreateVendorRequest {
  const [parentType, parentId] = row.parentKey.split(":");
  return {
    carId: detail.unitId,
    coreId: parentType === "COUNTDOWN" ? parentId : null,
    prId: parentType === "PR" ? parentId : null,
    vendorId: null,
    vendorName: row.vendorName.trim(),
    picVendor: null,
    itemName: null,
    quantity: null,
    uom: null,
    goodsConditionOut: null,
    targetDateReturn: row.targetDateReturn || null,
    estimatedCost: null,
    remarks: row.remarks.trim() || null,
    items: [{
      itemName: row.itemName.trim(),
      quantity: row.quantity,
      uom: row.uom.trim() || null,
      goodsConditionOut: row.goodsConditionOut.trim() || null,
      estimatedCost: row.estimatedCost,
    }],
  };
}

const SelectEditor = forwardRef(function SelectEditor(
  props: ICellEditorParams<WovGridRow, string> & { values?: Option[] },
  ref,
) {
  const [value, setValue] = useState(String(props.value ?? ""));
  useImperativeHandle(ref, () => ({ getValue: () => value }));
  return (
    <select autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="h-full w-full bg-card px-2 text-[13px] text-foreground outline-none">
      <option value="">Pilih</option>
      {(props.values ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
});

function ActionRenderer(params: ICellRendererParams<WovGridRow>) {
  const row = params.data;
  if (!row?.isNew) return row?.id ? <a href={`/vendor/${row.id}`} className="text-app-accent-ink hover:underline">Detail</a> : null;
  return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
}

export function MasterPanelWovGrid({ detail, canCreateVendor, onCreated }: MasterPanelWovGridProps) {
  const parentChoices = useMemo(() => parentOptions(detail), [detail]);
  const [draftRows, setDraftRows] = useState<WovGridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => [...toExistingRows(detail), ...draftRows], [detail, draftRows]);

  const columnDefs = useMemo<ColDef<WovGridRow>[]>(() => [
    { headerName: "WOV", field: "wovNumber", editable: false, minWidth: 130 },
    { headerName: "Unit", field: "unitName", editable: false, minWidth: 130 },
    { headerName: "Vendor", field: "vendorName", editable: ({ data }) => Boolean(data?.isNew), minWidth: 170 },
    { headerName: "Item", field: "itemName", editable: ({ data }) => Boolean(data?.isNew), minWidth: 190 },
    { headerName: "Approval", field: "accTracking", editable: false, minWidth: 135 },
    { headerName: "Status", field: "status", editable: false, minWidth: 120 },
    { headerName: "Target Return", field: "targetDateReturn", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 135 },
    { headerName: "QC", field: "qcStatus", editable: false, minWidth: 90 },
    { headerName: "Aging", field: "agingDays", editable: false, minWidth: 90 },
    { headerName: "Risk", field: "riskScore", editable: false, minWidth: 90 },
    {
      headerName: "Parent",
      field: "parentKey",
      editable: ({ data }) => Boolean(data?.isNew),
      cellEditor: SelectEditor,
      cellEditorParams: { values: parentChoices },
      valueFormatter: ({ value }) => parentChoices.find((option) => option.value === String(value ?? ""))?.label ?? "",
      minWidth: 220,
    },
    { headerName: "Qty", field: "quantity", editable: ({ data }) => Boolean(data?.isNew), minWidth: 90, valueParser: ({ newValue }) => Number(newValue) },
    { headerName: "UOM", field: "uom", editable: ({ data }) => Boolean(data?.isNew), minWidth: 90 },
    { headerName: "Action", field: "error", editable: false, cellRenderer: ActionRenderer, minWidth: 145 },
  ], [parentChoices]);

  function updateDraft(event: CellValueChangedEvent<WovGridRow>) {
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
      const result = await createVendor(buildPayload(detail, row));
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
          <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Vendor WO</p>
          {error ? <p className="mt-1 text-[13px] text-destructive">{error}</p> : null}
        </div>
        {canCreateVendor ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDraftRows((current) => [...current, makeDraftRow(detail)])} disabled={isSaving || parentChoices.length === 0} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-foreground hover:bg-muted disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Row
            </button>
            <button type="button" onClick={() => void saveDrafts()} disabled={draftRows.length === 0 || isSaving} className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/[0.06] px-2 py-1 text-[12px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 disabled:opacity-40">
              <Save className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => { setDraftRows([]); setError(null); }} disabled={draftRows.length === 0 || isSaving} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> Batal
            </button>
          </div>
        ) : null}
      </div>
      {canCreateVendor && parentChoices.length === 0 ? <p className="text-[13px] text-muted-foreground">WOV membutuhkan parent Countdown atau PR yang sudah terhubung ke Master Panel ini.</p> : null}
      <div className="ag-theme-alpine sms-ag-grid h-[20rem] w-full">
        <AgGridReact<WovGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: true, suppressHeaderMenuButton: true }}
          getRowId={({ data }) => data.clientId}
          rowHeight={42}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          suppressMovableColumns
          onCellValueChanged={updateDraft}
          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada WOV untuk part ini.</span>"
        />
      </div>
    </div>
  );
}
