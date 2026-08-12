"use client";

import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import type { GridQueryState } from "@smsystem/contracts/grid";
import {
  createCountdownRecord,
  deleteCountdownRecord,
  downloadCountdownTemplate,
  downloadCountdownWorkbook,
  updateCountdownRecord,
  uploadCountdownWorkbook,
} from "@/shared/api/countdown";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridCellValue,
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import {
  ActionButton, CompactSelect, FieldLabel, PageHeader,
} from "@/shared/ui/compact";
import { parseHHMMToDecimal } from "@/shared/format/time";
import { CountdownBoardForm, type CountdownFormValues } from "./forms/countdown-board-form";
import { Download, FileText, FileUp, Pencil, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { formatCountdownImportIssue, formatCountdownStatus } from "../countdown-copy";
import {
  buildCountdownExportParams,
  resolveCountdownEntryMode,
  type CountdownEntryMode,
} from "../countdown-dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ReferenceOption {
  label: string;
  value: string;
  code?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  parentCode?: string | null;
  divisionId?: number | null;
  divisionName?: string | null;
  divisionParentId?: number | null;
  divisionParentName?: string | null;
  divisionParentCode?: string | null;
}

interface CountdownReferences {
  divisions: ReferenceOption[];
  units: ReferenceOption[];
  panels: ReferenceOption[];
  sections?: ReferenceOption[];
  jobTypes: ReferenceOption[];
  taskCategories?: ReferenceOption[];
}

interface CountdownBoardShellProps {
  rows: CountdownBoardRow[];
  references: CountdownReferences;
  canManage: boolean;
  meta: {
    page: number; limit: number; total: number;
    totalPages: number; hasNext: boolean; hasPrev: boolean;
  };
  state: GridQueryState;
}


function normalizeTextInput(value: string): string | null {
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function formatDecimalToHHMM(decimalHours: number): string {
  if (!Number.isFinite(decimalHours)) return "";
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toBoardRow(row: Record<string, SmartDataGridCellValue>): CountdownBoardRow {
  return row as unknown as CountdownBoardRow;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/u, "");
}

/* ------------------------------------------------------------------ */
/*  Grid config                                                         */
/* ------------------------------------------------------------------ */

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Deadline", value: "deadlineDate" },
  { label: "Diperbarui", value: "updatedAt" },
  { label: "Dibuat", value: "createdAt" },
  { label: "Unit", value: "unitName" },
  { label: "Divisi", value: "divisionName" },
  { label: "Panel", value: "panelName" },
  { label: "Bagian", value: "sectionName" },
  { label: "Kategori", value: "taskCategory" },
  { label: "Status", value: "status" },
  { label: "Sisa Jam", value: "remainingHours" },
  { label: "Progress", value: "actualProgressPercent" },
];

function buildCountdownColumns(
  canManage: boolean,
  onEdit: (row: CountdownBoardRow) => void,
  onDelete: (row: CountdownBoardRow) => void,
  references: CountdownReferences,
): SmartDataGridColumn[] {
  return [
    {
      key: "unitName", label: "Unit", kind: "text", sticky: true,
      filterKey: "unitId",
      filterOptions: references.units,
      renderCell: (value, row) => (
        <div className="space-y-0.5">
          <Link
            href={`/countdown/${String(row.countdownId ?? "")}`}
            className="text-[12px] font-medium text-foreground hover:text-app-accent-ink"
          >
            {String(value ?? "-")}
          </Link>
          <p className="text-[10px] text-foreground/30">{String(row.carId ?? "-")}</p>
        </div>
      ),
    },
    { key: "divisionName", label: "Divisi", kind: "text", filterKey: "divisionId", filterOptions: references.divisions },
    { key: "sectionName", label: "Bagian", kind: "text", filterKey: "sectionName" },
    {
      key: "panelName", label: "Panel", kind: "text",
      filterKey: "panelId",
      filterOptions: references.panels,
      renderCell: (value) => (
        <div className="space-y-0.5">
          <p className="text-[12px] text-foreground">{String(value ?? "-")}</p>
        </div>
      ),
    },
    {
      key: "jobTypeName",
      label: "Jobdesc",
      kind: "text",
      filterKey: "jobTypeId",
      filterOptions: references.jobTypes,
      renderCell: (value, row) => String(value ?? row.sectionName ?? "-"),
    },
    { key: "temuanAwal", label: "Temuan Awal", kind: "text" },
    { key: "keterangan", label: "Keterangan", kind: "text" },
    { 
      key: "targetHoursInitial", label: "Target", kind: "text", align: "right",
      renderCell: (v) => <span className="tabular-nums">{formatDecimalToHHMM(Number(v)) || "00:00"}</span>
    },
    { 
      key: "totalActualHours", label: "Aktual", kind: "text", align: "right",
      renderCell: (v) => <span className="tabular-nums">{formatDecimalToHHMM(Number(v)) || "00:00"}</span>
    },
    { 
      key: "remainingHours", label: "Sisa", kind: "text", align: "right",
      renderCell: (v) => <span className="tabular-nums">{formatDecimalToHHMM(Number(v)) || "00:00"}</span>
    },
    { key: "actualProgressPercent", label: "Progress %", kind: "number", align: "right" },
    { key: "deadlineDate", label: "Deadline", kind: "mono" },
    {
      key: "status",
      label: "Status",
      kind: "status",
      align: "center",
      filterKey: "status",
      filterOptions: [
        { label: formatCountdownStatus("PLAN"), value: "PLAN" },
        { label: formatCountdownStatus("PROSES"), value: "PROSES" },
        { label: formatCountdownStatus("QC_READY"), value: "QC_READY" },
        { label: formatCountdownStatus("DONE"), value: "DONE" },
      ],
    },
    {
      key: "isOverdue", label: "Risiko", kind: "text", align: "center",
      renderCell: (_v, row) => (
        <span className={[
          "inline-flex border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]",
          row.isOverdue
            ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
            : "border-success/20 bg-success/[0.06] text-success",
        ].join(" ")}>
          {row.isOverdue ? "Terlambat" : "Sesuai Jadwal"}
        </span>
      ),
    },
    {
      key: "action", label: "Tindakan", kind: "text", align: "center",
      renderCell: (_v, row) => (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Link href={`/countdown/${String(row.countdownId ?? "")}`}
            className="border border-primary/30 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-app-accent-ink hover:bg-primary/[0.12] transition-colors">
            Detail
          </Link>
          {canManage && (
            <>
              <button type="button" onClick={() => onEdit(toBoardRow(row))}
                className="inline-flex items-center gap-1 border border-white/[0.07] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/55 hover:border-primary/30 hover:text-app-accent-ink transition-colors">
                <Pencil className="h-3 w-3" />Edit
              </button>
              <button type="button" onClick={() => onDelete(toBoardRow(row))}
                className="inline-flex items-center gap-1 border border-destructive/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-destructive/80 hover:bg-destructive/[0.06] transition-colors">
                <Trash2 className="h-3 w-3" />Hapus
              </button>
            </>
          )}
        </div>
      ),
    },
  ];
}

function buildCountdownFilters(references: CountdownReferences): SmartDataGridFilterDefinition[] {
  return [
    {
      field: "status", label: "Status", options: [
        { label: formatCountdownStatus("PLAN"), value: "PLAN" },
        { label: formatCountdownStatus("PROSES"), value: "PROSES" },
        { label: formatCountdownStatus("QC_READY"), value: "QC_READY" },
        { label: formatCountdownStatus("DONE"), value: "DONE" },
      ]
    },
    { field: "divisionId", label: "Divisi", options: references.divisions },
    { field: "unitId", label: "Unit", options: references.units },
    { field: "panelId", label: "Panel", options: references.panels },
  ];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function CountdownBoardShell({ rows, references, canManage, meta, state }: CountdownBoardShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const [isUploading, setIsUploading] = useState(false);
  const [entryMode, setEntryMode] = useState<CountdownEntryMode>("manual");
  const [uploadUnitId, setUploadUnitId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; rejected: number;
    issues: Array<{ rowNumber: number; field: string; message: string; value: string | null }>;
  } | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportUnitId, setExportUnitId] = useState("");
  const [exportDivisionId, setExportDivisionId] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [initialFormValues, setInitialFormValues] = useState<CountdownFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlightRef = useRef(false);

  const activeUnitFilter = state.filters?.find((f) => f.field === "unitId");
  const activeDivisionFilter = state.filters?.find((f) => f.field === "divisionId");

  const activeUnitId = activeUnitFilter?.value as string | undefined;
  const activeDivisionId = activeDivisionFilter?.value as string | undefined;

  // Resolve label untuk display di UI
  const activeUnitLabel = references.units.find((u) => u.value === activeUnitId)?.label ?? null;
  const activeDivisionLabel = references.divisions.find((d) => d.value === activeDivisionId)?.label ?? null;

  useEffect(() => {
    if (!message) {
      return;
    }

    sweetAlert.notifySuccess("Berhasil", message);
    setMessage(null);
  }, [message, sweetAlert]);

  useEffect(() => {
    if (!error) {
      return;
    }

    sweetAlert.notifyError("Tindakan gagal", error);
    setError(null);
  }, [error, sweetAlert]);

  function openCreateCountdown() {
    setError(null); setMessage(null); setImportResult(null);
    setEntryMode("manual"); setUploadUnitId(activeUnitId ?? "");
    setSelectedFile(null); setEditorMode("create"); setInitialFormValues(null);
  }

  function openEditCountdown(row: CountdownBoardRow) {
    setError(null); setMessage(null); setImportResult(null);
    setEntryMode("manual"); setEditorMode("edit"); setInitialFormValues({
      countdownId: row.countdownId,
      carId: row.carId,
      divisionId: row.divisionId ? String(row.divisionId) : "",
      panelId: row.panelId ? String(row.panelId) : "",
      taskCategory: row.taskCategory,
      sectionName: row.sectionName ?? "",
      jobTypeId: row.jobTypeId ?? "",
      targetHoursInitial: Number.isFinite(row.targetHoursInitial) ? formatDecimalToHHMM(row.targetHoursInitial) : "",
      startDate: row.startDate ?? "",
      deadlineDate: row.deadlineDate ?? "",
      prerequisiteCoreId: row.prerequisiteCoreId ?? "",
      refWoId: row.refWoId ?? "",
      note: row.note ?? "",
      temuanAwal: row.temuanAwal ?? "",
      keterangan: row.keterangan ?? "",
      status: row.status ?? "PLAN",
    });
  }

  function closeEditor() { setEditorMode(null); setInitialFormValues(null); setSelectedFile(null); }

  async function submitImport() {
    if (!selectedFile) { setError("Pilih file Excel terlebih dahulu."); return; }
    if (!uploadUnitId) { setError("Unit wajib dipilih sebelum mengunggah."); return; }
    setError(null); setMessage(null); setImportResult(null);
    setIsUploading(true);
    try {
      const result = await uploadCountdownWorkbook(selectedFile, { unitId: uploadUnitId });
      if (!result.success) { setError(result.message); return; }
      setImportResult(result.result);
      setMessage(`Impor selesai. ${result.result.inserted} data ditambahkan, ${result.result.rejected} data ditolak.`);
      setSelectedFile(null);
      router.refresh();
    } finally { setIsUploading(false); }
  }

  async function handleTemplateDownload() {
    if (!uploadUnitId) {
      setError("Pilih unit terlebih dahulu sebelum mengunduh templat.");
      return;
    }
    setError(null); setMessage(null);
    const result = await downloadCountdownTemplate({ unitId: uploadUnitId });
    if (!result.success) { setError(result.message); return; }
    const unitLabel = references.units.find((unit) => unit.value === uploadUnitId)?.label ?? uploadUnitId;
    setMessage(`Templat countdown untuk unit “${unitLabel}” berhasil diunduh.`);
  }

  async function handleCountdownDownload() {
    const params = buildCountdownExportParams(exportUnitId, exportDivisionId, exportStatus);
    if (!params) {
      setError("Pilih unit terlebih dahulu sebelum mengunduh countdown.");
      return;
    }
    setError(null); setMessage(null);

    const result = await downloadCountdownWorkbook(params);

    if (!result.success) { setError(result.message); return; }

    const unitLabel = references.units.find((unit) => unit.value === exportUnitId)?.label ?? exportUnitId;
    const divisionLabel = references.divisions.find((division) => division.value === exportDivisionId)?.label;
    const filterDescription = divisionLabel ? `divisi “${divisionLabel}”` : "semua divisi";
    setMessage(`Countdown unit ${unitLabel} berhasil diunduh untuk ${filterDescription}.`);
    setExportOpen(false);
  }

  async function handleSaveCountdown(data: CountdownFormValues) {
    if (saveInFlightRef.current) {
      return;
    }

    const payload = {
      carId: data.carId.trim(),
      divisionId: Number(data.divisionId),
      panelId: normalizeTextInput(data.panelId ?? "") ? Number(data.panelId) : null,
      taskCategory: data.taskCategory,
      sectionName: data.sectionName.trim(),
      jobTypeId: normalizeTextInput(data.jobTypeId ?? ""),
      targetHoursInitial: parseHHMMToDecimal(data.targetHoursInitial),
      startDate: normalizeTextInput(data.startDate ?? ""),
      deadlineDate: data.deadlineDate.trim(),
      prerequisiteCoreId: normalizeTextInput(data.prerequisiteCoreId ?? ""),
      refWoId: normalizeTextInput(data.refWoId ?? ""),
      note: normalizeTextInput(data.note ?? ""),
      temuanAwal: normalizeTextInput(data.temuanAwal ?? ""),
      keterangan: normalizeTextInput(data.keterangan ?? ""),
      status: data.status,
    };

    if (!payload.carId || !Number.isFinite(payload.divisionId) || payload.divisionId <= 0) {
      setError("Unit dan divisi wajib diisi."); return;
    }
    if (!payload.sectionName) { setError("Section wajib dipilih dari master."); return; }
    if (!payload.jobTypeId) { setError("Jobdesc wajib dipilih dari master jobdesc."); return; }
    if (!Number.isFinite(payload.targetHoursInitial) || payload.targetHoursInitial < 0) {
      setError("Target jam awal tidak valid."); return;
    }
    if (!payload.deadlineDate) { setError("Tanggal deadline wajib diisi."); return; }

    saveInFlightRef.current = true;
    setIsSaving(true); setError(null); setMessage(null); setImportResult(null);
    try {
      if (editorMode === "edit" && data.countdownId) {
        const result = await updateCountdownRecord(data.countdownId, payload);
        if (!result.success) { setError(result.message); return; }
        setMessage("Countdown berhasil diperbarui.");
        closeEditor(); router.refresh(); return;
      }
      const result = await createCountdownRecord(payload);
      if (!result.success) { setError(result.message); return; }
      setMessage("Countdown berhasil dibuat.");
      closeEditor();
      router.refresh();
    } catch { setError("Form countdown tidak valid."); }
    finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleDeleteCountdown(row: CountdownBoardRow) {
    const shouldDelete = await sweetAlert.confirm({
      title: "Hapus countdown?",
      description: `${row.unitName} akan dihapus dari daftar countdown aktif.`,
      tone: "warning",
      confirmLabel: "Hapus Countdown",
    });
    if (!shouldDelete) return;
    setError(null); setMessage(null); setImportResult(null);
    const result = await deleteCountdownRecord(String(row.countdownId));
    if (!result.success) { setError(result.message); return; }
    if (initialFormValues?.countdownId === row.countdownId) closeEditor();
    setMessage("Countdown berhasil dihapus.");
    router.refresh();
  }

  const columns = buildCountdownColumns(canManage, openEditCountdown, handleDeleteCountdown, references);
  const filters = buildCountdownFilters(references);

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <PageHeader
        eyebrow="Countdown"
        title="Daftar Countdown"
        actions={
          <>
            {canManage ? (
              <>
                <ActionButton variant="success" onClick={openCreateCountdown}>
                  <Plus className="h-3 w-3" />Tambah Jobdesc
                </ActionButton>
              </>
            ) : null}

            {/* Download Countdown — tombol baru */}
            <ActionButton
              onClick={() => {
                setExportUnitId(activeUnitId ?? "");
                setExportDivisionId(activeDivisionId ?? "");
                setExportStatus(String(state.filters?.find((filter) => filter.field === "status")?.value ?? ""));
                setExportOpen(true);
              }}
            >
              <Download className="h-3 w-3" />Unduh
            </ActionButton>

            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />Muat Ulang
            </ActionButton>
          </>
        }
      />

      {/* ── Active Filter Indicator ── */}
      {(activeUnitId || activeDivisionId) ? (
        <div className="flex flex-wrap items-center gap-2 border border-primary/15 bg-primary/[0.04] px-3 py-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-app-accent-ink/60">
            Filter aktif:
          </span>
          {activeUnitLabel ? (
            <span className="border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-foreground/70">
              Unit: {activeUnitLabel}
            </span>
          ) : null}
          {activeDivisionLabel ? (
            <span className="border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-foreground/70">
              Divisi: {activeDivisionLabel}
            </span>
          ) : null}
          {!activeUnitId ? (
            <span className="border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-mono text-app-accent-ink">
              Filter unit belum dipilih
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-white/[0.04] bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-mono text-foreground/25">
            Belum ada filter tabel aktif
          </span>
        </div>
      )}

      {sweetAlert.alertElement}

      {canManage && editorMode ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-2 backdrop-blur-[1px] sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="countdown-entry-title" className="flex max-h-[calc(100svh-1rem)] w-full max-w-5xl flex-col overflow-hidden border border-border bg-card shadow-2xl sm:max-h-[calc(100svh-2rem)]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5 text-success" />
                <p id="countdown-entry-title" className="text-sm font-semibold text-foreground">
                  {editorMode === "edit" ? "Edit Jobdesc" : "Tambah Jobdesc"}
                </p>
              </div>
              <ActionButton onClick={closeEditor}><X className="h-3 w-3" />Tutup</ActionButton>
            </div>
            {editorMode === "create" ? (
              <div className="flex shrink-0 gap-1 border-b border-border bg-background px-4 py-2 sm:px-5">
                {(["manual", "upload"] as const).map((mode) => (
                  <ActionButton
                    key={mode}
                    variant={entryMode === mode ? "primary" : undefined}
                    aria-pressed={entryMode === mode}
                    onClick={() => { setEntryMode(mode); setImportResult(null); }}
                  >
                    {mode === "manual" ? <Pencil className="h-3 w-3" /> : <FileUp className="h-3 w-3" />}
                    {mode === "manual" ? "Manual" : "Unggah Excel"}
                  </ActionButton>
                ))}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
            {resolveCountdownEntryMode(editorMode, entryMode) === "manual" ? (
              <CountdownBoardForm
                initialValues={initialFormValues}
                editorMode={editorMode}
                references={references}
                isSaving={isSaving}
                onCancel={closeEditor}
                onSubmit={(data) => {
                  void handleSaveCountdown(data);
                }}
              />
            ) : (
              <div className="mx-auto max-w-xl space-y-4">
                <div>
                  <FieldLabel required>Unit</FieldLabel>
                  <CompactSelect value={uploadUnitId} onChange={(event) => setUploadUnitId(event.target.value)}>
                    <option value="">Pilih unit</option>
                    {references.units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                  </CompactSelect>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Gunakan templat agar kolom Excel sesuai.</p>
                  <ActionButton disabled={!uploadUnitId} onClick={() => void handleTemplateDownload()}>
                    <FileText className="h-3 w-3" />Unduh Templat
                  </ActionButton>
                </div>
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={!uploadUnitId}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="block w-full border border-border bg-background p-2 text-[11px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 file:mr-2 file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:uppercase file:tracking-wider file:text-app-accent-ink"
                />
                {importResult ? (
                  <div className="border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
                    <p>Ditambahkan: {importResult.inserted}. Diperbarui: {importResult.updated}. Ditolak: {importResult.rejected}.</p>
                    {importResult.issues.length > 0 ? (
                      <div className="mt-2 space-y-1 text-destructive/80">
                        {importResult.issues.map((issue) => {
                          const [field, issueMessage] = formatCountdownImportIssue(issue.field, issue.message);
                          return <p key={`${issue.rowNumber}-${issue.field}`}>Baris {issue.rowNumber}. Kolom {field}. {issueMessage}</p>;
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex justify-end border-t border-border pt-3">
                  <ActionButton variant="primary" disabled={isUploading || !uploadUnitId || !selectedFile} onClick={() => void submitImport()}>
                    <Upload className="h-3 w-3" />{isUploading ? "Mengunggah…" : "Unggah"}
                  </ActionButton>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      ) : null}

      {exportOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div role="dialog" aria-modal="true" aria-labelledby="countdown-export-title" className="flex max-h-[calc(100svh-2rem)] w-full max-w-lg flex-col overflow-hidden border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p id="countdown-export-title" className="text-sm font-semibold text-foreground">Unduh Countdown</p>
              <ActionButton onClick={() => setExportOpen(false)}><X className="h-3 w-3" />Tutup</ActionButton>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div><FieldLabel required>Unit</FieldLabel><CompactSelect value={exportUnitId} onChange={(event) => setExportUnitId(event.target.value)}><option value="">Pilih unit</option>{references.units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</CompactSelect></div>
              <div><FieldLabel>Divisi</FieldLabel><CompactSelect value={exportDivisionId} onChange={(event) => setExportDivisionId(event.target.value)}><option value="">Semua divisi</option>{references.divisions.map((division) => <option key={division.value} value={division.value}>{division.label}</option>)}</CompactSelect></div>
              <div><FieldLabel>Status</FieldLabel><CompactSelect value={exportStatus} onChange={(event) => setExportStatus(event.target.value)}><option value="">Semua status</option>{["PLAN", "PROSES", "QC_READY", "DONE"].map((status) => <option key={status} value={status}>{formatCountdownStatus(status)}</option>)}</CompactSelect></div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
              <ActionButton variant="primary" disabled={!exportUnitId} onClick={() => void handleCountdownDownload()}><Download className="h-3 w-3" />Unduh</ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Data grid ── */}
      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="Daftar Countdown"
        description="Pantau countdown berdasarkan unit, divisi, panel, bagian, dan status pekerjaan."
        columns={columns} rows={rows} meta={meta} state={state}
        searchPlaceholder="Cari unit, panel, bagian, jenis pekerjaan, atau status…"
        filters={filters} headerFilterFields={["unitId", "divisionId", "status"]} sortOptions={sortOptions}
        emptyMessage="Belum ada countdown yang sesuai pencarian saat ini."
      />
    </div>
  );
}
