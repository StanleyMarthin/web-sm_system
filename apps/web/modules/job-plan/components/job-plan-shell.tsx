"use client";

/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 */

import type {
  JobPlanDraftRecord,
  JobPlanCreateMode,
  JobPlanGridQuery,
  JobPlanGridReference,
  JobPlanMode,
  JobPlanRecord,
  JobPlanStatus,
  JobPlanWorkspaceSource,
} from "@smsystem/contracts/job-plan";
import type { UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import {
  buildJobPlanScheduleSegments,
  calculateJobPlanFinishTime,
  findExceededJobPlanAllocation,
  formatDurationHHMM,
  parseDurationHHMM,
} from "@smsystem/contracts/job-plan-schedule";
import { isNonTechnicalDivision } from "@smsystem/contracts/division";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import {
  ChevronDown,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  CornerDownLeft,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteJobPlanDrafts,
  saveJobPlanDraft,
  submitJobPlanDrafts,
  updateJobPlanStatus,
} from "@/shared/api/job-plan";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import {
  ActionButton,
  CompactDateInput,
  CompactDateRangeInput,
  CompactInput,
  CompactSelect,
  CompactTextarea,
  FieldLabel,
  MetricBar,
  PageHeader,
} from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { humanizeCodeLabel, fmtTime } from "@/shared/format/humanize";
import { SearchableField } from "@/modules/units/components/shared/SearchableField";
import {
  buildPayload as buildUnitPanelPayload,
  CONDITION_LABEL,
  emptyForm as emptyUnitPanelForm,
  LOCATION_LABEL,
  type PanelFormState,
  STOCK_STATUS_LABEL,
  stockStatusForLocation,
} from "@/modules/units/helpers/unit-panel-form";
import { createUnitPanel, fetchUnitPanels } from "@/shared/api/units";

interface JobPlanShellProps {
  title: string;
  description: string;
  mode: JobPlanMode;
  rows: JobPlanRecord[];
  meta: JobPlanGridMeta;
  state: JobPlanGridQuery;
  references: JobPlanGridReference;
  summary: {
    totalHours: number;
    pendingCount: number;
    approvedCount: number;
    overtimeCount: number;
  };
  exportHref: string;
  allSections?: {
    normal: {
      rows: JobPlanRecord[];
      meta: JobPlanGridMeta;
    };
    overtime: {
      rows: JobPlanRecord[];
      meta: JobPlanGridMeta;
    };
  };
}

interface JobPlanGridMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface JobPlanEditFormState {
  assignedUserId: string;
  taskDate: string;
  targetHours: string;
  startTime: string;
  finishTime: string;
  jobDescription: string;
  note: string;
  isPriority: boolean;
}

export function buildJobPlanEditForm(plan: Pick<
  JobPlanRecord,
  | "assignedUserId"
  | "taskDate"
  | "targetHours"
  | "startTime"
  | "finishTime"
  | "jobDescription"
  | "note"
  | "isPriority"
>): JobPlanEditFormState {
  return {
    assignedUserId: plan.assignedUserId,
    taskDate: plan.taskDate,
    targetHours: formatDurationHHMM(plan.targetHours),
    startTime: plan.startTime ?? "",
    finishTime: plan.finishTime ?? "",
    jobDescription: plan.jobDescription,
    note: plan.note ?? "",
    isPriority: plan.isPriority,
  };
}

interface WorkspaceRowState {
  rowId: string;
  source: JobPlanWorkspaceSource;
  referenceId: string;
  carId: string;
  panelKey: string;
  panelId: string;
  useNewPanel: boolean;
  newPanelForm: PanelFormState;
  jobTypeId: string;
  assignedUserId: string;
  targetHours: string;
  startTime: string;
  finishTime: string;
  jobDescription: string;
  note: string;
  isPriority: boolean;
}

export function resolveAdditionalPanelSelection(input: {
  useNewPanel: boolean;
  newPanelName: string;
  panelId: string;
  panelOptions: Array<{ value: string; panelName: string }>;
}): Pick<JobPlanDraftRecord, "panelId" | "panelName"> {
  if (input.useNewPanel) {
    return { panelId: null, panelName: input.newPanelName.trim() || null };
  }

  return {
    panelId: input.panelId ? Number(input.panelId) : null,
    panelName: input.panelOptions.find((panel) => panel.value === input.panelId)?.panelName ?? null,
  };
}

interface WorkspaceFormState {
  mode: JobPlanCreateMode;
  isNonTechnicalJob: boolean;
  divisionId: string;
  taskDate: string;
  deadlineDate: string;
  projectTargetHours: string;
  isRework: boolean;
  rows: WorkspaceRowState[];
}

type EditorMode = "edit" | null;
type AddJobKind = "normal" | "overtime" | "additional" | null;

interface InlineCreateRowState {
  rowId: string;
  divisionId: string;
  taskDate: string;
  carId: string;
  unitQuery: string;
  panelKey: string;
  panelQuery: string;
  referenceId: string;
  assignedUserId: string;
  picQuery: string;
  targetHours: string;
  startTime: string;
  finishTime: string;
  startTimeTouched: boolean;
  finishTimeTouched: boolean;
  jobDescription: string;
  instructionQuery: string;
  note: string;
  isPriority: boolean;
}

function emptyEditForm(taskDate: string): JobPlanEditFormState {
  return {
    assignedUserId: "",
    taskDate,
    targetHours: "",
    startTime: "",
    finishTime: "",
    jobDescription: "",
    note: "",
    isPriority: false,
  };
}

function makeRowId(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyWorkspaceRow(): WorkspaceRowState {
  return {
    rowId: makeRowId(),
    source: "countdown",
    referenceId: "",
    carId: "",
    panelKey: "",
    panelId: "",
    useNewPanel: false,
    newPanelForm: emptyUnitPanelForm(),
    jobTypeId: "",
    assignedUserId: "",
    targetHours: "",
    startTime: "",
    finishTime: "",
    jobDescription: "",
    note: "",
    isPriority: false,
  };
}

function createEmptyInlineCreateRow(taskDate: string, divisionId: string): InlineCreateRowState {
  return {
    rowId: makeRowId(),
    divisionId,
    taskDate,
    carId: "",
    unitQuery: "",
    panelKey: "",
    panelQuery: "",
    referenceId: "",
    assignedUserId: "",
    picQuery: "",
    targetHours: "01:00",
    startTime: "08:00",
    finishTime: "09:00",
    startTimeTouched: false,
    finishTimeTouched: false,
    jobDescription: "",
    instructionQuery: "",
    note: "",
    isPriority: false,
  };
}

function isPendingStatus(status: JobPlanStatus): boolean {
  return ["PENDING", "PENDING_ADV", "PENDING_KP", "PENDING_MP"].includes(status);
}

function isDraftStatus(status: JobPlanStatus): boolean {
  return status === "DRAFT";
}

function matchesWorkDivision(
  rowDivisionId: number | null | undefined,
  selectedDivisionId: string,
  divisions: JobPlanGridReference["divisions"],
): boolean {
  if (!selectedDivisionId) return true;
  if (String(rowDivisionId ?? "") === selectedDivisionId) return true;

  const selectedDivision = divisions.find((division) => division.value === selectedDivisionId);
  return selectedDivision?.parentId != null && String(rowDivisionId ?? "") === String(selectedDivision.parentId);
}

function getModeLabel(mode: JobPlanMode): string {
  switch (mode) {
    case "overtime":
      return "Lembur";
    case "normal":
      return "Normal";
    default:
      return "Semua";
  }
}

function getTodayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysIso(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${current.getFullYear()}-${month}-${day}`;
}

const weekdayFormatter = new Intl.DateTimeFormat("id-ID", { weekday: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatTaskDateWithDay(value: unknown): { dateLabel: string; dayLabel: string } {
  const rawValue = typeof value === "string" ? value : "";
  const isoDate = rawValue.includes("T") ? rawValue.split("T")[0] : rawValue.slice(0, 10);
  const parsed = new Date(`${isoDate}T00:00:00`);

  if (!isoDate || Number.isNaN(parsed.getTime())) {
    return {
      dateLabel: rawValue || "-",
      dayLabel: "-",
    };
  }

  return {
    dateLabel: shortDateFormatter.format(parsed),
    dayLabel: weekdayFormatter.format(parsed),
  };
}

function differenceInDaysInclusive(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endDate - startDate) / 86_400_000) + 1;
}

function clampWeeklyRange(start: string, end: string): { start: string; end: string } {
  const nextStart = start;
  let nextEnd = end;

  if (nextEnd < nextStart) {
    nextEnd = nextStart;
  }

  const span = differenceInDaysInclusive(nextStart, nextEnd);
  if (span < 2) {
    nextEnd = addDaysIso(nextStart, 1);
  } else if (span > 7) {
    nextEnd = addDaysIso(nextStart, 6);
  }

  return {
    start: nextStart,
    end: nextEnd,
  };
}

function rowHasMeaningfulInput(row: WorkspaceRowState): boolean {
  return Boolean(
    row.referenceId ||
    row.carId ||
    row.panelId ||
    row.jobTypeId ||
    row.assignedUserId ||
    row.targetHours ||
    row.jobDescription.trim() ||
    row.note.trim(),
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal", value: "taskDate" },
  { label: "Unit", value: "unitName" },
  { label: "PIC", value: "assignedUserName" },
  { label: "Target (Jam)", value: "targetHours" },
  { label: "Status Plan", value: "status" },
  { label: "Kapasitas", value: "availablePlanHours" },
  { label: "Progress", value: "progressPercent" },
  { label: "Dibuat", value: "createdAt" },
];

export function JobPlanShell({
  title,
  mode,
  rows,
  meta,
  state,
  references,
  summary,
  exportHref,
  allSections,
}: JobPlanShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sweetAlert = useSweetAlert();
  const [isPending, startTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [activePlan, setActivePlan] = useState<JobPlanRecord | null>(null);
  const [approvalPlan, setApprovalPlan] = useState<JobPlanRecord | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<JobPlanStatus>("PLAN");
  const [approvalNote, setApprovalNote] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [quickCreateMode, setQuickCreateMode] = useState<AddJobKind>(null);
  const [quickCreateSubmitting, setQuickCreateSubmitting] = useState(false);
  const [quickCreateRows, setQuickCreateRows] = useState<InlineCreateRowState[]>([]);
  const [quickCreateEntry, setQuickCreateEntry] = useState<InlineCreateRowState | null>(null);
  const [editingQuickCreateRowId, setEditingQuickCreateRowId] = useState<string | null>(null);
  const [quickCreateDivisionQuery, setQuickCreateDivisionQuery] = useState("");
  const [editForm, setEditForm] = useState<JobPlanEditFormState>(emptyEditForm(state.dateStart));
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);
  const [workspaceUnitPanels, setWorkspaceUnitPanels] = useState<UnitPanelRecord[]>([]);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>({
    mode: "normal",
    isNonTechnicalJob: false,
    divisionId: "",
    taskDate: state.dateStart,
    deadlineDate: state.window === "weekly" ? state.dateEnd : state.dateStart,
    projectTargetHours: "01:00",
    isRework: false,
    rows: [{
      ...createEmptyWorkspaceRow(),
      source: "additional",
      targetHours: "01:00",
    }],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const countdownTransferHandledRef = useRef<string | null>(null);
  const quickCreateDialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (quickCreateMode !== "normal" && quickCreateMode !== "overtime") return;
    const dialog = quickCreateDialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [quickCreateMode]);

  const filters: SmartDataGridFilterDefinition[] = [
    {
      field: "isOvertime",
      label: "Tipe",
      options: [
        { label: "Normal", value: "false" },
        { label: "Lembur", value: "true" },
      ],
    },
  ];
  const divisionFilterValue =
    state.filters.find((filter) => filter.field === "divisionId")?.value ?? "";
  const activeDailyDate = state.dateStart;
  const activeRange = clampWeeklyRange(state.dateStart, state.dateEnd);

  const countdownMap = useMemo(
    () => new Map(references.countdowns.map((item) => [item.value, item])),
    [references.countdowns],
  );
  const quickCreateAllocationError = useMemo(() => {
    const availableHoursByReference = new Map(
      references.countdowns.map((countdown) => [
        countdown.value,
        countdown.availablePlanHours ?? countdown.remainingHours,
      ]),
    );

    return findExceededJobPlanAllocation(
      [
        ...quickCreateRows.filter((row) => row.rowId !== editingQuickCreateRowId),
        ...(quickCreateEntry ? [quickCreateEntry] : []),
      ].flatMap((row) => {
        const targetHours = parseDurationHHMM(row.targetHours);
        return targetHours === null
          ? []
          : [{ referenceId: row.referenceId, targetHours }];
      }),
      availableHoursByReference,
    );
  }, [editingQuickCreateRowId, quickCreateEntry, quickCreateRows, references.countdowns]);
  const quickCreateStagedAllocationError = useMemo(() => {
    const availableHoursByReference = new Map(
      references.countdowns.map((countdown) => [
        countdown.value,
        countdown.availablePlanHours ?? countdown.remainingHours,
      ]),
    );
    return findExceededJobPlanAllocation(
      quickCreateRows.flatMap((row) => {
        const targetHours = parseDurationHHMM(row.targetHours);
        return targetHours === null ? [] : [{ referenceId: row.referenceId, targetHours }];
      }),
      availableHoursByReference,
    );
  }, [quickCreateRows, references.countdowns]);
  const workOrderMap = useMemo(
    () => new Map(references.workOrders.map((item) => [item.value, item])),
    [references.workOrders],
  );
  const jobTypeMap = useMemo(
    () => new Map(references.jobTypes.map((item) => [item.value, item])),
    [references.jobTypes],
  );
  const filteredWorkspaceEmployees = useMemo(
    () =>
      references.employees.filter(
        (employee) =>
          !workspaceForm.divisionId ||
          String(employee.divisionId ?? "") === workspaceForm.divisionId,
      ),
    [references.employees, workspaceForm.divisionId],
  );
  const isWorkspaceNonTechnical = useMemo(
    () => workspaceForm.isNonTechnicalJob || isNonTechnicalDivision(workspaceForm.divisionId, references.divisions),
    [references.divisions, workspaceForm.divisionId, workspaceForm.isNonTechnicalJob],
  );
  const additionalPreview = useMemo(() => {
    const row = workspaceForm.rows[0];
    const targetHours = row ? parseDurationHHMM(row.targetHours) : null;
    if (!row || !targetHours || targetHours <= 0) {
      return [];
    }

    return buildJobPlanScheduleSegments({
      taskDate: workspaceForm.taskDate,
      requestedMode: "normal",
      targetHours,
    });
  }, [workspaceForm.rows, workspaceForm.taskDate]);

  const allVisibleRows = useMemo(() => {
    if (mode === "all" && allSections) {
      return [...allSections.normal.rows, ...allSections.overtime.rows];
    }

    return rows;
  }, [allSections, mode, rows]);

  const selectedRows = useMemo(
    () => allVisibleRows.filter((row) => selectedKeys.has(String(row.planId))),
    [allVisibleRows, selectedKeys],
  );

  const normalRows = (allSections?.normal.rows ?? []).map((row) => ({
    ...row,
    modeLabel: "Normal",
  }));
  const overtimeRows = (allSections?.overtime.rows ?? []).map((row) => ({
    ...row,
    modeLabel: "Lembur",
  }));
  const gridRows = rows.map((row) => ({
    ...row,
    modeLabel: row.isOvertime ? "Lembur" : "Normal",
  }));

  const canBulkApprove =
    selectedRows.length > 0 && selectedRows.every((row) => isPendingStatus(row.status));
  const canBulkDelete =
    selectedRows.length > 0 && selectedRows.every((row) => isDraftStatus(row.status));
  const canBulkSubmitDraft =
    selectedRows.length > 0 && selectedRows.every((row) => isDraftStatus(row.status));

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

  const countdownTransferKey = useMemo(() => {
    const countdownId = searchParams.get("countdownId")?.trim() ?? "";
    if (!countdownId || searchParams.get("autoOpenCreate") !== "1") {
      return "";
    }

    return [
      countdownId,
      searchParams.get("divisionId") ?? "",
      searchParams.get("carId") ?? "",
      state.dateStart,
      mode,
    ].join("|");
  }, [mode, searchParams, state.dateStart]);

  function pushQuery(mutator: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    if (!nextParams.has("mode")) {
      nextParams.set("mode", mode);
    }
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function setDivisionFilter(value: string) {
    pushQuery((params) => {
      const remainingTokens = params
        .getAll("filter")
        .filter((token) => !token.startsWith("divisionId:"));
      params.delete("filter");
      for (const token of remainingTokens) {
        params.append("filter", token);
      }
      if (value) {
        params.append(
          "filter",
          encodeGridFilterToken({
            field: "divisionId",
            operator: "eq",
            value,
          }),
        );
      }
      params.set("page", "1");
    });
  }

  function switchToDaily(date = activeDailyDate || getTodayIsoDate()) {
    pushQuery((params) => {
      params.set("window", "daily");
      params.set("date", date);
      params.set("dateStart", date);
      params.set("dateEnd", date);
      params.set("page", "1");
    });
  }

  function updateDailyDate(date: string) {
    switchToDaily(date);
  }

  function switchToWeekly(start = activeRange.start, end = activeRange.end) {
    const range = clampWeeklyRange(start, end);
    pushQuery((params) => {
      params.set("window", "weekly");
      params.set("date", range.start);
      params.set("dateStart", range.start);
      params.set("dateEnd", range.end);
      params.set("page", "1");
    });
  }

  function applyDateSelection(range: { from: string; to: string }) {
    if (range.from === range.to) {
      switchToDaily(range.from);
      return;
    }

    switchToWeekly(range.from, range.to);
  }

  function buildExportHref(format: "csv" | "xlsx" | "pdf" | "image"): string {
    const separator = exportHref.includes("?") ? "&" : "?";
    return `${exportHref}${separator}format=${format}`;
  }

  function buildInlineDraftRecord(row: InlineCreateRowState): JobPlanDraftRecord | null {
    const selectedCountdown = getQuickCreateSelectedCountdown(row);
    if (!selectedCountdown) {
      return null;
    }

    const targetHours = parseDurationHHMM(row.targetHours);
    if (!targetHours || targetHours <= 0) {
      return null;
    }

    const assignedUserName =
      references.employees.find((employee) => employee.value === row.assignedUserId)?.label ??
      row.assignedUserId;

    return {
      draftItemId: row.rowId,
      sourceType: "COUNTDOWN",
      coreId: row.referenceId,
      carId: selectedCountdown.carId,
      unitName: selectedCountdown.unitName,
      divisionId: selectedCountdown.divisionId ?? null,
      divisionName:
        selectedCountdown.divisionName ??
        references.divisions.find((division) => division.value === row.divisionId)?.label ??
        null,
      panelId: null,
      panelName:
        selectedCountdown.panelName ?? selectedCountdown.panelSectionName ?? row.panelKey,
      jobTypeId: null,
      jobName: selectedCountdown.jobName ?? row.jobDescription.trim(),
      assignedUserId: row.assignedUserId,
      assignedUserName,
      taskDate: row.taskDate,
      targetHours,
      startTime: row.startTime || null,
      finishTime: row.finishTime || null,
      jobDescription: row.jobDescription.trim(),
      note: row.note.trim() ? row.note.trim() : null,
      isOvertime: quickCreateMode === "overtime",
      isPriority: row.isPriority,
      deadlineDate: null,
      isRework: false,
      isNonTechnicalJob: selectedCountdown.isTeknis === false,
    };
  }

  function buildAdditionalDraftRecord(
    createdPanel?: Pick<JobPlanDraftRecord, "panelId" | "panelName">,
  ): JobPlanDraftRecord | null {
    const row = workspaceForm.rows[0];
    if (!row) {
      return null;
    }

    const targetHours = parseDurationHHMM(row.targetHours);
    if (!targetHours || targetHours <= 0) {
      return null;
    }

    const assignedUserName =
      references.employees.find((employee) => employee.value === row.assignedUserId)?.label ??
      row.assignedUserId;
    const panel = createdPanel ?? resolveAdditionalPanelSelection({
      useNewPanel: row.useNewPanel,
      newPanelName: row.newPanelForm.name,
      panelId: row.panelId,
      panelOptions: getAdditionalPanelOptions(row),
    });
    const selectedJobType = references.jobTypes.find((jobType) => jobType.value === row.jobTypeId);
    const jobName = selectedJobType?.label ?? row.jobDescription.trim() ?? null;
    const unitName = references.units.find((unit) => unit.value === row.carId)?.label ?? null;
    const divisionName =
      references.divisions.find((division) => division.value === workspaceForm.divisionId)?.label ??
      null;

    return {
      draftItemId: row.rowId,
      sourceType: "ADDITIONAL",
      coreId: null,
      carId: row.carId || null,
      unitName,
      divisionId: workspaceForm.divisionId ? Number(workspaceForm.divisionId) : null,
      divisionName,
      panelId: isWorkspaceNonTechnical ? null : panel.panelId,
      panelName: isWorkspaceNonTechnical ? null : panel.panelName,
      jobTypeId: row.jobTypeId || null,
      jobName,
      assignedUserId: row.assignedUserId,
      assignedUserName,
      taskDate: workspaceForm.taskDate,
      targetHours,
      startTime: additionalPreview[0]?.startTime ?? null,
      finishTime: additionalPreview[additionalPreview.length - 1]?.finishTime ?? null,
      jobDescription: row.jobDescription.trim(),
      note: row.note.trim() ? row.note.trim() : null,
      isOvertime: false,
      isPriority: row.isPriority,
      deadlineDate: workspaceForm.deadlineDate,
      isRework: workspaceForm.isRework,
      isNonTechnicalJob: workspaceForm.isNonTechnicalJob,
    };
  }

  function buildEditedDraftRecord(plan: JobPlanRecord): JobPlanDraftRecord {
    const parsedTargetHours = parseDurationHHMM(editForm.targetHours);

    return {
      draftItemId: plan.planId,
      sourceType: plan.draftSourceType ?? "COUNTDOWN",
      coreId: plan.draftSourceType === "ADDITIONAL" ? null : plan.coreId,
      carId: plan.draftCarId ?? null,
      unitName: plan.unitName,
      divisionId: plan.divisionId ?? null,
      divisionName: plan.divisionName ?? null,
      panelId: plan.draftPanelId ?? null,
      panelName: plan.panelName ?? null,
      jobTypeId: plan.draftJobTypeId ?? null,
      jobName: plan.jobName ?? null,
      assignedUserId: editForm.assignedUserId,
      assignedUserName:
        references.employees.find((employee) => employee.value === editForm.assignedUserId)?.label ??
        editForm.assignedUserId,
      taskDate: editForm.taskDate,
      targetHours: parsedTargetHours ?? plan.targetHours,
      startTime: editForm.startTime || null,
      finishTime: editForm.finishTime || null,
      jobDescription: editForm.jobDescription.trim(),
      note: editForm.note.trim() ? editForm.note.trim() : null,
      isOvertime: plan.isOvertime,
      isPriority: editForm.isPriority,
      deadlineDate: plan.draftDeadlineDate ?? null,
      isRework: plan.draftIsRework ?? false,
      isNonTechnicalJob: plan.draftIsNonTechnicalJob ?? false,
    };
  }

  function openQuickCreate(nextMode: "normal" | "overtime") {
    setMessage(null);
    setError(null);
    if (!divisionFilterValue) {
      setError("Pilih divisi di header dulu agar pilihan PIC dan jobdesc langsung terfilter.");
      return;
    }

    setAddMenuOpen(false);
    setQuickCreateMode(nextMode);
    setQuickCreateDivisionQuery(
      references.divisions.find((division) => division.value === divisionFilterValue)?.label ?? "",
    );
    setQuickCreateRows([]);
    setQuickCreateEntry(
      applyInlineSchedule(createEmptyInlineCreateRow(state.dateStart, divisionFilterValue), nextMode),
    );
    setEditingQuickCreateRowId(null);
  }

  function closeQuickCreate() {
    setQuickCreateMode(null);
    setQuickCreateSubmitting(false);
    setQuickCreateRows([]);
    setQuickCreateEntry(null);
    setEditingQuickCreateRowId(null);
    setQuickCreateDivisionQuery("");
  }

  function openCreateWorkspace() {
    setMessage(null);
    setError(null);
    if (!divisionFilterValue) {
      setError("Pilih divisi di header dulu agar pilihan PIC dan jobdesc langsung terfilter.");
      return;
    }

    setAddMenuOpen(false);
    setWorkspaceForm({
      mode: "normal",
      isNonTechnicalJob: false,
      divisionId: divisionFilterValue,
      taskDate: state.dateStart,
      deadlineDate: state.window === "weekly" ? state.dateEnd : state.dateStart,
      projectTargetHours: "01:00",
      isRework: false,
      rows: [
        {
          ...createEmptyWorkspaceRow(),
          source: "additional",
          targetHours: "01:00",
        },
      ],
    });
    setWorkspaceOpen(true);
  }

  function closeCreateWorkspace() {
    setWorkspaceOpen(false);
    setWorkspaceSubmitting(false);
  }

  function openEditEditor(plan: JobPlanRecord) {
    setMessage(null);
    setError(null);
    setEditorMode("edit");
    setActivePlan(plan);
    setEditForm(buildJobPlanEditForm(plan));
  }

  function closeEditor() {
    setEditorMode(null);
    setActivePlan(null);
    setEditForm(emptyEditForm(state.dateStart));
  }

  async function submitUpdate() {
    if (!activePlan) return;
    if (!isDraftStatus(activePlan.status)) {
      setError("Hanya draft yang masih disimpan lokal yang bisa diubah.");
      return;
    }

    setError(null);
    setMessage(null);
    const targetHours = parseDurationHHMM(editForm.targetHours);
    if (!targetHours || targetHours <= 0) {
      setError("Total jam harus memakai format HH:MM.");
      return;
    }

    const result = await saveJobPlanDraft({
      replaceItems: false,
      items: [{ ...buildEditedDraftRecord(activePlan), targetHours }],
    });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`Draft ${activePlan.planId} berhasil diperbarui.`);
    closeEditor();
    router.refresh();
  }

  function setWorkspaceField<K extends keyof WorkspaceFormState>(
    key: K,
    value: WorkspaceFormState[K],
  ) {
    setWorkspaceForm((currentValue) => ({
      ...currentValue,
      [key]: value,
    }));
  }

  function updateWorkspaceRow(
    rowId: string,
    updater: (row: WorkspaceRowState) => WorkspaceRowState,
  ) {
    setWorkspaceForm((currentValue) => ({
      ...currentValue,
      rows: currentValue.rows.map((row) => (row.rowId === rowId ? updater(row) : row)),
    }));
  }

  function handleCountdownReferenceChange(rowId: string, referenceId: string) {
    updateWorkspaceRow(rowId, (row) => {
      const countdown = countdownMap.get(referenceId);
      return {
        ...row,
        referenceId,
        carId: countdown?.carId ?? "",
        jobDescription: row.jobDescription || countdown?.jobName || countdown?.panelName || "",
      };
    });
  }

  function handleWorkOrderReferenceChange(rowId: string, referenceId: string) {
    updateWorkspaceRow(rowId, (row) => {
      const workOrder = workOrderMap.get(referenceId);
      return {
        ...row,
        referenceId,
        carId: workOrder?.carId ?? "",
        jobDescription:
          row.jobDescription || workOrder?.panelName || `WO ${workOrder?.unitName ?? ""}`.trim(),
      };
    });
  }

  function handleAdditionalUnitChange(rowId: string, carId: string) {
    setWorkspaceUnitPanels([]);
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      carId,
      panelKey: "",
      panelId: "",
      useNewPanel: false,
      newPanelForm: emptyUnitPanelForm(),
      jobTypeId: "",
    }));
  }

  function handleAdditionalJobTypeChange(rowId: string, jobTypeId: string) {
    updateWorkspaceRow(rowId, (row) => {
      const jobType = jobTypeMap.get(jobTypeId);
      return {
        ...row,
        jobTypeId,
        jobDescription: row.jobDescription || jobType?.jobName || "",
      };
    });
  }

  function handleCountdownUnitChange(rowId: string, carId: string) {
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      carId,
      panelKey: "",
      referenceId: "",
      jobDescription: "",
    }));
  }

  function handleCountdownPanelChange(rowId: string, panelKey: string) {
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      panelKey,
      referenceId: "",
      jobDescription: "",
    }));
  }

  function handleWorkOrderUnitChange(rowId: string, carId: string) {
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      carId,
      panelKey: "",
      referenceId: "",
      jobDescription: "",
    }));
  }

  function handleWorkOrderPanelChange(rowId: string, panelKey: string) {
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      panelKey,
      referenceId: "",
      jobDescription: "",
    }));
  }

  function getCountdownRowsForDivision() {
    return references.countdowns.filter(
      (countdown) =>
        matchesWorkDivision(countdown.divisionId, workspaceForm.divisionId, references.divisions),
    );
  }

  function getCountdownUnitOptions() {
    const unique = new Map<string, { value: string; label: string }>();
    for (const countdown of getCountdownRowsForDivision()) {
      if (!unique.has(countdown.carId)) {
        unique.set(countdown.carId, {
          value: countdown.carId,
          label: countdown.unitName,
        });
      }
    }
    return Array.from(unique.values());
  }

  function getCountdownPanelOptions(row: WorkspaceRowState) {
    const unique = new Map<string, { value: string; label: string }>();
    for (const countdown of getCountdownRowsForDivision()) {
      if (countdown.carId !== row.carId) {
        continue;
      }
      const key = countdown.panelName ?? countdown.panelSectionName ?? "-";
      if (!unique.has(key)) {
        unique.set(key, {
          value: key,
          label: key,
        });
      }
    }
    return Array.from(unique.values());
  }

  function getCountdownJobOptions(row: WorkspaceRowState) {
    return getCountdownRowsForDivision().filter((countdown) => {
      const panelKey = countdown.panelName ?? countdown.panelSectionName ?? "-";
      return countdown.carId === row.carId && panelKey === row.panelKey;
    });
  }

  function getWorkOrdersForDivision() {
    return references.workOrders.filter(
      (workOrder) =>
        matchesWorkDivision(workOrder.divisionId, workspaceForm.divisionId, references.divisions),
    );
  }

  function getWorkOrderUnitOptions() {
    const unique = new Map<string, { value: string; label: string }>();
    for (const workOrder of getWorkOrdersForDivision()) {
      if (!unique.has(workOrder.carId)) {
        unique.set(workOrder.carId, {
          value: workOrder.carId,
          label: workOrder.unitName,
        });
      }
    }
    return Array.from(unique.values());
  }

  function getWorkOrderPanelOptions(row: WorkspaceRowState) {
    const unique = new Map<string, { value: string; label: string }>();
    for (const workOrder of getWorkOrdersForDivision()) {
      if (workOrder.carId !== row.carId) {
        continue;
      }
      const key = workOrder.panelName ?? "-";
      if (!unique.has(key)) {
        unique.set(key, {
          value: key,
          label: key,
        });
      }
    }
    return Array.from(unique.values());
  }

  function getWorkOrderOptions(row: WorkspaceRowState) {
    return getWorkOrdersForDivision().filter(
      (workOrder) =>
        workOrder.carId === row.carId && (workOrder.panelName ?? "-") === row.panelKey,
    );
  }

  function getCountdownRowsByDivision(divisionId: string) {
    return references.countdowns.filter(
      (countdown) => matchesWorkDivision(countdown.divisionId, divisionId, references.divisions),
    );
  }

  function getInlineEmployees(row: InlineCreateRowState) {
    return references.employees.filter(
      (employee) =>
        !row.divisionId || String(employee.divisionId ?? "") === row.divisionId,
    );
  }

  const getInlinePreview = useCallback((
    row: InlineCreateRowState,
    requestedMode: Exclude<AddJobKind, "additional" | null> | null = quickCreateMode === "additional" ? null : quickCreateMode,
  ) => {
    const targetHours = parseDurationHHMM(row.targetHours);
    if (!targetHours || targetHours <= 0 || !requestedMode) {
      return [];
    }

    return buildJobPlanScheduleSegments({
      taskDate: row.taskDate,
      requestedMode,
      targetHours,
    });
  }, [quickCreateMode]);

  const applyInlineSchedule = useCallback((
    row: InlineCreateRowState,
    requestedMode: Exclude<AddJobKind, "additional" | null> | null = quickCreateMode === "additional" ? null : quickCreateMode,
  ): InlineCreateRowState => {
    const preview = getInlinePreview(row, requestedMode);
    if (preview.length === 0) {
      return row;
    }

    return {
      ...row,
      startTime: row.startTimeTouched ? row.startTime : preview[0].startTime,
      finishTime: row.finishTimeTouched
        ? row.finishTime
        : calculateJobPlanFinishTime(
          row.taskDate,
          row.startTimeTouched ? row.startTime : preview[0].startTime,
          parseDurationHHMM(row.targetHours) ?? 0,
        ),
    };
  }, [getInlinePreview, quickCreateMode]);

  useEffect(() => {
    if (!countdownTransferKey || countdownTransferHandledRef.current === countdownTransferKey) {
      return;
    }

    countdownTransferHandledRef.current = countdownTransferKey;
    const countdownId = searchParams.get("countdownId")?.trim() ?? "";
    const selectedCountdown = references.countdowns.find(
      (countdown) => countdown.value === countdownId,
    );

    if (!selectedCountdown) {
      setError("Countdown yang dibuka belum tersedia di pilihan Job Plan. Cek filter divisi atau refresh data.");
      return;
    }

    const divisionId = String(selectedCountdown.divisionId ?? searchParams.get("divisionId") ?? "");
    if (!divisionId) {
      setError("Countdown ini belum memiliki divisi, jadi draft Job Plan belum bisa dibuat.");
      return;
    }

    const transferMode = mode === "overtime" ? "overtime" : "normal";
    const sourceHours =
      selectedCountdown.availablePlanHours ??
      selectedCountdown.remainingHours ??
      0;
    const targetHours = sourceHours > 0 ? sourceHours : 0;
    const row = applyInlineSchedule(
      {
        ...createEmptyInlineCreateRow(state.dateStart, divisionId),
        carId: selectedCountdown.carId,
        unitQuery: selectedCountdown.unitName,
        panelKey: selectedCountdown.panelName ?? selectedCountdown.panelSectionName ?? "-",
        panelQuery: selectedCountdown.panelName ?? selectedCountdown.panelSectionName ?? "-",
        referenceId: selectedCountdown.value,
        targetHours: formatDurationHHMM(targetHours),
        jobDescription: getCountdownInstruction(selectedCountdown),
        instructionQuery:
          selectedCountdown.jobName ?? selectedCountdown.label ?? "",
        note: "",
      },
      transferMode,
    );

    setMessage(null);
    setError(null);
    setAddMenuOpen(false);
    setQuickCreateMode(transferMode);
    setQuickCreateDivisionQuery(
      references.divisions.find((division) => division.value === divisionId)?.label ?? "",
    );
    setQuickCreateRows([]);
    setQuickCreateEntry(row);
    setEditingQuickCreateRowId(null);
  }, [
    applyInlineSchedule,
    countdownTransferKey,
    mode,
    references.countdowns,
    references.divisions,
    searchParams,
    state.dateStart,
  ]);

  function updateQuickCreateEntry(
    updater: (row: InlineCreateRowState) => InlineCreateRowState,
  ) {
    setQuickCreateEntry((currentValue) =>
      currentValue ? applyInlineSchedule(updater(currentValue)) : currentValue,
    );
  }

  function commitQuickCreateEntry() {
    const row = quickCreateEntry;
    if (!row?.divisionId || !row.referenceId || !row.assignedUserId || !row.jobDescription.trim()) {
      setError("Lengkapi Divisi, Unit, PIC, Panel/Part, Job Description, dan Instruksi Kerja.");
      return;
    }
    if (!parseDurationHHMM(row.targetHours)) {
      setError("Target hari ini harus memakai format HH:MM.");
      return;
    }
    if (quickCreateAllocationError) {
      setError(`Target hari ini melebihi sisa target ${formatDurationHHMM(quickCreateAllocationError.availableHours)}.`);
      return;
    }

    setError(null);
    setQuickCreateRows((currentValue) =>
      editingQuickCreateRowId
        ? currentValue.map((item) => item.rowId === editingQuickCreateRowId ? row : item)
        : [...currentValue, row],
    );
    setEditingQuickCreateRowId(null);
    setQuickCreateEntry(applyInlineSchedule(
      createEmptyInlineCreateRow(row.taskDate, row.divisionId),
      quickCreateMode === "overtime" ? "overtime" : "normal",
    ));
    requestAnimationFrame(() => {
      quickCreateDialogRef.current?.querySelectorAll<HTMLInputElement>("input")[1]?.focus();
    });
  }

  function editQuickCreateRow(row: InlineCreateRowState) {
    setEditingQuickCreateRowId(row.rowId);
    setQuickCreateEntry(row);
    quickCreateDialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }

  function deleteQuickCreateRow(rowId: string) {
    setQuickCreateRows((currentValue) => currentValue.filter((row) => row.rowId !== rowId));
    if (editingQuickCreateRowId === rowId) {
      setEditingQuickCreateRowId(null);
      setQuickCreateEntry((currentValue) => currentValue
        ? applyInlineSchedule(
            createEmptyInlineCreateRow(currentValue.taskDate, currentValue.divisionId),
            quickCreateMode === "overtime" ? "overtime" : "normal",
          )
        : currentValue);
    }
  }

  function getQuickCreateUnitOptions(row: InlineCreateRowState) {
    const unique = new Map<string, { value: string; label: string }>();
    for (const countdown of getCountdownRowsByDivision(row.divisionId)) {
      if (!unique.has(countdown.carId)) {
        unique.set(countdown.carId, {
          value: countdown.carId,
          label: countdown.unitName,
        });
      }
    }
    return Array.from(unique.values());
  }

  function getQuickCreatePanelOptions(row: InlineCreateRowState) {
    const unique = new Map<string, { value: string; label: string }>();
    for (const countdown of getCountdownRowsByDivision(row.divisionId)) {
      if (countdown.carId !== row.carId) continue;
      const panel = countdown.panelName ?? countdown.panelSectionName ?? "-";
      unique.set(panel, { value: panel, label: panel });
    }
    return Array.from(unique.values());
  }

  function getQuickCreateJobOptions(row: InlineCreateRowState) {
    return getCountdownRowsByDivision(row.divisionId).filter((countdown) => {
      const panel = countdown.panelName ?? countdown.panelSectionName ?? "-";
      return countdown.carId === row.carId && panel === row.panelKey;
    });
  }

  function getCountdownInstruction(countdown: (typeof references.countdowns)[number]) {
    return [
      countdown.jobName ?? countdown.label,
      countdown.panelName ?? countdown.panelSectionName,
    ].filter(Boolean).join(" · ");
  }

  function getCountdownJobOptionValue(countdown: (typeof references.countdowns)[number]) {
    return countdown.jobName ?? countdown.label;
  }

  function getQuickCreateSelectedCountdown(row: InlineCreateRowState) {
    if (!row.referenceId) {
      return null;
    }

    return getQuickCreateJobOptions(row).find((countdown) => countdown.value === row.referenceId) ?? null;
  }

  async function submitQuickCreate() {
    if (!quickCreateMode || quickCreateMode === "additional") {
      return;
    }

    setError(null);
    setMessage(null);
    setQuickCreateSubmitting(true);

    try {
      const usedRows = quickCreateRows.filter(
        (row) => row.referenceId || row.assignedUserId || row.jobDescription.trim(),
      );
      if (usedRows.length === 0) {
        setError("Isi minimal satu baris job plan lebih dulu.");
        return;
      }

      if (quickCreateStagedAllocationError) {
        setError(
          `Total jam untuk job yang sama ${formatDurationHHMM(quickCreateStagedAllocationError.requestedHours)}, melebihi sisa target ${formatDurationHHMM(quickCreateStagedAllocationError.availableHours)}. Kurangi jam atau hapus baris duplikat.`,
        );
        return;
      }

      const draftItems: JobPlanDraftRecord[] = [];
      for (const row of usedRows) {
        if (!row.divisionId) {
          setError("Pilih divisi di header dulu.");
          return;
        }
        if (!row.referenceId || !row.assignedUserId) {
          setError("Pilih pekerjaan countdown dan PIC di setiap baris yang dipakai.");
          return;
        }
        if (!row.jobDescription.trim()) {
          setError("Instruksi kerja wajib diisi.");
          return;
        }
        const draft = buildInlineDraftRecord(row);
        if (!draft) {
          setError("Lengkapi pekerjaan countdown dan total jam dengan format HH:MM.");
          return;
        }
        draftItems.push(draft);
      }

      const result = await saveJobPlanDraft({
        replaceItems: false,
        items: draftItems,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(`${result.result.createdIds.length} draft job plan berhasil disimpan.`);
      closeQuickCreate();
      router.refresh();
    } finally {
      setQuickCreateSubmitting(false);
    }
  }

  async function submitWorkspace() {
    setError(null);
    setMessage(null);
    setWorkspaceSubmitting(true);

    try {
      if (!workspaceForm.divisionId) {
        setError("Pilih divisi lebih dulu agar PIC dan jobdesc bisa terfilter dengan benar.");
        return;
      }

      const rows = workspaceForm.rows.slice(0, 1).filter(rowHasMeaningfulInput);
      if (rows.length === 0) {
        setError("Lengkapi dulu form tambahan sebelum menyimpan.");
        return;
      }

      for (const row of rows) {
        const targetHours = parseDurationHHMM(row.targetHours);
        if (!row.assignedUserId || !targetHours || !row.jobDescription.trim()) {
          setError("Lengkapi PIC, jam kerja, dan instruksi pada setiap baris yang dipakai.");
          return;
        }

        const rowIsNonTechnical = isWorkspaceNonTechnical;
        if (row.source === "additional" && !rowIsNonTechnical && (!row.carId || (!row.panelId && (!row.newPanelForm.name.trim() || !row.newPanelForm.section.trim() || !row.newPanelForm.category.trim())) || !row.jobTypeId)) {
          setError("Lengkapi unit, panel/part, kategori, section, dan jobdesc tambahan.");
          return;
        }

        if (row.source === "additional" && rowIsNonTechnical && (!row.assignedUserId || !targetHours || !row.jobDescription.trim())) {
          setError("Lengkapi PIC, jam kerja, dan deskripsi aktivitas non-teknis.");
          return;
        }
      }

      const firstRow = rows[0];
      const parsedTargetHours = parseDurationHHMM(firstRow.targetHours);
      if (!parsedTargetHours) {
        setError("Total jam tambahan harus memakai format HH:MM.");
        return;
      }

      let createdPanel: Pick<JobPlanDraftRecord, "panelId" | "panelName"> | undefined;
      if (!isWorkspaceNonTechnical && firstRow.useNewPanel) {
        if (firstRow.newPanelForm.nodeType === "PART" && !firstRow.newPanelForm.parentId) {
          setError("Pilih panel parent untuk part.");
          return;
        }
        const panelPayload = buildUnitPanelPayload(firstRow.newPanelForm, { includeParentId: true });
        const panelResult = await createUnitPanel(firstRow.carId, {
          ...panelPayload,
          parentId: firstRow.newPanelForm.nodeType === "PART"
            ? Number.parseInt(firstRow.newPanelForm.parentId, 10) || null
            : null,
        });
        if (!panelResult.success) {
          setError(panelResult.message);
          return;
        }
        createdPanel = { panelId: panelResult.result.id, panelName: panelResult.result.name };
      }

      const draft = buildAdditionalDraftRecord(createdPanel);
      if (!draft) {
        setError("Form tambahan belum lengkap.");
        return;
      }

      const result = await saveJobPlanDraft({
        replaceItems: false,
        items: [
          {
            ...draft,
            targetHours: parsedTargetHours,
          },
        ],
      });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Draft job tambahan berhasil disimpan.");
      closeCreateWorkspace();
      router.refresh();
    } finally {
      setWorkspaceSubmitting(false);
    }
  }

  async function submitDelete(plan: JobPlanRecord) {
    if (!isDraftStatus(plan.status)) {
      setError("Hanya draft yang masih di keranjang yang bisa dihapus.");
      return;
    }

    const shouldDelete = await sweetAlert.confirm({
      title: "Hapus draft job plan?",
      description: `${plan.assignedUserName} · ${plan.unitName}. Draft ini akan dihapus dari daftar lokal sebelum dikirim ke approval.`,
      tone: "warning",
      confirmLabel: "Hapus Draft",
    });
    if (!shouldDelete) {
      return;
    }

    setError(null);
    setMessage(null);

    const result = await deleteJobPlanDrafts({
      draftItemIds: [plan.planId],
    });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`Draft ${plan.planId} berhasil dihapus.`);
    router.refresh();
  }

  async function submitApproval() {
    if (!approvalPlan) {
      return;
    }

    setError(null);
    setMessage(null);

    const result = await updateJobPlanStatus(approvalPlan.planId, {
      status: approvalStatus,
      note: approvalNote.trim() ? approvalNote.trim() : null,
    });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`Status ${approvalPlan.planId} berhasil bergerak ke ${result.result.status}.`);
    setApprovalPlan(null);
    setApprovalNote("");
    router.refresh();
  }

  async function handleBulkApprove() {
    if (!canBulkApprove) {
      return;
    }

    const shouldApprove = await sweetAlert.confirm({
      title: "Lanjutkan approval job plan?",
      description: `${selectedRows.length} job plan terpilih akan bergerak ke tahap approval berikutnya.`,
      tone: "warning",
      confirmLabel: "Lanjutkan Approval",
    });
    if (!shouldApprove) {
      return;
    }

    setError(null);
    setMessage(null);

    let successCount = 0;
    for (const row of selectedRows) {
      const result = await updateJobPlanStatus(row.planId, {
        status: "PLAN",
        note: null,
      });
      if (result.success) {
        successCount += 1;
      }
    }

    setMessage(`${successCount} dari ${selectedRows.length} job plan berhasil diproses.`);
    setSelectedKeys(new Set());
    router.refresh();
  }

  async function handleBulkSubmitDraft() {
    if (!canBulkSubmitDraft) {
      return;
    }

    const shouldSubmit = await sweetAlert.confirm({
      title: "Kirim draft ke approval?",
      description: `${selectedRows.length} draft akan dikirim ke alur KD -> QA (jika ada) -> KP -> PM/MP.`,
      tone: "warning",
      confirmLabel: "Kirim Draft",
    });
    if (!shouldSubmit) {
      return;
    }

    setError(null);
    setMessage(null);

    const result = await submitJobPlanDrafts({
      draftItemIds: selectedRows.map((row) => row.planId),
    });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`${result.result.createdIds.length} draft berhasil dikirim ke approval.`);
    setSelectedKeys(new Set());
    router.refresh();
  }

  async function handleBulkDelete() {
    if (!canBulkDelete) {
      return;
    }

    const shouldDelete = await sweetAlert.confirm({
      title: "Hapus draft terpilih?",
      description: `${selectedRows.length} draft job plan akan dihapus dari daftar lokal sebelum approval.`,
      tone: "warning",
      confirmLabel: "Hapus Draft",
    });
    if (!shouldDelete) {
      return;
    }

    setError(null);
    setMessage(null);

    const result = await deleteJobPlanDrafts({
      draftItemIds: selectedRows.map((row) => row.planId),
    });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`${selectedRows.length} draft job plan berhasil dihapus.`);
    setSelectedKeys(new Set());
    router.refresh();
  }

  const columns: SmartDataGridColumn[] = [
    {
      key: "unitName",
      label: "Unit",
      sticky: true,
      sortable: true,
      sortKey: "unitName",
      widthClassName: "min-w-[180px]",
    },
    {
      key: "taskDate",
      label: "Tanggal / Hari",
      kind: "mono",
      sortable: true,
      sortKey: "taskDate",
      widthClassName: "min-w-[150px]",
      renderCell: (value) => {
        const dateMeta = formatTaskDateWithDay(value);
        return (
          <div className="space-y-0.5">
            <p className="font-mono text-[11px] text-foreground/80">{dateMeta.dateLabel}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-app-accent-ink/70">
              {dateMeta.dayLabel}
            </p>
          </div>
        );
      },
    },
    {
      key: "divisionName",
      label: "Divisi",
      sortable: true,
      sortKey: "divisionName",
      filterKey: "divisionId",
      filterOptions: references.divisions,
      widthClassName: "min-w-[180px]",
    },
    {
      key: "assignedUserName",
      label: "PIC",
      sortable: true,
      sortKey: "assignedUserName",
      filterKey: "assignedUserId",
      filterOptions: references.employees,
      widthClassName: "min-w-[230px]",
      renderCell: (value, row) => (
        <div className="space-y-1">
          <p className="text-foreground">{String(value ?? "-")}</p>
          <p className="text-[11px] text-foreground/35">{String(row.assignedUserId ?? "-")}</p>
        </div>
      ),
    },
    {
      key: "panelName",
      label: "Panel / Part",
      sortable: true,
      sortKey: "panelName",
      widthClassName: "min-w-[230px]",
    },
    {
      key: "jobName",
      label: "Job Description",
      sortable: true,
      sortKey: "jobName",
      widthClassName: "min-w-[260px]",
      renderCell: (_value, row) => (
        <span className="font-medium text-app-accent-ink/80">
          {String(row.masterJobName ?? row.jobName ?? row.panelName ?? "-")}
        </span>
      ),
    },
    {
      key: "jobDescription",
      label: "Instruksi Kerja",
      widthClassName: "min-w-[320px]",
      renderCell: (_value, row) => String(row.instructionText ?? row.jobDescription ?? "-"),
    },
    {
      key: "targetHours",
      label: "Target Hari Ini",
      align: "right",
      sortable: true,
      sortKey: "targetHours",
      widthClassName: "min-w-[140px]",
      renderCell: (_value, row) => {
        const value =
          row.targetDailyHours === null || row.targetDailyHours === undefined
            ? row.targetHours
            : row.targetDailyHours;
        return Number(value ?? 0).toFixed(1);
      },
    },
    {
      key: "targetTotalHours",
      label: "Target Total",
      align: "right",
      sortable: true,
      sortKey: "availablePlanHours",
      widthClassName: "min-w-[140px]",
      renderCell: (_value, row) => {
        const targetTotalHours =
          row.targetTotalHours === null || row.targetTotalHours === undefined
            ? null
            : Number(row.targetTotalHours);
        return targetTotalHours === null ? "-" : targetTotalHours.toFixed(1);
      },
    },
    {
      key: "progressPercent",
      label: "% Progress",
      kind: "number",
      align: "right",
      sortable: true,
      sortKey: "progressPercent",
    },
    {
      key: "remainingHours",
      label: "Sisa Target",
      align: "right",
      sortable: true,
      sortKey: "remainingHours",
      widthClassName: "min-w-[140px]",
      renderCell: (_value, row) => {
        const availablePlanHours =
          row.availablePlanHours === null || row.availablePlanHours === undefined
            ? null
            : Number(row.availablePlanHours);
        const remainingHours =
          row.remainingHours === null || row.remainingHours === undefined
            ? null
            : Number(row.remainingHours);

        return (
          <div className="space-y-1 text-right">
            <p className="font-medium text-foreground">
              {remainingHours !== null
                ? remainingHours.toFixed(1)
                : "-"}
            </p>
            <p className="text-[10px] text-foreground/35">
              {availablePlanHours !== null
                ? `${availablePlanHours.toFixed(1)} bisa diplan`
                : "-"}
            </p>
          </div>
        );
      },
    },
    {
      key: "planTimeRange",
      label: "Jadwal",
      align: "center",
      widthClassName: "min-w-[140px]",
      renderCell: (_value, row) => {
        const planStart = row.startTime as string | null | undefined;
        const planFinish = row.finishTime as string | null | undefined;
        return (
          <span className="font-mono text-[11px] text-foreground/70">
            {fmtTime(planStart)} — {fmtTime(planFinish)}
          </span>
        );
      },
    },
    {
      key: "actualTimeRange",
      label: "Waktu Aktual",
      widthClassName: "min-w-[160px]",
      renderCell: (_value, row) => {
        const actualStart = row.actualStartTime as string | null | undefined;
        const actualFinish = row.actualFinishTime as string | null | undefined;
        const breakMins = Number(row.actualBreakMinutes ?? 0);

        if (!actualStart && !actualFinish) {
          return <span className="text-[11px] text-foreground/20">Belum ada aktual</span>;
        }

        return (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="font-mono text-foreground/80">
              {fmtTime(actualStart)} — {fmtTime(actualFinish)}
            </span>
            {breakMins > 0 ? (
              <span className="text-foreground/45">
                Istirahat: <span className="font-mono text-app-accent-ink/80">{breakMins}m</span>
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      kind: "status",
      align: "center",
      filterKey: "status",
      filterOptions: references.statuses,
      sortable: true,
      sortKey: "status",
      renderCell: (_value, row) => {
        const actualStatus = row.actualStatus as string | null | undefined;
        const planStatus = row.status as string | null | undefined;
        if (actualStatus === "DONE") {
          return (
            <span className="inline-flex items-center gap-1 border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success">
              Sudah Dikerjakan
            </span>
          );
        }
        // default: render plan status badge
        return (
          <span className="inline-flex items-center gap-1 border border-white/5 bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground/50">
            {humanizeCodeLabel(planStatus)}
          </span>
        );
      },
    },
    {
      key: "note",
      label: "Catatan Tambahan",
      widthClassName: "min-w-[240px]",
    },
    {
      key: "rowActions",
      label: "Aksi",
      align: "center",
      widthClassName: "min-w-[72px]",
      renderCell: (_value, row) =>
        isDraftStatus(row.status as JobPlanStatus) ? (
          <button
            type="button"
            onClick={() => openEditEditor(row as unknown as JobPlanRecord)}
            className="inline-grid h-9 w-9 place-items-center border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-app-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
            aria-label={`Edit job plan ${String(row.planId)}`}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null,
    },
  ];

  function renderGridSection(
    sectionTitle: string,
    sectionDescription: string,
    sectionRows: Array<Record<string, string | number | boolean | null>>,
    sectionMeta: JobPlanGridMeta,
    showControls: boolean,
  ) {
    const viewportClassName =
      mode === "all"
        ? "max-h-[clamp(20rem,38svh,30rem)] [&>table]:min-w-[2600px]"
        : "max-h-[clamp(24rem,58svh,44rem)] [&>table]:min-w-[2600px]";

    return (
      <SmartDataGrid
        title={sectionTitle}
        description=""
        columns={columns}
        rows={sectionRows}
        meta={sectionMeta}
        state={state}
        filters={filters}
        sortOptions={sortOptions}
        savedViews={[]}
        searchPlaceholder="Cari plan ID, unit, PIC, atau instruksi..."
        selectionEnabled={true}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        rowKeyField="planId"
        showControls={showControls}
        viewportClassName={viewportClassName}
      />
    );
  }

  function renderQuickCreateEditor(sectionMode: "normal" | "overtime") {
    if (quickCreateMode !== sectionMode) return null;

    return quickCreateRows.map((row, index) => {
      const selectedCountdown = getQuickCreateSelectedCountdown(row);
      const employeeName =
        getInlineEmployees(row)
          .find((employee) => employee.value === row.assignedUserId)
          ?.label.replace(`${row.assignedUserId} · `, "") ?? "-";
      const targetTotalHours = selectedCountdown?.targetTotalHours ?? null;
      const remainingWorkHours = selectedCountdown?.remainingHours ?? null;
      const hasAllocationError =
        quickCreateStagedAllocationError?.referenceId === row.referenceId;

      return (
        <tr
          key={row.rowId}
          className={[
            "bg-background align-top transition-colors",
            editingQuickCreateRowId === row.rowId
              ? "bg-primary/[0.05]"
              : "hover:bg-muted/40",
          ].join(" ")}
        >
          <td className="sticky left-0 z-10 border-b border-border bg-inherit px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">{index + 1}</td>
          <td className="min-w-[210px] border-b border-border px-3 py-2 font-medium text-foreground">{row.unitQuery || "-"}</td>
          <td className="min-w-[160px] border-b border-border px-3 py-2">
            <span className="block font-mono text-[11px] text-foreground">{row.assignedUserId || "-"}</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">({employeeName})</span>
          </td>
          <td className="min-w-[210px] border-b border-border px-3 py-2 text-foreground/80">{row.panelQuery || "-"}</td>
          <td className="min-w-[210px] border-b border-border px-3 py-2 text-app-accent-ink">{row.instructionQuery || "-"}</td>
          <td className="min-w-[260px] border-b border-border px-3 py-2 text-foreground/75">{row.jobDescription || "-"}</td>
          <td className="border-b border-border px-3 py-2 text-right font-mono text-[11px] text-foreground/60">{targetTotalHours === null ? "-" : formatDurationHHMM(targetTotalHours)}</td>
          <td className={["border-b border-border px-3 py-2 text-right font-mono text-[11px]", hasAllocationError ? "text-destructive" : "text-foreground"].join(" ")}>{row.targetHours}</td>
          <td className="border-b border-border px-3 py-2 text-right font-mono text-[11px] text-foreground/60">{remainingWorkHours === null ? "-" : formatDurationHHMM(remainingWorkHours)}</td>
          <td className="min-w-[150px] border-b border-border px-3 py-2 font-mono text-[11px] text-foreground/75">{fmtTime(row.startTime)} — {fmtTime(row.finishTime)}</td>
          <td className="min-w-[180px] border-b border-border px-3 py-2 text-foreground/65">{row.note || "-"}</td>
          <td className="w-[96px] border-b border-border px-3 py-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => editQuickCreateRow(row)} className="grid h-8 w-8 place-items-center border border-primary/35 text-app-accent-ink hover:bg-primary/10 active:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" aria-label={`Edit baris ${index + 1}`}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => deleteQuickCreateRow(row.rowId)} className="grid h-8 w-8 place-items-center border border-destructive/25 text-destructive hover:bg-destructive/10 active:bg-destructive/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" aria-label={`Hapus baris ${index + 1}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }

  function getAdditionalPanelOptions(row: WorkspaceRowState) {
    return references.panels.filter((panel) => !panel.carId || panel.carId === row.carId);
  }

  function renderUnitCell(row: WorkspaceRowState) {
    if (row.source === "additional") {
      return (
        <CompactSelect
          value={row.carId}
          onChange={(event) => handleAdditionalUnitChange(row.rowId, event.target.value)}
        >
          <option value="">Pilih Unit</option>
          {references.units.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </CompactSelect>
      );
    }

    if (row.source === "countdown") {
      return (
        <CompactSelect
          value={row.carId}
          onChange={(event) => handleCountdownUnitChange(row.rowId, event.target.value)}
        >
          <option value="">Pilih Unit</option>
          {getCountdownUnitOptions().map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </CompactSelect>
      );
    }

    return (
      <CompactSelect
        value={row.carId}
        onChange={(event) => handleWorkOrderUnitChange(row.rowId, event.target.value)}
      >
        <option value="">Pilih Unit</option>
        {getWorkOrderUnitOptions().map((unit) => (
          <option key={unit.value} value={unit.value}>
            {unit.label}
          </option>
        ))}
      </CompactSelect>
    );
  }

  function renderPanelCell(row: WorkspaceRowState) {
    if (isWorkspaceNonTechnical) {
      return (
        <div className="flex h-[38px] items-center rounded-md border border-white/5 bg-card px-3 text-[12px] text-foreground/35">
          Tanpa Panel / Part
        </div>
      );
    }

    if (row.source === "additional") {
      const panelOptions = getAdditionalPanelOptions(row);
      const unitPanelRows = workspaceUnitPanels.flatMap((panel) => [panel, ...panel.children]);
      const categoryOptions = Array.from(new Set(unitPanelRows.map((panel) => panel.category).filter(Boolean)))
        .map((category) => ({ value: category! }));
      const sectionOptions = Array.from(new Set(unitPanelRows
        .filter((panel) => !row.newPanelForm.category || panel.category === row.newPanelForm.category)
        .map((panel) => panel.section)))
        .map((section) => ({ value: section }));
      const parentOptions = workspaceUnitPanels
        .filter((panel) => panel.nodeType === "PANEL" && (!row.newPanelForm.section || panel.section === row.newPanelForm.section))
        .map((panel) => ({ value: String(panel.id), label: panel.name }));
      const updateNewPanelForm = (updater: (form: PanelFormState) => PanelFormState) =>
        updateWorkspaceRow(row.rowId, (currentValue) => ({
          ...currentValue,
          newPanelForm: updater(currentValue.newPanelForm),
        }));
      return (
        <div className="space-y-2">
          {row.useNewPanel ? (
            <div className="space-y-3 border border-border bg-background p-3">
              <div className="grid grid-cols-2 gap-1 border border-border bg-card p-1">
                {(["PANEL", "PART"] as const).map((nodeType) => (
                  <button key={nodeType} type="button" onClick={() => updateNewPanelForm((form) => ({ ...form, nodeType, nodeTypeName: nodeType === "PART" ? "Part" : "Panel", parentId: nodeType === "PART" ? form.parentId : "", parentName: nodeType === "PART" ? form.parentName : "" }))} className={`h-8 font-mono text-[12px] uppercase tracking-[0.08em] ${row.newPanelForm.nodeType === nodeType ? "bg-primary/10 text-app-accent-ink" : "text-muted-foreground hover:text-foreground"}`}>
                    {nodeType === "PART" ? "Part" : "Panel"}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><FieldLabel required>Kategori</FieldLabel><SearchableField value={row.newPanelForm.category} options={categoryOptions} onChange={(category) => updateNewPanelForm((form) => ({ ...form, category, section: "", parentId: "", parentName: "" }))} placeholder="Pilih / ketik kategori" heightClassName="h-9" menuZClassName="z-[70]" /></div>
                <div><FieldLabel required>Section</FieldLabel><SearchableField value={row.newPanelForm.section} options={sectionOptions} onChange={(section) => updateNewPanelForm((form) => ({ ...form, section, parentId: "", parentName: "" }))} placeholder="Pilih / ketik section" heightClassName="h-9" menuZClassName="z-[70]" /></div>
                {row.newPanelForm.nodeType === "PART" ? <div><FieldLabel required>Panel Parent</FieldLabel><CompactSelect value={row.newPanelForm.parentId} onChange={(event) => updateNewPanelForm((form) => ({ ...form, parentId: event.target.value }))}><option value="">Pilih panel parent</option>{parentOptions.map((panel) => <option key={panel.value} value={panel.value}>{panel.label}</option>)}</CompactSelect></div> : null}
                <div><FieldLabel required>Nama {row.newPanelForm.nodeType === "PART" ? "Part" : "Panel"}</FieldLabel><CompactInput value={row.newPanelForm.name} maxLength={100} onChange={(event) => updateNewPanelForm((form) => ({ ...form, name: event.target.value }))} /></div>
                <div><FieldLabel>Qty</FieldLabel><CompactInput type="number" min="0.01" step="0.01" value={row.newPanelForm.qty} onChange={(event) => updateNewPanelForm((form) => ({ ...form, qty: event.target.value }))} /></div>
                <div><FieldLabel>Lokasi</FieldLabel><CompactSelect value={row.newPanelForm.defaultLocationType} onChange={(event) => { const defaultLocationType = event.target.value as PanelFormState["defaultLocationType"]; updateNewPanelForm((form) => ({ ...form, defaultLocationType, defaultStockStatus: stockStatusForLocation(defaultLocationType) })); }}>{Object.entries(LOCATION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</CompactSelect></div>
                <div><FieldLabel>Posisi</FieldLabel><CompactSelect value={row.newPanelForm.defaultStockStatus} disabled={row.newPanelForm.defaultLocationType === "UNIT"} onChange={(event) => updateNewPanelForm((form) => ({ ...form, defaultStockStatus: event.target.value as PanelFormState["defaultStockStatus"] }))}>{Object.entries(STOCK_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</CompactSelect></div>
                <div><FieldLabel>Kondisi</FieldLabel><CompactSelect value={row.newPanelForm.defaultConditionType} onChange={(event) => updateNewPanelForm((form) => ({ ...form, defaultConditionType: event.target.value as PanelFormState["defaultConditionType"] }))}>{Object.entries(CONDITION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</CompactSelect></div>
              </div>
            </div>
          ) : (
            <CompactSelect
              value={row.panelId}
              onChange={(event) =>
                updateWorkspaceRow(row.rowId, (currentValue) => ({
                  ...currentValue,
                  panelKey: event.target.value,
                  panelId: event.target.value,
                }))}
              disabled={!row.carId}
            >
              <option value="">Pilih Panel / Part</option>
              {panelOptions.map((panel) => (
                <option key={panel.value} value={panel.value}>
                  {panel.panelName}
                </option>
              ))}
            </CompactSelect>
          )}
          <label className="flex min-h-9 cursor-pointer items-center gap-2 border border-border bg-background px-3 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={row.useNewPanel}
              onChange={(event) => {
                const checked = event.target.checked;
                updateWorkspaceRow(row.rowId, (currentValue) => ({ ...currentValue, useNewPanel: checked, panelId: "", panelKey: "", newPanelForm: checked ? currentValue.newPanelForm : emptyUnitPanelForm() }));
                if (checked && row.carId) void fetchUnitPanels("", row.carId).then((result) => setWorkspaceUnitPanels(result.payload?.data.tree ?? []));
              }}
              className="h-4 w-4 accent-primary"
            />
            Panel baru / belum ada
          </label>
        </div>
      );
    }

    if (row.source === "countdown") {
      return (
        <CompactSelect
          value={row.panelKey}
          onChange={(event) => handleCountdownPanelChange(row.rowId, event.target.value)}
          disabled={!row.carId}
        >
          <option value="">Pilih Panel / Part</option>
          {getCountdownPanelOptions(row).map((panel) => (
            <option key={panel.value} value={panel.value}>
              {panel.label}
            </option>
          ))}
        </CompactSelect>
      );
    }

    return (
      <CompactSelect
        value={row.panelKey}
        onChange={(event) => handleWorkOrderPanelChange(row.rowId, event.target.value)}
        disabled={!row.carId}
      >
        <option value="">Pilih Panel / Part</option>
        {getWorkOrderPanelOptions(row).map((panel) => (
          <option key={panel.value} value={panel.value}>
            {panel.label}
          </option>
        ))}
      </CompactSelect>
    );
  }

  function renderJobCell(row: WorkspaceRowState) {
    if (isWorkspaceNonTechnical) {
      return (
        <CompactInput
          type="text"
          value={row.jobDescription}
          placeholder="Activity / Jobdesc"
          onChange={(event) =>
            updateWorkspaceRow(row.rowId, (currentValue) => ({
              ...currentValue,
              jobDescription: event.target.value,
            }))}
        />
      );
    }

    if (row.source === "additional") {
      return (
        <CompactSelect
          value={row.jobTypeId}
          onChange={(event) => handleAdditionalJobTypeChange(row.rowId, event.target.value)}
        >
          <option value="">Pilih Jobdesc</option>
          {references.jobTypes
            .filter(
              (jobType) =>
                !workspaceForm.divisionId ||
                jobType.divisionId === null ||
                matchesWorkDivision(jobType.divisionId, workspaceForm.divisionId, references.divisions),
            )
            .map((jobType) => (
              <option key={jobType.value} value={jobType.value}>
                {jobType.label}
              </option>
            ))}
        </CompactSelect>
      );
    }

    if (row.source === "countdown") {
      return (
        <CompactSelect
          value={row.referenceId}
          onChange={(event) => handleCountdownReferenceChange(row.rowId, event.target.value)}
          disabled={!row.panelKey}
        >
          <option value="">Pilih Jobdesc</option>
          {getCountdownJobOptions(row).map((countdown) => (
            <option key={countdown.value} value={countdown.value}>
              {countdown.jobName ?? countdown.label}
            </option>
          ))}
        </CompactSelect>
      );
    }

    return (
      <CompactSelect
        value={row.referenceId}
        onChange={(event) => handleWorkOrderReferenceChange(row.rowId, event.target.value)}
        disabled={!row.panelKey}
      >
        <option value="">Pilih WO</option>
        {getWorkOrderOptions(row).map((workOrder) => (
          <option key={workOrder.value} value={workOrder.value}>
            {workOrder.label}
          </option>
        ))}
      </CompactSelect>
    );
  }

  const unifiedRows = mode === "all" && allSections
    ? [...normalRows, ...overtimeRows]
    : gridRows;

  const unifiedMeta = mode === "all" && allSections
    ? allSections.normal.meta
    : meta;
  const quickEntryCountdown = quickCreateEntry ? getQuickCreateSelectedCountdown(quickCreateEntry) : null;
  const quickEntryUnits = quickCreateEntry ? getQuickCreateUnitOptions(quickCreateEntry) : [];
  const quickEntryEmployees = quickCreateEntry ? getInlineEmployees(quickCreateEntry) : [];
  const quickEntryPanels = quickCreateEntry ? getQuickCreatePanelOptions(quickCreateEntry) : [];
  const quickEntryJobs = quickCreateEntry ? getQuickCreateJobOptions(quickCreateEntry) : [];

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Job Plan"
        title={title}
        actions={
          <>
            <div className="flex border-b border-white/5">
              <button
                type="button"
                onClick={() => switchToDaily(activeDailyDate || getTodayIsoDate())}
                className={[
                  "px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] border-b-2 transition-colors",
                  state.window === "daily"
                    ? "border-primary text-app-accent-ink"
                    : "border-transparent text-foreground/40 hover:text-foreground/70",
                ].join(" ")}
              >
                Harian
              </button>
              <button
                type="button"
                onClick={() => switchToWeekly(activeRange.start, activeRange.end)}
                className={[
                  "px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] border-b-2 transition-colors",
                  state.window === "weekly"
                    ? "border-primary text-app-accent-ink"
                    : "border-transparent text-foreground/40 hover:text-foreground/70",
                ].join(" ")}
              >
                Mingguan
              </button>
            </div>

            {state.window === "daily" ? (
              <CompactDateInput
                value={activeDailyDate}
                onChange={updateDailyDate}
                className="w-64"
              />
            ) : (
              <CompactDateRangeInput
                from={activeRange.start}
                to={activeRange.end}
                onChange={applyDateSelection}
                selectionBehavior="single-or-range"
                className="w-64"
              />
            )}

            <CompactSelect
              value={mode}
              onChange={(event) => {
                const nextMode = event.target.value as JobPlanMode;
                pushQuery((params) => {
                  params.set("mode", nextMode);
                  params.set("page", "1");
                });
              }}
            >
              <option value="all">Semua</option>
              <option value="normal">Normal</option>
              <option value="overtime">Lembur</option>
            </CompactSelect>

            <CompactSelect
              value={divisionFilterValue}
              onChange={(event) => setDivisionFilter(event.target.value)}
            >
              <option value="">Semua Divisi</option>
              {references.divisions.map((division) => (
                <option key={division.value} value={division.value}>
                  {division.label}
                </option>
              ))}
            </CompactSelect>

            <div className="relative">
              <ActionButton variant="primary" onClick={() => setAddMenuOpen((currentValue) => !currentValue)}>
                <Plus className="h-3 w-3" />
                Tambah Job
                <ChevronDown className="h-3 w-3" />
              </ActionButton>
              {addMenuOpen ? (
                <div className="absolute right-0 top-10 z-40 min-w-40 border border-white/10 bg-background py-1">
                  <button
                    type="button"
                    onClick={() => openQuickCreate("normal")}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 text-app-accent-ink" />
                    Job Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickCreate("overtime")}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 text-destructive" />
                    Job Lembur
                  </button>
                  <button
                    type="button"
                    onClick={openCreateWorkspace}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 text-app-accent-ink" />
                    Job Tambahan
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((currentValue) => !currentValue)}
                className="inline-flex items-center gap-1 border border-white/5 bg-card px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-foreground/60 hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportOpen ? (
                <div className="absolute right-0 top-9 z-40 min-w-36 border border-white/10 bg-background py-1">
                  <a
                    href={buildExportHref("csv")}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5 text-app-accent-ink" />
                    CSV
                  </a>
                  <a
                    href={buildExportHref("xlsx")}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-foreground/45" />
                    Excel
                  </a>
                  <a
                    href={buildExportHref("pdf")}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5 text-destructive" />
                    PDF
                  </a>
                  <a
                    href={buildExportHref("image")}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-foreground/70 transition-colors hover:bg-white/[0.02] hover:text-foreground"
                  >
                    <FileImage className="h-3.5 w-3.5 text-foreground/45" />
                    Gambar
                  </a>
                </div>
              ) : null}
            </div>

            <ActionButton onClick={() => router.refresh()}>Refresh</ActionButton>
          </>
        }
      />

      <MetricBar items={[
        { label: "Total Jam", value: `${summary.totalHours.toFixed(1)}j` },
        { label: "Pending", value: summary.pendingCount, tone: summary.pendingCount > 0 ? "warn" : undefined },
        { label: "Plan", value: summary.approvedCount, tone: summary.approvedCount > 0 ? "up" : undefined },
        { label: "Lembur", value: summary.overtimeCount, tone: summary.overtimeCount > 0 ? "warn" : undefined },
      ]} />

      {sweetAlert.alertElement}

      {selectedKeys.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-white/5 bg-card px-3 py-2">
          <p className="text-[11px] text-foreground/55">{selectedKeys.size} job plan dipilih</p>
          <div className="flex flex-wrap items-center gap-2">
            {selectedKeys.size === 1 && selectedRows[0] && isDraftStatus(selectedRows[0].status) ? (
              <ActionButton onClick={() => openEditEditor(selectedRows[0])}>Edit</ActionButton>
            ) : null}
            {selectedKeys.size === 1 && selectedRows[0] && isPendingStatus(selectedRows[0].status) ? (
              <ActionButton
                variant="danger"
                onClick={() => {
                  setApprovalPlan(selectedRows[0]);
                  setApprovalStatus("REJECTED");
                  setApprovalNote("");
                }}
              >
                Reject
              </ActionButton>
            ) : null}
            {canBulkSubmitDraft ? (
              <ActionButton variant="primary" onClick={() => { void handleBulkSubmitDraft(); }}>
                Kirim Draft
              </ActionButton>
            ) : null}
            {canBulkApprove ? (
              <ActionButton variant="success" onClick={() => { void handleBulkApprove(); }}>
                Approve
              </ActionButton>
            ) : null}
            {canBulkDelete ? (
              <ActionButton variant="danger" onClick={() => { void handleBulkDelete(); }}>
                Hapus
              </ActionButton>
            ) : null}
            <ActionButton onClick={() => setSelectedKeys(new Set())}>Kosongkan</ActionButton>
          </div>
        </div>
      ) : null}

      {renderGridSection(
        getModeLabel(mode),
        "",
        unifiedRows,
        unifiedMeta,
        true,
      )}

      {quickCreateMode === "normal" || quickCreateMode === "overtime" ? (
        <dialog
          ref={quickCreateDialogRef}
          aria-labelledby="quick-create-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!quickCreateSubmitting) closeQuickCreate();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !quickCreateSubmitting) closeQuickCreate();
          }}
          className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-black/70 p-2 open:flex backdrop:bg-black/70 sm:p-4"
        >
          <div className="flex max-h-[calc(100svh-1rem)] w-full max-w-none flex-col overflow-hidden border border-border bg-card shadow-2xl shadow-black/20 sm:max-h-[calc(100svh-2rem)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h3 id="quick-create-title" className="truncate text-base font-semibold text-foreground">
                  Tambah job {quickCreateMode === "overtime" ? "lembur" : "normal"}
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Isi form, tekan Enter untuk staging · Shift+Enter untuk baris baru pada catatan
                </p>
              </div>
              <button type="button" onClick={closeQuickCreate} className="grid h-11 w-11 shrink-0 place-items-center border border-border text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Tutup spreadsheet job plan">
                <X className="h-4 w-4" />
              </button>
            </div>
            {quickCreateEntry ? (
              <form className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-5" onSubmit={(event) => { event.preventDefault(); commitQuickCreateEntry(); }}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:gap-0">
                  <div className="space-y-2 xl:pr-6">
                    <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Referensi Pekerjaan</p>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Divisi</FieldLabel><SearchableField value={quickCreateDivisionQuery} options={references.divisions.map((division) => ({ value: division.label, dedupeKey: division.value }))} placeholder="Pilih divisi..." heightClassName="h-9" menuZClassName="z-[70]" onChange={(query) => { const selected = references.divisions.find((division) => division.label.toLowerCase() === query.toLowerCase()); setQuickCreateDivisionQuery(query); updateQuickCreateEntry((row) => ({ ...row, divisionId: selected?.value ?? "", assignedUserId: "", picQuery: "", carId: "", unitQuery: "", panelKey: "", panelQuery: "", referenceId: "", jobDescription: "", instructionQuery: "" })); }} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Unit</FieldLabel><SearchableField value={quickCreateEntry.unitQuery} options={quickEntryUnits.map((unit) => ({ value: unit.label, dedupeKey: unit.value }))} disabled={!quickCreateEntry.divisionId} placeholder="Pilih unit..." heightClassName="h-9" menuZClassName="z-[70]" onChange={(query) => { const selected = quickEntryUnits.find((unit) => unit.label.toLowerCase() === query.toLowerCase()); updateQuickCreateEntry((row) => ({ ...row, unitQuery: query, carId: selected?.value ?? "", panelKey: "", panelQuery: "", referenceId: "", jobDescription: "", instructionQuery: "" })); }} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>PIC</FieldLabel><SearchableField value={quickCreateEntry.picQuery} options={quickEntryEmployees.map((employee) => ({ value: employee.value, label: employee.label.replace(`${employee.value} · `, "") }))} disabled={!quickCreateEntry.divisionId} placeholder="Pilih PIC..." heightClassName="h-9" menuZClassName="z-[70]" onChange={(query) => { const selected = quickEntryEmployees.find((employee) => employee.value.toLowerCase() === query.toLowerCase()); updateQuickCreateEntry((row) => ({ ...row, picQuery: selected?.value ?? query, assignedUserId: selected?.value ?? "" })); }} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Panel / Part</FieldLabel><SearchableField value={quickCreateEntry.panelQuery} options={quickEntryPanels} disabled={!quickCreateEntry.carId} placeholder="Pilih panel / part..." heightClassName="h-9" menuZClassName="z-[70]" onChange={(query) => { const selected = quickEntryPanels.find((panel) => panel.label.toLowerCase() === query.toLowerCase()); updateQuickCreateEntry((row) => ({ ...row, panelQuery: query, panelKey: selected?.value ?? "", referenceId: "", jobDescription: "", instructionQuery: "" })); }} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Job Description</FieldLabel><SearchableField value={quickCreateEntry.instructionQuery} options={quickEntryJobs.map((countdown) => ({ value: getCountdownJobOptionValue(countdown), label: countdown.panelName ?? countdown.panelSectionName ?? "Panel / Part", dedupeKey: countdown.value }))} disabled={!quickCreateEntry.panelKey} placeholder="Pilih job description..." heightClassName="h-9" menuZClassName="z-[70]" onChange={(query) => updateQuickCreateEntry((row) => ({ ...row, instructionQuery: query, referenceId: "", jobDescription: "" }))} onSelect={(option) => { const selected = quickEntryJobs.find((countdown) => countdown.value === option.dedupeKey); if (selected) updateQuickCreateEntry((row) => ({ ...row, instructionQuery: selected.jobName ?? selected.label, referenceId: selected.value, jobDescription: getCountdownInstruction(selected) })); }} /></div>
                    <div className="grid items-start gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Instruksi Kerja</FieldLabel><CompactTextarea rows={2} value={quickCreateEntry.jobDescription} placeholder="Masukkan instruksi kerja..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commitQuickCreateEntry(); } }} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, jobDescription: event.target.value }))} /></div>
                  </div>
                  <div className="space-y-2 xl:border-l xl:border-border xl:pl-6">
                    <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Target &amp; Jadwal</p>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Tanggal</FieldLabel><CompactInput type="date" value={quickCreateEntry.taskDate} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, taskDate: event.target.value, finishTimeTouched: false }))} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel>Target Awal</FieldLabel><CompactInput value={quickEntryCountdown?.targetTotalHours == null ? "-" : formatDurationHHMM(quickEntryCountdown.targetTotalHours)} disabled /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel required>Target Hari Ini</FieldLabel><CompactInput value={quickCreateEntry.targetHours} placeholder="HH:MM" aria-invalid={quickCreateAllocationError?.referenceId === quickCreateEntry.referenceId || undefined} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, targetHours: event.target.value, finishTimeTouched: false }))} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel>Sisa Target</FieldLabel><CompactInput value={quickEntryCountdown?.remainingHours == null ? "-" : formatDurationHHMM(quickEntryCountdown.remainingHours)} disabled /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel>Jadwal Mulai</FieldLabel><CompactInput type="time" value={quickCreateEntry.startTime} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, startTime: event.target.value, startTimeTouched: true, finishTimeTouched: false }))} /></div>
                    <div className="grid items-center gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel>Jadwal Selesai</FieldLabel><CompactInput type="time" value={quickCreateEntry.finishTime} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, finishTime: event.target.value, finishTimeTouched: true }))} /></div>
                    <div className="grid items-start gap-2 md:grid-cols-[105px_minmax(0,1fr)]"><FieldLabel>Catatan</FieldLabel><CompactTextarea rows={2} value={quickCreateEntry.note} placeholder="Masukkan catatan..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commitQuickCreateEntry(); } }} onChange={(event) => updateQuickCreateEntry((row) => ({ ...row, note: event.target.value }))} /></div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <p className="text-[10px] text-muted-foreground">Enter untuk memasukkan · Shift+Enter untuk newline</p>
                  <ActionButton variant="primary" type="submit"><CornerDownLeft className="h-3.5 w-3.5" /> {editingQuickCreateRowId ? "Perbarui Row" : "Masukkan ke Row"}</ActionButton>
                </div>
              </form>
            ) : null}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2 sm:px-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Staging Job Plan</p>
              <span className="font-mono text-[10px] text-app-accent-ink">{quickCreateRows.length} row</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
              <table className="w-full min-w-[1840px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-30 bg-card">
                  <tr>
                    <th className="w-10 border-b border-border px-3 py-2 text-center font-mono text-[10px] uppercase text-muted-foreground" scope="col">No.</th>
                    {[["Unit", "w-[210px]"], ["PIC", "w-[160px]"], ["Panel / Part", "w-[210px]"], ["Job Description", "w-[210px]"], ["Instruksi Kerja", "w-[260px]"], ["Target Awal", "w-[100px]"], ["Target Hari Ini", "w-[115px]"], ["Sisa Target", "w-[100px]"], ["Jadwal", "w-[150px]"], ["Catatan", "w-[180px]"], ["Aksi", "w-[96px]"]].map(([label, width]) => (
                      <th key={label} scope="col" className={`${width} whitespace-normal border-b border-border px-3 py-2 text-[10px] font-mono uppercase leading-4 tracking-[0.1em] text-muted-foreground`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{renderQuickCreateEditor(quickCreateMode)}</tbody>
              </table>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 sm:px-5 [&_button]:whitespace-nowrap">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{quickCreateRows.length} row siap disimpan</p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ActionButton onClick={closeQuickCreate}>Batal</ActionButton>
                <ActionButton variant="primary" disabled={quickCreateSubmitting || quickCreateRows.length === 0} onClick={() => { void submitQuickCreate(); }}>
                  <Save className="h-3 w-3" /> {quickCreateSubmitting ? "Menyimpan..." : "Simpan Job Plan"}
                </ActionButton>
              </div>
            </div>
          </div>
        </dialog>
      ) : null}

      {workspaceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[calc(100svh-2rem)] w-full max-w-5xl overflow-y-auto border border-border bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {isWorkspaceNonTechnical ? "Job Non Teknis" : "Isi Job Plan"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground">
                  {isWorkspaceNonTechnical ? "Pekerjaan Non Teknis" : "Pekerjaan Tambahan"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateWorkspace}
                className="grid h-11 w-11 place-items-center border border-border text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Tutup form pekerjaan tambahan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Target & Jadwal</p>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <FieldLabel required>Tanggal</FieldLabel>
                  <CompactInput
                    type="date"
                    value={workspaceForm.taskDate}
                    onChange={(event) => setWorkspaceField("taskDate", event.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Deadline</FieldLabel>
                  <CompactInput
                    type="date"
                    value={workspaceForm.deadlineDate}
                    onChange={(event) => setWorkspaceField("deadlineDate", event.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Pengulangan</FieldLabel>
                  <CompactSelect
                    value={workspaceForm.isRework ? "yes" : "no"}
                    onChange={(event) => setWorkspaceField("isRework", event.target.value === "yes")}
                  >
                    <option value="no">Tidak</option>
                    <option value="yes">Ya</option>
                  </CompactSelect>
                </div>
                <div>
                  <FieldLabel>Jenis Pekerjaan</FieldLabel>
                  <label className="flex h-[38px] items-center gap-2 border border-border bg-background px-3 text-[12px] text-foreground">
                    <input type="checkbox" checked={workspaceForm.isNonTechnicalJob} onChange={(event) => setWorkspaceField("isNonTechnicalJob", event.target.checked)} className="h-4 w-4 accent-primary" />
                    Non Teknis
                  </label>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground md:col-span-2">Referensi Pekerjaan</p>
                <div>
                  <FieldLabel required={!isWorkspaceNonTechnical}>
                    {isWorkspaceNonTechnical ? "Unit Scope" : "Unit"}
                  </FieldLabel>
                  {renderUnitCell(workspaceForm.rows[0]!)}
                </div>
                <div>
                  <FieldLabel required={!isWorkspaceNonTechnical}>
                    {isWorkspaceNonTechnical ? "Tanpa Panel / Part" : "Panel / Part"}
                  </FieldLabel>
                  {renderPanelCell(workspaceForm.rows[0]!)}
                </div>
                <div>
                  <FieldLabel required>
                    {isWorkspaceNonTechnical ? "Activity / Jobdesc" : "Pekerjaan"}
                  </FieldLabel>
                  {renderJobCell(workspaceForm.rows[0]!)}
                </div>
                <div>
                  <FieldLabel required>PIC</FieldLabel>
                  <CompactSelect
                    value={workspaceForm.rows[0]?.assignedUserId ?? ""}
                    onChange={(event) =>
                      updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                        ...currentValue,
                        assignedUserId: event.target.value,
                      }))}
                  >
                    <option value="">Pilih PIC</option>
                    {filteredWorkspaceEmployees.map((employee) => (
                      <option key={employee.value} value={employee.value}>
                        {employee.label}
                      </option>
                    ))}
                  </CompactSelect>
                </div>
                <div>
                  <FieldLabel required>{isWorkspaceNonTechnical ? "Jam Kerja" : "Target Awal"}</FieldLabel>
                  <CompactInput
                    type="text"
                    value={workspaceForm.rows[0]?.targetHours ?? ""}
                    placeholder="Contoh 08:00"
                    onChange={(event) =>
                      updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                        ...currentValue,
                        targetHours: event.target.value,
                      }))}
                  />
                </div>
                <div>
                  <FieldLabel>Prioritas</FieldLabel>
                  <label className="flex h-[38px] items-center gap-2 rounded-md border border-white/5 bg-card px-3 text-[12px] text-foreground/70">
                    <input
                      type="checkbox"
                      checked={workspaceForm.rows[0]?.isPriority ?? false}
                      onChange={(event) =>
                        updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                          ...currentValue,
                          isPriority: event.target.checked,
                        }))}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-primary"
                    />
                    Masukkan ke pekerjaan prioritas
                  </label>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>Start Time</FieldLabel>
                  <div className="flex h-[38px] items-center rounded-md border border-white/5 bg-card px-3 text-[12px] text-app-accent-ink">
                    {fmtTime(additionalPreview[0]?.startTime)}
                  </div>
                </div>
                <div>
                  <FieldLabel>Finish Time</FieldLabel>
                  <div className="flex h-[38px] items-center rounded-md border border-white/5 bg-card px-3 text-[12px] text-app-accent-ink">
                    {fmtTime(additionalPreview[additionalPreview.length - 1]?.finishTime)}
                  </div>
                </div>
              </div>

              {additionalPreview.length > 1 ? (
                <div className="border border-white/5 bg-background px-3 py-2 text-[11px] text-foreground/55">
                  Sistem akan memecah tambahan ini menjadi jam normal lalu sisa lembur sesuai hari kerja.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel required>
                    {isWorkspaceNonTechnical ? "Description / Instruksi" : "Instruksi"}
                  </FieldLabel>
                  <CompactTextarea
                    rows={4}
                    value={workspaceForm.rows[0]?.jobDescription ?? ""}
                    placeholder="Instruksi kerja"
                    onChange={(event) =>
                      updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                        ...currentValue,
                        jobDescription: event.target.value,
                      }))}
                  />
                </div>
                <div>
                  <FieldLabel>Note</FieldLabel>
                  <CompactTextarea
                    rows={4}
                    value={workspaceForm.rows[0]?.note ?? ""}
                    placeholder="Catatan tambahan"
                    onChange={(event) =>
                      updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                        ...currentValue,
                        note: event.target.value,
                      }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
              <ActionButton onClick={closeCreateWorkspace}>Batal</ActionButton>
              <ActionButton
                variant="primary"
                disabled={workspaceSubmitting}
                onClick={() => {
                  void submitWorkspace();
                }}
              >
                <Save className="h-3 w-3" />
                {workspaceSubmitting ? "Menyimpan..." : isWorkspaceNonTechnical ? "Simpan Job Non Teknis" : "Simpan Tambahan"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {editorMode === "edit" && activePlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[calc(100svh-2rem)] w-full max-w-5xl overflow-y-auto border border-border bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {isDraftStatus(activePlan.status) ? "Edit Draft Job Plan" : "Detail Job Plan"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{activePlan.unitName}</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">{activePlan.planId} · {activePlan.divisionName}</p>
              </div>
              <button type="button" onClick={closeEditor} className="grid h-11 w-11 place-items-center border border-border text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Tutup form edit">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:gap-0">
              <section className="space-y-3 xl:pr-6">
                <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Referensi Pekerjaan</p>
                {[
                  ["Divisi", activePlan.divisionName ?? "-"],
                  ["Unit", activePlan.unitName],
                  ["Panel / Part", activePlan.panelName ?? "-"],
                  ["Job Description", activePlan.masterJobName ?? activePlan.jobName ?? activePlan.panelName ?? "-"],
                ].map(([label, value]) => (
                  <div key={label} className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                    <FieldLabel>{label}</FieldLabel>
                    <CompactInput value={value} disabled />
                  </div>
                ))}
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                  <FieldLabel required>PIC</FieldLabel>
                  <CompactSelect value={editForm.assignedUserId} onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, assignedUserId: event.target.value }))}>
                    <option value="">Pilih PIC</option>
                    {references.employees.filter((employee) => !activePlan.divisionId || String(employee.divisionId ?? "") === String(activePlan.divisionId)).map((employee) => <option key={employee.value} value={employee.value}>{employee.label}</option>)}
                  </CompactSelect>
                </div>
                <div className="grid items-start gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                  <FieldLabel required>Instruksi Kerja</FieldLabel>
                  <CompactTextarea rows={4} value={editForm.jobDescription} placeholder="Masukkan instruksi kerja..." onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, jobDescription: event.target.value }))} />
                </div>
              </section>

              <section className="space-y-3 xl:border-l xl:border-border xl:pl-6">
                <p className="border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Target &amp; Jadwal</p>
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]"><FieldLabel required>Tanggal</FieldLabel><CompactInput type="date" value={editForm.taskDate} onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, taskDate: event.target.value }))} /></div>
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]"><FieldLabel required>Target Hari Ini</FieldLabel><CompactInput value={editForm.targetHours} placeholder="HH:MM" onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, targetHours: event.target.value }))} /></div>
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]"><FieldLabel>Jadwal Mulai</FieldLabel><CompactInput type="time" value={editForm.startTime} onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, startTime: event.target.value }))} /></div>
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]"><FieldLabel>Jadwal Selesai</FieldLabel><CompactInput type="time" value={editForm.finishTime} onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, finishTime: event.target.value }))} /></div>
                <div className="grid items-start gap-2 md:grid-cols-[120px_minmax(0,1fr)]"><FieldLabel>Catatan</FieldLabel><CompactTextarea rows={3} value={editForm.note} placeholder="Masukkan catatan..." onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, note: event.target.value }))} /></div>
                <div className="grid items-center gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                  <FieldLabel>Prioritas</FieldLabel>
                  <label className="flex h-10 items-center gap-2 border border-border bg-background px-3 text-[12px] text-foreground">
                    <input type="checkbox" checked={editForm.isPriority} onChange={(event) => setEditForm((currentValue) => ({ ...currentValue, isPriority: event.target.checked }))} className="h-4 w-4 border-border bg-background accent-primary" />
                    Job prioritas
                  </label>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3">
              {isDraftStatus(activePlan.status) ? (
                <ActionButton variant="danger" onClick={() => { void submitDelete(activePlan); }}><Trash2 className="h-3.5 w-3.5" /> Hapus Draft</ActionButton>
              ) : <span />}
              <div className="flex gap-2">
                <ActionButton onClick={closeEditor}>Batal</ActionButton>
                <ActionButton variant="primary" disabled={isPending} onClick={() => { startTransition(() => { void submitUpdate(); }); }}>
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {approvalPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-md border border-white/5 bg-background p-4">
            <p className="text-[10px] uppercase tracking-wider text-app-accent-ink/70">Approval Job Plan</p>
            <h3 className="mt-1 text-sm font-medium text-foreground">{approvalPlan.planId}</h3>
            <p className="mt-1 text-[11px] text-foreground/45">
              {approvalPlan.unitName} · {approvalPlan.assignedUserName}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setApprovalStatus("PLAN")}
                className={[
                  "rounded-md border px-3 py-2 text-[11px] font-medium transition-colors",
                  approvalStatus === "PLAN"
                    ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                    : "border-white/5 bg-card text-foreground/55",
                ].join(" ")}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setApprovalStatus("REJECTED")}
                className={[
                  "rounded-md border px-3 py-2 text-[11px] font-medium transition-colors",
                  approvalStatus === "REJECTED"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-white/5 bg-card text-foreground/55",
                ].join(" ")}
              >
                Reject
              </button>
            </div>

            <div className="mt-3">
              <FieldLabel>Catatan</FieldLabel>
              <CompactTextarea
                value={approvalNote}
                rows={2}
                placeholder="Alasan approval atau reject..."
                onChange={(event) => setApprovalNote(event.target.value)}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-white/[0.05] pt-3">
              <ActionButton onClick={() => { setApprovalPlan(null); setApprovalNote(""); }}>
                Batal
              </ActionButton>
              <ActionButton
                variant="primary"
                disabled={isPending}
                onClick={() => {
                  startTransition(() => {
                    void submitApproval();
                  });
                }}
              >
                <Save className="h-3 w-3" />
                {isPending ? "Menyimpan..." : "Simpan"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
