import { env } from "@/config/env";

const COUNTDOWN_BASE = env.countdownUrl;
const JOB_PLAN_BASE = env.jobPlanUrl;

export interface CountdownUnit {
  carId: string;
  unitName: string;
  customerName: string | null;
  status: string;
  contractDeliveryDate: string | null;
  overallProgress: number;
}

export interface CountdownDivision {
  divisionId: string;
  divisionName: string;
  code: string | null;
  divisionProgress: number;
}

export interface CountdownSection {
  panelId: string;
  sectionName: string;
  section: string;
  totalJobdesc: number;
  totalRemainingHours: number;
  totalTargetHours: number;
  sectionProgress: number;
  sectionStatus: string;
}

export interface CountdownJobdesc {
  id: string;
  carId: string;
  unitName?: string;
  customerName?: string | null;
  divisionId: string;
  divisionName?: string;
  currentDivisionId: string | null;
  panelId?: string;
  panelName: string;
  sectionName: string;
  section?: string;
  contractDeliveryDate?: string | null;
  overallProgress?: number;
  jobName: string;
  taskCategory: string;
  status: string;
  progress: number;
  targetHoursRevised: number;
  remainingHours: number;
  deadlineDate: string | null;
  revisionRequestStatus: string | null;
  requestedRevisionHours: number | null;
  requestedRevisionDeadline: string | null;
  requestedRevisionReason: string | null;
  requestedRevisionByName: string | null;
  requestedRevisionAt: string | null;
  approvedRevisionHours: number | null;
  approvedRevisionDeadline: string | null;
  approvedRevisionByName: string | null;
  approvedRevisionAt: string | null;
  rejectedRevisionByName: string | null;
  rejectedRevisionAt: string | null;
  qcLastStatus: string | null;
  isLockedByOtherDivision: boolean;
}

export interface CountdownDetailItem {
  id: string;
  countdownId: string;
  employeeName: string;
  taskStatus: string;
  workDate: string | null;
  startTime: string;
  finishTime: string;
  billedHours: number;
  progressPercent: number;
}

export interface CountdownRevision {
  id: string;
  countdownId: string;
  carId: string;
  unitName: string;
  panelName: string;
  jobName: string;
  status: string;
  currentHours: number;
  currentDeadline: string | null;
  requestedHours: number;
  requestedDeadline: string | null;
  reason: string | null;
  requestedByName: string | null;
  requestedAt: string | null;
  approvedHours: number | null;
  approvedDeadline: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
}

export interface CountdownEmployeeOption {
  id: string;
  name: string;
  grade: string | null;
}

export interface CountdownDraftItem {
  sourceType: "COUNTDOWN";
  coreId: string;
  carId: string;
  divisionId: string;
  unitName: string;
  panelName: string;
  assignedUserId: string;
  assignedTo: string;
  jobDescription: string;
  targetHours: number;
  taskDate: string;
  startTime: string;
  finishTime: string;
  isOvertime: boolean;
  note: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toShortDate(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;
  if (raw.length >= 10) return raw.slice(0, 10);
  return raw;
}

function toTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.max(0, Math.floor(value));
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  const raw = asString(value, "08:00");
  if (raw.length >= 5) return raw.slice(0, 5);
  return raw;
}

async function readPayload<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const errorPayload = asRecord(json);
    throw new Error(
      asString(errorPayload.message || errorPayload.error, `Request failed (${response.status})`),
    );
  }
  const payload = asRecord(json);
  if ("data" in payload) {
    return payload.data as T;
  }
  return json as T;
}

async function fetchList(path: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${COUNTDOWN_BASE}${path}`, {
    cache: "no-store",
  });
  const payload = await readPayload<unknown>(response);
  return asArray<Record<string, unknown>>(payload);
}

function mapUnit(row: Record<string, unknown>): CountdownUnit {
  return {
    carId: asString(row.car_id),
    unitName: asString(row.unit_name, "-"),
    customerName: asNullableString(row.customer_name),
    status: asString(row.status, "PLAN"),
    contractDeliveryDate: toShortDate(row.contract_delivery_date),
    overallProgress: asNumber(row.overall_progress),
  };
}

function mapDivision(row: Record<string, unknown>): CountdownDivision {
  return {
    divisionId: asString(row.division_id),
    divisionName: asString(row.division_name, "-"),
    code: asNullableString(row.code),
    divisionProgress: asNumber(row.division_progress),
  };
}

function mapSection(row: Record<string, unknown>): CountdownSection {
  return {
    panelId: asString(row.panel_id),
    sectionName: asString(row.section_name, "-"),
    section: asString(row.section, "-"),
    totalJobdesc: asNumber(row.total_jobdesc),
    totalRemainingHours: asNumber(row.total_remaining_hours),
    totalTargetHours: asNumber(row.total_target_hours),
    sectionProgress: asNumber(row.section_progress),
    sectionStatus: asString(row.section_status, "PLAN"),
  };
}

function mapJobdesc(row: Record<string, unknown>, fallback: { carId: string; divisionId: string }): CountdownJobdesc {
  const divisionId = asString(row.division_id, fallback.divisionId);
  const currentDivisionId = asNullableString(row.current_division_id);
  const isLocked = asString(row.is_locked) === "1" || row.is_locked === true;

  return {
    id: asString(row.countdown_id),
    carId: asString(row.car_id, fallback.carId),
    divisionId,
    currentDivisionId,
    panelName: asString(row.panel_name, "-"),
    sectionName: asString(row.section_name, "-"),
    jobName: asString(row.job_name, "-"),
    taskCategory: asString(row.task_category, "MAIN"),
    status: asString(row.status, "PLAN"),
    progress: asNumber(row.progress),
    targetHoursRevised: asNumber(row.target_hours_revised),
    remainingHours: asNumber(row.remaining_hours),
    deadlineDate: toShortDate(row.deadline_date),
    revisionRequestStatus: asNullableString(row.extension_request_status || row.revision_request_status),
    requestedRevisionHours: row.requested_extension_hours == null
      ? null
      : asNumber(row.requested_extension_hours),
    requestedRevisionDeadline: toShortDate(row.requested_deadline || row.requested_revision_deadline),
    requestedRevisionReason: asNullableString(row.revision_reason || row.requested_revision_reason),
    requestedRevisionByName: asNullableString(row.requested_by_name || row.requested_revision_by_name),
    requestedRevisionAt: asNullableString(row.created_at || row.requested_revision_at),
    approvedRevisionHours: row.approved_extension_hours == null
      ? null
      : asNumber(row.approved_extension_hours),
    approvedRevisionDeadline: toShortDate(row.approved_deadline || row.approved_revision_deadline),
    approvedRevisionByName: asNullableString(row.approved_by_name || row.approved_revision_by_name),
    approvedRevisionAt: asNullableString(row.approved_at || row.approved_revision_at),
    rejectedRevisionByName: asNullableString(row.rejected_by_name || row.rejected_revision_by_name),
    rejectedRevisionAt: asNullableString(row.rejected_at || row.rejected_revision_at),
    qcLastStatus: asNullableString(row.qc_last_status || row.qcLastStatus),
    isLockedByOtherDivision: isLocked && !!currentDivisionId && currentDivisionId !== divisionId,
  };
}

function mapDetail(row: Record<string, unknown>): CountdownDetailItem {
  return {
    id: asString(row.detail_id),
    countdownId: asString(row.countdown_id),
    employeeName: asString(row.employee_name, "-"),
    taskStatus: asString(row.task_status, "-"),
    workDate: toShortDate(row.work_date),
    startTime: toTime(row.start_time),
    finishTime: toTime(row.finish_time),
    billedHours: asNumber(row.billed_hours),
    progressPercent: asNumber(row.progress_percent),
  };
}

function mapRevision(row: Record<string, unknown>): CountdownRevision {
  return {
    id: asString(row.countdown_id),
    countdownId: asString(row.countdown_id),
    carId: asString(row.car_id),
    unitName: asString(row.unit_name, "-"),
    panelName: asString(row.panel_name, "-"),
    jobName: asString(row.job_name, "-"),
    status: asString(row.status || row.revision_status, "REQUESTED").toUpperCase(),
    currentHours: asNumber(row.current_hours),
    currentDeadline: toShortDate(row.current_deadline),
    requestedHours: asNumber(row.requested_extension_hours),
    requestedDeadline: toShortDate(row.requested_deadline),
    reason: asNullableString(row.revision_reason),
    requestedByName: asNullableString(row.requested_by_name),
    requestedAt: asNullableString(row.created_at),
    approvedHours: row.approved_extension_hours == null
      ? null
      : asNumber(row.approved_extension_hours),
    approvedDeadline: toShortDate(row.approved_deadline),
    approvedByName: asNullableString(row.approved_by_name),
    approvedAt: asNullableString(row.approved_at),
    rejectedByName: asNullableString(row.rejected_by_name),
    rejectedAt: asNullableString(row.rejected_at),
  };
}

export async function getCountdownUnits(userId: string): Promise<CountdownUnit[]> {
  const query = new URLSearchParams({ user_id: userId });
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map(mapUnit);
}

export async function getCountdownDivisions(userId: string, carId: string): Promise<CountdownDivision[]> {
  const query = new URLSearchParams({
    user_id: userId,
    car_id: carId,
  });
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map(mapDivision);
}

export async function getCountdownSections(
  userId: string,
  carId: string,
  divisionId: string,
  options?: { search?: string; status?: string },
): Promise<CountdownSection[]> {
  const query = new URLSearchParams({
    user_id: userId,
    car_id: carId,
    division_id: divisionId,
  });
  if (options?.search) query.set("search", options.search);
  if (options?.status && options.status !== "all") {
    query.set("status", options.status === "qcready" ? "READY_QC" : options.status);
  }
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map(mapSection);
}

export async function getCountdownJobdescs(
  userId: string,
  carId: string,
  divisionId: string,
  panelId: string,
): Promise<CountdownJobdesc[]> {
  const query = new URLSearchParams({
    user_id: userId,
    car_id: carId,
    division_id: divisionId,
    panel_id: panelId,
  });
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map((row) => mapJobdesc(row, { carId, divisionId }));
}

export async function getCountdownTableRows(userId: string): Promise<CountdownJobdesc[]> {
  const units = await getCountdownUnits(userId);

  const divisionBatches = await Promise.all(
    units.map(async (unit) => ({
      unit,
      divisions: await getCountdownDivisions(userId, unit.carId),
    })),
  );

  const sectionBatches = await Promise.all(
    divisionBatches.flatMap(({ unit, divisions }) => (
      divisions.map(async (division) => ({
        unit,
        division,
        sections: await getCountdownSections(userId, unit.carId, division.divisionId),
      }))
    )),
  );

  const jobBatches = await Promise.all(
    sectionBatches.flatMap(({ unit, division, sections }) => (
      sections.map(async (section) => ({
        unit,
        division,
        section,
        jobs: await getCountdownJobdescs(userId, unit.carId, division.divisionId, section.panelId),
      }))
    )),
  );

  return jobBatches.flatMap(({ unit, division, section, jobs }) => (
    jobs.map((job) => ({
      ...job,
      unitName: unit.unitName,
      customerName: unit.customerName,
      divisionName: division.divisionName,
      panelId: section.panelId,
      sectionName: job.sectionName || section.sectionName,
      section: section.section,
      contractDeliveryDate: unit.contractDeliveryDate,
      overallProgress: unit.overallProgress,
    }))
  ));
}

export async function getCountdownDetails(userId: string, countdownId: string): Promise<CountdownDetailItem[]> {
  const query = new URLSearchParams({
    user_id: userId,
    countdown_id: countdownId,
  });
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map(mapDetail);
}

export async function getCountdownRevisions(userId: string): Promise<CountdownRevision[]> {
  const query = new URLSearchParams({
    user_id: userId,
    approvals: "true",
  });
  const rows = await fetchList(`/sm/countdown?${query}`);
  return rows.map(mapRevision);
}

export async function requestCountdownRevision(params: {
  userId: string;
  countdownId: string;
  requestedHours: number;
  requestedDeadline: string;
  reason: string;
}): Promise<void> {
  const response = await fetch(`${COUNTDOWN_BASE}/sm/countdown/revision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: params.userId,
      countdown_id: params.countdownId,
      requested_hours: params.requestedHours,
      requested_deadline: params.requestedDeadline,
      reason: params.reason,
    }),
  });
  await readPayload(response);
}

export async function processCountdownRevision(params: {
  userId: string;
  countdownId: string;
  approved: boolean;
  approvedHours: number;
  approvedDeadline: string | null;
}): Promise<void> {
  const response = await fetch(`${COUNTDOWN_BASE}/sm/countdown/action`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "submit_approval",
      user_id: params.userId,
      countdown_id: params.countdownId,
      is_approved: params.approved,
      approved_hours: params.approvedHours,
      approved_deadline: params.approvedDeadline,
    }),
  });
  await readPayload(response);
}

export async function markCountdownQcReady(params: {
  userId: string;
  countdownId: string;
}): Promise<void> {
  const response = await fetch(`${COUNTDOWN_BASE}/sm/countdown/action`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "mark_qc_ready",
      user_id: params.userId,
      countdown_id: params.countdownId,
    }),
  });
  await readPayload(response);
}

export async function getCountdownPlanAssignees(divisionId: string): Promise<CountdownEmployeeOption[]> {
  const query = new URLSearchParams();
  if (divisionId) query.set("divisionId", divisionId);
  const response = await fetch(`${JOB_PLAN_BASE}/sm/job-plans/dropdowns?${query}`, {
    cache: "no-store",
  });
  const payload = await readPayload<unknown>(response);
  const users = asArray<Record<string, unknown>>(asRecord(payload).users);

  return users
    .map((user) => ({
      id: asString(user.id),
      name: asString(user.name || user.full_name, "-"),
      grade: asNullableString(user.grade || user.jabatan),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveCountdownPlanDraft(params: {
  userId: string;
  items: CountdownDraftItem[];
  note?: string;
}): Promise<void> {
  const response = await fetch(`${JOB_PLAN_BASE}/sm/job-plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "save_draft",
      userId: params.userId,
      sourceType: "COUNTDOWN",
      note: params.note,
      items: params.items,
    }),
  });
  await readPayload(response);
}
