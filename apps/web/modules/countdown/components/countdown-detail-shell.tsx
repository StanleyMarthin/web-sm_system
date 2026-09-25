"use client";

// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench utilitarian · design.md

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, ICellEditorParams, ICellRendererParams } from "ag-grid-community";
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { humanizeCodeLabel, fmtTime } from "@/shared/format/humanize";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { parseClipboardTsv } from "@/shared/datagrid/clipboard";
import { approveCountdownRevision, requestCountdownRevision } from "@/shared/api/countdown/countdown";
import { fetchJobPlanGrid } from "@/shared/api/job-plan/job-plan";
import { createJobPlan, createJobPlanCommandId } from "@/shared/api/job-plan/job-plan-runtime";
import { createPr } from "@/shared/api/pr/pr";
import { createVendor } from "@/shared/api/vendor/vendor";
import { createWo } from "@/shared/api/wo/wo";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SmartSelectCellEditor, type SmartSelectOption } from "@/modules/units/components/master-panel-smart-select-editor";
import { resolveCountdownPhotoUrl, resolveCountdownRevisionActions } from "../countdown-dialog";
import { formatCountdownRevisionStatus } from "../countdown-revision";

interface CountdownDetailShellProps {
  countdown: CountdownDetail;
  userId: string;
  canRequestRevision?: boolean;
  canApproveRevision?: boolean;
  canApproveMoRevision?: boolean;
}

interface JobPlanEmployeeOption {
  label: string;
  value: string;
  divisionId?: number | null;
}

type JobPlanDivisionOption = SmartSelectOption;
type OperationalDraftType = "wo" | "pr" | "wov";

interface JobPlanDraftForm {
  divisionId: string;
  employeeId: string;
  taskDate: string;
  startTime: string;
  durationText: string;
  jobDescription: string;
  note: string;
  isPriority: boolean;
}

type JobPlanDraftRow = JobPlanDraftForm & {
  clientId: string;
  error: string | null;
};

interface OperationalDraftRow {
  clientId: string;
  type: OperationalDraftType;
  divisionId: string;
  itemName: string;
  jobDetail: string;
  qty: number | null;
  uom: string;
  estimate: string;
  targetDate: string;
  priority: string;
  vendorName: string;
  picVendor: string;
  note: string;
  error: string | null;
}

type FreeTextSuggestCellEditorProps<TData> = {
  value?: string | null;
  values?: SmartSelectOption[];
  onValueChange?: (value: string) => void;
  stopEditing: (cancel?: boolean) => void;
} & ICellEditorParams<TData, string>;

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Pengerjaan",
  AFTER: "Setelah",
  DEFECT: "Temuan",
} as const;

const priorityOptions: SmartSelectOption[] = [
  { label: "Rendah", value: "LOW" },
  { label: "Normal", value: "NORMAL" },
  { label: "Tinggi", value: "HIGH" },
];

const originOptions: SmartSelectOption[] = [
  { label: "Lokal", value: "LOKAL" },
  { label: "Luar Negeri", value: "LN" },
];

type CountdownActualEntry = CountdownDetail["details"][number];
type CountdownActualRow = CountdownActualEntry & { divisionName: string | null };

const actualColumnDefs: ColDef<CountdownActualRow>[] = [
  { headerName: "Divisi", field: "divisionName", minWidth: 120, valueFormatter: ({ value }) => String(value ?? "Tanpa divisi") },
  { headerName: "Tanggal", field: "workDate", minWidth: 110 },
  { headerName: "PIC", field: "employeeName", minWidth: 150, flex: 0.8 },
  { headerName: "Mulai", field: "startTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Selesai", field: "finishTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Durasi", field: "billedHours", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Progress", field: "progressPercent", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(0)}%` },
  { headerName: "Status", field: "taskStatus", minWidth: 130, cellRenderer: ({ value }: ICellRendererParams<CountdownActualRow>) => <DataGridStatusBadge value={humanizeCodeLabel(value)} /> },
  { headerName: "Catatan", field: "dailyNotes", minWidth: 220, flex: 1 },
];

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} jam`;
}

function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hoursToDuration(value: number) {
  const totalMinutes = Math.max(1, Math.round(value * 60));
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function parseDurationMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/u);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function parseTimeMinutes(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/u);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function labelForOption(options: SmartSelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? "";
}

function filterEmployeesByDivision(employees: JobPlanEmployeeOption[], divisionId: string) {
  if (!divisionId) return employees;
  const numericDivisionId = Number(divisionId);
  return employees.filter((employee) => employee.divisionId === numericDivisionId);
}

function defaultEmployeeId(employees: JobPlanEmployeeOption[], currentEmployeeId = "") {
  if (currentEmployeeId && employees.some((employee) => employee.value === currentEmployeeId)) return currentEmployeeId;
  return employees.length === 1 ? employees[0].value : "";
}

function makeJobPlanDraftRow(countdown: CountdownDetail, seed: Partial<JobPlanDraftRow> = {}): JobPlanDraftRow {
  return {
    clientId: `job-plan-draft-${crypto.randomUUID()}`,
    divisionId: countdown.divisionId ? String(countdown.divisionId) : "",
    employeeId: "",
    taskDate: todayDate(),
    startTime: "08:00",
    durationText: hoursToDuration(Math.min(Math.max(countdown.remainingHours || countdown.targetHoursRevised || 1, 1), 12)),
    jobDescription: countdown.jobTypeName ?? humanizeCodeLabel(countdown.taskCategory),
    note: countdown.keterangan ?? countdown.note ?? "",
    isPriority: false,
    error: null,
    ...seed,
  };
}

function makeOperationalDraftRow(countdown: CountdownDetail, type: OperationalDraftType, seed: Partial<OperationalDraftRow> = {}): OperationalDraftRow {
  return {
    clientId: `activity-draft-${crypto.randomUUID()}`,
    type,
    divisionId: countdown.divisionId ? String(countdown.divisionId) : "",
    itemName: countdown.panelName ?? countdown.jobTypeName ?? "",
    jobDetail: countdown.jobTypeName ?? humanizeCodeLabel(countdown.taskCategory),
    qty: 1,
    uom: "PCS",
    estimate: type === "pr" ? "LOKAL" : hoursToDuration(Math.min(Math.max(countdown.remainingHours || 1, 1), 12)),
    targetDate: todayDate(),
    priority: "NORMAL",
    vendorName: "",
    picVendor: "",
    note: countdown.keterangan ?? countdown.note ?? "",
    error: null,
    ...seed,
  };
}

function resolveOptionValue(options: SmartSelectOption[], raw: string) {
  const value = raw.trim();
  return options.find((option) => [option.value, option.label, option.code].filter(Boolean).some((item) => String(item).toLowerCase() === value.toLowerCase()))?.value ?? value;
}

function copyCells<TRow extends { error: string | null }>(rows: TRow[], fields: Array<keyof TRow>) {
  return rows.map((row) => fields.map((field) => {
    const value = row[field];
    return value == null ? "" : String(value);
  }).join("\t")).join("\n");
}

const FreeTextSuggestCellEditor = forwardRef(function FreeTextSuggestCellEditor<TData>(
  props: FreeTextSuggestCellEditorProps<TData>,
  ref: React.ForwardedRef<unknown>,
) {
  const options = props.values ?? [];
  const initialLabel = options.find((option) => option.value === String(props.value ?? ""))?.label ?? String(props.value ?? "");
  const valueRef = useRef(initialLabel);
  const [query, setQuery] = useState(initialLabel);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const source = trimmed
      ? options.filter((option) => `${option.label} ${option.code ?? ""} ${option.value}`.toLowerCase().includes(trimmed))
      : options;
    return source.slice(0, trimmed ? 20 : 3);
  }, [options, query]);

  useImperativeHandle(ref, () => ({
    getValue: () => valueRef.current,
    isPopup: () => true,
    getPopupPosition: () => "under",
  }));

  function commit(value: string) {
    valueRef.current = value;
    props.onValueChange?.(value);
    props.stopEditing();
  }

  return (
    <div className="ag-custom-component-popup z-[9999] w-[280px] border border-border bg-card p-2 shadow-xl dark:border-white/[0.08] dark:bg-muted">
      <input
        autoFocus
        value={query}
        onChange={(event) => {
          valueRef.current = event.target.value;
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            commit(visibleOptions[activeIndex]?.value ?? query.trim());
          }
          if (event.key === "Escape") props.stopEditing(true);
        }}
        className="h-8 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/45"
        placeholder="Ketik atau pilih..."
      />
      {visibleOptions.length > 0 ? (
        <div className="mt-2 max-h-44 overflow-auto">
          {visibleOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                commit(option.value);
              }}
              className={`block w-full px-2 py-1.5 text-left text-[13px] ${index === activeIndex ? "bg-primary/[0.08] text-app-accent-ink" : "text-foreground hover:bg-muted"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-t border-border py-2 first:border-t-0 dark:border-white/[0.06]">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

function CountdownWorkCard({ countdown }: { countdown: CountdownDetail }) {
  return (
    <article className="border border-border bg-background dark:border-white/[0.06]">
      <div className="border-b border-border px-3 py-2 dark:border-white/[0.06]">
        <p className="text-sm font-semibold text-foreground">{countdown.sectionName || "Component belum ditentukan"}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{countdown.panelName || "Panel belum ditentukan"}</p>
      </div>
      <dl className="px-3 py-1">
        <MetricField label="Divisi" value={countdown.divisionName ?? "Tanpa divisi"} />
        <MetricField label="Jobdesc" value={countdown.jobTypeName ?? humanizeCodeLabel(countdown.taskCategory)} />
        <MetricField label="Temuan Awal" value={countdown.temuanAwal ?? "-"} />
        <MetricField label="Grade" value={countdown.requiredGrade ?? "-"} />
        <MetricField label="Target Awal" value={formatHours(countdown.targetHoursInitial)} />
        <MetricField label="Target Hours" value={formatHours(countdown.targetHoursRevised)} />
        <MetricField label="Aktual" value={formatHours(countdown.totalActualHours)} />
        <MetricField label="Sisa Jam Kerja" value={formatHours(countdown.remainingHours)} />
        <MetricField label="PIC" value={countdown.picName ?? countdown.picPlan ?? "-"} />
        <MetricField label="Keterangan" value={countdown.keterangan ?? countdown.note ?? "-"} />
        <MetricField label="Mulai" value={countdown.startDate ?? "-"} />
        <MetricField label="Deadline" value={countdown.deadlineDate ?? "-"} />
      </dl>
      <div className="border-t border-border px-3 py-2 dark:border-white/[0.06]">
        <DataGridStatusBadge value={humanizeCodeLabel(countdown.status)} />
      </div>
    </article>
  );
}

function CountdownGallery({ countdown }: { countdown: CountdownDetail }) {
  const photos = countdown.details.flatMap((detail) => detail.photos.map((photo) => ({
    ...photo,
    workDate: detail.workDate,
    employeeName: detail.employeeName,
  }))).filter((photo) => resolveCountdownPhotoUrl(photo.url));
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex];
  const activeUrl = activePhoto ? resolveCountdownPhotoUrl(activePhoto.url) : null;

  if (!activePhoto || !activeUrl) {
    return (
      <div className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Kamera Dokumentasi</h2>
        </div>
        <p className="px-3 py-5 text-sm text-muted-foreground">Belum ada foto.</p>
      </div>
    );
  }

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + photos.length) % photos.length);
  }

  return (
    <div className="border border-border bg-card dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Kamera Dokumentasi</h2>
        </div>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{photos.length} foto</span>
      </div>
      <div className="space-y-3 p-3">
        <div className="relative flex aspect-[16/9] min-h-[14rem] max-h-[24rem] items-center justify-center overflow-hidden border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
          <img src={activeUrl} alt={activePhoto.caption || `Dokumentasi ${photoLabels[activePhoto.type]}`} className="h-full w-full object-contain" />
          {photos.length > 1 ? (
            <>
              <button type="button" onClick={() => move(-1)} className="absolute left-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(1)} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : null}
        </div>
        <p className="text-[12px] font-medium text-foreground">Foto lainnya</p>
        <div className="grid max-h-32 grid-cols-4 gap-2 overflow-y-auto pr-1">
          {photos.map((photo, index) => {
            const url = resolveCountdownPhotoUrl(photo.url);
            if (!url) return null;
            return (
              <button key={photo.photoId} type="button" onClick={() => setActiveIndex(index)} className={`relative h-14 min-w-0 overflow-hidden border bg-background text-left ${index === activeIndex ? "border-primary" : "border-border hover:border-primary/50"}`} aria-label={`Pilih foto ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center font-mono text-[9px] uppercase text-white">{photoLabels[photo.type]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
        <span className="font-medium text-foreground">{photoLabels[activePhoto.type]}</span>
        {activePhoto.caption ? ` · ${activePhoto.caption}` : ""}
        {activePhoto.workDate ? ` · ${activePhoto.workDate}` : ""}
      </div>
    </div>
  );
}

export function CountdownDetailShell({
  countdown,
  userId,
  canRequestRevision = false,
  canApproveRevision = false,
  canApproveMoRevision = false,
}: CountdownDetailShellProps) {
  const router = useRouter();
  const revisionDialogRef = useRef<HTMLDialogElement>(null);
  const sweetAlert = useSweetAlert();
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [requestedHours, setRequestedHours] = useState("");
  const [requestedDeadline, setRequestedDeadline] = useState(countdown.deadlineDate ?? "");
  const [revisionReason, setRevisionReason] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [isDecidingRevision, setIsDecidingRevision] = useState(false);
  const [jobPlanDraftOpen, setJobPlanDraftOpen] = useState(false);
  const [operationalDraftType, setOperationalDraftType] = useState<OperationalDraftType | null>(null);
  const [jobPlanDivisions, setJobPlanDivisions] = useState<JobPlanDivisionOption[]>([]);
  const [jobPlanEmployees, setJobPlanEmployees] = useState<JobPlanEmployeeOption[]>([]);
  const [isLoadingJobPlanRefs, setIsLoadingJobPlanRefs] = useState(false);
  const [isSavingJobPlanDraft, setIsSavingJobPlanDraft] = useState(false);
  const [isSavingOperationalDraft, setIsSavingOperationalDraft] = useState(false);
  const [jobPlanDraftError, setJobPlanDraftError] = useState<string | null>(null);
  const [operationalDraftError, setOperationalDraftError] = useState<string | null>(null);
  const [jobPlanDraftRows, setJobPlanDraftRows] = useState<JobPlanDraftRow[]>([]);
  const [operationalDraftRows, setOperationalDraftRows] = useState<OperationalDraftRow[]>([]);
  const revisionActions = resolveCountdownRevisionActions({
    status: countdown.status,
    extensionRequestStatus: countdown.extensionRequestStatus ?? null,
    canRequestRevision,
    canApproveRevision,
    canApproveMoRevision,
  });
  const approvalRole = revisionActions.canApprove ? "KP" : revisionActions.canApproveMo ? "MO" : null;
  const jobPlanColumnDefs = useMemo<ColDef<JobPlanDraftRow>[]>(() => [
    {
      headerName: "Divisi",
      field: "divisionId",
      editable: jobPlanDivisions.length > 1,
      cellEditor: SmartSelectCellEditor,
      cellEditorParams: { values: jobPlanDivisions },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value }) => labelForOption(jobPlanDivisions, String(value ?? "")) || countdown.divisionName || "",
      minWidth: 145,
      flex: 0.75,
    },
    {
      headerName: "PIC",
      field: "employeeId",
      editable: true,
      cellEditor: FreeTextSuggestCellEditor,
      cellEditorParams: ({ data }: { data?: JobPlanDraftRow }) => ({
        values: filterEmployeesByDivision(jobPlanEmployees, String(data?.divisionId ?? "")),
      }),
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
      valueFormatter: ({ value }) => labelForOption(jobPlanEmployees, String(value ?? "")) || String(value ?? ""),
      minWidth: 150,
      flex: 0.8,
    },
    { headerName: "Tanggal", field: "taskDate", editable: true, cellEditor: "agDateStringCellEditor", minWidth: 120 },
    { headerName: "Mulai", field: "startTime", editable: true, minWidth: 90 },
    { headerName: "Estimasi", field: "durationText", editable: true, minWidth: 105 },
    { headerName: "Detail Pekerjaan", field: "jobDescription", editable: true, minWidth: 220, flex: 1.3 },
    { headerName: "Catatan", field: "note", editable: true, minWidth: 180, flex: 0.9 },
    {
      headerName: "Prioritas",
      field: "isPriority",
      editable: true,
      cellRenderer: "agCheckboxCellRenderer",
      cellEditor: "agCheckboxCellEditor",
      minWidth: 105,
      valueFormatter: ({ value }) => value ? "Ya" : "Tidak",
    },
    {
      headerName: "Status",
      field: "error",
      editable: false,
      minWidth: 155,
      pinned: "right",
      cellRenderer: ({ data }: ICellRendererParams<JobPlanDraftRow>) => data?.error
        ? <span className="text-[12px] text-destructive">{data.error}</span>
        : <span className="text-[12px] text-muted-foreground">Draft</span>,
    },
  ], [countdown.divisionName, jobPlanDivisions, jobPlanEmployees]);
  const operationalColumnDefs = useMemo<ColDef<OperationalDraftRow>[]>(() => {
    const statusColumn: ColDef<OperationalDraftRow> = {
      headerName: "Status",
      field: "error",
      editable: false,
      minWidth: 155,
      pinned: "right",
      cellRenderer: ({ data }: ICellRendererParams<OperationalDraftRow>) => data?.error
        ? <span className="text-[12px] text-destructive">{data.error}</span>
        : <span className="text-[12px] text-muted-foreground">Draft</span>,
    };

    if (operationalDraftType === "wo") {
      return [
        {
          headerName: "Divisi Tujuan",
          field: "divisionId",
          editable: jobPlanDivisions.length > 1,
          cellEditor: SmartSelectCellEditor,
          cellEditorParams: { values: jobPlanDivisions },
          cellEditorPopup: true,
          cellEditorPopupPosition: "under",
          valueFormatter: ({ value }) => labelForOption(jobPlanDivisions, String(value ?? "")) || countdown.divisionName || "",
          minWidth: 160,
          flex: 0.8,
        },
        { headerName: "Pekerjaan", field: "jobDetail", editable: true, minWidth: 240, flex: 1.3 },
        { headerName: "Estimasi", field: "estimate", editable: true, minWidth: 105 },
        { headerName: "Tanggal", field: "targetDate", editable: true, cellEditor: "agDateStringCellEditor", minWidth: 120 },
        { headerName: "Prioritas", field: "priority", editable: true, cellEditor: SmartSelectCellEditor, cellEditorParams: { values: priorityOptions }, cellEditorPopup: true, cellEditorPopupPosition: "under", valueFormatter: ({ value }) => labelForOption(priorityOptions, String(value ?? "")), minWidth: 110 },
        { headerName: "Catatan", field: "note", editable: true, minWidth: 180, flex: 0.8 },
        statusColumn,
      ];
    }

    if (operationalDraftType === "pr") {
      return [
        { headerName: "Item", field: "itemName", editable: true, minWidth: 220, flex: 1.2 },
        { headerName: "Qty", field: "qty", editable: true, minWidth: 85, valueParser: ({ newValue }) => Number(newValue) },
        { headerName: "UOM", field: "uom", editable: true, minWidth: 85 },
        { headerName: "Asal", field: "estimate", editable: true, cellEditor: SmartSelectCellEditor, cellEditorParams: { values: originOptions }, cellEditorPopup: true, cellEditorPopupPosition: "under", valueFormatter: ({ value }) => labelForOption(originOptions, String(value ?? "")) || "Lokal", minWidth: 120 },
        { headerName: "Target", field: "targetDate", editable: true, cellEditor: "agDateStringCellEditor", minWidth: 120 },
        { headerName: "Prioritas", field: "priority", editable: true, cellEditor: SmartSelectCellEditor, cellEditorParams: { values: priorityOptions }, cellEditorPopup: true, cellEditorPopupPosition: "under", valueFormatter: ({ value }) => labelForOption(priorityOptions, String(value ?? "")), minWidth: 110 },
        { headerName: "Catatan", field: "note", editable: true, minWidth: 180, flex: 0.8 },
        statusColumn,
      ];
    }

    return [
      { headerName: "Vendor", field: "vendorName", editable: true, minWidth: 180, flex: 0.9 },
      { headerName: "PIC Vendor", field: "picVendor", editable: true, minWidth: 150 },
      { headerName: "Item", field: "itemName", editable: true, minWidth: 200, flex: 1 },
      { headerName: "Qty", field: "qty", editable: true, minWidth: 85, valueParser: ({ newValue }) => Number(newValue) },
      { headerName: "UOM", field: "uom", editable: true, minWidth: 85 },
      { headerName: "Target Kembali", field: "targetDate", editable: true, cellEditor: "agDateStringCellEditor", minWidth: 130 },
      { headerName: "Catatan", field: "note", editable: true, minWidth: 180, flex: 0.8 },
      statusColumn,
    ];
  }, [countdown.divisionName, jobPlanDivisions, operationalDraftType]);

  useEffect(() => {
    const dialog = revisionDialogRef.current;
    if (revisionOpen && dialog && !dialog.open) dialog.showModal();
    if (!revisionOpen && dialog?.open) dialog.close();
  }, [revisionOpen]);

  async function handleRevisionRequest() {
    const hours = Number(requestedHours);
    if (!Number.isFinite(hours) || hours <= 0 || !requestedDeadline || !revisionReason.trim()) {
      sweetAlert.notifyError("Pengajuan belum lengkap", "Jam tambahan, deadline, dan alasan wajib diisi.");
      return;
    }
    setIsSubmittingRevision(true);
    try {
      const result = await requestCountdownRevision(countdown.countdownId, {
        requestedHours: hours,
        requestedDeadline,
        reason: revisionReason.trim(),
      });
      if (!result.success) return sweetAlert.notifyError("Pengajuan gagal", result.message);
      setRevisionOpen(false);
      sweetAlert.notifySuccess("Berhasil", "Revisi countdown berhasil diajukan.");
      router.refresh();
    } catch {
      sweetAlert.notifyError("Pengajuan gagal", "Layanan countdown tidak dapat dihubungi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  }

  async function handleRevisionDecision(isApproved: boolean) {
    const hours = countdown.requestedExtensionHours ?? 0;
    const deadline = countdown.requestedDeadline ?? countdown.deadlineDate ?? "";
    const confirmed = await sweetAlert.confirm({
      title: isApproved ? `Setujui revisi sebagai ${approvalRole}?` : `Tolak revisi sebagai ${approvalRole}?`,
      description: isApproved ? `${hours} jam dengan deadline ${deadline}.` : "Pengajuan akan dikembalikan sebagai ditolak.",
      tone: isApproved ? "info" : "warning",
      confirmLabel: isApproved ? "Setujui" : "Tolak",
    });
    if (!confirmed) return;
    setIsDecidingRevision(true);
    try {
      const result = await approveCountdownRevision(countdown.countdownId, {
        isApproved,
        approvedHours: hours,
        approvedDeadline: deadline,
      });
      if (!result.success) return sweetAlert.notifyError("Persetujuan gagal", result.message);
      sweetAlert.notifySuccess("Berhasil", isApproved ? "Revisi disetujui." : "Revisi ditolak.");
      router.refresh();
    } catch {
      sweetAlert.notifyError("Persetujuan gagal", "Layanan countdown tidak dapat dihubungi.");
    } finally {
      setIsDecidingRevision(false);
    }
  }

  async function openJobPlanDraft() {
    setJobPlanDraftOpen(true);
    setOperationalDraftType(null);
    setJobPlanDraftError(null);
    setJobPlanDraftRows((current) => current.length > 0 ? current : [makeJobPlanDraftRow(countdown)]);
    if (jobPlanEmployees.length > 0 || isLoadingJobPlanRefs) return;

    setIsLoadingJobPlanRefs(true);
    const result = await fetchJobPlanGrid("", { coreId: countdown.countdownId, date: todayDate() }, "normal");
    setIsLoadingJobPlanRefs(false);
    if (!result.payload) {
      setJobPlanDraftError("Referensi PIC belum bisa dimuat.");
      return;
    }

    const employees = result.payload.references.employees;
    const divisions = result.payload.references.divisions.map((division) => ({
      label: division.label,
      value: String(division.value),
      code: division.code ?? null,
    }));
    const divisionId = countdown.divisionId ? String(countdown.divisionId) : (divisions.length === 1 ? divisions[0].value : "");
    const filteredEmployees = filterEmployeesByDivision(employees, divisionId);
    setJobPlanDivisions(divisions);
    setJobPlanEmployees(employees);
    setJobPlanDraftRows((current) => (current.length > 0 ? current : [makeJobPlanDraftRow(countdown)]).map((row) => ({
      ...row,
      divisionId: row.divisionId || divisionId,
      employeeId: defaultEmployeeId(filteredEmployees, row.employeeId),
    })));
  }

  async function loadActivityReferences() {
    if (jobPlanDivisions.length > 0 || isLoadingJobPlanRefs) return;
    setIsLoadingJobPlanRefs(true);
    const result = await fetchJobPlanGrid("", { coreId: countdown.countdownId, date: todayDate() }, "normal");
    setIsLoadingJobPlanRefs(false);
    if (!result.payload) {
      setOperationalDraftError("Referensi divisi belum bisa dimuat.");
      return;
    }
    setJobPlanDivisions(result.payload.references.divisions.map((division) => ({
      label: division.label,
      value: String(division.value),
      code: division.code ?? null,
    })));
  }

  async function openOperationalDraft(type: OperationalDraftType) {
    setJobPlanDraftOpen(false);
    setOperationalDraftType(type);
    setOperationalDraftError(null);
    setOperationalDraftRows((current) => current.some((row) => row.type === type) ? current.filter((row) => row.type === type) : [makeOperationalDraftRow(countdown, type)]);
    await loadActivityReferences();
  }

  function updateJobPlanDraft(event: CellValueChangedEvent<JobPlanDraftRow>) {
    const row = event.data;
    const divisionId = String(row.divisionId ?? "");
    const employees = filterEmployeesByDivision(jobPlanEmployees, divisionId);
    const employeeId = event.colDef.field === "divisionId" ? defaultEmployeeId(employees, row.employeeId) : String(row.employeeId ?? "");
    setJobPlanDraftRows((current) => current.map((draft) => draft.clientId === row.clientId ? {
      ...row,
      divisionId,
      employeeId,
      error: null,
    } : draft));
    setJobPlanDraftError(null);
  }

  function updateOperationalDraft(event: CellValueChangedEvent<OperationalDraftRow>) {
    setOperationalDraftRows((current) => current.map((draft) => draft.clientId === event.data.clientId ? {
      ...event.data,
      type: operationalDraftType ?? event.data.type,
      error: null,
    } : draft));
    setOperationalDraftError(null);
  }

  async function saveJobPlanDraft() {
    if (!userId) return setJobPlanDraftError("Session user tidak terbaca.");
    const validated = jobPlanDraftRows.map((row) => {
      const durationMinutes = parseDurationMinutes(row.durationText);
      const startMinutes = parseTimeMinutes(row.startTime);
      const error = !row.employeeId
        ? "PIC wajib dipilih."
        : !row.taskDate
          ? "Tanggal wajib diisi."
          : startMinutes == null
            ? "Jam mulai harus format HH:MM."
            : !durationMinutes || durationMinutes <= 0
              ? "Estimasi harus format HH:MM."
              : !row.jobDescription.trim()
                ? "Detail pekerjaan wajib diisi."
                : null;
      return { ...row, error };
    });
    const firstError = validated.find((row) => row.error)?.error;
    if (firstError) {
      setJobPlanDraftRows(validated);
      setJobPlanDraftError(firstError);
      return;
    }

    setIsSavingJobPlanDraft(true);
    setJobPlanDraftError(null);
    const failed: JobPlanDraftRow[] = [];
    for (const row of validated) {
      const result = await createJobPlan({
        userId,
        coreId: countdown.countdownId,
        employeeId: row.employeeId,
        taskDate: row.taskDate,
        plannedStartMinute: parseTimeMinutes(row.startTime) ?? 0,
        plannedWorkMinutes: parseDurationMinutes(row.durationText) ?? 1,
        jobDescription: row.jobDescription.trim(),
        commandId: createJobPlanCommandId("countdown-job-plan"),
        note: row.note.trim() || null,
        isOvertime: false,
        isRework: false,
        isPriority: row.isPriority,
      });
      if (!result.success) failed.push({ ...row, error: result.message });
    }
    setIsSavingJobPlanDraft(false);
    if (failed.length > 0) {
      setJobPlanDraftRows(failed);
      setJobPlanDraftError(`${failed.length} draft belum tersimpan.`);
      return;
    }
    sweetAlert.notifySuccess("Draft tersimpan", "Job Plan dibuat sebagai Draft.");
    setJobPlanDraftRows([]);
    setJobPlanDraftOpen(false);
    router.refresh();
  }

  async function saveOperationalDraft() {
    if (!operationalDraftType) return;
    const rows = operationalDraftRows.filter((row) => row.type === operationalDraftType);
    const validated = rows.map((row) => {
      const qty = Number(row.qty ?? 0);
      const error = operationalDraftType === "wo" && (!row.divisionId || !Number.isFinite(Number(row.divisionId)))
        ? "Divisi tujuan wajib dipilih."
        : operationalDraftType === "wo" && !row.jobDetail.trim()
          ? "Pekerjaan wajib diisi."
          : operationalDraftType === "pr" && !row.itemName.trim()
            ? "Item wajib diisi."
            : operationalDraftType === "pr" && (!Number.isFinite(qty) || qty <= 0)
              ? "Qty wajib lebih dari 0."
              : operationalDraftType === "pr" && !row.uom.trim()
                ? "UOM wajib diisi."
                : operationalDraftType === "wov" && !row.vendorName.trim()
                  ? "Vendor wajib diisi."
                  : operationalDraftType === "wov" && !row.itemName.trim()
                    ? "Item wajib diisi."
                    : null;
      return { ...row, error };
    });
    const firstError = validated.find((row) => row.error)?.error;
    if (firstError) {
      setOperationalDraftRows(validated);
      setOperationalDraftError(firstError);
      return;
    }

    setIsSavingOperationalDraft(true);
    setOperationalDraftError(null);
    const failed: OperationalDraftRow[] = [];
    for (const row of validated) {
      const estimateMinutes = parseDurationMinutes(row.estimate);
      const estimatedHours = estimateMinutes ? estimateMinutes / 60 : null;
      const qty = Number(row.qty ?? 0);
      const result = operationalDraftType === "wo"
        ? await createWo({
          carId: countdown.carId,
          masterPanelId: countdown.panelId ?? undefined,
          panelName: countdown.panelName ?? null,
          toDivisionId: Number(row.divisionId),
          requestDate: row.targetDate,
          isPriority: row.priority === "HIGH",
          jobDetail: null,
          estimatedHours: null,
          notes: null,
          items: [{
            jobDetail: row.jobDetail.trim(),
            panelName: countdown.panelName ?? null,
            sectionName: countdown.sectionName ?? null,
            panelCategory: null,
            addPanelToMaster: false,
            estimatedHours,
            notes: row.note.trim() || null,
          }],
        })
        : operationalDraftType === "pr"
          ? await createPr({
            carId: countdown.carId,
            panelId: countdown.panelId ?? null,
            divisionName: countdown.divisionName ?? null,
            targetDate: row.targetDate || null,
            priority: row.priority || "NORMAL",
            notes: row.note.trim() || null,
            items: [{
              itemName: row.itemName.trim(),
              description: row.jobDetail.trim() || null,
              originType: row.estimate === "LN" ? "LN" : "LOKAL",
              qty: Number(row.qty ?? 0),
              uom: row.uom.trim(),
              estimatedPrice: null,
              photoUrl: null,
            }],
          })
          : await createVendor({
            carId: countdown.carId,
            coreId: countdown.countdownId,
            prId: null,
            vendorId: null,
            vendorName: row.vendorName.trim(),
            picVendor: row.picVendor.trim() || null,
            itemName: row.itemName.trim(),
            quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
            uom: row.uom.trim() || null,
            goodsConditionOut: null,
            targetDateReturn: row.targetDate || null,
            estimatedCost: null,
            remarks: row.note.trim() || null,
            items: [],
          });
      if (!result.success) failed.push({ ...row, error: result.message });
    }
    setIsSavingOperationalDraft(false);
    if (failed.length > 0) {
      setOperationalDraftRows(failed);
      setOperationalDraftError(`${failed.length} draft belum tersimpan.`);
      return;
    }
    sweetAlert.notifySuccess("Draft tersimpan", `${operationalDraftType.toUpperCase()} dibuat sebagai draft.`);
    setOperationalDraftRows([]);
    setOperationalDraftType(null);
    router.refresh();
  }

  function addJobPlanDraftRow() {
    setJobPlanDraftRows((current) => [...current, makeJobPlanDraftRow(countdown, {
      divisionId: current.at(-1)?.divisionId ?? (countdown.divisionId ? String(countdown.divisionId) : ""),
      employeeId: current.at(-1)?.employeeId ?? "",
    })]);
  }

  function addOperationalDraftRow() {
    if (!operationalDraftType) return;
    setOperationalDraftRows((current) => [...current, makeOperationalDraftRow(countdown, operationalDraftType, {
      divisionId: current.at(-1)?.divisionId ?? (countdown.divisionId ? String(countdown.divisionId) : ""),
      priority: current.at(-1)?.priority ?? "NORMAL",
      uom: current.at(-1)?.uom ?? "PCS",
    })]);
  }

  async function handleJobPlanGridKeyDown(event: CellKeyDownEvent<JobPlanDraftRow>) {
    const keyboardEvent = event.event as KeyboardEvent | undefined;
    if (!keyboardEvent || !event.data) return;
    const fields: Array<keyof JobPlanDraftRow> = ["divisionId", "employeeId", "taskDate", "startTime", "durationText", "jobDescription", "note"];
    const field = event.column.getColId() as keyof JobPlanDraftRow;

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "c") {
      const selectedRows = event.api.getSelectedRows();
      await navigator.clipboard?.writeText(copyCells(selectedRows.length > 0 ? selectedRows : [event.data], fields));
      keyboardEvent.preventDefault();
      return;
    }

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "v") {
      const text = await navigator.clipboard?.readText();
      if (!text) return;
      const matrix = parseClipboardTsv(text);
      if (matrix.length > 500) return setJobPlanDraftError("Paste maksimal 500 baris.");
      const startRow = event.node.rowIndex ?? jobPlanDraftRows.length;
      const startField = Math.max(0, fields.indexOf(field));
      const next = [...jobPlanDraftRows];
      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
        const rowIndex = startRow + rowOffset;
        if (!next[rowIndex]) next[rowIndex] = makeJobPlanDraftRow(countdown);
        let row = { ...next[rowIndex], error: null };
        for (let colOffset = 0; colOffset < matrix[rowOffset].length; colOffset += 1) {
          const targetField = fields[startField + colOffset];
          const raw = matrix[rowOffset][colOffset] ?? "";
          if (!targetField) break;
          if (targetField === "divisionId") row = { ...row, divisionId: resolveOptionValue(jobPlanDivisions, raw) };
          else if (targetField === "employeeId") row = { ...row, employeeId: resolveOptionValue(filterEmployeesByDivision(jobPlanEmployees, row.divisionId), raw) };
          else row = { ...row, [targetField]: raw };
        }
        next[rowIndex] = row;
      }
      setJobPlanDraftRows(next);
      keyboardEvent.preventDefault();
      return;
    }

    if (keyboardEvent.key === "Enter" && event.node.rowIndex === jobPlanDraftRows.length - 1 && field === fields.at(-1)) {
      addJobPlanDraftRow();
    }
  }

  async function handleOperationalGridKeyDown(event: CellKeyDownEvent<OperationalDraftRow>) {
    const keyboardEvent = event.event as KeyboardEvent | undefined;
    if (!keyboardEvent || !event.data || !operationalDraftType) return;
    const fields: Array<keyof OperationalDraftRow> = operationalDraftType === "wo"
      ? ["divisionId", "jobDetail", "estimate", "targetDate", "priority", "note"]
      : operationalDraftType === "pr"
        ? ["itemName", "qty", "uom", "estimate", "targetDate", "priority", "note"]
        : ["vendorName", "picVendor", "itemName", "qty", "uom", "targetDate", "note"];
    const field = event.column.getColId() as keyof OperationalDraftRow;

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "c") {
      const selectedRows = event.api.getSelectedRows();
      await navigator.clipboard?.writeText(copyCells(selectedRows.length > 0 ? selectedRows : [event.data], fields));
      keyboardEvent.preventDefault();
      return;
    }

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "v") {
      const text = await navigator.clipboard?.readText();
      if (!text) return;
      const matrix = parseClipboardTsv(text);
      if (matrix.length > 500) return setOperationalDraftError("Paste maksimal 500 baris.");
      const startRow = event.node.rowIndex ?? operationalDraftRows.length;
      const startField = Math.max(0, fields.indexOf(field));
      const next = operationalDraftRows.filter((row) => row.type === operationalDraftType);
      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
        const rowIndex = startRow + rowOffset;
        if (!next[rowIndex]) next[rowIndex] = makeOperationalDraftRow(countdown, operationalDraftType);
        let row = { ...next[rowIndex], error: null };
        for (let colOffset = 0; colOffset < matrix[rowOffset].length; colOffset += 1) {
          const targetField = fields[startField + colOffset];
          const raw = matrix[rowOffset][colOffset] ?? "";
          if (!targetField) break;
          if (targetField === "divisionId") row = { ...row, divisionId: resolveOptionValue(jobPlanDivisions, raw) };
          else if (targetField === "priority") row = { ...row, priority: resolveOptionValue(priorityOptions, raw) };
          else if (targetField === "estimate" && operationalDraftType === "pr") row = { ...row, estimate: resolveOptionValue(originOptions, raw) };
          else if (targetField === "qty") row = { ...row, qty: Number(raw) };
          else row = { ...row, [targetField]: raw };
        }
        next[rowIndex] = row;
      }
      setOperationalDraftRows(next);
      keyboardEvent.preventDefault();
      return;
    }

    if (keyboardEvent.key === "Enter" && event.node.rowIndex === operationalDraftRows.length - 1 && field === fields.at(-1)) {
      addOperationalDraftRow();
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <header className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link href={`/units/${encodeURIComponent(countdown.carId)}?tab=countdown`} title="Kembali ke Countdown Unit" aria-label="Kembali ke Countdown Unit" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-lg font-semibold text-foreground">{countdown.unitName}</h1>
              <span className="shrink-0"><DataGridStatusBadge value={humanizeCodeLabel(countdown.status)} /></span>
            </div>
            <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">
              {countdown.panelName ?? "Panel belum ditentukan"}
            </p>
            <p className="truncate pl-6 text-xs text-muted-foreground">{countdown.customerName || "-"}</p>
            <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">KP: {countdown.kpName || "-"}</p>
            <p className="truncate pl-6 text-xs text-muted-foreground">KD: {countdown.kdName || "-"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {revisionActions.canRequest ? (
              <ActionButton variant="primary" onClick={() => setRevisionOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" />Ajukan Revisi
              </ActionButton>
            ) : null}
            {approvalRole ? (
              <>
                <ActionButton variant="success" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(true)}>
                  <Check className="h-3.5 w-3.5" />Setujui ({approvalRole})
                </ActionButton>
                <ActionButton variant="danger" disabled={isDecidingRevision} onClick={() => void handleRevisionDecision(false)}>
                  <X className="h-3.5 w-3.5" />Tolak ({approvalRole})
                </ActionButton>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-stretch border-t border-border dark:border-white/[0.06]">
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Target Jam</p>
            <p className="font-mono text-[16px] font-semibold leading-none tabular-nums text-foreground">{countdown.targetHoursRevised.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Jam Aktual</p>
            <p className="font-mono text-[16px] font-semibold leading-none tabular-nums text-foreground">{countdown.totalActualHours.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Jam Tersisa</p>
            <p className={`font-mono text-[16px] font-semibold leading-none tabular-nums ${countdown.remainingHours <= 0 ? "text-destructive" : "text-app-accent-ink"}`}>{countdown.remainingHours.toFixed(2)} jam</p>
          </div>
          <div className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Progress</p>
            <p className={`font-mono text-[16px] font-semibold leading-none tabular-nums ${countdown.isOverdue ? "text-app-accent-ink" : "text-success"}`}>{countdown.actualProgressPercent.toFixed(0)}%</p>
          </div>
        </div>

        <div className="border-t border-border px-3 py-2.5 dark:border-white/[0.06]">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Progress pekerjaan</span>
            <span className="font-mono text-muted-foreground">{countdown.actualProgressPercent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-muted" role="progressbar" aria-label="Progress pekerjaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(countdown.actualProgressPercent)}>
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, countdown.actualProgressPercent))}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{countdown.isOverdue ? "Terlambat" : "Sesuai jadwal"}</p>
        </div>
      </header>

      {sweetAlert.alertElement}

      {countdown.extensionRequestStatus || countdown.countRevision > 0 ? (
        <section className="border border-border bg-card px-3 py-2.5 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground"><span className="font-semibold">Revisi:</span> {formatCountdownRevisionStatus(countdown.extensionRequestStatus)}</p>
            <span className="text-xs text-muted-foreground">{countdown.countRevision ?? 0} kali</span>
          </div>
          {countdown.extensionRequestStatus ? (
            <div className="mt-2 grid gap-1 border-t border-border pt-2 text-xs text-muted-foreground md:grid-cols-[auto_auto_1fr] md:gap-4 dark:border-white/[0.06]">
              <p>Tambahan jam: {countdown.requestedExtensionHours ?? 0} jam</p>
              <p>Deadline diminta: {countdown.requestedDeadline ?? "-"}</p>
              <p>Alasan: {countdown.revisionReason ?? "-"}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <main className="min-w-0 space-y-3">
        <SectionCard label="Detail pekerjaan">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <CountdownWorkCard countdown={countdown} />
            <CountdownGallery countdown={countdown} />
          </div>
        </SectionCard>

        <div id="hasil-pekerjaan">
          <SectionCard label="Hasil pekerjaan" count={countdown.details.length}>
            {countdown.details.length > 0 ? (
              <SmsAgGrid<CountdownActualRow>
                heightClassName="h-72"
                rowData={countdown.details.map((entry) => ({ ...entry, divisionName: countdown.divisionName }))}
                columnDefs={actualColumnDefs}
                getRowId={(params) => params.data.detailId}
                emptyMessage="Belum ada hasil pekerjaan."
              />
            ) : <p className="text-sm text-muted-foreground">Belum ada hasil pekerjaan.</p>}
          </SectionCard>
        </div>

        <SectionCard label="Aktivitas terkait">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => void openJobPlanDraft()} className="border border-border px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
              <span className="block text-muted-foreground">Job Plan</span>
              <span className="mt-1 block font-medium">Buat Draft</span>
              <span className="mt-1 inline-flex border border-warning/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">Draft</span>
            </button>
            <button type="button" onClick={() => void openOperationalDraft("wo")} className="border border-border px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
              <span className="block text-muted-foreground">Work Order</span>
              <span className="mt-1 block font-medium">Buat Draft</span>
              <span className="mt-1 inline-flex border border-warning/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">Draft</span>
            </button>
            <button type="button" onClick={() => void openOperationalDraft("pr")} className="border border-border px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
              <span className="block text-muted-foreground">Purchase Request</span>
              <span className="mt-1 block font-medium">Buat Draft</span>
              <span className="mt-1 inline-flex border border-warning/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">Draft</span>
            </button>
            <button type="button" onClick={() => void openOperationalDraft("wov")} className="border border-border px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-primary hover:bg-muted">
              <span className="block text-muted-foreground">Vendor WO</span>
              <span className="mt-1 block font-medium">Buat Draft</span>
              <span className="mt-1 inline-flex border border-warning/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">Draft</span>
            </button>
          </div>
          {jobPlanDraftOpen ? (
            <div className="mt-3 border border-border bg-background">
              <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
                <div>
                  <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-app-accent-ink">Draft Job Plan</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">Pilih divisi untuk membatasi PIC. Data unit, panel, dan countdown tetap mengikuti sumber ini.</p>
                </div>
                <button type="button" onClick={() => setJobPlanDraftOpen(false)} className="h-8 border border-border px-2 text-[12px] text-muted-foreground hover:text-foreground">Tutup</button>
              </div>
              <div className="p-3">
                <SmsAgGrid<JobPlanDraftRow>
                  heightClassName="h-44"
                  rowData={jobPlanDraftRows}
                  columnDefs={jobPlanColumnDefs}
                  getRowId={({ data }) => data.clientId}
                  singleClickEdit
                  onCellValueChanged={updateJobPlanDraft}
                  onCellKeyDown={(event) => { if ("column" in event) void handleJobPlanGridKeyDown(event); }}
                  emptyMessage={isLoadingJobPlanRefs ? "Memuat referensi..." : "Belum ada draft."}
                />
              </div>
              {jobPlanDraftError ? <p className="px-3 pb-2 text-[13px] text-destructive">{jobPlanDraftError}</p> : null}
              <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
                <button type="button" onClick={addJobPlanDraftRow} disabled={isSavingJobPlanDraft} className="h-9 border border-border px-3 text-[12px] text-foreground hover:bg-muted disabled:opacity-50">+ Row</button>
                <button type="button" onClick={() => { setJobPlanDraftRows([]); setJobPlanDraftOpen(false); }} className="h-9 border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">Batal</button>
                <button type="button" disabled={isSavingJobPlanDraft || isLoadingJobPlanRefs || jobPlanDraftRows.length === 0} onClick={() => void saveJobPlanDraft()} className="h-9 border border-primary/30 bg-primary/10 px-3 text-[12px] text-app-accent-ink hover:bg-primary/15 disabled:opacity-50">
                  {isSavingJobPlanDraft ? "Menyimpan..." : "Simpan Draft"}
                </button>
              </div>
            </div>
          ) : null}
          {operationalDraftType ? (
            <div className="mt-3 border border-border bg-background">
              <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
                <div>
                  <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-app-accent-ink">
                    Draft {operationalDraftType === "wo" ? "Work Order" : operationalDraftType === "pr" ? "Purchase Request" : "Vendor WO"}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">Edit langsung di grid. Data unit, panel, dan countdown mengikuti sumber ini.</p>
                </div>
                <button type="button" onClick={() => setOperationalDraftType(null)} className="h-8 border border-border px-2 text-[12px] text-muted-foreground hover:text-foreground">Tutup</button>
              </div>
              <div className="p-3">
                <SmsAgGrid<OperationalDraftRow>
                  heightClassName="h-44"
                  rowData={operationalDraftRows}
                  columnDefs={operationalColumnDefs}
                  getRowId={({ data }) => data.clientId}
                  singleClickEdit
                  onCellValueChanged={updateOperationalDraft}
                  onCellKeyDown={(event) => { if ("column" in event) void handleOperationalGridKeyDown(event); }}
                  emptyMessage={isLoadingJobPlanRefs ? "Memuat referensi..." : "Belum ada draft."}
                />
              </div>
              {operationalDraftError ? <p className="px-3 pb-2 text-[13px] text-destructive">{operationalDraftError}</p> : null}
              <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
                <button type="button" onClick={addOperationalDraftRow} disabled={isSavingOperationalDraft} className="h-9 border border-border px-3 text-[12px] text-foreground hover:bg-muted disabled:opacity-50">+ Row</button>
                <button type="button" onClick={() => { setOperationalDraftRows([]); setOperationalDraftType(null); }} className="h-9 border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">Batal</button>
                <button type="button" disabled={isSavingOperationalDraft || isLoadingJobPlanRefs || operationalDraftRows.length === 0} onClick={() => void saveOperationalDraft()} className="h-9 border border-primary/30 bg-primary/10 px-3 text-[12px] text-app-accent-ink hover:bg-primary/15 disabled:opacity-50">
                  {isSavingOperationalDraft ? "Menyimpan..." : "Simpan Draft"}
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </main>

      <dialog
        ref={revisionDialogRef}
        onClose={() => setRevisionOpen(false)}
        onCancel={() => setRevisionOpen(false)}
        aria-labelledby="countdown-revision-title"
        className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[1px]"
      >
          <div
            className="flex max-h-[calc(100svh-2rem)] w-full flex-col overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p id="countdown-revision-title" className="text-sm font-semibold text-foreground">Ajukan Revisi Countdown</p>
              <ActionButton onClick={() => setRevisionOpen(false)} disabled={isSubmittingRevision}>
                <X className="h-3 w-3" />Tutup
              </ActionButton>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <FieldLabel required>Tambahan Jam</FieldLabel>
                <CompactInput aria-label="Tambahan jam" autoFocus type="number" min="0.01" step="0.01" value={requestedHours} onChange={(event) => setRequestedHours(event.target.value)} />
              </div>
              <div>
                <FieldLabel required>Deadline Baru</FieldLabel>
                <CompactInput aria-label="Deadline baru" type="date" value={requestedDeadline} onChange={(event) => setRequestedDeadline(event.target.value)} />
              </div>
              <div>
                <FieldLabel required>Alasan</FieldLabel>
                <CompactTextarea aria-label="Alasan revisi" rows={4} maxLength={1000} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} />
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
              <ActionButton variant="primary" disabled={isSubmittingRevision} onClick={() => void handleRevisionRequest()}>
                <RotateCcw className="h-3 w-3" />{isSubmittingRevision ? "Mengajukan…" : "Ajukan Revisi"}
              </ActionButton>
            </div>
          </div>
      </dialog>
    </div>
  );
}
