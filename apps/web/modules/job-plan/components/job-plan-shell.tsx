"use client";

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
import {
  buildJobPlanScheduleSegments,
  formatDurationHHMM,
  parseDurationHHMM,
} from "@smsystem/contracts/job-plan-schedule";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import {
  ChevronDown,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Plus,
  Save,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  CompactInput,
  CompactSelect,
  CompactTextarea,
  FieldLabel,
} from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

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

interface WorkspaceRowState {
  rowId: string;
  source: JobPlanWorkspaceSource;
  referenceId: string;
  carId: string;
  panelKey: string;
  panelId: string;
  jobTypeId: string;
  assignedUserId: string;
  targetHours: string;
  startTime: string;
  finishTime: string;
  jobDescription: string;
  note: string;
  isPriority: boolean;
}

interface WorkspaceFormState {
  mode: JobPlanCreateMode;
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
  panelKey: string;
  referenceId: string;
  assignedUserId: string;
  targetHours: string;
  startTime: string;
  finishTime: string;
  startTimeTouched: boolean;
  finishTimeTouched: boolean;
  jobDescription: string;
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
    panelKey: "",
    referenceId: "",
    assignedUserId: "",
    targetHours: "01:00",
    startTime: "08:00",
    finishTime: "09:00",
    startTimeTouched: false,
    finishTimeTouched: false,
    jobDescription: "",
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
  { label: "Target Jam", value: "targetHours" },
  { label: "Status", value: "status" },
  { label: "Kapasitas", value: "availablePlanHours" },
  { label: "Progress", value: "progressPercent" },
  { label: "Dibuat", value: "createdAt" },
];

export function JobPlanShell({
  title,
  description,
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
  const [selectedQuickCreateRowIds, setSelectedQuickCreateRowIds] = useState<Set<string>>(
    new Set(),
  );
  const [editForm, setEditForm] = useState<JobPlanEditFormState>(emptyEditForm(state.dateStart));
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>({
    mode: "normal",
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

  const filters: SmartDataGridFilterDefinition[] = [];
  const divisionFilterValue =
    state.filters.find((filter) => filter.field === "divisionId")?.value ?? "";
  const activeDailyDate = state.dateStart;
  const activeRange = clampWeeklyRange(state.dateStart, state.dateEnd);

  const countdownMap = useMemo(
    () => new Map(references.countdowns.map((item) => [item.value, item])),
    [references.countdowns],
  );
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
        panelKey: selectedCountdown.panelName ?? selectedCountdown.panelSectionName ?? "-",
        referenceId: selectedCountdown.value,
        targetHours: formatDurationHHMM(targetHours),
        jobDescription:
          selectedCountdown.jobName ??
          selectedCountdown.label ??
          "",
        note: `Sumber: Countdown ${selectedCountdown.value}`,
      },
      transferMode,
    );

    setMessage(null);
    setError(null);
    setAddMenuOpen(false);
    setQuickCreateMode(transferMode);
    setQuickCreateRows([row]);
    setSelectedQuickCreateRowIds(new Set());
  }, [
    countdownTransferKey,
    references.countdowns,
    searchParams,
    state.dateStart,
  ]);

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

  function updateWeeklyStart(start: string) {
    const range = clampWeeklyRange(start, activeRange.end);
    switchToWeekly(range.start, range.end);
  }

  function updateWeeklyEnd(end: string) {
    const range = clampWeeklyRange(activeRange.start, end);
    switchToWeekly(range.start, range.end);
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
    };
  }

  function buildAdditionalDraftRecord(): JobPlanDraftRecord | null {
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
    const panelName = references.panels.find((panel) => panel.value === row.panelId)?.label ?? null;
    const jobName =
      references.jobTypes.find((jobType) => jobType.value === row.jobTypeId)?.label ?? null;
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
      panelId: row.panelId ? Number(row.panelId) : null,
      panelName,
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
    setQuickCreateRows([
      applyInlineSchedule(createEmptyInlineCreateRow(state.dateStart, divisionFilterValue), nextMode),
    ]);
    setSelectedQuickCreateRowIds(new Set());
  }

  function closeQuickCreate() {
    setQuickCreateMode(null);
    setQuickCreateSubmitting(false);
    setQuickCreateRows([]);
    setSelectedQuickCreateRowIds(new Set());
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
    setEditForm({
      assignedUserId: plan.assignedUserId,
      taskDate: plan.taskDate,
      targetHours: formatDurationHHMM(plan.targetHours),
      startTime: plan.startTime ?? "",
      finishTime: plan.finishTime ?? "",
      jobDescription: plan.jobDescription,
      note: plan.note ?? "",
      isPriority: plan.isPriority,
    });
  }

  function closeEditor() {
    setEditorMode(null);
    setActivePlan(null);
    setEditForm(emptyEditForm(state.dateStart));
  }

  async function submitUpdate() {
    if (!activePlan) {
      return;
    }

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
      items: [
        {
          ...buildEditedDraftRecord(activePlan),
          targetHours,
        },
      ],
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
    updateWorkspaceRow(rowId, (row) => ({
      ...row,
      carId,
      panelKey: "",
      panelId: "",
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
        !workspaceForm.divisionId ||
        String(countdown.divisionId ?? "") === workspaceForm.divisionId,
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
        !workspaceForm.divisionId ||
        String(workOrder.divisionId ?? "") === workspaceForm.divisionId,
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
      (countdown) => !divisionId || String(countdown.divisionId ?? "") === divisionId,
    );
  }

  function getInlineEmployees(row: InlineCreateRowState) {
    return references.employees.filter(
      (employee) =>
        !row.divisionId || String(employee.divisionId ?? "") === row.divisionId,
    );
  }

  function getInlinePreview(
    row: InlineCreateRowState,
    requestedMode: Exclude<AddJobKind, "additional" | null> | null = quickCreateMode === "additional" ? null : quickCreateMode,
  ) {
    const targetHours = parseDurationHHMM(row.targetHours);
    if (!targetHours || targetHours <= 0 || !requestedMode) {
      return [];
    }

    return buildJobPlanScheduleSegments({
      taskDate: row.taskDate,
      requestedMode,
      targetHours,
    });
  }

  function applyInlineSchedule(
    row: InlineCreateRowState,
    requestedMode: Exclude<AddJobKind, "additional" | null> | null = quickCreateMode === "additional" ? null : quickCreateMode,
  ): InlineCreateRowState {
    const preview = getInlinePreview(row, requestedMode);
    if (preview.length === 0) {
      return row;
    }

    return {
      ...row,
      startTime: row.startTimeTouched ? row.startTime : preview[0].startTime,
      finishTime: row.finishTimeTouched ? row.finishTime : preview[preview.length - 1].finishTime,
    };
  }

  function addInlineCreateRow() {
    setQuickCreateRows((currentValue) => [
      ...currentValue,
      applyInlineSchedule(createEmptyInlineCreateRow(state.dateStart, divisionFilterValue)),
    ]);
  }

  function removeSelectedInlineCreateRows() {
    if (selectedQuickCreateRowIds.size === 0) {
      return;
    }

    setQuickCreateRows((currentValue) => {
      const remainingRows = currentValue.filter(
        (row) => !selectedQuickCreateRowIds.has(row.rowId),
      );
      if (remainingRows.length > 0) {
        return remainingRows;
      }

      return [
        applyInlineSchedule(
          createEmptyInlineCreateRow(state.dateStart, divisionFilterValue),
          quickCreateMode === "additional" ? null : quickCreateMode,
        ),
      ];
    });
    setSelectedQuickCreateRowIds(new Set());
  }

  function updateInlineCreateRow(
    rowId: string,
    updater: (row: InlineCreateRowState) => InlineCreateRowState,
  ) {
    setQuickCreateRows((currentValue) =>
      currentValue.map((row) => (row.rowId === rowId ? applyInlineSchedule(updater(row)) : row)),
    );
  }

  function handleInlineLastFieldKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowIndex: number,
  ) {
    const isLastRow = rowIndex === quickCreateRows.length - 1;
    if (!isLastRow) {
      return;
    }

    if (event.key !== "Tab" && event.key !== "Enter") {
      return;
    }

    const row = quickCreateRows[rowIndex];
    if (!row) {
      return;
    }

    if (!row.referenceId || !row.assignedUserId || !row.jobDescription.trim()) {
      return;
    }

    addInlineCreateRow();
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

  function getQuickCreateJobOptions(row: InlineCreateRowState) {
    return getCountdownRowsByDivision(row.divisionId).filter((countdown) => {
      const panelKey = countdown.panelName ?? countdown.panelSectionName ?? "-";
      return countdown.carId === row.carId && panelKey === row.panelKey;
    });
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

        if (row.source === "additional" && (!row.carId || !row.panelId || !row.jobTypeId)) {
          setError("Baris sumber tambahan wajib memilih unit, panel, dan jobdesc tambahan.");
          return;
        }
      }

      const firstRow = rows[0];
      const parsedTargetHours = parseDurationHHMM(firstRow.targetHours);
      if (!parsedTargetHours) {
        setError("Total jam tambahan harus memakai format HH:MM.");
        return;
      }

      const draft = buildAdditionalDraftRecord();
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
      description: `${selectedRows.length} draft akan dikirim ke alur KD → Advisor (jika ada) → KP → PM/MP.`,
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
      key: "taskDate",
      label: "Tanggal",
      kind: "mono",
      sticky: true,
      sortable: true,
      sortKey: "taskDate",
    },
    {
      key: "assignedUserName",
      label: "PIC",
      sortable: true,
      sortKey: "assignedUserName",
      filterKey: "assignedUserId",
      filterOptions: references.employees,
      renderCell: (value, row) => (
        <div className="space-y-1">
          <p className="text-white">{String(value ?? "-")}</p>
          <p className="text-[11px] text-white/35">{String(row.assignedUserId ?? "-")}</p>
        </div>
      ),
    },
    {
      key: "unitName",
      label: "Unit",
      sortable: true,
      sortKey: "unitName",
      widthClassName: "min-w-[120px]",
    },
    {
      key: "panelName",
      label: "Panel",
      sortable: true,
      sortKey: "panelName",
      widthClassName: "min-w-[180px]",
    },
    {
      key: "jobName",
      label: "Jobdesc",
      sortable: true,
      sortKey: "jobName",
      widthClassName: "min-w-[220px]",
      renderCell: (_value, row) => (
        <span className="font-medium text-amber-300/80">
          {String(row.jobName ?? row.panelName ?? "-")}
        </span>
      ),
    },
    {
      key: "jobDescription",
      label: "Instruksi",
      widthClassName: "min-w-[280px]",
    },
    {
      key: "targetHours",
      label: "Total Jam",
      kind: "number",
      align: "right",
      sortable: true,
      sortKey: "targetHours",
    },
    {
      key: "availablePlanHours",
      label: "Kapasitas",
      align: "right",
      sortable: true,
      sortKey: "availablePlanHours",
      widthClassName: "min-w-[156px]",
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
            <p className="font-medium text-white">
              {availablePlanHours !== null
                ? `${formatDurationHHMM(availablePlanHours)} tersedia`
                : "-"}
            </p>
            <p className="text-[10px] text-white/35">
              {remainingHours !== null
                ? `${formatDurationHHMM(remainingHours)} sisa kerja`
                : "-"}
            </p>
          </div>
        );
      },
    },
    {
      key: "startTime",
      label: "Jam Mulai",
      kind: "mono",
      align: "center",
      widthClassName: "min-w-[100px]",
    },
    {
      key: "finishTime",
      label: "Jam Selesai",
      kind: "mono",
      align: "center",
      widthClassName: "min-w-[100px]",
    },
    {
      key: "progressPercent",
      label: "Progress %",
      kind: "number",
      align: "right",
      sortable: true,
      sortKey: "progressPercent",
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
    },
    {
      key: "note",
      label: "Keterangan",
      widthClassName: "min-w-[200px]",
    },
  ];

  function renderGridSection(
    sectionTitle: string,
    sectionDescription: string,
    sectionRows: Array<Record<string, string | number | boolean | null>>,
    sectionMeta: JobPlanGridMeta,
    showControls: boolean,
    sectionMode: "normal" | "overtime",
  ) {
    const viewportClassName =
      mode === "all"
        ? "max-h-[clamp(20rem,38vh,30rem)]"
        : "max-h-[clamp(24rem,58vh,44rem)]";

    return (
      <SmartDataGrid
        title={sectionTitle}
        description={sectionDescription}
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
        prependRow={renderQuickCreateEditor(sectionMode)}
        viewportClassName={viewportClassName}
      />
    );
  }

  function renderQuickCreateEditor(sectionMode: "normal" | "overtime") {
    if (quickCreateMode !== sectionMode) {
      return null;
    }

    const colSpan = columns.length + 1;

    return (
      <>
        <tr>
          <td colSpan={colSpan} className="border-b border-white/[0.05] bg-[#0d0d0d] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-white/70">
                  Tambah job {quickCreateMode === "overtime" ? "lembur" : "normal"}
                </p>
                <p className="text-[10px] text-white/35">
                  Baris baru masuk langsung ke tabel ini. Tab atau Enter di kolom keterangan
                  terakhir akan menambah baris baru.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton variant="primary" onClick={addInlineCreateRow}>
                  <Plus className="h-3 w-3" />
                  Tambah Row
                </ActionButton>
                <ActionButton
                  variant="danger"
                  disabled={selectedQuickCreateRowIds.size === 0}
                  onClick={removeSelectedInlineCreateRows}
                >
                  <X className="h-3 w-3" />
                  Hapus Baris
                </ActionButton>
                <ActionButton
                  variant="primary"
                  disabled={quickCreateSubmitting}
                  onClick={() => {
                    void submitQuickCreate();
                  }}
                >
                  <Save className="h-3 w-3" />
                  {quickCreateSubmitting ? "Menyimpan..." : "Simpan"}
                </ActionButton>
                <ActionButton onClick={closeQuickCreate}>Batal</ActionButton>
              </div>
            </div>
          </td>
        </tr>
        {quickCreateRows.map((row, index) => {
          const preview = getInlinePreview(row);
          const selectedCountdown = getQuickCreateSelectedCountdown(row);
          const availablePlanHours = selectedCountdown?.availablePlanHours ?? null;
          const remainingWorkHours = selectedCountdown?.remainingHours ?? null;
          const countdownProgress = selectedCountdown?.progressPercent ?? null;

          return (
            <tr key={row.rowId} className="align-top bg-[#0d0d0d]">
              <td className="sticky left-0 z-20 border-b border-white/[0.04] bg-[#0d0d0d] px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedQuickCreateRowIds.has(row.rowId)}
                  onChange={(event) => {
                    setSelectedQuickCreateRowIds((currentValue) => {
                      const nextValue = new Set(currentValue);
                      if (event.target.checked) {
                        nextValue.add(row.rowId);
                      } else {
                        nextValue.delete(row.rowId);
                      }
                      return nextValue;
                    });
                  }}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-amber-500"
                />
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[126px]">
                <CompactInput
                  type="date"
                  value={row.taskDate}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      taskDate: event.target.value,
                    }))}
                />
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[220px]">
                <CompactSelect
                  value={row.assignedUserId}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      assignedUserId: event.target.value,
                    }))}
                >
                  <option value="">Pilih PIC</option>
                  {getInlineEmployees(row).map((employee) => (
                    <option key={employee.value} value={employee.value}>
                      {employee.label}
                    </option>
                  ))}
                </CompactSelect>
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[170px]">
                <CompactSelect
                  value={row.carId}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      carId: event.target.value,
                      panelKey: "",
                      referenceId: "",
                      jobDescription: "",
                    }))}
                >
                  <option value="">Pilih Unit</option>
                  {getQuickCreateUnitOptions(row).map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </CompactSelect>
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[220px]">
                <CompactSelect
                  value={row.panelKey}
                  disabled={!row.carId}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      panelKey: event.target.value,
                      referenceId: "",
                      jobDescription: "",
                    }))}
                >
                  <option value="">Pilih Panel / Part</option>
                  {getQuickCreatePanelOptions(row).map((panel) => (
                    <option key={panel.value} value={panel.value}>
                      {panel.label}
                    </option>
                  ))}
                </CompactSelect>
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[250px]">
                <CompactSelect
                  value={row.referenceId}
                  disabled={!row.panelKey}
                  onChange={(event) => {
                    const selectedCountdown = getQuickCreateJobOptions(row).find(
                      (countdown) => countdown.value === event.target.value,
                    );
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      referenceId: event.target.value,
                      jobDescription:
                        currentValue.jobDescription ||
                        selectedCountdown?.jobName ||
                        selectedCountdown?.label ||
                        "",
                    }));
                  }}
                >
                  <option value="">Pilih Jobdesc</option>
                  {getQuickCreateJobOptions(row).map((countdown) => (
                    <option key={countdown.value} value={countdown.value}>
                      {countdown.jobName ?? countdown.label}
                    </option>
                  ))}
                </CompactSelect>
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[280px]">
                <CompactInput
                  type="text"
                  value={row.jobDescription}
                  placeholder="Instruksi kerja"
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      jobDescription: event.target.value,
                    }))}
                />
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[120px]">
                <CompactInput
                  type="text"
                  value={row.targetHours}
                  placeholder="HH:MM"
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      targetHours: event.target.value,
                    }))}
                />
              </td>
              <td className="border-b border-white/[0.04] px-3 py-2 min-w-[160px] text-[11px] text-white/55">
                {availablePlanHours !== null || remainingWorkHours !== null ? (
                  <div className="space-y-1">
                    <p className="text-white/75">
                      {availablePlanHours !== null
                        ? `${formatDurationHHMM(availablePlanHours)} tersedia`
                        : "-"}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {remainingWorkHours !== null
                        ? `${formatDurationHHMM(remainingWorkHours)} sisa kerja`
                        : "Pilih jobdesc"}
                    </p>
                  </div>
                ) : (
                  <span className="text-white/25">-</span>
                )}
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[110px]">
                <CompactInput
                  type="time"
                  value={row.startTime}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      startTime: event.target.value,
                      startTimeTouched: true,
                    }))}
                />
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[120px]">
                <CompactInput
                  type="time"
                  value={row.finishTime}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      finishTime: event.target.value,
                      finishTimeTouched: true,
                    }))}
                />
                {preview.length > 1 ? (
                  <p className="mt-1 text-[10px] text-white/35">
                    Split {preview[0]?.finishTime} lalu lanjut lembur
                  </p>
                ) : null}
              </td>
              <td className="border-b border-white/[0.04] px-3 py-2 min-w-[90px] text-right text-[11px] text-white/55">
                {countdownProgress !== null ? countdownProgress.toFixed(0) : 0}
              </td>
              <td className="border-b border-white/[0.04] px-3 py-2 min-w-[110px] text-center">
                <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/55">
                  Baru
                </span>
              </td>
              <td className="border-b border-white/[0.04] p-2 min-w-[200px]">
                <CompactInput
                  type="text"
                  value={row.note}
                  placeholder="Keterangan"
                  onKeyDown={(event) => handleInlineLastFieldKeyDown(event, index)}
                  onChange={(event) =>
                    updateInlineCreateRow(row.rowId, (currentValue) => ({
                      ...currentValue,
                      note: event.target.value,
                    }))}
                />
              </td>
            </tr>
          );
        })}
      </>
    );
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
    if (row.source === "additional") {
      const panelOptions = getAdditionalPanelOptions(row);
      return (
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
                String(jobType.divisionId ?? "") === workspaceForm.divisionId,
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

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] px-3 py-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[13px] font-medium text-white">{title}</h1>
              <div className="w-40">
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
              </div>
              <div className="w-52">
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => switchToDaily(activeDailyDate || getTodayIsoDate())}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    state.window === "daily"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-white/40 hover:text-white/70",
                  ].join(" ")}
                >
                  Harian
                </button>
                <button
                  type="button"
                  onClick={() => switchToWeekly(activeRange.start, activeRange.end)}
                  className={[
                    "rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
                    state.window === "weekly"
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-white/40 hover:text-white/70",
                  ].join(" ")}
                >
                  Mingguan
                </button>
              </div>

              {state.window === "daily" ? (
                <div className="w-40">
                  <CompactInput
                    type="date"
                    value={activeDailyDate}
                    onChange={(event) => updateDailyDate(event.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2">
                  <div className="w-36">
                    <CompactInput
                      type="date"
                      value={activeRange.start}
                      onChange={(event) => updateWeeklyStart(event.target.value)}
                    />
                  </div>
                  <span className="text-[11px] text-white/30">s.d.</span>
                  <div className="w-36">
                    <CompactInput
                      type="date"
                      value={activeRange.end}
                      onChange={(event) => updateWeeklyEnd(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-white/30">Total Jam</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-white tabular-nums">
                  {summary.totalHours.toFixed(1)}j
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-amber-500/70">Pending</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-amber-500 tabular-nums">
                  {summary.pendingCount}
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-emerald-500/70">Plan</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-emerald-500 tabular-nums">
                  {summary.approvedCount}
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.13em] text-red-500/70">Lembur</p>
                <p className="mt-1 text-[16px] font-medium leading-none text-red-500 tabular-nums">
                  {summary.overtimeCount}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <ActionButton variant="primary" onClick={() => setAddMenuOpen((currentValue) => !currentValue)}>
                  <Plus className="h-3 w-3" />
                  Tambah Job
                  <ChevronDown className="h-3 w-3" />
                </ActionButton>
                {addMenuOpen ? (
                  <div className="absolute right-0 top-10 z-40 min-w-40 rounded-xl border border-white/[0.08] bg-[#090909] p-1 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => openQuickCreate("normal")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5 text-emerald-400" />
                      Job Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuickCreate("overtime")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5 text-red-400" />
                      Job Lembur
                    </button>
                    <button
                      type="button"
                      onClick={openCreateWorkspace}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5 text-amber-400" />
                      Job Tambahan
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((currentValue) => !currentValue)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-white/60 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {exportOpen ? (
                  <div className="absolute right-0 top-9 z-40 min-w-36 rounded-xl border border-white/[0.08] bg-[#090909] p-1 shadow-2xl">
                <a
                  href={buildExportHref("csv")}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                >
                  <Download className="h-3.5 w-3.5 text-amber-400" />
                  CSV
                </a>
                <a
                  href={buildExportHref("xlsx")}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  Excel
                </a>
                <a
                  href={buildExportHref("pdf")}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                >
                  <FileText className="h-3.5 w-3.5 text-red-400" />
                  PDF
                </a>
                <a
                  href={buildExportHref("image")}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.05] hover:text-white"
                >
                  <FileImage className="h-3.5 w-3.5 text-sky-400" />
                  Gambar
                </a>
                  </div>
                ) : null}
              </div>

              <ActionButton onClick={() => router.refresh()}>Refresh</ActionButton>
            </div>
          </div>
        </div>
      </div>

      {sweetAlert.alertElement}

      {selectedKeys.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] px-3 py-2">
          <p className="text-[11px] text-white/55">{selectedKeys.size} job plan dipilih</p>
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

      {mode === "all" && allSections ? (
        <div className="space-y-3">
          {renderGridSection(
            "Normal",
            "Daftar job plan normal untuk rentang aktif.",
            normalRows,
            allSections.normal.meta,
            true,
            "normal",
          )}
          {renderGridSection(
            "Lembur",
            "Daftar job plan lembur untuk rentang aktif.",
            overtimeRows,
            allSections.overtime.meta,
            false,
            "overtime",
          )}
        </div>
      ) : (
        renderGridSection(
          getModeLabel(mode),
          description,
          gridRows,
          meta,
          true,
          mode === "overtime" ? "overtime" : "normal",
        )
      )}

      {workspaceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-5xl rounded-[16px] border border-white/[0.06] bg-[#0a0a0a] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-500/70">Job Tambahan</p>
                <h3 className="mt-1 text-sm font-medium text-white">
                  Form tambahan ini akan membuat countdown baru kategori additional.
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateWorkspace}
                className="rounded-lg border border-white/[0.08] p-2 text-white/45 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="grid gap-3 md:grid-cols-3">
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
                  <FieldLabel>Perlu Rework?</FieldLabel>
                  <CompactSelect
                    value={workspaceForm.isRework ? "yes" : "no"}
                    onChange={(event) => setWorkspaceField("isRework", event.target.value === "yes")}
                  >
                    <option value="no">Tidak</option>
                    <option value="yes">Ya</option>
                  </CompactSelect>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel required>Unit</FieldLabel>
                  {renderUnitCell(workspaceForm.rows[0]!)}
                </div>
                <div>
                  <FieldLabel required>Panel / Part</FieldLabel>
                  {renderPanelCell(workspaceForm.rows[0]!)}
                </div>
                <div>
                  <FieldLabel required>Pekerjaan</FieldLabel>
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
                  <FieldLabel required>Total Jam</FieldLabel>
                  <CompactInput
                    type="text"
                    value={workspaceForm.rows[0]?.targetHours ?? ""}
                    placeholder="HH:MM"
                    onChange={(event) =>
                      updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                        ...currentValue,
                        targetHours: event.target.value,
                      }))}
                  />
                </div>
                <div>
                  <FieldLabel>Prioritas</FieldLabel>
                  <label className="flex h-[38px] items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/70">
                    <input
                      type="checkbox"
                      checked={workspaceForm.rows[0]?.isPriority ?? false}
                      onChange={(event) =>
                        updateWorkspaceRow(workspaceForm.rows[0]!.rowId, (currentValue) => ({
                          ...currentValue,
                          isPriority: event.target.checked,
                        }))}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-amber-500"
                    />
                    Masukkan ke pekerjaan prioritas
                  </label>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>Jam Mulai</FieldLabel>
                  <div className="flex h-[38px] items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-amber-300">
                    {additionalPreview[0]?.startTime ?? "-"}
                  </div>
                </div>
                <div>
                  <FieldLabel>Jam Selesai</FieldLabel>
                  <div className="flex h-[38px] items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-amber-300">
                    {additionalPreview[additionalPreview.length - 1]?.finishTime ?? "-"}
                  </div>
                </div>
              </div>

              {additionalPreview.length > 1 ? (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
                  Sistem akan memecah tambahan ini menjadi jam normal lalu sisa lembur sesuai hari kerja.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel required>Instruksi</FieldLabel>
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
                  <FieldLabel>Catatan</FieldLabel>
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
                {workspaceSubmitting ? "Menyimpan..." : "Simpan Tambahan"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {editorMode === "edit" && activePlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-500/70">
                  {isDraftStatus(activePlan.status) ? "Edit Draft Job Plan" : "Detail Job Plan"}
                </p>
                <h3 className="mt-1 text-sm font-medium text-white">{activePlan.planId}</h3>
                <p className="mt-1 text-[11px] text-white/40">
                  {activePlan.unitName} · {activePlan.divisionName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-white/[0.08] p-2 text-white/45 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel required>PIC</FieldLabel>
                <CompactSelect
                  value={editForm.assignedUserId}
                  onChange={(event) =>
                    setEditForm((currentValue) => ({
                      ...currentValue,
                      assignedUserId: event.target.value,
                    }))}
                >
                  <option value="">Pilih PIC</option>
                  {references.employees.map((employee) => (
                    <option key={employee.value} value={employee.value}>
                      {employee.label}
                    </option>
                  ))}
                </CompactSelect>
              </div>
              <div>
                <FieldLabel required>Tanggal</FieldLabel>
                <CompactInput
                  type="date"
                  value={editForm.taskDate}
                  onChange={(event) =>
                    setEditForm((currentValue) => ({
                      ...currentValue,
                      taskDate: event.target.value,
                    }))}
                />
              </div>
              <div>
                <FieldLabel required>Jam Kerja</FieldLabel>
                <CompactInput
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editForm.targetHours}
                  onChange={(event) =>
                    setEditForm((currentValue) => ({
                      ...currentValue,
                      targetHours: event.target.value,
                    }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Mulai</FieldLabel>
                  <CompactInput
                    type="time"
                    value={editForm.startTime}
                    onChange={(event) =>
                      setEditForm((currentValue) => ({
                        ...currentValue,
                        startTime: event.target.value,
                      }))}
                  />
                </div>
                <div>
                  <FieldLabel>Selesai</FieldLabel>
                  <CompactInput
                    type="time"
                    value={editForm.finishTime}
                    onChange={(event) =>
                      setEditForm((currentValue) => ({
                        ...currentValue,
                        finishTime: event.target.value,
                      }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel required>Instruksi</FieldLabel>
              <CompactTextarea
                rows={3}
                value={editForm.jobDescription}
                onChange={(event) =>
                  setEditForm((currentValue) => ({
                    ...currentValue,
                    jobDescription: event.target.value,
                  }))}
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <FieldLabel>Keterangan</FieldLabel>
                <CompactInput
                  type="text"
                  value={editForm.note}
                  onChange={(event) =>
                    setEditForm((currentValue) => ({
                      ...currentValue,
                      note: event.target.value,
                    }))}
                />
              </div>
              <div>
                <FieldLabel>Prioritas</FieldLabel>
                <label className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white">
                  <input
                    type="checkbox"
                    checked={editForm.isPriority}
                    onChange={(event) =>
                      setEditForm((currentValue) => ({
                        ...currentValue,
                        isPriority: event.target.checked,
                      }))}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-amber-500"
                  />
                  Tandai prioritas
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-2 border-t border-white/[0.05] pt-3">
              {isDraftStatus(activePlan.status) ? (
                <ActionButton variant="danger" onClick={() => { void submitDelete(activePlan); }}>
                  Hapus Draft
                </ActionButton>
              ) : <span />}
              <div className="flex gap-2">
                <ActionButton onClick={closeEditor}>Batal</ActionButton>
                <ActionButton
                  variant="primary"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void submitUpdate();
                    });
                  }}
                >
                  <Save className="h-3 w-3" />
                  {isPending ? "Menyimpan..." : isDraftStatus(activePlan.status) ? "Simpan Draft" : "Simpan"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {approvalPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-[14px] border border-white/[0.06] bg-[#0a0a0a] p-4 shadow-2xl">
            <p className="text-[10px] uppercase tracking-wider text-amber-500/70">Approval Job Plan</p>
            <h3 className="mt-1 text-sm font-medium text-white">{approvalPlan.planId}</h3>
            <p className="mt-1 text-[11px] text-white/45">
              {approvalPlan.unitName} · {approvalPlan.assignedUserName}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setApprovalStatus("PLAN")}
                className={[
                  "rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors",
                  approvalStatus === "PLAN"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-white/[0.06] bg-white/[0.03] text-white/55",
                ].join(" ")}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setApprovalStatus("REJECTED")}
                className={[
                  "rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors",
                  approvalStatus === "REJECTED"
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-white/[0.06] bg-white/[0.03] text-white/55",
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
