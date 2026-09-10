"use client";

import type { CreatePrInput } from "@smsystem/contracts/pr";
import type { UnitPanelActivity, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPr } from "@/shared/api/pr";

const ICON_STROKE_WIDTH = 2.4;

interface MasterPanelPrGridProps {
  detail: UnitPanelDetail;
  canCreatePr: boolean;
  onCreated: () => Promise<void>;
}

interface PrGridRow {
  clientId: string;
  id: string | null;
  isNew: boolean;
  prNumber: string;
  unitName: string;
  divisionName: string;
  requestedByName: string;
  accTracking: string;
  status: string;
  itemName: string;
  vendorSummary: string;
  agingDays: number | null;
  riskScore: number | null;
  qty: number;
  uom: string;
  originType: "LOKAL" | "LN";
  estimatedPrice: number | null;
  targetDate: string;
  priority: string;
  notes: string;
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

function makeDraftRow(detail: UnitPanelDetail): PrGridRow {
  return {
    clientId: `pr-draft-${crypto.randomUUID()}`,
    id: null,
    isNew: true,
    prNumber: "",
    unitName: detail.panel.carId,
    divisionName: "",
    requestedByName: "",
    accTracking: "Draft",
    status: "OPEN",
    itemName: detail.panel.name,
    vendorSummary: "-",
    agingDays: null,
    riskScore: null,
    qty: 1,
    uom: "pcs",
    originType: "LOKAL",
    estimatedPrice: null,
    targetDate: today(),
    priority: "NORMAL",
    notes: "",
    error: null,
  };
}

function toExistingRows(detail: UnitPanelDetail): PrGridRow[] {
  return detail.activities
    .filter((activity) => activity.type === "PR")
    .map((activity) => ({
      clientId: `pr-${activity.id}`,
      id: activity.id,
      isNew: false,
      prNumber: textMetadata(activity, "prNumber") || activity.title,
      unitName: textMetadata(activity, "unitName") || detail.unitId,
      divisionName: textMetadata(activity, "divisionName") || "-",
      requestedByName: textMetadata(activity, "requestedByName") || "-",
      accTracking: textMetadata(activity, "accTracking") || "-",
      status: activity.status ?? "-",
      itemName: String(activity.metadata.totalItems ?? "-"),
      vendorSummary: textMetadata(activity, "vendorSummary") || "-",
      agingDays: numberMetadata(activity, "agingDays"),
      riskScore: numberMetadata(activity, "riskScore"),
      qty: 1,
      uom: "pcs",
      originType: "LOKAL",
      estimatedPrice: null,
      targetDate: "",
      priority: "NORMAL",
      notes: "",
      error: null,
    }));
}

function validateDraft(row: PrGridRow): string | null {
  if (!row.itemName.trim()) return "Item wajib diisi.";
  if (!Number.isFinite(row.qty) || row.qty <= 0) return "Qty harus lebih dari 0.";
  if (!row.uom.trim()) return "UOM wajib diisi.";
  if (row.estimatedPrice !== null && (!Number.isFinite(row.estimatedPrice) || row.estimatedPrice < 0)) return "Estimasi harga tidak valid.";
  return null;
}

function buildPayload(detail: UnitPanelDetail, row: PrGridRow): CreatePrInput {
  return {
    carId: detail.unitId,
    panelId: detail.panel.id,
    divisionName: null,
    targetDate: row.targetDate || null,
    priority: row.priority || "NORMAL",
    notes: row.notes.trim() || null,
    items: [{
      itemName: row.itemName.trim(),
      description: null,
      originType: row.originType,
      qty: row.qty,
      uom: row.uom.trim(),
      estimatedPrice: row.estimatedPrice,
      photoUrl: null,
    }],
  };
}

function ActionRenderer(params: ICellRendererParams<PrGridRow>) {
  const row = params.data;
  if (!row?.isNew) return row?.id ? <a href={`/pr/${row.id}`} className="text-app-accent-ink hover:underline">Detail</a> : null;
  return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
}

export function MasterPanelPrGrid({ detail, canCreatePr, onCreated }: MasterPanelPrGridProps) {
  const [draftRows, setDraftRows] = useState<PrGridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => [...toExistingRows(detail), ...draftRows], [detail, draftRows]);

  const columnDefs = useMemo<ColDef<PrGridRow>[]>(() => [
    { headerName: "PR", field: "prNumber", editable: false, minWidth: 130 },
    { headerName: "Unit", field: "unitName", editable: false, minWidth: 130 },
    { headerName: "Divisi", field: "divisionName", editable: false, minWidth: 130 },
    { headerName: "Requester", field: "requestedByName", editable: false, minWidth: 150 },
    { headerName: "Approval", field: "accTracking", editable: false, minWidth: 140 },
    { headerName: "Status", field: "status", editable: false, minWidth: 120 },
    { headerName: "Item", field: "itemName", editable: ({ data }) => Boolean(data?.isNew), minWidth: 190 },
    { headerName: "Vendor", field: "vendorSummary", editable: false, minWidth: 140 },
    { headerName: "Aging", field: "agingDays", editable: false, minWidth: 95 },
    { headerName: "Risk", field: "riskScore", editable: false, minWidth: 90 },
    { headerName: "Qty", field: "qty", editable: ({ data }) => Boolean(data?.isNew), minWidth: 90, valueParser: ({ newValue }) => Number(newValue) },
    { headerName: "UOM", field: "uom", editable: ({ data }) => Boolean(data?.isNew), minWidth: 90 },
    { headerName: "Target", field: "targetDate", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 120 },
    { headerName: "Prioritas", field: "priority", editable: ({ data }) => Boolean(data?.isNew), minWidth: 115 },
    { headerName: "Action", field: "error", editable: false, cellRenderer: ActionRenderer, minWidth: 145 },
  ], []);

  function updateDraft(event: CellValueChangedEvent<PrGridRow>) {
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
      const result = await createPr(buildPayload(detail, row));
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
          <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Purchase Request</p>
          {error ? <p className="mt-1 text-[13px] text-destructive">{error}</p> : null}
        </div>
        {canCreatePr ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDraftRows((current) => [...current, makeDraftRow(detail)])} disabled={isSaving} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-foreground hover:bg-muted disabled:opacity-40">
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
      <div className="ag-theme-alpine sms-ag-grid h-[20rem] w-full">
        <AgGridReact<PrGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: true, suppressHeaderMenuButton: true }}
          getRowId={({ data }) => data.clientId}
          rowHeight={42}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          suppressMovableColumns
          onCellValueChanged={updateDraft}
          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada PR untuk part ini.</span>"
        />
      </div>
    </div>
  );
}
