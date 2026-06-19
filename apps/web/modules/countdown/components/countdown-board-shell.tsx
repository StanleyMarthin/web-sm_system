"use client";

import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
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
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import {
  ActionButton, MetricBar, PageHeader,
} from "@/shared/ui/compact";
import { parseHHMMToDecimal } from "@/shared/format/time";
import { CountdownBoardForm, type CountdownFormValues } from "./forms/countdown-board-form";
import { Download, FileText, FileUp, Pencil, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

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

function formatWorkdayAlias(hours: number): string {
  const totalHours = Math.max(0, hours);
  if (totalHours <= 0) return "0j / 0 hari kerja";
  let remaining = totalHours;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let workdays = 0;

  for (let guard = 0; guard < 370; guard += 1) {
    const day = cursor.getDay();
    const capacity = day === 0 ? 0 : day === 6 ? 5 : 8;
    if (capacity > 0) {
      workdays += 1;
      remaining -= capacity;
      if (remaining <= 0.0001) {
        return `${formatNumber(totalHours)}j / ${workdays} hari kerja`;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return `${formatNumber(totalHours)}j`;
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

const savedViews: SmartDataGridSavedView[] = [
  { id: "all-countdowns", label: "Semua", sortBy: "deadlineDate", sortDirection: "asc", filters: [] },
  {
    id: "additional-only", label: "Tambahan", sortBy: "deadlineDate", sortDirection: "asc",
    filters: [{ field: "taskCategory", operator: "eq", value: "ADDITIONAL" } satisfies GridFilter]
  },
  {
    id: "wo-only", label: "WO", sortBy: "deadlineDate", sortDirection: "asc",
    filters: [{ field: "taskCategory", operator: "eq", value: "WO" } satisfies GridFilter]
  },
  {
    id: "wov-only", label: "WOV", sortBy: "deadlineDate", sortDirection: "asc",
    filters: [{ field: "taskCategory", operator: "eq", value: "WOV" } satisfies GridFilter]
  },
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
      key: "totalActualHours", label: "Actual", kind: "text", align: "right",
      renderCell: (v) => <span className="tabular-nums">{formatDecimalToHHMM(Number(v)) || "00:00"}</span>
    },
    { 
      key: "remainingHours", label: "Remaining", kind: "text", align: "right",
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
        { label: "PLAN", value: "PLAN" },
        { label: "PROSES", value: "PROSES" },
        { label: "QC_READY", value: "QC_READY" },
        { label: "DONE", value: "DONE" },
      ],
    },
    {
      key: "isOverdue", label: "Risk", kind: "text", align: "center",
      renderCell: (_v, row) => (
        <span className={[
          "inline-flex border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]",
          row.isOverdue
            ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
            : "border-success/20 bg-success/[0.06] text-success",
        ].join(" ")}>
          {row.isOverdue ? "Overdue" : "On Track"}
        </span>
      ),
    },
    {
      key: "action", label: "Action", kind: "text", align: "center",
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
                <Trash2 className="h-3 w-3" />Del
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
        { label: "PLAN", value: "PLAN" },
        { label: "PROSES", value: "PROSES" },
        { label: "QC_READY", value: "QC_READY" },
        { label: "DONE", value: "DONE" },
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; rejected: number;
    issues: Array<{ rowNumber: number; field: string; message: string; value: string | null }>;
  } | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
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

  const summary = useMemo(() => ({
    total: rows.length,
    done: rows.filter((r) => r.status === "DONE").length,
    additional: rows.filter((r) => r.taskCategory === "ADDITIONAL").length,
    overdue: rows.filter((r) => r.isOverdue).length,
    remainingHours: rows.reduce((s, r) => s + r.remainingHours, 0),
  }), [rows]);

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

    sweetAlert.notifyError("Aksi belum jalan", error);
    setError(null);
  }, [error, sweetAlert]);

  function openCreateCountdown() {
    setError(null); setMessage(null); setImportResult(null);
    setEditorMode("create"); setInitialFormValues(null);
  }

  function openEditCountdown(row: CountdownBoardRow) {
    setError(null); setMessage(null); setImportResult(null);
    setEditorMode("edit"); setInitialFormValues({
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

  function closeEditor() { setEditorMode(null); setInitialFormValues(null); }

  async function submitImport() {
    if (!selectedFile) { setError("Pilih file Excel terlebih dahulu."); return; }
    if (!activeUnitId) { setError("Filter unit wajib dipilih sebelum upload."); return; }
    setError(null); setMessage(null); setImportResult(null);
    setIsUploading(true);
    try {
      const result = await uploadCountdownWorkbook(selectedFile, { unitId: activeUnitId });
      if (!result.success) { setError(result.message); return; }
      setImportResult(result.result);
      setMessage(`Import selesai. Inserted ${result.result.inserted}, rejected ${result.result.rejected}.`);
      setSelectedFile(null);
      setUploadOpen(false);
      router.refresh();
    } finally { setIsUploading(false); }
  }

  async function handleTemplateDownload() {
    if (!activeUnitId) {
      setError("Pilih filter unit terlebih dahulu sebelum download template.");
      return;
    }
    setError(null); setMessage(null);
    const result = await downloadCountdownTemplate({ unitId: activeUnitId });
    if (!result.success) { setError(result.message); return; }
    setMessage(`Template countdown untuk unit "${activeUnitLabel}" berhasil didownload.`);
  }

  async function handleCountdownDownload() {
    if (!activeUnitId) {
      setError("Pilih filter unit terlebih dahulu sebelum download countdown.");
      return;
    }
    setError(null); setMessage(null);

    const result = await downloadCountdownWorkbook({
      unitId: activeUnitId,
      divisionId: activeDivisionId ?? undefined,
      // Backend behavior:
      // - Jika divisionId ada → 1 sheet, sheet name = nama divisi itu
      // - Jika divisionId tidak ada → multi-sheet, tiap sheet = satu divisi
      //   (sheet name = divisionName, isi = countdown rows divisi tersebut)
    });

    if (!result.success) { setError(result.message); return; }

    const sheetDesc = activeDivisionId
      ? `sheet "${activeDivisionLabel}"`
      : "semua divisi (multi-sheet)";
    setMessage(`Download countdown unit "${activeUnitLabel}" — ${sheetDesc} berhasil.`);
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
        title="Countdown board"
        actions={
          <>
            {canManage ? (
              <>
                <ActionButton variant="success" onClick={openCreateCountdown}>
                  <Plus className="h-3 w-3" />Tambah Jobdesc
                </ActionButton>
                <ActionButton
                  variant="primary"
                  onClick={() => {
                    if (!activeUnitId) {
                      setError("Pilih filter unit terlebih dahulu sebelum upload.");
                      return;
                    }
                    setUploadOpen(true);
                  }}
                >
                  <FileUp className="h-3 w-3" />Upload Excel
                </ActionButton>
              </>
            ) : null}

            {/* Download Countdown — tombol baru */}
            <ActionButton
              onClick={() => void handleCountdownDownload()}
              disabled={!activeUnitId}
              title={!activeUnitId ? "Pilih filter unit terlebih dahulu" : `Download countdown ${activeUnitLabel}`}
            >
              <Download className="h-3 w-3" />Download
            </ActionButton>

            {/* Download Template */}
            <ActionButton
              onClick={() => void handleTemplateDownload()}
              disabled={!activeUnitId}
              title={!activeUnitId ? "Pilih filter unit terlebih dahulu" : `Download template untuk ${activeUnitLabel}`}
            >
              <FileText className="h-3 w-3" />Template
            </ActionButton>

            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />Refresh
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
              ⚠ Pilih unit untuk aktifkan download & upload
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-white/[0.04] bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-mono text-foreground/25">
            Pilih filter Unit untuk mengaktifkan Download & Upload Excel
          </span>
        </div>
      )}

      {/* ── Metrics ── */}
      <MetricBar items={[
        { label: "Total Pengerjaan", value: summary.total },
        { label: "Selesai", value: summary.done, tone: "up" },
        { label: "Sisa Jam", value: formatWorkdayAlias(summary.remainingHours), tone: "muted" },
        { label: "Overdue", value: summary.overdue, tone: summary.overdue > 0 ? "down" : undefined },
        { label: "Total Jobdesc Tambahan", value: summary.additional },
      ]} />

      {sweetAlert.alertElement}

      {canManage && editorMode ? (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[1px]">
          <div className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-y-auto border-l border-white/[0.08] bg-popover p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5 text-success" />
                <p className="text-[12px] font-medium text-foreground">
                  {editorMode === "edit" ? "Edit Jobdesc" : "Tambah Jobdesc"}
                </p>
              </div>
              <ActionButton onClick={closeEditor}><X className="h-3 w-3" />Tutup</ActionButton>
            </div>

              <CountdownBoardForm
                initialValues={initialFormValues}
                editorMode={editorMode as "create" | "edit"}
                references={references}
                isSaving={isSaving}
                onCancel={closeEditor}
                onSubmit={(data) => {
                  void handleSaveCountdown(data);
                }}
              />
          </div>
        </div>
      ) : null}

      {canManage && uploadOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 backdrop-blur-[1px]">
          <div className="w-full max-w-xl border border-white/[0.08] bg-popover p-4 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileUp className="h-3.5 w-3.5 text-app-accent-ink" />
                <p className="text-[12px] font-mono text-foreground">Upload Excel Countdown</p>
              </div>
              <ActionButton onClick={() => setUploadOpen(false)}><X className="h-3 w-3" />Tutup</ActionButton>
            </div>

            {/* Unit context — wajib ada */}
            {activeUnitId ? (
              <div className="mb-3 border border-primary/15 bg-primary/[0.04] px-3 py-2">
                <p className="text-[10px] font-mono text-app-accent-ink/70 uppercase tracking-[0.12em]">Upload untuk unit</p>
                <p className="mt-0.5 text-[12px] font-mono text-foreground">{activeUnitLabel}</p>
                {activeDivisionLabel ? (
                  <p className="mt-0.5 text-[10px] font-mono text-foreground/40">Divisi: {activeDivisionLabel}</p>
                ) : null}
              </div>
            ) : (
              <div className="mb-3 border border-destructive/20 bg-destructive/[0.05] px-3 py-2">
                <p className="text-[11px] font-mono text-destructive">
                  ⚠ Filter unit belum dipilih. Tutup modal ini dan pilih filter unit dari grid terlebih dahulu.
                </p>
              </div>
            )}

            {/* File input */}
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={!activeUnitId}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full border border-white/[0.06] bg-white/[0.03] p-2 text-[11px] font-mono text-foreground/50 disabled:cursor-not-allowed disabled:opacity-40 file:mr-2 file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-mono file:uppercase file:tracking-wider file:text-app-accent-ink"
            />

            {/* Import result */}
            {importResult ? (
              <div className="mt-3 border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-[11px] font-mono text-foreground/60">
                <p>Inserted: {importResult.inserted} · Updated: {importResult.updated} · Rejected: {importResult.rejected}</p>
                {importResult.issues.length > 0 ? (
                  <div className="mt-1.5 space-y-0.5 text-destructive/80">
                    {importResult.issues.map((issue) => (
                      <p key={`${issue.rowNumber}-${issue.field}`}>
                        Row {issue.rowNumber} · {issue.field} · {issue.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <ActionButton
                variant="primary"
                disabled={isUploading || !activeUnitId || !selectedFile}
                onClick={() => void submitImport()}
              >
                <Upload className="h-3 w-3" />
                {isUploading ? "Uploading..." : "Upload"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Data grid ── */}
      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="Countdown Board"
        description="Monitor countdown per unit, divisi, panel, section, dan status kerja."
        columns={columns} rows={rows} meta={meta} state={state}
        searchPlaceholder="Cari unit / panel / section / job type / status..."
        filters={filters} sortOptions={sortOptions} savedViews={savedViews}
        emptyMessage="Belum ada countdown yang sesuai query saat ini."
      />
    </div>
  );
}
