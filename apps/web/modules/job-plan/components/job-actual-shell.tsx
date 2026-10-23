"use client";

import type { JobPlanRuntimeReadItem } from "@smsystem/contracts/job-plan-runtime";
import type { JobPlanRecord } from "@smsystem/contracts/job-plan";
import type { QcInspectionRecord } from "@smsystem/contracts/qc";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  createJobPlanCommandId,
  fetchJobPlanRuntimeList,
  manualExecuteJobPlan,
  monitorJobPlan,
} from "@/shared/api/job-plan/job-plan-runtime";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { fetchQcDetail, passQc, rejectQc } from "@/shared/api/qc/qc";
import { fetchJobActualRows } from "@/shared/api/job-plan/job-plan";
import { ActionButton, CompactDateInput, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { normalizeSmsDurationText, normalizeSmsTimeText } from "@/shared/datagrid/parsers";
import {
  buildManualExecutionJobPlanRuntimePayload,
  createManualExecutionDraft,
  manualExecutionDraftActualMinutes,
  liveJobPlanActualMinutes,
  liveJobPlanUnverifiedMinutes,
  jobActualQcLabel,
  minutesToDuration,
  toJobPlanRuntimeDisplayRows,
  toLocalDateValue,
  validateManualExecutionDraft,
  type JobPlanCountdownOption,
  type JobPlanEmployeeOption,
  type JobPlanRuntimeDisplayRow,
  type JobPlanRuntimeManualExecutionDraft,
} from "../job-plan-planner";

interface JobActualShellProps {
  userId: string;
  canInput: boolean;
  canMonitor: boolean;
  canValidate: boolean;
  initialDate: string | null;
  countdowns: JobPlanCountdownOption[];
  employees: JobPlanEmployeeOption[];
  actualRows: JobPlanRecord[];
}

type ActualProgressStatus = JobPlanRuntimeManualExecutionDraft["status"];
type ReviewAction = "monitor" | "qc";
type QcResultDraft = "lolos" | "tidak_lolos";

interface JobActualReviewDraft {
  action: ReviewAction;
  planId: string;
  coreId: string;
  expectedVersion: number;
  unitName: string;
  panelName: string;
  jobDescription: string;
  verifiedMinutes: number;
  status: ActualProgressStatus;
  progressText: string;
  noteText: string;
  qcResult: QcResultDraft;
  qcDurationMinutesText: string;
  qcPhotoBeforeUrl: string;
  qcEvidencePhotoUrl: string;
  reworkDate: string;
  reworkAssignedUser: string;
  reworkDailyHours: string;
  reworkStartTime: string;
  reworkFinishTime: string;
  reworkDescription: string;
  reworkIsOvertime: boolean;
  reworkIsPriority: boolean;
  error: string | null;
}

interface JobActualMonitoringDetail {
  row: JobPlanRuntimeDisplayRow;
  actual?: JobPlanRecord;
}

const progressStatusLabels: Record<ActualProgressStatus, string> = {
  pending: "Pending",
  on_progress: "On Progress",
  done: "Selesai",
};

function monitoringStatus(row: JobPlanRuntimeDisplayRow) {
  if (row.persistedWorkMinutes > 0) return "Sudah monitoring";
  if (row.unverifiedWorkMinutes > 0 || row.accumulatedWorkMinutes > 0) return "Perlu monitoring";
  return "Belum ada aktual";
}

function qcStatus(row: JobPlanRuntimeDisplayRow, actual?: JobPlanRecord) {
  const inspection = jobActualQcLabel(actual);
  if (inspection) return inspection;
  if (["VALIDATED", "FINISHED_PENDING_VALIDATION"].includes(row.executionState)) return "Menunggu QC";
  return "Belum QC";
}

function actualWorkStatus(row: JobPlanRuntimeDisplayRow) {
  if (row.approvalState === "APPROVED" && row.executionState === "NOT_STARTED") return "PLAN";
  if (row.executionState === "RUNNING") return "ONPROGRESS";
  if (row.executionState === "HOLD") return "PENDING";
  if (row.executionState === "FINISHED_PENDING_VALIDATION") return "READY_QC";
  if (row.executionState === "VALIDATED") return "DONE";
  return row.executionState;
}

function actualProgressText(row: JobPlanRuntimeDisplayRow, actual?: JobPlanRecord) {
  const progress = actual?.actualProgressPercent ?? actual?.actualValidationProgress;
  if (progress != null) return `${progress}%`;
  if (row.persistedWorkMinutes > 0) return "100%";
  return "-";
}

function actualProgressValue(row: JobPlanRuntimeDisplayRow, actual?: JobPlanRecord) {
  const progress = actual?.actualProgressPercent ?? actual?.actualValidationProgress;
  if (progress != null) return Number(progress);
  if (row.monitoringHistory.length > 0) return row.monitoringHistory.at(-1)?.progress ?? 0;
  return row.persistedWorkMinutes > 0 ? 100 : 0;
}

function uniqueByValue(options: Array<{ value: string; label: string }>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function timeFromDateTime(value: string) {
  return value.includes("T") ? value.split("T")[1]?.slice(0, 5) ?? "" : value.slice(0, 5);
}

function timeOnly(value: string | null | undefined) {
  if (!value) return "-";
  const timePart = value.includes("T") ? value.split("T")[1] : value.split(" ")[1] ?? value;
  return timePart.slice(0, 5) || "-";
}

function timeFromDate(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function actualTimeText(row: JobPlanRuntimeDisplayRow | undefined, actual: JobPlanRecord | undefined, kind: "start" | "finish", now: Date) {
  const runtimeValue = kind === "start" ? row?.actualStartAt ?? row?.activeSegmentStartedAt : row?.actualFinishAt;
  const legacyValue = kind === "start" ? actual?.actualStartTime : actual?.actualFinishTime;
  const value = runtimeValue ?? legacyValue ?? "";
  if (!value && kind === "finish" && row?.executionState === "RUNNING" && row.activeSegmentStartedAt) return timeFromDate(now);
  return value ? timeFromDateTime(value) : "-";
}

function monitoringDetailText(row: JobPlanRuntimeDisplayRow, actual: JobPlanRecord | undefined, now: Date) {
  const start = actualTimeText(row, actual, "start", now);
  const finish = actualTimeText(row, actual, "finish", now);
  const liveMinutes = liveJobPlanActualMinutes(row, now);
  const durationMinutes = row.persistedWorkMinutes > 0 ? row.persistedWorkMinutes : liveMinutes;
  const progress = actual?.actualProgressPercent ?? (row.persistedWorkMinutes > 0 ? 100 : 0);
  const duration = minutesToDuration(durationMinutes);
  if (start !== "-" && finish !== "-") return `${start} - ${finish} | ${duration} (${progress}%)`;
  return `${duration} (${progress}%)`;
}

function monitoringHistoryEntries(row: JobPlanRuntimeDisplayRow, actual: JobPlanRecord | undefined, now: Date) {
  const entries = row.monitoringHistory
    .slice(0, 3)
    .map((item, index) => ({
      sequence: item.sequence || index + 1,
      text: `${item.time ? timeFromDateTime(item.time) : "-"} (${item.progress ?? 0}%)`,
    }));
  if (entries.length > 0) return entries;
  if (row.persistedWorkMinutes <= 0) return [];
  return [{ sequence: 1, text: monitoringDetailText(row, actual, now).replace(/\s\|\s\d{2}:\d{2}/u, "") }];
}

function canAddMonitoring(row: JobPlanRuntimeDisplayRow, actual?: JobPlanRecord) {
  return row.monitoringHistory.length < 3 && actualProgressValue(row, actual) < 100;
}

function setDateTimeClock(value: string, clock: string) {
  const date = value.includes("T") ? value.split("T")[0] : toLocalDateValue();
  return `${date}T${clock}`;
}

function normalizeDateTimeClock(value: string, label: string) {
  const normalized = normalizeSmsTimeText(timeFromDateTime(value), label);
  if (!normalized.value) return null;
  return setDateTimeClock(value, normalized.value);
}

function normalizeActualDraftTimes(draft: JobPlanRuntimeManualExecutionDraft): JobPlanRuntimeManualExecutionDraft {
  const actualStart = normalizeDateTimeClock(draft.actualStart, "Jam mulai aktual") ?? draft.actualStart;
  const actualFinish = normalizeDateTimeClock(draft.actualFinish, "Jam selesai") ?? draft.actualFinish;
  const breakText = normalizeSmsDurationText(draft.breakMinutesText.trim() || "00:00", "Jam istirahat").value ?? draft.breakMinutesText;
  return {
    ...draft,
    actualStart,
    actualFinish,
    breakMinutesText: breakText,
  };
}

function createActualDraft(row: JobPlanRuntimeDisplayRow): JobPlanRuntimeManualExecutionDraft {
  return {
    ...createManualExecutionDraft(row),
    actualStart: `${row.taskDate}T${row.startTime}`,
    actualFinish: `${row.taskDate}T${row.finishTime}`,
  };
}

function createReviewDraft(action: ReviewAction, row: JobPlanRuntimeDisplayRow, actual?: JobPlanRecord): JobActualReviewDraft {
  const progress = actual?.actualProgressPercent ?? actual?.actualValidationProgress ?? (row.persistedWorkMinutes > 0 ? 100 : 0);
  return {
    action,
    planId: String(row.planId),
    coreId: row.coreId,
    expectedVersion: Number(row.version ?? 0),
    unitName: row.unitName,
    panelName: row.panelName,
    jobDescription: row.jobDescription,
    verifiedMinutes: row.accumulatedWorkMinutes,
    status: "done",
    progressText: String(progress),
    noteText: action === "qc" ? "Pekerjaan selesai dan siap ditutup final." : "",
    qcResult: "lolos",
    qcDurationMinutesText: "",
    qcPhotoBeforeUrl: "",
    qcEvidencePhotoUrl: "",
    reworkDate: row.taskDate || toLocalDateValue(),
    reworkAssignedUser: row.employeeId,
    reworkDailyHours: row.durationText || "01:00",
    reworkStartTime: row.startTime,
    reworkFinishTime: row.finishTime,
    reworkDescription: `QC Rework - ${row.jobDescription || row.panelName || row.unitName}`,
    reworkIsOvertime: row.workMode === "overtime",
    reworkIsPriority: false,
    error: null,
  };
}

function validateProgress(progressText: string) {
  const progress = Number(progressText);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return "Persentase harus 0 sampai 100.";
  return null;
}

function optionalPositiveInteger(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1440) {
    return { value: null, error: `${label} harus angka menit 1 sampai 1440.` };
  }
  return { value: parsed, error: null };
}

function optionalUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  try {
    const url = new URL(trimmed);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("INVALID_PROTOCOL");
    return { value: url.toString(), error: null };
  } catch {
    return { value: null, error: `${label} harus URL yang valid.` };
  }
}

function validateClockOrEmpty(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeSmsTimeText(trimmed, label).error ?? null;
}

function validateQcDraft(draft: JobActualReviewDraft) {
  if (!draft.coreId.trim()) return "Core countdown wajib ada untuk input QC.";

  const duration = optionalPositiveInteger(draft.qcDurationMinutesText, "Durasi QC");
  if (duration.error) return duration.error;

  const photoBefore = optionalUrl(draft.qcPhotoBeforeUrl, "Foto QC 1");
  if (photoBefore.error) return photoBefore.error;

  const evidencePhoto = optionalUrl(draft.qcEvidencePhotoUrl, "Foto QC 2");
  if (evidencePhoto.error) return evidencePhoto.error;

  if (draft.qcResult === "tidak_lolos") {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(draft.reworkDate.trim())) return "Tanggal pengerjaan ulang wajib diisi.";
    if (!draft.reworkAssignedUser.trim()) return "PIC rework wajib diisi.";
    if (!/^\d{2}:\d{2}$/u.test(draft.reworkDailyHours.trim())) return "Jam rework harian harus format HH:MM.";
    const startError = validateClockOrEmpty(draft.reworkStartTime, "Jam mulai rework");
    if (startError) return startError;
    const finishError = validateClockOrEmpty(draft.reworkFinishTime, "Jam selesai rework");
    if (finishError) return finishError;
  }

  return null;
}

function humanNote(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  if (!raw.startsWith("{")) return raw;
  try {
    const parsed = JSON.parse(raw) as { note?: unknown };
    return typeof parsed.note === "string" ? parsed.note.trim() : "";
  } catch {
    return raw;
  }
}

const noteCellClass = "whitespace-normal break-words py-2 leading-5";

function fieldClassName() {
  return "mt-1 h-9 w-full border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-app-accent";
}

export function JobActualShell({
  userId,
  canInput,
  canMonitor,
  canValidate,
  initialDate,
  countdowns,
  employees,
  actualRows,
}: JobActualShellProps) {
  const [items, setItems] = useState<JobPlanRuntimeReadItem[]>([]);
  const [currentActualRows, setCurrentActualRows] = useState(actualRows);
  const loadRequest = useRef(0);
  const qcRequest = useRef(0);
  const [dateFilter, setDateFilter] = useState(initialDate ?? toLocalDateValue());
  const [kpFilter, setKpFilter] = useState("");
  const [qaFilter, setQaFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<JobPlanRuntimeManualExecutionDraft | null>(null);
  const [reviewDraft, setReviewDraft] = useState<JobActualReviewDraft | null>(null);
  const [monitoringDetail, setMonitoringDetail] = useState<JobActualMonitoringDetail | null>(null);
  const [qcDetail, setQcDetail] = useState<{
    row: JobPlanRuntimeDisplayRow; history: QcInspectionRecord[]; loading: boolean; error: string | null;
  } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const sweetAlert = useSweetAlert();

  async function load() {
    const request = ++loadRequest.current;
    setIsLoading(true);
    const [result, actual] = await Promise.all([
      fetchJobPlanRuntimeList({ userId, view: "execution", date: dateFilter }),
      fetchJobActualRows(dateFilter),
    ]);
    if (request !== loadRequest.current) return;
    if (!result.success || !actual.rows) {
      setError(!result.success ? result.message : "Data aktual dan QC belum bisa dimuat. Coba muat ulang.");
      setIsLoading(false);
      return;
    }
    setItems(result.result.items);
    setCurrentActualRows(actual.rows);
    setError(null);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => {
      loadRequest.current += 1;
      qcRequest.current += 1;
      window.removeEventListener("focus", refresh);
    };
  }, [userId, dateFilter]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!draft && !reviewDraft) return;
      event.preventDefault();
      event.returnValue = "Ada perubahan yang belum disimpan.";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft, reviewDraft]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const baseRows = useMemo(() => toJobPlanRuntimeDisplayRows(items, countdowns, employees), [countdowns, employees, items]);
  const rows = useMemo(() => baseRows.map((row) => {
    const accumulatedWorkMinutes = liveJobPlanActualMinutes(row, nowTick);
    const unverifiedWorkMinutes = liveJobPlanUnverifiedMinutes(row, nowTick);
    if (accumulatedWorkMinutes === row.accumulatedWorkMinutes && unverifiedWorkMinutes === row.unverifiedWorkMinutes) return row;
    return { ...row, accumulatedWorkMinutes, unverifiedWorkMinutes, isLiveProjected: true };
  }), [baseRows, nowTick]);
  const actualByPlanId = useMemo(() => new Map(currentActualRows.map((row) => [row.planId, row])), [currentActualRows]);

  async function openQcDetail(row: JobPlanRuntimeDisplayRow) {
    const request = ++qcRequest.current;
    setDraft(null);
    setReviewDraft(null);
    setMonitoringDetail(null);
    setQcDetail({ row, history: [], loading: true, error: null });
    try {
      const result = await fetchQcDetail("", row.coreId);
      if (request !== qcRequest.current) return;
      setQcDetail({ row, history: result.payload?.data.history ?? [], loading: false,
        error: result.payload ? null : "Riwayat QC belum bisa dimuat. Coba lagi." });
    } catch {
      if (request === qcRequest.current) setQcDetail({ row, history: [], loading: false,
        error: "Riwayat QC belum bisa dimuat. Coba lagi." });
    }
  }
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (dateFilter && row.taskDate !== dateFilter) return false;
    if (kpFilter && row.kpId !== kpFilter) return false;
    if (qaFilter && !row.qaIds.includes(qaFilter)) return false;
    if (divisionFilter && row.divisionName !== divisionFilter) return false;
    if (statusFilter && row.executionState !== statusFilter && row.approvalState !== statusFilter) return false;
    return true;
  }), [dateFilter, divisionFilter, kpFilter, qaFilter, rows, statusFilter]);

  const kpOptions = useMemo(() => uniqueByValue(countdowns.map((item) => ({
    value: item.kpId ?? "",
    label: item.kpName ?? item.kpId ?? "",
  }))), [countdowns]);
  const qaOptions = useMemo(() => uniqueByValue(countdowns.flatMap((item) => (item.qaIds ?? []).map((value, index) => ({
    value,
    label: item.qaNames?.[index] ?? value,
  })))), [countdowns]);
  const divisionOptions = useMemo(() => uniqueByValue(rows.map((row) => ({
    value: row.divisionName,
    label: row.divisionName,
  }))), [rows]);
  const statusOptions = [
    ["DRAFT", "Draft"],
    ["DIVISION_REVIEW", "Review QA"],
    ["UNIT_REVIEW", "Review KP"],
    ["MANAGEMENT_REVIEW", "Review PM"],
    ["NOT_STARTED", "Plan"],
    ["RUNNING", "Berjalan"],
    ["HOLD", "Ditahan"],
    ["FINISHED_PENDING_VALIDATION", "Selesai"],
    ["VALIDATED", "Tervalidasi"],
  ] as const;
  const summaryItems = useMemo(() => [
    { label: "Siap Input", value: rows.filter((row) => row.approvalState === "APPROVED" && row.executionState === "NOT_STARTED").length },
    { label: "Menunggu QC / QA", value: rows.filter((row) => ["Menunggu QC", "QC_KD · Menunggu QA"].includes(qcStatus(row, row.planId ? actualByPlanId.get(row.planId) : undefined))).length, tone: "warn" as const },
    { label: "Lolos QC", value: rows.filter((row) => qcStatus(row, row.planId ? actualByPlanId.get(row.planId) : undefined) === "Lolos QC").length, tone: "up" as const },
  ], [rows, actualByPlanId]);

  const columnDefs = useMemo<ColDef<JobPlanRuntimeDisplayRow>[]>(() => [
    { headerName: "TEAM", field: "divisionName", minWidth: 125, pinned: "left" },
    { headerName: "PERSONIL", field: "employeeName", minWidth: 155, flex: 0.8 },
    { headerName: "NAMA UNIT", field: "unitName", minWidth: 120 },
    { headerName: "NAMA PANEL / PART", field: "panelName", minWidth: 160, flex: 0.9 },
    { headerName: "JOB DESCRIPTION", field: "jobDescription", minWidth: 220, flex: 1.1 },
    { headerName: "INTRUKSI", field: "instructionText", minWidth: 180, flex: 0.9 },
    { headerName: "PLAN START", field: "startTime", minWidth: 115 },
    { headerName: "PLAN FINISH", field: "finishTime", minWidth: 115 },
    { headerName: "ACTUAL START", minWidth: 125, valueGetter: ({ data }) => actualTimeText(data, data?.planId ? actualByPlanId.get(data.planId) : undefined, "start", nowTick) },
    { headerName: "ACTUAL FINISH", minWidth: 125, valueGetter: ({ data }) => actualTimeText(data, data?.planId ? actualByPlanId.get(data.planId) : undefined, "finish", nowTick) },
    {
      headerName: "DURASI AKTUAL",
      field: "accumulatedWorkMinutes",
      minWidth: 120,
      valueFormatter: ({ value }) => minutesToDuration(Number(value ?? 0)),
    },
    { headerName: "STATUS", minWidth: 115, valueGetter: ({ data }) => data ? actualWorkStatus(data) : "", cellRenderer: ({ data }: ICellRendererParams<JobPlanRuntimeDisplayRow>) => data ? <DataGridStatusBadge value={actualWorkStatus(data)} /> : null },
    { headerName: "PERSENTASE", minWidth: 115, valueGetter: ({ data }) => data ? actualProgressText(data, data.planId ? actualByPlanId.get(data.planId) : undefined) : "" },
    {
      headerName: "MONITORING",
      minWidth: 155,
      valueGetter: ({ data }) => data ? monitoringStatus(data) : "",
      cellRenderer: ({ data }: ICellRendererParams<JobPlanRuntimeDisplayRow>) => data ? (
        <button
          type="button"
          className="inline-flex h-full items-center"
          onClick={() => {
            setDraft(null);
            setReviewDraft(null);
            qcRequest.current += 1;
            setQcDetail(null);
            setMonitoringDetail({ row: data, actual: data.planId ? actualByPlanId.get(data.planId) : undefined });
          }}
        >
          <DataGridStatusBadge value={monitoringStatus(data)} />
        </button>
      ) : null,
    },
    { headerName: "QC", minWidth: 245, valueGetter: ({ data }) => data ? qcStatus(data, data.planId ? actualByPlanId.get(data.planId) : undefined) : "", cellRenderer: ({ data }: ICellRendererParams<JobPlanRuntimeDisplayRow>) => data ? (
      <button type="button" className="inline-flex h-full items-center" aria-label={`Lihat riwayat QC ${data.jobDescription}`} onClick={() => void openQcDetail(data)}>
        <DataGridStatusBadge value={qcStatus(data, data.planId ? actualByPlanId.get(data.planId) : undefined)} />
      </button>
    ) : null },
    {
      headerName: "CATATAN AKTUAL",
      minWidth: 180,
      flex: 0.8,
      wrapText: true,
      autoHeight: true,
      cellClass: noteCellClass,
      valueGetter: ({ data }) => data?.planId ? humanNote(actualByPlanId.get(data.planId)?.actualNote) : "",
    },
    {
      headerName: "CATATAN MONITORING",
      minWidth: 190,
      flex: 0.9,
      wrapText: true,
      autoHeight: true,
      cellClass: noteCellClass,
      valueGetter: ({ data }) => data?.planId ? humanNote(actualByPlanId.get(data.planId)?.actualMonitoringNote) : "",
    },
    {
      headerName: "CATATAN QC",
      minWidth: 170,
      flex: 0.8,
      wrapText: true,
      autoHeight: true,
      cellClass: noteCellClass,
      valueGetter: ({ data }) => data?.planId ? humanNote(actualByPlanId.get(data.planId)?.actualQcNote) : "",
    },
    {
      headerName: "AKSI",
      width: 230,
      pinned: "right",
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<JobPlanRuntimeDisplayRow>) => data ? (
        <div className="flex h-full items-center gap-1">
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canInput || !data.planId || !data.version} onClick={() => {
            setReviewDraft(null);
            setMonitoringDetail(null);
            setDraft(createActualDraft(data));
          }}>Input</button>
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canMonitor || !data.planId || !data.version || data.accumulatedWorkMinutes <= 0 || !canAddMonitoring(data, data.planId ? actualByPlanId.get(data.planId) : undefined)} onClick={() => {
            setDraft(null);
            setMonitoringDetail(null);
            setReviewDraft(createReviewDraft("monitor", data, data.planId ? actualByPlanId.get(data.planId) : undefined));
          }}>Monitor</button>
          <button type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" disabled={!canValidate || !data.planId || !data.version || data.accumulatedWorkMinutes <= 0} onClick={() => {
            setDraft(null);
            setMonitoringDetail(null);
            setReviewDraft(createReviewDraft("qc", data, data.planId ? actualByPlanId.get(data.planId) : undefined));
          }}>QC</button>
        </div>
      ) : null,
    },
  ], [actualByPlanId, canInput, canMonitor, canValidate, nowTick]);

  async function saveActual() {
    if (!draft || isSaving) return;
    const normalizedDraft = normalizeActualDraftTimes(draft);
    const message = validateManualExecutionDraft(normalizedDraft);
    if (message) {
      setDraft({ ...normalizedDraft, error: message });
      return;
    }
    setIsSaving(true);
    const result = await manualExecuteJobPlan(normalizedDraft.planId, buildManualExecutionJobPlanRuntimePayload(normalizedDraft, userId, createJobPlanCommandId("web-actual")));
    if (!result.success) {
      setDraft({ ...normalizedDraft, error: result.message });
      setError(result.message);
    } else {
      setDraft(null);
      setMonitoringDetail(null);
      await load();
    }
    setIsSaving(false);
  }

  async function saveReview() {
    if (!reviewDraft || isSaving) return;
    if (reviewDraft.action === "monitor") {
      const row = rows.find((item) => item.planId === reviewDraft.planId);
      const actual = row?.planId ? actualByPlanId.get(row.planId) : undefined;
      if (row && !canAddMonitoring(row, actual)) {
        setReviewDraft({ ...reviewDraft, error: "Monitoring sudah lengkap. Ubah data existing jika perlu koreksi." });
        return;
      }
    }
    const message = reviewDraft.action === "monitor" ? validateProgress(reviewDraft.progressText) : validateQcDraft(reviewDraft);
    if (message) {
      setReviewDraft({ ...reviewDraft, error: message });
      return;
    }
    const progress = Number(reviewDraft.progressText);
    const note = reviewDraft.noteText.trim() || null;
    setIsSaving(true);
    const input = {
      userId,
      commandId: createJobPlanCommandId(reviewDraft.action === "monitor" ? "web-monitor" : "web-qc"),
      expectedVersion: reviewDraft.expectedVersion,
      verifiedTotalMinutes: reviewDraft.verifiedMinutes,
      note,
    };
    let result: Awaited<ReturnType<typeof monitorJobPlan>> | Awaited<ReturnType<typeof passQc>> | Awaited<ReturnType<typeof rejectQc>>;
    if (reviewDraft.action === "monitor") {
      result = await monitorJobPlan(reviewDraft.planId, { ...input, progressSeen: progress });
    } else {
      const duration = optionalPositiveInteger(reviewDraft.qcDurationMinutesText, "Durasi QC").value;
      const photoBeforeUrl = optionalUrl(reviewDraft.qcPhotoBeforeUrl, "Foto QC 1").value;
      const evidencePhotoUrl = optionalUrl(reviewDraft.qcEvidencePhotoUrl, "Foto QC 2").value;
      const qcInput = {
        notes: reviewDraft.noteText.trim() || null,
        inspectionDurationMinutes: duration,
        photoBeforeUrl,
        evidencePhotoUrl,
      };
      if (reviewDraft.qcResult === "lolos") {
        result = await passQc(reviewDraft.coreId, qcInput);
      } else {
        result = await rejectQc(reviewDraft.coreId, {
          ...qcInput,
          reworkDate: reviewDraft.reworkDate.trim(),
          reworkAssignedUser: reviewDraft.reworkAssignedUser.trim(),
          reworkDailyHours: reviewDraft.reworkDailyHours.trim(),
          reworkStartTime: reviewDraft.reworkStartTime.trim() || null,
          reworkFinishTime: reviewDraft.reworkFinishTime.trim() || null,
          reworkDescription: reviewDraft.reworkDescription.trim() || note,
          reworkIsOvertime: reviewDraft.reworkIsOvertime,
          reworkIsPriority: reviewDraft.reworkIsPriority,
        });
      }
    }
    if (!result.success) {
      setReviewDraft({ ...reviewDraft, error: result.message });
      setError(result.message);
    } else {
      setReviewDraft(null);
      setMonitoringDetail(null);
    }
    await load();
    setIsSaving(false);
  }

  const monitoringDetailEntries = monitoringDetail
    ? monitoringHistoryEntries(monitoringDetail.row, monitoringDetail.actual, nowTick)
    : [];
  const monitoringDetailCanInput = monitoringDetail
    ? canAddMonitoring(monitoringDetail.row, monitoringDetail.actual)
    : false;

  return (
    <div className="space-y-3">
      {sweetAlert.alertElement}
      <div className="border border-border bg-card px-3 py-2 shadow-sm">
        <PageHeader
          eyebrow="JOB ACTUAL"
          title="Hasil Pekerjaan"
          actions={<p className="text-[11px] text-muted-foreground">{filteredRows.length} dari {rows.length} baris</p>}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summaryItems.map((item) => {
            const toneClass = item.tone === "warn"
              ? "text-app-accent-ink"
              : item.tone === "up"
                ? "text-success"
                : "text-foreground";
            return (
              <span key={item.label} className="border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                {item.label}: <strong className={`font-mono ${toneClass}`}>{item.value}</strong>
              </span>
            );
          })}
        </div>
      </div>

      <div className="relative z-40 flex flex-wrap items-end gap-2 border border-border bg-card px-3 py-2">
        <div className="min-w-[15.5rem] flex-1">
          <span className="text-[11px] text-muted-foreground">Tanggal</span>
          <CompactDateInput value={dateFilter} onChange={setDateFilter} className="mt-1" panelAlign="left" />
        </div>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          KP
          <select value={kpFilter} onChange={(event) => setKpFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua KP</option>
            {kpOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          QA
          <select value={qaFilter} onChange={(event) => setQaFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua QA</option>
            {qaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Divisi
          <select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua divisi</option>
            {divisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[8.5rem] flex-1 text-[11px] text-muted-foreground">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-8 w-full border border-border bg-background px-2 text-[12px] text-foreground">
            <option value="">Semua status</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <ActionButton onClick={() => {
          setDateFilter(initialDate ?? toLocalDateValue());
          setKpFilter("");
          setQaFilter("");
          setDivisionFilter("");
          setStatusFilter("");
        }}>Reset</ActionButton>
      </div>

      {error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {monitoringDetail ? (
        <div className="space-y-3 border border-border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Detail Monitoring</p>
              <h2 className="text-sm font-semibold text-foreground">{monitoringDetail.row.unitName} · {monitoringDetail.row.jobDescription}</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">{monitoringStatus(monitoringDetail.row)}</p>
            </div>
            <div className="flex gap-2">
              <ActionButton onClick={() => setMonitoringDetail(null)}>Tutup</ActionButton>
              <ActionButton
                variant="primary"
                disabled={!canMonitor || !monitoringDetail.row.planId || !monitoringDetail.row.version || monitoringDetail.row.accumulatedWorkMinutes <= 0 || !monitoringDetailCanInput}
                onClick={() => {
                  setDraft(null);
                  setReviewDraft(createReviewDraft(
                    "monitor",
                    monitoringDetail.row,
                    monitoringDetail.row.planId ? actualByPlanId.get(monitoringDetail.row.planId) : undefined,
                  ));
                  setMonitoringDetail(null);
                }}
              >
                Input Monitoring
              </ActionButton>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {monitoringDetailEntries.length > 0 ? monitoringDetailEntries.map((entry) => (
              <div key={entry.sequence} className="border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Monitoring {entry.sequence}</p>
                <p className="mt-1 font-mono text-sm text-foreground">{entry.text}</p>
              </div>
            )) : (
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Monitoring</p>
                <p className="mt-1 font-mono text-sm text-foreground">Belum ada</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {qcDetail ? (
        <section className="space-y-3 border border-border bg-card p-3" aria-label="Riwayat QC">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase text-muted-foreground">Riwayat QC</p>
              <h2 className="text-sm font-semibold text-foreground">{qcDetail.row.unitName} · {qcDetail.row.jobDescription}</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">{qcStatus(qcDetail.row, actualByPlanId.get(qcDetail.row.planId ?? ""))}</p>
            </div>
            <ActionButton onClick={() => { qcRequest.current += 1; setQcDetail(null); }}>Tutup</ActionButton>
          </div>
          {qcDetail.loading ? <p role="status" className="text-sm text-muted-foreground">Memuat riwayat QC...</p>
            : qcDetail.error ? <p role="alert" className="text-sm text-destructive">{qcDetail.error}</p>
            : qcDetail.history.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pemeriksaan QC.</p>
            : <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Daftar pemeriksaan QC">
              {qcDetail.history.map((entry) => (
                <article key={entry.qcId} className="w-[min(22rem,calc(100vw-3rem))] shrink-0 space-y-3 border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{entry.qcLevel === "QC_KD" ? "QC KD" : ["QC_QA", "QC_ADVISOR"].includes(entry.qcLevel ?? "") ? "QC QA" : entry.qcLevel ?? "QC"}</span>
                    <DataGridStatusBadge value={entry.resultStatus === "LOLOS" ? "Lolos" : "Tidak lolos"} />
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                    <dt className="text-muted-foreground">Waktu</dt>
                    <dd className="text-foreground">{timeOnly(entry.inspectionDate)}</dd>
                    <dt className="text-muted-foreground">Pemeriksa</dt>
                    <dd className="truncate text-foreground">{entry.inspectorName ?? entry.inspectorId ?? "Tidak tercatat"}</dd>
                    <dt className="text-muted-foreground">Durasi</dt>
                    <dd className="text-foreground">{entry.inspectionDurationMinutes == null ? "Tidak tercatat" : `${entry.inspectionDurationMinutes} menit`}</dd>
                  </dl>
                  {entry.notes ? <p className="border-t border-border pt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">{entry.notes}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {[entry.photoBeforeUrl, entry.evidencePhotoUrl].map((photo, index) => {
                      const url = optionalUrl(photo ?? "", "Foto QC").value;
                      const label = `Foto QC ${index + 1}`;
                      return url ? (
                        <button key={index} type="button" onClick={() => setPhotoPreview({ url, label })} className="block text-left text-[12px] text-app-accent" title={`Lihat ${label}`}>
                          <Image src={url} alt={label} width={120} height={80} unoptimized className="h-20 w-28 border border-border object-contain" />
                          <span className="mt-1 block">Foto {index + 1}</span>
                        </button>
                      ) : null;
                    })}
                  </div>
                </article>
              ))}
            </div>}
        </section>
      ) : null}

      {photoPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={photoPreview.label}>
          <div className="max-h-[90vh] w-full max-w-4xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{photoPreview.label}</p>
              <div className="flex gap-2">
                <a href={photoPreview.url} download target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center border border-primary/40 px-3 font-mono text-[12px] uppercase text-app-accent-ink hover:bg-primary/10">
                  Download
                </a>
                <ActionButton onClick={() => setPhotoPreview(null)}>Tutup</ActionButton>
              </div>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center overflow-auto bg-background">
              <Image src={photoPreview.url} alt={photoPreview.label} width={1200} height={800} unoptimized className="max-h-[78vh] w-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-3 border border-border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Input Hasil</p>
              <h2 className="text-sm font-semibold text-foreground">Jam kerja aktual, istirahat, status, dan persentase</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Durasi kerja: <span className="font-mono text-foreground">{minutesToDuration(manualExecutionDraftActualMinutes(draft).value ?? 0)}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <ActionButton onClick={() => setDraft(null)}>Batal</ActionButton>
              <ActionButton variant="primary" disabled={isSaving} onClick={() => void saveActual()}>{isSaving ? "Menyimpan..." : "Simpan Hasil"}</ActionButton>
            </div>
          </div>
          {draft.error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{draft.error}</p> : null}
          <div className="grid gap-2 md:grid-cols-5">
            <label className="text-[11px] text-muted-foreground">
              Jam mulai aktual
              <input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 8 atau 08:30"
                value={timeFromDateTime(draft.actualStart)}
                onChange={(event) => setDraft({ ...draft, actualStart: setDateTimeClock(draft.actualStart, event.target.value), error: null })}
                onBlur={() => {
                  const normalized = normalizeDateTimeClock(draft.actualStart, "Jam mulai aktual");
                  if (normalized) setDraft({ ...draft, actualStart: normalized, error: null });
                }}
                className={fieldClassName()}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Jam istirahat
              <input
                type="text"
                placeholder="00:00"
                value={draft.breakMinutesText}
                onChange={(event) => setDraft({ ...draft, breakMinutesText: event.target.value, error: null })}
                onBlur={(event) => {
                  const normalized = normalizeSmsDurationText(event.target.value, "Jam istirahat");
                  if (normalized.value) setDraft({ ...draft, breakMinutesText: normalized.value, error: null });
                }}
                className={fieldClassName()}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Jam selesai
              <input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 17 atau 17:00"
                value={timeFromDateTime(draft.actualFinish)}
                onChange={(event) => setDraft({ ...draft, actualFinish: setDateTimeClock(draft.actualFinish, event.target.value), error: null })}
                onBlur={() => {
                  const normalized = normalizeDateTimeClock(draft.actualFinish, "Jam selesai");
                  if (normalized) setDraft({ ...draft, actualFinish: normalized, error: null });
                }}
                className={fieldClassName()}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Status
              <select
                value={draft.status}
                onChange={(event) => {
                  const status = event.target.value as ActualProgressStatus;
                  setDraft({
                    ...draft,
                    status,
                    progressText: status === "done" ? "100" : draft.progressText,
                    error: null,
                  });
                }}
                className={fieldClassName()}
              >
                {Object.entries(progressStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Persentase
              <input
                type="number"
                min={0}
                max={100}
                value={draft.progressText}
                onChange={(event) => setDraft({
                  ...draft,
                  progressText: event.target.value,
                  status: event.target.value === "100" ? "done" : draft.status === "done" ? "on_progress" : draft.status,
                  error: null,
                })}
                className={fieldClassName()}
              />
            </label>
          </div>
        </div>
      ) : null}

      {reviewDraft ? (
        <div className="space-y-3 border border-border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {reviewDraft.action === "monitor" ? "Monitoring Progres" : "Validasi Final Task"}
              </p>
              <h2 className="text-sm font-semibold text-foreground">{reviewDraft.unitName} · {reviewDraft.jobDescription}</h2>
              {reviewDraft.action === "monitor" ? (
                <>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Jam kerja terverifikasi: <span className="font-mono text-foreground">{minutesToDuration(reviewDraft.verifiedMinutes)}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Jam monitoring dicatat otomatis saat disimpan: <span className="font-mono text-foreground">{timeFromDate(nowTick)}</span>
                  </p>
                </>
              ) : (
                <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
                  Isi hasil pengecekan seperti form QC mobile. Jika tidak lolos, sistem akan membuat rencana rework.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <ActionButton onClick={() => setReviewDraft(null)}>Batal</ActionButton>
              <ActionButton variant="primary" disabled={isSaving} onClick={() => void saveReview()}>
                {isSaving ? "Menyimpan..." : reviewDraft.action === "monitor" ? "Simpan Monitoring" : "Kirim Hasil QC"}
              </ActionButton>
            </div>
          </div>
          {reviewDraft.error ? <p className="border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{reviewDraft.error}</p> : null}
          {reviewDraft.action === "monitor" ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-[11px] text-muted-foreground">
                Progress pantauan (0-100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={reviewDraft.progressText}
                  onChange={(event) => setReviewDraft({
                    ...reviewDraft,
                    progressText: event.target.value,
                    error: null,
                  })}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Keterangan opsional
                <input
                  type="text"
                  value={reviewDraft.noteText}
                  onChange={(event) => setReviewDraft({ ...reviewDraft, noteText: event.target.value, error: null })}
                  placeholder="Contoh: hasil sesuai pantauan"
                  className={fieldClassName()}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-[11px] text-muted-foreground">
                  Hasil QC
                  <select
                    value={reviewDraft.qcResult}
                    onChange={(event) => setReviewDraft({
                      ...reviewDraft,
                      qcResult: event.target.value as QcResultDraft,
                      error: null,
                    })}
                    className={fieldClassName()}
                  >
                    <option value="lolos">Lolos QC</option>
                    <option value="tidak_lolos">Tidak Lolos QC</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Durasi QC (menit)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={reviewDraft.qcDurationMinutesText}
                    onChange={(event) => setReviewDraft({ ...reviewDraft, qcDurationMinutesText: event.target.value, error: null })}
                    className={fieldClassName()}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Panel
                  <input
                    type="text"
                    value={reviewDraft.panelName || "-"}
                    disabled
                    className="mt-1 h-9 w-full border border-border bg-muted/40 px-2 text-[12px] text-muted-foreground outline-none"
                  />
                </label>
              </div>

              <label className="block text-[11px] text-muted-foreground">
                Catatan QC
                <textarea
                  value={reviewDraft.noteText}
                  onChange={(event) => setReviewDraft({ ...reviewDraft, noteText: event.target.value, error: null })}
                  rows={3}
                  className="mt-1 w-full resize-none border border-border bg-background px-2 py-2 text-[12px] text-foreground outline-none focus:border-app-accent"
                />
              </label>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-[11px] text-muted-foreground">
                  Foto QC 1
                  <input
                    type="url"
                    value={reviewDraft.qcPhotoBeforeUrl}
                    onChange={(event) => setReviewDraft({ ...reviewDraft, qcPhotoBeforeUrl: event.target.value, error: null })}
                    placeholder="https://..."
                    className={fieldClassName()}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Foto QC 2
                  <input
                    type="url"
                    value={reviewDraft.qcEvidencePhotoUrl}
                    onChange={(event) => setReviewDraft({ ...reviewDraft, qcEvidencePhotoUrl: event.target.value, error: null })}
                    placeholder="https://..."
                    className={fieldClassName()}
                  />
                </label>
              </div>

              {reviewDraft.qcResult === "tidak_lolos" ? (
                <div className="space-y-3 border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-[12px] font-semibold text-destructive">Jadwal Pengerjaan Ulang</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-[11px] text-muted-foreground">
                      Tanggal
                      <input
                        type="date"
                        value={reviewDraft.reworkDate}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, reworkDate: event.target.value, error: null })}
                        className={fieldClassName()}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      PIC Rework
                      <select
                        value={reviewDraft.reworkAssignedUser}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, reworkAssignedUser: event.target.value, error: null })}
                        className={fieldClassName()}
                      >
                        <option value="">Pilih anggota</option>
                        {employees.map((employee) => (
                          <option key={employee.value} value={employee.value}>{employee.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Jam Rework Harian
                      <input
                        type="text"
                        value={reviewDraft.reworkDailyHours}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, reworkDailyHours: event.target.value, error: null })}
                        onBlur={(event) => {
                          const normalized = normalizeSmsDurationText(event.target.value, "Jam rework harian");
                          if (normalized.value) setReviewDraft({ ...reviewDraft, reworkDailyHours: normalized.value, error: null });
                        }}
                        placeholder="Contoh: 8 atau 08:00"
                        className={fieldClassName()}
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-[11px] text-muted-foreground">
                      Jam Mulai
                      <input
                        type="text"
                        inputMode="numeric"
                        value={reviewDraft.reworkStartTime}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, reworkStartTime: event.target.value, error: null })}
                        onBlur={(event) => {
                          const normalized = normalizeSmsTimeText(event.target.value, "Jam mulai rework");
                          if (normalized.value) setReviewDraft({ ...reviewDraft, reworkStartTime: normalized.value, error: null });
                        }}
                        placeholder="Contoh: 8 atau 08:30"
                        className={fieldClassName()}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Jam Selesai
                      <input
                        type="text"
                        inputMode="numeric"
                        value={reviewDraft.reworkFinishTime}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, reworkFinishTime: event.target.value, error: null })}
                        onBlur={(event) => {
                          const normalized = normalizeSmsTimeText(event.target.value, "Jam selesai rework");
                          if (normalized.value) setReviewDraft({ ...reviewDraft, reworkFinishTime: normalized.value, error: null });
                        }}
                        placeholder="Contoh: 17 atau 17:00"
                        className={fieldClassName()}
                      />
                    </label>
                    <div className="flex items-end gap-4 pb-2">
                      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={reviewDraft.reworkIsPriority}
                          onChange={(event) => setReviewDraft({ ...reviewDraft, reworkIsPriority: event.target.checked, error: null })}
                        />
                        Prioritas
                      </label>
                      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={reviewDraft.reworkIsOvertime}
                          onChange={(event) => setReviewDraft({ ...reviewDraft, reworkIsOvertime: event.target.checked, error: null })}
                        />
                        Lembur
                      </label>
                    </div>
                  </div>
                  <label className="block text-[11px] text-muted-foreground">
                    Deskripsi rework
                    <textarea
                      value={reviewDraft.reworkDescription}
                      onChange={(event) => setReviewDraft({ ...reviewDraft, reworkDescription: event.target.value, error: null })}
                      rows={2}
                      className="mt-1 w-full resize-none border border-border bg-background px-2 py-2 text-[12px] text-foreground outline-none focus:border-app-accent"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <SmsAgGrid<JobPlanRuntimeDisplayRow>
        heightClassName="h-[calc(100vh-330px)] min-h-[28rem]"
        rowData={filteredRows}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.clientId}
        loading={isLoading}
        defaultColDef={{ floatingFilter: true, filter: "agTextColumnFilter", filterParams: { trimInput: true, debounceMs: 150 } }}
        emptyMessage="Belum ada Job Actual."
      />
    </div>
  );
}
