"use client";

import type { UnitPanelActivity, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createCountdownRecord } from "@/shared/api/countdown";
import { parseHHMMToDecimal } from "@/shared/format/time";
import { SmartSelectCellEditor, type SmartSelectOption } from "./master-panel-smart-select-editor";

const ICON_STROKE_WIDTH = 2.4;

interface MasterPanelCountdownGridProps {
  detail: UnitPanelDetail;
  canCreateCountdown: boolean;
  onCreated: () => Promise<void>;
}

interface CountdownGridRow {
  clientId: string;
  id: string | null;
  isNew: boolean;
  unitName: string;
  divisionId: string;
  divisionName: string;
  picPlan: string;
  jobTypeId: string;
  jobTypeName: string;
  targetHours: string;
  deadlineDate: string;
  status: string;
  error: string | null;
}

function metadataText(activity: UnitPanelActivity, key: string): string {
  const value = activity.metadata[key];
  return typeof value === "string" ? value : "";
}

function metadataNumber(activity: UnitPanelActivity, key: string): number {
  const value = Number(activity.metadata[key]);
  return Number.isFinite(value) ? value : 0;
}

function metadataBool(activity: UnitPanelActivity, key: string): boolean {
  return activity.metadata[key] === true;
}

function decimalToHHMM(value: unknown): string {
  const hours = Number(value ?? 0);
  if (!Number.isFinite(hours)) return "00:00";
  const minutes = Math.round(hours * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function singleValue(options: SmartSelectOption[]): string {
  return options.length === 1 ? options[0].value : "";
}

function makeDraftRow(divisionOptions: SmartSelectOption[], jobTypeOptions: SmartSelectOption[]): CountdownGridRow {
  return {
    clientId: `countdown-draft-${crypto.randomUUID()}`,
    id: null,
    isNew: true,
    unitName: "",
    divisionId: singleValue(divisionOptions),
    divisionName: "",
    picPlan: "",
    jobTypeId: singleValue(jobTypeOptions),
    jobTypeName: "",
    targetHours: "01:00",
    deadlineDate: today(),
    status: "PLAN",
    error: null,
  };
}

function toExistingRows(detail: UnitPanelDetail): CountdownGridRow[] {
  return detail.activities
    .filter((activity) => activity.type === "COUNTDOWN")
    .map((activity) => ({
      clientId: `countdown-${activity.id}`,
      id: activity.id,
      isNew: false,
      unitName: "",
      divisionId: "",
      divisionName: metadataText(activity, "divisionName") || "-",
      picPlan: metadataText(activity, "picPlan"),
      jobTypeId: "",
      jobTypeName: metadataText(activity, "jobTypeName") || activity.title,
      targetHours: decimalToHHMM(activity.metadata.targetHours),
      deadlineDate: metadataText(activity, "deadlineDate"),
      status: activity.status ?? "PLAN",
      error: null,
    }));
}

function validateDraft(row: CountdownGridRow): string | null {
  if (!row.divisionId) return "Divisi wajib dipilih.";
  if (!row.jobTypeId) return "Jobdesc wajib dipilih.";
  if (!row.deadlineDate) return "Deadline wajib diisi.";
  if (!Number.isFinite(parseHHMMToDecimal(row.targetHours)) || parseHHMMToDecimal(row.targetHours) <= 0) {
    return "Target harus format HH:MM dan lebih dari 0.";
  }
  return null;
}

function ActionRenderer(params: ICellRendererParams<CountdownGridRow>) {
  const row = params.data;
  if (!row?.isNew) return row?.id ? <a href={`/countdown/${row.id}`} className="text-app-accent-ink hover:underline">Detail</a> : null;
  return row.error ? <span className="text-[12px] text-destructive">{row.error}</span> : <span className="text-[12px] text-muted-foreground">Draft</span>;
}

export function MasterPanelCountdownGrid({ detail, canCreateCountdown, onCreated }: MasterPanelCountdownGridProps) {
  const divisionOptions = useMemo<SmartSelectOption[]>(
    () => detail.countdownReferences.divisions.map((division) => ({ label: division.label, value: String(division.value) })),
    [detail.countdownReferences.divisions],
  );
  const jobTypeOptions = useMemo<SmartSelectOption[]>(
    () => detail.countdownReferences.jobTypes.map((jobType) => ({ label: jobType.label, value: String(jobType.value) })),
    [detail.countdownReferences.jobTypes],
  );
  const [draftRows, setDraftRows] = useState<CountdownGridRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => [...toExistingRows(detail), ...draftRows], [detail, draftRows]);

  const columnDefs = useMemo<ColDef<CountdownGridRow>[]>(() => [
    {
      headerName: "Divisi",
      field: "divisionId",
      editable: ({ data }) => Boolean(data?.isNew),
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: divisionOptions },
      valueFormatter: ({ data, value }) => data?.isNew ? divisionOptions.find((option) => option.value === String(value ?? ""))?.label ?? "" : data?.divisionName ?? "",
      minWidth: 140,
      flex: 0.9,
    },
    { headerName: "PIC", field: "picPlan", editable: ({ data }) => Boolean(data?.isNew), minWidth: 125, flex: 0.8 },
    {
      headerName: "Jobdesc",
      field: "jobTypeId",
      editable: ({ data }) => Boolean(data?.isNew),
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: jobTypeOptions },
      valueFormatter: ({ data, value }) => data?.isNew ? jobTypeOptions.find((option) => option.value === String(value ?? ""))?.label ?? "" : data?.jobTypeName ?? "",
      minWidth: 220,
      flex: 1.4,
    },
    { headerName: "Target", field: "targetHours", editable: ({ data }) => Boolean(data?.isNew), minWidth: 95, width: 105 },
    { headerName: "Deadline", field: "deadlineDate", editable: ({ data }) => Boolean(data?.isNew), cellEditor: "agDateStringCellEditor", minWidth: 125 },
    { headerName: "Status", field: "status", editable: false, minWidth: 105 },
    { headerName: "Tindakan", field: "error", editable: false, cellRenderer: ActionRenderer, minWidth: 120, pinned: "right" },
  ], [divisionOptions, jobTypeOptions]);

  function updateDraft(event: CellValueChangedEvent<CountdownGridRow>) {
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
      const result = await createCountdownRecord({
        carId: detail.unitId,
        divisionId: Number(row.divisionId),
        panelId: detail.panel.id,
        taskCategory: "ADDITIONAL",
        sectionName: detail.panel.section,
        jobTypeId: row.jobTypeId,
        targetHoursInitial: parseHHMMToDecimal(row.targetHours),
        startDate: today(),
        deadlineDate: row.deadlineDate,
        prerequisiteCoreId: "",
        refWoId: "",
        picPlan: row.picPlan.trim() || null,
        note: "",
        temuanAwal: "",
        keterangan: detail.panel.name,
        status: "PLAN",
      });
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
          <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Countdown</p>
          {error ? <p className="mt-1 text-[13px] text-destructive">{error}</p> : null}
        </div>
        {canCreateCountdown ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDraftRows((current) => [...current, makeDraftRow(divisionOptions, jobTypeOptions)])} disabled={isSaving} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-foreground hover:bg-muted disabled:opacity-40">
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
        <AgGridReact<CountdownGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: true, suppressHeaderMenuButton: true }}
          getRowId={({ data }) => data.clientId}
          rowHeight={42}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          suppressMovableColumns
          onCellValueChanged={updateDraft}
          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada Countdown untuk part ini.</span>"
        />
      </div>
    </div>
  );
}
