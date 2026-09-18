"use client";

import type { AuthUser } from "@smsystem/contracts/auth";
import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  createCountdownRecord,
  deleteCountdownRecord,
  downloadCountdownTemplate,
  downloadCountdownWorkbook,
  updateCountdownRecord,
  uploadCountdownWorkbook,
} from "@/shared/api/countdown";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { copySelectedGridRows } from "@/shared/datagrid/clipboard";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";
import {
  ActionButton, CompactDateRangeInput, CompactInput, CompactSelect, FieldLabel, PageHeader,
} from "@/shared/ui/compact";
import { parseHHMMToDecimal } from "@/shared/format/time";
import { CountdownBoardForm, emptyCountdownFormValues, type CountdownFormValues } from "./forms/countdown-board-form";
import { Camera, Download, FileText, FileUp, Pencil, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { formatCountdownImportIssue, formatCountdownStatus } from "../countdown-copy";
import {
  buildCountdownExportParams,
  resolveCountdownEntryMode,
  type CountdownEntryMode,
} from "../countdown-dialog";
import {
  buildCountdownDeadlineFilters,
  buildCountdownProgressFilters,
  countdownPriorityLabels,
  countdownPriorityRank,
  countdownProgressOptions,
  countdownScopeFilters,
  countdownSmartViewOptions,
  countdownStatusOptions,
  readCountdownDeadlineRange,
  readCountdownProgressSelection,
  resolveCountdownFilterValue,
  resolveCountdownDefaultSmartView,
  resolveCountdownPriority,
  resolveCountdownSmartView,
  shouldHideUnitColumn,
  todayIso,
  type CountdownSmartView,
} from "../countdown-board";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ReferenceOption {
  label: string;
  value: string;
  code?: string | null;
  grade?: string | null;
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
  employees?: ReferenceOption[];
  grades?: ReferenceOption[];
  taskCategories?: ReferenceOption[];
}

interface CountdownBoardShellProps {
  rows: CountdownBoardRow[];
  references: CountdownReferences;
  canManage: boolean;
  user?: AuthUser | null;
  /** Board yang dirender di dalam satu unit (tab Countdown Unit Workspace). */
  singleUnitContext?: boolean;
  meta: {
    page: number; limit: number; total: number;
    totalPages: number; hasNext: boolean; hasPrev: boolean;
  };
  state: GridQueryState;
}

type CountdownBoardViewRow = CountdownBoardRow & {
  priorityRank: number;
  priorityLabel: string;
};


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

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/u, "");
}

/* ------------------------------------------------------------------ */
/*  Grid config                                                         */
/* ------------------------------------------------------------------ */

function buildCountdownColumns(
  canManage: boolean,
  onEdit: (row: CountdownBoardRow) => void,
  onDelete: (row: CountdownBoardRow) => void,
): ColDef<CountdownBoardViewRow>[] {
  return [
    {
      headerName: "Unit",
      field: "unitName",
      pinned: "left",
      minWidth: 145,
      flex: 0.8,
      cellRenderer: ({ value, data }: ICellRendererParams<CountdownBoardViewRow>) => (
        <Link
          href={`/countdown/${String(data?.countdownId ?? "")}`}
          className="text-[12px] font-medium text-foreground hover:text-app-accent-ink"
        >
          {String(value ?? "-")}
        </Link>
      ),
    },
    {
      headerName: "Status",
      field: "status",
      minWidth: 110,
      valueFormatter: ({ value }) => formatCountdownStatus(String(value ?? "")),
    },
    {
      headerName: "Prioritas",
      field: "priorityRank",
      minWidth: 120,
      cellRenderer: ({ data }: ICellRendererParams<CountdownBoardViewRow>) => {
        const priority = data?.priorityLabel ?? "Normal";
        const tone = data?.priorityRank === 0
          ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
          : data?.priorityRank === 1
            ? "border-warning/30 bg-warning/[0.08] text-warning"
            : "border-border bg-muted/40 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]";
        return (
          <span className={`inline-flex border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}>
            {priority}
          </span>
        );
      },
    },
    { headerName: "Divisi", field: "divisionName", minWidth: 120 },
    { headerName: "Temuan", field: "temuanAwal", minWidth: 200, flex: 1 },
    {
      headerName: "Job Description",
      field: "jobTypeName",
      minWidth: 190,
      flex: 1.1,
      valueFormatter: ({ value, data }) => String(value ?? data?.sectionName ?? "-"),
    },
    { headerName: "Grade", field: "requiredGrade", minWidth: 90, valueFormatter: ({ value }) => String(value ?? "-") },
    {
      headerName: "PIC",
      field: "picPlan",
      minWidth: 140,
      valueFormatter: ({ value, data }) => data?.picName ?? (value ? String(value) : "-"),
    },
    { 
      headerName: "Target",
      field: "targetHoursInitial",
      minWidth: 92,
      valueFormatter: ({ value }) => formatDecimalToHHMM(Number(value)) || "00:00",
      cellClass: "text-right tabular-nums",
    },
    { 
      headerName: "Aktual",
      field: "totalActualHours",
      minWidth: 92,
      valueFormatter: ({ value }) => formatDecimalToHHMM(Number(value)) || "00:00",
      cellClass: "text-right tabular-nums",
    },
    { 
      headerName: "Sisa",
      field: "remainingHours",
      minWidth: 92,
      valueFormatter: ({ value }) => formatDecimalToHHMM(Number(value)) || "00:00",
      cellClass: "text-right tabular-nums",
    },
    { headerName: "Progress", field: "actualProgressPercent", minWidth: 95, valueFormatter: ({ value }) => `${formatNumber(Number(value ?? 0))}%`, cellClass: "text-right" },
    { headerName: "Mulai", field: "startDate", minWidth: 110 },
    { headerName: "Deadline", field: "deadlineDate", minWidth: 115 },
    {
      headerName: "Tindakan",
      colId: "action",
      minWidth: 265,
      pinned: "right",
      sortable: false,
      filter: false,
      cellRenderer: ({ data: row }: ICellRendererParams<CountdownBoardViewRow>) => row ? (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Link href={`/countdown/${String(row.countdownId ?? "")}`}
            className="border border-primary/30 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-app-accent-ink hover:bg-primary/[0.12] transition-colors">
            Detail
          </Link>
          {canManage ? (
            <Link href={`/countdown/${String(row.countdownId ?? "")}#job-plan`}
              className="border border-success/25 bg-success/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-success hover:bg-success/[0.12] transition-colors">
              Buat Job Plan
            </Link>
          ) : null}
          <Link href={`/countdown/${String(row.countdownId ?? "")}#dokumentasi`}
            className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/55 hover:border-primary/30 hover:text-app-accent-ink transition-colors">
            <Camera className="h-3 w-3" />Dokumentasi
          </Link>
          {canManage && (
            <>
              <button type="button" onClick={() => onEdit(row)}
                className="inline-flex items-center gap-1 border border-white/[0.07] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/55 hover:border-primary/30 hover:text-app-accent-ink transition-colors">
                <Pencil className="h-3 w-3" />Edit
              </button>
              <button type="button" onClick={() => onDelete(row)}
                className="inline-flex items-center gap-1 border border-destructive/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-destructive/80 hover:bg-destructive/[0.06] transition-colors">
                <Trash2 className="h-3 w-3" />Hapus
              </button>
            </>
          )}
        </div>
      ) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function CountdownBoardShell({
  rows,
  references,
  canManage,
  meta,
  state,
  user,
  singleUnitContext = false,
}: CountdownBoardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sweetAlert = useSweetAlert();
  const gridState = useDataGridState(state);
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
  const [searchInput, setSearchInput] = useState(state.search);
  const [selectedRows, setSelectedRows] = useState<CountdownBoardViewRow[]>([]);
  const saveInFlightRef = useRef(false);

  const activeFilters = state.filters ?? [];
  const scopeFilters = useMemo(() => countdownScopeFilters(user), [user]);
  const smartView = resolveCountdownSmartView(
    searchParams.get("smartView") ?? resolveCountdownDefaultSmartView(scopeFilters),
  );
  const hideUnitColumn = shouldHideUnitColumn({ singleUnitContext, smartView, scopeFilters });
  const deadlineRange = readCountdownDeadlineRange(activeFilters);
  const progressSelection = readCountdownProgressSelection(activeFilters);
  const activeUnitFilter = activeFilters.find((filter) => filter.field === "unitId");
  const activeDivisionFilter = activeFilters.find((filter) => filter.field === "divisionId");

  const activeUnitId = activeUnitFilter?.value as string | undefined;
  const activeDivisionId = activeDivisionFilter?.value as string | undefined;

  // Resolve label untuk display di UI
  const activeUnitLabel = references.units.find((u) => u.value === activeUnitId)?.label ?? null;
  const activeDivisionLabel = references.divisions.find((d) => d.value === activeDivisionId)?.label ?? null;
  const viewRows = useMemo<CountdownBoardViewRow[]>(() => rows.map((row) => {
    const priority = resolveCountdownPriority(row);
    return {
      ...row,
      priorityRank: countdownPriorityRank(priority),
      priorityLabel: countdownPriorityLabels[priority],
    };
  }), [rows]);

  useEffect(() => {
    setSearchInput(state.search);
  }, [state.search]);

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
    setSelectedFile(null); setEditorMode("create");
    setInitialFormValues({ ...emptyCountdownFormValues, carId: activeUnitId ?? "" });
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
      picPlan: row.picPlan ?? "",
      requiredGrade: row.requiredGrade ?? "",
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
      picPlan: normalizeTextInput(data.picPlan ?? ""),
      requiredGrade: normalizeTextInput(data.requiredGrade ?? ""),
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

  function applyFilters(nextFilters: GridFilter[], nextSmartView: CountdownSmartView) {
    gridState.setFilters(nextFilters, { smartView: nextSmartView });
  }

  function replaceFilterField(field: string, value: string) {
    const remaining = activeFilters.filter((filter) => filter.field !== field);
    applyFilters(value ? [...remaining, { field, operator: "eq", value }] : remaining, "custom");
  }

  // Progress dan deadline memakai beberapa filter sekaligus, jadi satu field dibersihkan lalu diisi ulang.
  function updateProgress(value: string) {
    const remaining = activeFilters.filter((filter) => filter.field !== "actualProgressPercent");
    applyFilters([...remaining, ...buildCountdownProgressFilters(value)], "custom");
  }

  function updateDeadline(range: { from: string; to: string }) {
    const remaining = activeFilters.filter((filter) => filter.field !== "deadlineDate");
    applyFilters([...remaining, ...buildCountdownDeadlineFilters(range.from, range.to)], "custom");
  }

  function applySmartView(value: CountdownSmartView) {
    if (value === "custom") {
      applyFilters(activeFilters, "custom");
      return;
    }
    applyFilters(value === "all" ? [] : scopeFilters, value);
  }

  function resetFilters() {
    applyFilters(scopeFilters, scopeFilters.length > 0 ? "scope" : "all");
  }

  function handleGridCopy(event: ClipboardEvent<HTMLDivElement>) {
    if (selectedRows.length === 0) return;
    const text = copySelectedGridRows(selectedRows, [
      { key: "unitName", header: "Unit" },
      { key: "status", header: "Status" },
      { key: "priorityLabel", header: "Prioritas" },
      { key: "divisionName", header: "Divisi" },
      { key: "temuanAwal", header: "Temuan" },
      { key: "jobTypeName", header: "Job Description" },
      { key: "requiredGrade", header: "Grade" },
      { key: "picName", header: "PIC" },
      { key: "targetHoursInitial", header: "Target" },
      { key: "totalActualHours", header: "Aktual" },
      { key: "remainingHours", header: "Sisa" },
      { key: "actualProgressPercent", header: "Progress" },
      { key: "startDate", header: "Mulai" },
      { key: "deadlineDate", header: "Deadline" },
    ]);
    if (!text) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  }

  const columns = buildCountdownColumns(canManage, openEditCountdown, handleDeleteCountdown)
    .filter((column) => !hideUnitColumn || column.field !== "unitName");
  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("limit", String(meta.limit));
    return `${pathname}?${params.toString()}`;
  }

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

      {/* ── Smart View + Filter Bar ── */}
      <section className="border border-border bg-card" aria-label="Filter countdown">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">View</span>
          <CompactSelect
            aria-label="Smart view"
            value={smartView}
            onChange={(event) => applySmartView(event.target.value as CountdownSmartView)}
            className="w-40"
          >
            {countdownSmartViewOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </CompactSelect>
          <span className="text-[11px] text-muted-foreground">
            {smartView === "all"
              ? "Semua data dalam wewenang akses Anda."
              : smartView === "custom"
                ? "Filter manual aktif."
                : scopeFilters.length > 0
                  ? `Scope bawaan peran: ${[
                    ...scopeFilters
                      .filter((filter) => filter.field === "unitId")
                      .map((filter) => references.units.find((unit) => unit.value === filter.value)?.label ?? filter.value),
                    ...scopeFilters
                      .filter((filter) => filter.field === "divisionId")
                      .map((filter) => references.divisions.find((division) => division.value === filter.value)?.label ?? filter.value),
                  ].join(", ")}.`
                  : "Semua data dalam wewenang akses Anda."}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <ActionButton onClick={resetFilters}>Reset Filter</ActionButton>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 px-3 py-2">
          <div className="flex flex-col gap-1">
            <FieldLabel>Cari</FieldLabel>
            <CompactInput
              type="search"
              value={searchInput}
              placeholder="Unit, job desc, PIC, temuan"
              aria-label="Cari countdown"
              className="w-56"
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") gridState.setSearch(searchInput.trim(), { smartView: "custom" });
              }}
              onBlur={() => {
                if (searchInput.trim() !== state.search) gridState.setSearch(searchInput.trim(), { smartView: "custom" });
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Status</FieldLabel>
            <CompactSelect
              value={resolveCountdownFilterValue(activeFilters, "status")}
              className="w-36"
              onChange={(event) => replaceFilterField("status", event.target.value)}
            >
              <option value="">Semua status</option>
              {countdownStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </CompactSelect>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Divisi</FieldLabel>
            <CompactSelect
              value={resolveCountdownFilterValue(activeFilters, "divisionId")}
              className="w-44"
              onChange={(event) => replaceFilterField("divisionId", event.target.value)}
            >
              <option value="">Semua divisi</option>
              {references.divisions.map((division) => (
                <option key={division.value} value={division.value}>{division.label}</option>
              ))}
            </CompactSelect>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Unit</FieldLabel>
            <CompactSelect
              value={resolveCountdownFilterValue(activeFilters, "unitId")}
              className="w-44"
              onChange={(event) => replaceFilterField("unitId", event.target.value)}
            >
              <option value="">Semua unit</option>
              {references.units.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </CompactSelect>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>PIC</FieldLabel>
            <CompactSelect
              value={resolveCountdownFilterValue(activeFilters, "picPlan")}
              className="w-44"
              onChange={(event) => replaceFilterField("picPlan", event.target.value)}
            >
              <option value="">Semua PIC</option>
              {(references.employees ?? []).map((employee) => (
                <option key={employee.value} value={employee.value}>{employee.label}</option>
              ))}
            </CompactSelect>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Grade</FieldLabel>
            <CompactSelect
              value={resolveCountdownFilterValue(activeFilters, "requiredGrade")}
              className="w-36"
              onChange={(event) => replaceFilterField("requiredGrade", event.target.value)}
            >
              <option value="">Semua grade</option>
              {(references.grades ?? []).map((grade) => (
                <option key={grade.value} value={grade.value}>{grade.label}</option>
              ))}
            </CompactSelect>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Deadline</FieldLabel>
            <div className="flex items-center gap-1">
              <CompactDateRangeInput
                from={deadlineRange.from || todayIso()}
                to={deadlineRange.to}
                onChange={updateDeadline}
                selectionBehavior="single-or-range"
                displayLabel={deadlineRange.from || deadlineRange.to ? undefined : "Semua deadline"}
                className="w-56"
              />
              {deadlineRange.from || deadlineRange.to ? (
                <button
                  type="button"
                  onClick={() => applyFilters(
                    activeFilters.filter((filter) => filter.field !== "deadlineDate"),
                    "custom",
                  )}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Hapus
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Progress</FieldLabel>
            <CompactSelect
              value={progressSelection}
              className="w-40"
              onChange={(event) => updateProgress(event.target.value)}
            >
              {countdownProgressOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </CompactSelect>
          </div>
        </div>

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-app-accent-ink/70">Filter aktif:</span>
            {activeUnitLabel ? (
              <span className="border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground/70">Unit: {activeUnitLabel}</span>
            ) : null}
            {activeDivisionLabel ? (
              <span className="border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground/70">Divisi: {activeDivisionLabel}</span>
            ) : null}
            <span className="border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground/70">
              {activeFilters.length} filter aktif
            </span>
          </div>
        ) : null}
      </section>

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

      <section className="border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[12px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Daftar Countdown</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {meta.total} data · halaman {meta.page}/{meta.totalPages}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>Pilih baris untuk menyalin (Ctrl/Cmd+C), klik dua kali untuk membuka detail.</span>
            <Link
              aria-disabled={!meta.hasPrev}
              href={meta.hasPrev ? pageHref(meta.page - 1) : "#"}
              className={`border border-border px-2 py-1 ${meta.hasPrev ? "hover:text-foreground" : "pointer-events-none opacity-40"}`}
            >
              Prev
            </Link>
            <Link
              aria-disabled={!meta.hasNext}
              href={meta.hasNext ? pageHref(meta.page + 1) : "#"}
              className={`border border-border px-2 py-1 ${meta.hasNext ? "hover:text-foreground" : "pointer-events-none opacity-40"}`}
            >
              Next
            </Link>
          </div>
        </div>
        <div onCopyCapture={handleGridCopy}>
        <SmsAgGrid<CountdownBoardViewRow>
          heightClassName="h-[calc(100svh-360px)] min-h-[26rem]"
          rowData={viewRows}
          columnDefs={columns}
          rowSelection="multiple"
          enableCellTextSelection
          onSelectionChanged={(event) => {
            setSelectedRows(event.api.getSelectedRows());
          }}
          onRowDoubleClicked={(event) => {
            if (event.data) router.push(`/countdown/${encodeURIComponent(String(event.data.countdownId))}`);
          }}
          getRowId={(params) => params.data.countdownId}
          emptyMessage="Belum ada countdown yang sesuai pencarian saat ini."
        />
        </div>
      </section>
    </div>
  );
}
