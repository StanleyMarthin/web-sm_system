import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CountdownBoardRow,
  CountdownCreateRequest,
  CountdownDetail,
  CountdownImportResult,
  CountdownRevisionDecision,
  CountdownRevisionRequest,
  CountdownTemplateRow,
} from "@smsystem/contracts/countdown";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { getMySqlPool } from "@/db/mysql";
import type { CountdownGridQuery } from "@/services/countdown/query";
import { _build_workday_alias } from "@/services/workday-alias";

interface CountdownBoardRowPacket extends RowDataPacket {
  countdownId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  panelName: string | null;
  sectionName: string | null;
  taskCategory: string;
  prerequisiteCoreId: string | null;
  refWoId: string | null;
  note: string | null;
  temuanAwal: string | null;
  keterangan: string | null;
  jobTypeId: string | null;
  jobTypeName: string | null;
  targetHoursInitial: number;
  timeExtensionHours: number;
  targetHoursRevised: number;
  totalActualHours: number;
  remainingHours: number;
  actualProgressPercent: number;
  status: string;
  extensionRequestStatus: "REQUESTED" | "MO_REVIEW" | "APPROVED" | "REJECTED" | null;
  requestedExtensionHours: number;
  requestedDeadline: string | null;
  revisionReason: string | null;
  countRevision: number;
  startDate: string | null;
  deadlineDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isOverdue: number | boolean;
}

interface CountdownDetailRowPacket extends RowDataPacket {
  countdownId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  panelName: string | null;
  sectionName: string | null;
  taskCategory: string;
  prerequisiteCoreId: string | null;
  refWoId: string | null;
  note: string | null;
  temuanAwal: string | null;
  keterangan: string | null;
  jobTypeId: string | null;
  jobTypeName: string | null;
  targetHoursInitial: number;
  timeExtensionHours: number;
  targetHoursRevised: number;
  totalActualHours: number;
  remainingHours: number;
  actualProgressPercent: number;
  status: string;
  extensionRequestStatus: "REQUESTED" | "MO_REVIEW" | "APPROVED" | "REJECTED" | null;
  requestedExtensionHours: number;
  requestedDeadline: string | null;
  revisionReason: string | null;
  countRevision: number;
  startDate: string | null;
  deadlineDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isOverdue: number | boolean;
}

interface CountdownEntryRowPacket extends RowDataPacket {
  detailId: string;
  actualId: string | null;
  entryType: string;
  employeeId: string | null;
  employeeName: string;
  employeeRole: string | null;
  workDate: string;
  startTime: string;
  finishTime: string;
  billedHours: number;
  progressPercent: number;
  taskStatus: string;
  dailyNotes: string | null;
}

interface CountdownEntryPhotoRowPacket extends RowDataPacket {
  actualId: string;
  photoId: string;
  type: "BEFORE" | "PROCESS" | "AFTER" | "DEFECT";
  url: string;
  caption: string | null;
  uploader: string | null;
  time: string;
}

interface CountdownMetaRowPacket extends RowDataPacket {
  total: number;
}

interface CountdownRevisionRowPacket extends RowDataPacket {
  countdownId: string;
  carId: string;
  divisionId: number;
  status: string;
  extensionRequestStatus: string | null;
  timeExtensionHours: number;
  targetHoursInitial: number;
  targetHours: number | null;
  targetHoursRevised: number | null;
  totalActualHours: number;
  deadlineDate: string | null;
  picPlan: string | null;
  requiredGrade: string | null;
  revisionReason: string | null;
}

interface ValidationPacket extends RowDataPacket {
  id: string;
}

interface ReferenceOptionRow extends RowDataPacket {
  value: string | number;
  label: string;
  carId?: string | null;
  section?: string | null;
  category?: string | null;
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

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface CountdownBoardParams extends ScopeParams {
  query: CountdownGridQuery;
}

interface ImportRowInput extends CountdownTemplateRow {
  rowNumber: number;
}

export interface CountdownReferenceOptions {
  divisions: Array<{
    label: string;
    value: string;
    code?: string | null;
    parentId?: number | null;
    parentName?: string | null;
    parentCode?: string | null;
  }>;
  units: Array<{ label: string; value: string }>;
  panels: Array<{
    label: string;
    value: string;
    carId?: string | null;
    section?: string | null;
    category?: string | null;
  }>;
  sections?: Array<{ label: string; value: string }>;
  jobTypes: Array<{
    label: string;
    value: string;
    divisionId?: number | null;
    divisionName?: string | null;
    divisionParentId?: number | null;
    divisionParentName?: string | null;
    divisionParentCode?: string | null;
  }>;
  taskCategories?: Array<{ label: string; value: string }>;
}

function toBoolean(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function toStringValue(value: unknown, fallback = ""): string {
  const text = toNullableString(value);
  return text ?? fallback;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  alias = "cd",
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [];

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ${alias}.car_id
          AND cpa_scope.ended_at IS NULL
          AND (
            cpa_scope.kp_id = ?
            OR cpa_scope.advisor_id = ?
            OR cpa_scope.kd_id = ?
          )
      )`,
    );
    params.push(employeeId, employeeId, employeeId);
  }

  if (scope.divisionIds.length > 0) {
    clauses.push(
      `(
        ${alias}.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
        OR EXISTS (
          SELECT 1
          FROM sm_divisi selected_division
          WHERE selected_division.id IN (${scope.divisionIds.map(() => "?").join(", ")})
            AND selected_division.parent_id = ${alias}.division_id
        )
      )`,
    );
    params.push(...scope.divisionIds, ...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    params.push(...scope.unitIds);
    clauses.push(`${alias}.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildFilterClauses(query: CountdownGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        c.unit_name LIKE ?
        OR COALESCE(c.customer_name, '') LIKE ?
        OR COALESCE(cd.section_name, '') LIKE ?
        OR COALESCE(mp.component_name, '') LIKE ?
        OR COALESCE(mp.panel_name, '') LIKE ?
        OR COALESCE(mp.name_part, '') LIKE ?
        OR COALESCE(mjt.job_name, '') LIKE ?
        OR COALESCE(cd.temuan_awal, '') LIKE ?
        OR COALESCE(cd.keterangan, '') LIKE ?
        OR COALESCE(cd.task_category, '') LIKE ?
        OR COALESCE(cd.status, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value, value, value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("cd.status = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "taskCategory") {
      clauses.push("cd.task_category = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "divisionId") {
      clauses.push(`(
        cd.division_id = ?
        OR EXISTS (
          SELECT 1
          FROM sm_divisi selected_division
          WHERE selected_division.id = ?
            AND selected_division.parent_id = cd.division_id
        )
      )`);
      params.push(filter.value, filter.value);
      continue;
    }

    if (filter.field === "unitId") {
      clauses.push("cd.car_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "panelId") {
      const panelId = Number.parseInt(filter.value, 10);
      if (Number.isFinite(panelId) && panelId > 0) {
        clauses.push("cd.panel_id = ?");
        params.push(panelId);
      }
      continue;
    }

    if (filter.field === "sectionName") {
      clauses.push("cd.section_name LIKE ?");
      params.push(`%${filter.value}%`);
      continue;
    }

    if (filter.field === "jobTypeId") {
      clauses.push("cd.job_type_id = ?");
      params.push(filter.value);
      continue;
    }
  }

  return clauses;
}

function mapReferenceOption(row: ReferenceOptionRow): { label: string; value: string } {
  return {
    label: String(row.label),
    value: String(row.value),
  };
}

function mapPanelReference(row: ReferenceOptionRow): CountdownReferenceOptions["panels"][number] {
  return {
    label: String(row.label),
    value: String(row.value),
    carId: row.carId ?? null,
    section: row.section ?? null,
    category: row.category ?? null,
  };
}

function mapDivisionReference(row: ReferenceOptionRow): CountdownReferenceOptions["divisions"][number] {
  return {
    label: String(row.label),
    value: String(row.value),
    code: row.code ?? null,
    parentId: row.parentId ?? null,
    parentName: row.parentName ?? null,
    parentCode: row.parentCode ?? null,
  };
}

function mapJobTypeReference(row: ReferenceOptionRow): CountdownReferenceOptions["jobTypes"][number] {
  return {
    label: String(row.label),
    value: String(row.value),
    divisionId: row.divisionId ?? null,
    divisionName: row.divisionName ?? null,
    divisionParentId: row.divisionParentId ?? null,
    divisionParentName: row.divisionParentName ?? null,
    divisionParentCode: row.divisionParentCode ?? null,
  };
}

async function checkAllowedJobType(
  connection: Pick<PoolConnection, "query">,
  jobTypeId: string,
  divisionId: number,
): Promise<boolean> {
  const [rows] = await connection.query<ValidationPacket[]>(
    `
      SELECT mjt.id
      FROM master_job_types mjt
      LEFT JOIN sm_divisi selected_division ON selected_division.id = ?
      WHERE mjt.id = ?
        AND (
          mjt.division_id IS NULL
          OR mjt.division_id = ?
          OR mjt.division_id = selected_division.parent_id
        )
      LIMIT 1
    `,
    [divisionId, jobTypeId, divisionId],
  );

  return rows.length > 0;
}

async function resolveWorkDivisionId(
  connection: Pick<PoolConnection, "query">,
  divisionId: number,
): Promise<number> {
  const [rows] = await connection.query<Array<RowDataPacket & { workDivisionId: number }>>(
    `
      SELECT COALESCE(parent_id, id) AS workDivisionId
      FROM sm_divisi
      WHERE id = ?
      LIMIT 1
    `,
    [divisionId],
  );

  return rows[0]?.workDivisionId ?? divisionId;
}

function buildOrderBy(sortBy: CountdownGridQuery["sortBy"], direction: "asc" | "desc"): string {
  const columnMap: Record<CountdownGridQuery["sortBy"], string> = {
    updatedAt: "cd.updated_at",
    createdAt: "cd.created_at",
    unitName: "c.unit_name",
    divisionName: "sd.name",
    sectionName: "cd.section_name",
    taskCategory: "cd.task_category",
    status: "cd.status",
    deadlineDate: "cd.deadline_date",
    remainingHours: "COALESCE(cd.remaining_hours, 0)",
    actualProgressPercent: "COALESCE(cd.actual_progress_percent, 0)",
  };

  return `${columnMap[sortBy]} ${direction.toUpperCase()}, c.unit_name ASC, cd.updated_at DESC`;
}

function countdownFromSql(): string {
  return `
    FROM sm_jobdesc_countdown cd
    JOIN cars c ON c.id = cd.car_id
    LEFT JOIN sm_divisi sd ON sd.id = cd.division_id
    LEFT JOIN master_panels mp ON mp.id = cd.panel_id
    LEFT JOIN master_job_types mjt ON mjt.id = cd.job_type_id
  `;
}

function countdownSelectSql(): string {
  return `
    SELECT
      cd.id AS countdownId,
      cd.car_id AS carId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      cd.division_id AS divisionId,
      sd.name AS divisionName,
      cd.panel_id AS panelId,
      COALESCE(mp.panel_name, mp.name_part) AS panelName,
      cd.section_name AS sectionName,
      cd.task_category AS taskCategory,
      cd.prerequisite_core_id AS prerequisiteCoreId,
      cd.ref_taks_id AS refWoId,
      cd.revision_reason AS note,
      cd.temuan_awal AS temuanAwal,
      cd.keterangan AS keterangan,
      cd.job_type_id AS jobTypeId,
      COALESCE(mjt.job_name, cd.section_name) AS jobTypeName,
      ROUND(COALESCE(cd.target_hours_initial, 0), 2) AS targetHoursInitial,
      ROUND(COALESCE(cd.time_extension_hours, 0), 2) AS timeExtensionHours,
      ROUND(COALESCE(cd.target_hours_revised, cd.target_hours_initial + cd.time_extension_hours, cd.target_hours_initial), 2) AS targetHoursRevised,
      ROUND(COALESCE(cd.total_actual_hours, 0), 2) AS totalActualHours,
      ROUND(COALESCE(cd.remaining_hours, GREATEST(COALESCE(cd.target_hours_revised, cd.target_hours_initial + cd.time_extension_hours, cd.target_hours_initial) - COALESCE(cd.total_actual_hours, 0), 0)), 2) AS remainingHours,
      ROUND(COALESCE(cd.actual_progress_percent, 0), 2) AS actualProgressPercent,
      COALESCE(cd.status, 'PLAN') AS status,
      cd.extension_request_status AS extensionRequestStatus,
      ROUND(COALESCE(cd.requested_extension_hours, 0), 2) AS requestedExtensionHours,
      DATE_FORMAT(cd.requested_deadline, '%Y-%m-%d') AS requestedDeadline,
      cd.revision_reason AS revisionReason,
      COALESCE(cd.count_revisi, 0) AS countRevision,
      DATE_FORMAT(cd.start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(cd.deadline_date, '%Y-%m-%d') AS deadlineDate,
      DATE_FORMAT(cd.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(cd.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
      CASE
        WHEN cd.deadline_date IS NOT NULL AND cd.deadline_date < CURDATE() AND COALESCE(cd.status, 'PLAN') <> 'DONE' THEN 1
        ELSE 0
      END AS isOverdue
    ${countdownFromSql()}
  `;
}

function mapCountdownBoardRow(row: CountdownBoardRowPacket): CountdownBoardRow {
  return {
    countdownId: row.countdownId,
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    panelId: row.panelId,
    panelName: row.panelName,
    sectionName: row.sectionName,
    taskCategory: row.taskCategory,
    prerequisiteCoreId: row.prerequisiteCoreId,
    refWoId: row.refWoId,
    note: row.note,
    temuanAwal: row.temuanAwal,
    keterangan: row.keterangan,
    jobTypeId: row.jobTypeId,
    jobTypeName: row.jobTypeName,
    targetHoursInitial: Number(row.targetHoursInitial ?? 0),
    timeExtensionHours: Number(row.timeExtensionHours ?? 0),
    targetHoursRevised: Number(row.targetHoursRevised ?? 0),
    totalActualHours: Number(row.totalActualHours ?? 0),
    remainingHours: Number(row.remainingHours ?? 0),
    workdayAlias: _build_workday_alias(Number(row.remainingHours ?? 0)),
    actualProgressPercent: Number(row.actualProgressPercent ?? 0),
    status: row.status,
    extensionRequestStatus: row.extensionRequestStatus,
    requestedExtensionHours: Number(row.requestedExtensionHours ?? 0),
    requestedDeadline: row.requestedDeadline,
    revisionReason: row.revisionReason,
    countRevision: Number(row.countRevision ?? 0),
    startDate: row.startDate,
    deadlineDate: row.deadlineDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOverdue: toBoolean(row.isOverdue),
  };
}

function mapCountdownDetailRow(
  row: CountdownDetailRowPacket,
  details: CountdownEntryRowPacket[],
  photos: CountdownEntryPhotoRowPacket[],
): CountdownDetail {
  const photosByActualId = new Map<string, CountdownEntryPhotoRowPacket[]>();
  for (const photo of photos) {
    photosByActualId.set(photo.actualId, [...(photosByActualId.get(photo.actualId) ?? []), photo]);
  }
  return {
    ...mapCountdownBoardRow(row),
    details: details.map((detail) => ({
      detailId: detail.detailId,
      actualId: detail.actualId,
      entryType: detail.entryType,
      employeeId: detail.employeeId,
      employeeName: detail.employeeName,
      employeeRole: detail.employeeRole,
      workDate: detail.workDate,
      startTime: detail.startTime,
      finishTime: detail.finishTime,
      billedHours: Number(detail.billedHours ?? 0),
      progressPercent: Number(detail.progressPercent ?? 0),
      taskStatus: detail.taskStatus,
      dailyNotes: detail.dailyNotes,
      photos: (detail.actualId ? photosByActualId.get(detail.actualId) : undefined)?.map((photo) => ({
        photoId: photo.photoId,
        type: photo.type,
        url: photo.url,
        caption: photo.caption,
        uploader: photo.uploader,
        time: photo.time,
      })) ?? [],
    })),
  };
}

function mapImportIssue(rowNumber: number, field: string, message: string, value: unknown) {
  return {
    rowNumber,
    field,
    message,
    value: toNullableString(value),
  };
}

function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = Math.round(value * 24 * 60 * 60 * 1000);
    return new Date(excelEpoch.getTime() + millis).toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalized = text.replaceAll("/", "-");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    return normalized;
  }

  return null;
}

async function checkExists(
  connection: PoolConnection,
  sql: string,
  params: unknown[],
): Promise<boolean> {
  const [rows] = await connection.query<ValidationPacket[]>(sql, params);
  return rows.length > 0;
}

async function hasImportScopeAccess(
  connection: PoolConnection,
  scope: AuthScope,
  employeeId: string,
  carId: string,
  divisionId: number,
): Promise<boolean> {
  if (scope.canViewAllUnits) {
    return true;
  }

  if (scope.unitIds.includes(carId)) {
    return true;
  }

  if (scope.divisionIds.includes(divisionId)) {
    return true;
  }

  if (scope.divisionIds.length > 0) {
    const [rows] = await connection.query<ValidationPacket[]>(
      `SELECT id FROM sm_divisi
       WHERE id IN (${scope.divisionIds.map(() => "?").join(", ")})
         AND parent_id = ?
       LIMIT 1`,
      [...scope.divisionIds, divisionId],
    );
    if (rows.length > 0) {
      return true;
    }
  }

  if (!scope.canViewAssignedUnits) {
    return false;
  }

  const [rows] = await connection.query<ValidationPacket[]>(
    `
      SELECT cpa_scope.car_id AS id
      FROM car_project_assignment cpa_scope
      WHERE cpa_scope.car_id = ?
        AND cpa_scope.ended_at IS NULL
        AND (
          cpa_scope.kp_id = ?
          OR cpa_scope.advisor_id = ?
          OR cpa_scope.kd_id = ?
        )
      LIMIT 1
    `,
    [carId, employeeId, employeeId, employeeId],
  );

  return rows.length > 0;
}

interface NormalizedCountdownMutationInput {
  carId: string;
  divisionId: number;
  panelId: number | null;
  taskCategory: "MAIN" | "ADDITIONAL" | "WO" | "WOV";
  sectionName: string;
  jobTypeId: string | null;
  targetHoursInitial: number;
  startDate: string | null;
  deadlineDate: string;
  prerequisiteCoreId: string | null;
  refWoId: string | null;
  note: string | null;
  temuanAwal: string | null;
  keterangan: string | null;
  status: "PLAN" | "PROSES" | "QC_READY" | "DONE";
}

const ALLOWED_TASK_CATEGORIES = ["MAIN", "ADDITIONAL", "WO", "WOV"] as const;
const ALLOWED_STATUSES = ["PLAN", "PROSES", "QC_READY", "DONE"] as const;
const COUNTDOWN_CORRECTION_REASONS = new Set(["INPUT_ERROR", "WRONG_TARGET", "WRONG_PIC", "WRONG_DEADLINE", "SYSTEM_CORRECTION"]);
const COUNTDOWN_ALLOWED_REVISION_REASONS = new Set([
  "TARGET_NOT_ACHIEVED",
  "ADDITIONAL_DAMAGE",
  "SCOPE_CHANGE",
  "TECHNICAL_CONSTRAINT",
  "WAITING_SUPPORT",
  "PIC_CHANGE",
  "QC_REWORK",
  "FINISHED_EARLY",
  "SCOPE_REDUCED",
  "WORK_SIMPLIFIED",
  "INPUT_ERROR",
  "WRONG_TARGET",
  "WRONG_PIC",
  "WRONG_DEADLINE",
  "SYSTEM_CORRECTION",
  "OTHER",
]);

function normalizeCountdownRevisionReason(reason: string | null | undefined): string {
  const code = String(reason ?? "").trim().toUpperCase();
  return COUNTDOWN_ALLOWED_REVISION_REASONS.has(code) ? code : "OTHER";
}

function classifyCountdownRevision(
  oldTarget: number | null,
  newTarget: number | null,
  reasonCode: string,
): "EXTENSION" | "REDUCTION" | "CORRECTION" {
  if (COUNTDOWN_CORRECTION_REASONS.has(reasonCode)) return "CORRECTION";
  if (oldTarget !== null && newTarget !== null) {
    if (newTarget > oldTarget) return "EXTENSION";
    if (newTarget < oldTarget) return "REDUCTION";
  }
  return "CORRECTION";
}

function currentCountdownTarget(row: {
  targetHours?: number | null;
  targetHoursRevised?: number | null;
  targetHoursInitial?: number | null;
  timeExtensionHours?: number | null;
}): number | null {
  const candidates = [
    row.targetHours,
    row.targetHoursRevised,
    Number(row.targetHoursInitial ?? 0) + Number(row.timeExtensionHours ?? 0),
    row.targetHoursInitial,
  ];
  const value = candidates.find((candidate) => candidate !== null && candidate !== undefined && Number.isFinite(Number(candidate)));
  return value === undefined ? null : Number(value);
}

async function insertCountdownRevision(
  connection: PoolConnection,
  params: {
    countdownId: string;
    oldTargetHours: number | null;
    newTargetHours: number | null;
    oldDeadlineDate: string | null;
    newDeadlineDate: string | null;
    oldPicPlan: string | null;
    newPicPlan: string | null;
    oldRequiredGrade: string | null;
    newRequiredGrade: string | null;
    reasonCode: string;
    reasonDetail: string | null;
    referenceType: string | null;
    referenceId: string | null;
    changedBy: string;
  },
): Promise<void> {
  const delta = params.oldTargetHours !== null && params.newTargetHours !== null
    ? params.newTargetHours - params.oldTargetHours
    : null;
  await connection.execute(
    `INSERT INTO sm_jobdesc_countdown_revisions (
       countdown_id, revision_type, reason_code,
       old_target_hours, new_target_hours, delta_hours,
       old_deadline_date, new_deadline_date,
       old_pic_plan, new_pic_plan,
       old_required_grade, new_required_grade,
       reference_type, reference_id, reason_detail, changed_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.countdownId,
      classifyCountdownRevision(params.oldTargetHours, params.newTargetHours, params.reasonCode),
      params.reasonCode,
      params.oldTargetHours,
      params.newTargetHours,
      delta,
      params.oldDeadlineDate,
      params.newDeadlineDate,
      params.oldPicPlan,
      params.newPicPlan,
      params.oldRequiredGrade,
      params.newRequiredGrade,
      params.referenceType,
      params.referenceId,
      params.reasonDetail,
      params.changedBy,
    ],
  );
}

async function normalizeAndValidateCountdownMutation(
  connection: PoolConnection,
  params: ScopeParams,
  input: CountdownCreateRequest,
): Promise<NormalizedCountdownMutationInput> {
  const carId = toStringValue(input.carId).trim();
  const divisionId = toNumber(input.divisionId, Number.NaN);
  const panelIdRaw = input.panelId;
  const panelId = panelIdRaw === undefined || panelIdRaw === null
    ? null
    : toNumber(panelIdRaw, Number.NaN);
  const taskCategory = toStringValue(
    input.taskCategory ?? "ADDITIONAL",
  ).toUpperCase();
  const sectionName = toStringValue(input.sectionName);
  const jobTypeId = toNullableString(input.jobTypeId);
  const targetHoursInitial = toNumber(
    input.targetHoursInitial,
    Number.NaN,
  );
  const startDate = toIsoDate(input.startDate ?? null);
  const deadlineDate = toIsoDate(input.deadlineDate ?? null);
  const prerequisiteCoreId = toNullableString(input.prerequisiteCoreId);
  const refWoId = toNullableString(input.refWoId);
  const note = toNullableString(input.note);
  const temuanAwal = toNullableString(input.temuanAwal);
  const keterangan = toNullableString(input.keterangan);
  const status = toStringValue(input.status ?? "PLAN").toUpperCase();

  if (!carId) {
    throw new Error("COUNTDOWN_CAR_REQUIRED");
  }

  if (!Number.isFinite(divisionId) || divisionId <= 0) {
    throw new Error("COUNTDOWN_DIVISION_REQUIRED");
  }

  if (!sectionName) {
    throw new Error("COUNTDOWN_SECTION_REQUIRED");
  }

  if (!Number.isFinite(targetHoursInitial) || targetHoursInitial < 0) {
    throw new Error("COUNTDOWN_TARGET_HOURS_INVALID");
  }

  if (!deadlineDate) {
    throw new Error("COUNTDOWN_DEADLINE_INVALID");
  }

  if (!ALLOWED_TASK_CATEGORIES.includes(taskCategory as (typeof ALLOWED_TASK_CATEGORIES)[number])) {
    throw new Error("COUNTDOWN_TASK_CATEGORY_INVALID");
  }

  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    throw new Error("COUNTDOWN_STATUS_INVALID");
  }

  if (panelId !== null && (!Number.isFinite(panelId) || panelId <= 0)) {
    throw new Error("COUNTDOWN_PANEL_INVALID");
  }

  const validUnit = await checkExists(
    connection,
    "SELECT id FROM cars WHERE id = ? LIMIT 1",
    [carId],
  );
  if (!validUnit) {
    throw new Error("COUNTDOWN_CAR_NOT_FOUND");
  }

  const validDivision = await checkExists(
    connection,
    "SELECT id FROM sm_divisi WHERE id = ? LIMIT 1",
    [divisionId],
  );
  if (!validDivision) {
    throw new Error("COUNTDOWN_DIVISION_NOT_FOUND");
  }

  const scoped = await hasImportScopeAccess(
    connection,
    params.scope,
    params.employeeId,
    carId,
    divisionId,
  );
  if (!scoped) {
    throw new Error("SCOPE_FORBIDDEN");
  }

  if (panelId !== null) {
    const validPanel = await checkExists(
      connection,
      "SELECT id FROM master_panels WHERE id = ? AND (car_id IS NULL OR car_id = ?) LIMIT 1",
      [panelId, carId],
    );
    if (!validPanel) {
      throw new Error("COUNTDOWN_PANEL_NOT_FOUND");
    }
  }

  if (jobTypeId) {
    const validJobType = await checkAllowedJobType(connection, jobTypeId, divisionId);
    if (!validJobType) {
      throw new Error("COUNTDOWN_JOB_TYPE_NOT_FOUND");
    }
  }

  const workDivisionId = await resolveWorkDivisionId(connection, divisionId);

  if (prerequisiteCoreId) {
    const prerequisiteExists = await checkExists(
      connection,
      "SELECT id FROM sm_jobdesc_countdown WHERE id = ? LIMIT 1",
      [prerequisiteCoreId],
    );
    if (!prerequisiteExists) {
      throw new Error("COUNTDOWN_PREREQUISITE_NOT_FOUND");
    }
  }

  if (refWoId) {
    const refWoExists = await checkExists(
      connection,
      "SELECT id FROM sm_jobdesc_wo WHERE id = ? LIMIT 1",
      [refWoId],
    );
    if (!refWoExists) {
      throw new Error("COUNTDOWN_REF_WO_NOT_FOUND");
    }
  }

  return {
    carId,
    divisionId: workDivisionId,
    panelId,
    taskCategory: taskCategory as NormalizedCountdownMutationInput["taskCategory"],
    sectionName,
    jobTypeId,
    targetHoursInitial,
    startDate,
    deadlineDate,
    prerequisiteCoreId,
    refWoId,
    note,
    temuanAwal,
    keterangan,
    status: status as NormalizedCountdownMutationInput["status"],
  };
}

export interface CountdownBoardListPayload {
  rows: CountdownBoardRow[];
  total: number;
}

export interface CountdownRevisionResult {
  countdownId: string;
  status: "REQUESTED" | "MO_REVIEW" | "APPROVED" | "REJECTED";
  carId: string;
  divisionId: number;
}

export interface CountdownDownloadQuery {
  unitId: string;
  divisionId?: string;
  status?: string;
}

export class CountdownRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async findCountdownBoard(params: CountdownBoardParams): Promise<CountdownBoardListPayload> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, whereParams);
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    whereClauses.push(...buildFilterClauses(params.query, whereParams));

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [countRows] = await pool.query<CountdownMetaRowPacket[]>(
      `
        SELECT COUNT(*) AS total
        ${countdownFromSql()}
        ${whereSql}
      `,
      whereParams,
    );

    const offset = (params.query.page - 1) * params.query.limit;
    const dataParams = [...whereParams, params.query.limit, offset];
    const [rows] = await pool.query<CountdownBoardRowPacket[]>(
      `
        ${countdownSelectSql()}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      dataParams,
    );

    return {
      rows: rows.map(mapCountdownBoardRow),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async findCountdownDownload(
    params: ScopeParams & { query: CountdownDownloadQuery },
  ): Promise<CountdownBoardRow[]> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const query: CountdownGridQuery = {
      page: 1,
      limit: 100,
      search: "",
      sortBy: "updatedAt",
      sortDirection: "desc",
      view: null,
      filters: [
        { field: "unitId", operator: "eq", value: params.query.unitId },
        ...(params.query.divisionId
          ? [{ field: "divisionId" as const, operator: "eq" as const, value: params.query.divisionId }]
          : []),
        ...(params.query.status
          ? [{ field: "status" as const, operator: "eq" as const, value: params.query.status }]
          : []),
      ],
    };
    const clauses = [
      buildScopeWhereClause(params.scope, params.employeeId, whereParams),
      ...buildFilterClauses(query, whereParams),
    ].filter(Boolean);
    const [rows] = await pool.query<CountdownBoardRowPacket[]>(
      `
        ${countdownSelectSql()}
        WHERE ${clauses.join(" AND ")}
        ORDER BY ${buildOrderBy(query.sortBy, query.sortDirection)}
      `,
      whereParams,
    );

    return rows.map(mapCountdownBoardRow);
  }

  async findCountdownDetail(
    params: ScopeParams & { countdownId: string },
  ): Promise<CountdownDetail | null> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const whereClauses: string[] = ["cd.id = ?"];
    whereParams.push(params.countdownId);

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, whereParams);
    if (scopeClause) {
      whereClauses.unshift(scopeClause);
    }

    const [rows] = await pool.query<CountdownDetailRowPacket[]>(
      `
        ${countdownSelectSql()}
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      whereParams,
    );

    const summary = rows[0];
    if (!summary) {
      return null;
    }

    const [detailRows] = await pool.query<CountdownEntryRowPacket[]>(
      `
        SELECT
          detail.id AS detailId,
          detail.ref_actual_id AS actualId,
          detail.entry_type AS entryType,
          detail.employee_id AS employeeId,
          detail.employee_name AS employeeName,
          detail.employee_role AS employeeRole,
          DATE_FORMAT(detail.work_date, '%Y-%m-%d') AS workDate,
          TIME_FORMAT(detail.start_time, '%H:%i') AS startTime,
          TIME_FORMAT(detail.finish_time, '%H:%i') AS finishTime,
          ROUND(COALESCE(detail.billed_hours, 0), 2) AS billedHours,
          ROUND(COALESCE(detail.progress_percent, 0), 2) AS progressPercent,
          detail.task_status AS taskStatus,
          NULLIF(TRIM(actual.daily_notes), '') AS dailyNotes
        FROM sm_jobdesc_countdown_detail detail
        LEFT JOIN sm_jobdesc_actual actual ON actual.id = detail.ref_actual_id
        WHERE detail.countdown_id = ?
        ORDER BY detail.work_date DESC, detail.start_time DESC
      `,
      [params.countdownId],
    );

    const [photoRows] = await pool.query<CountdownEntryPhotoRowPacket[]>(
      `
        SELECT
          photos.actualId,
          photos.photoId,
          photos.type,
          photos.url,
          photos.caption,
          photos.uploader,
          photos.time
        FROM (
          SELECT
            tp.actual_id AS actualId,
            tp.id AS photoId,
            tp.photo_type AS type,
            tp.photo_url AS url,
            tp.caption,
            uploader.full_name AS uploader,
            DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS time
          FROM sm_work_photos_temp tp
          JOIN sm_jobdesc_actual actual ON actual.id = tp.actual_id
          JOIN sm_jobdesc_plan plan ON plan.id = actual.plandaily_id
          LEFT JOIN sm_employee uploader ON uploader.employee_id = tp.uploaded_by
          WHERE plan.core_id = ?

          UNION ALL

          SELECT
            ledger.actual_id AS actualId,
            lp.id AS photoId,
            lp.photo_type AS type,
            lp.photo_url AS url,
            lp.caption,
            COALESCE(lp.taken_by_name, uploader.full_name) AS uploader,
            DATE_FORMAT(COALESCE(lp.taken_at, lp.created_at), '%Y-%m-%d %H:%i:%s') AS time
          FROM sm_work_ledger_photos lp
          JOIN sm_work_ledger ledger ON ledger.id = lp.ledger_id
          LEFT JOIN sm_employee uploader ON uploader.employee_id = lp.taken_by
          WHERE ledger.countdown_id = ?
            AND ledger.actual_id IS NOT NULL
        ) photos
        ORDER BY photos.time DESC
      `,
      [params.countdownId, params.countdownId],
    );

    return mapCountdownDetailRow(summary, detailRows, photoRows);
  }

  async requestCountdownRevision(
    params: ScopeParams & { countdownId: string; input: CountdownRevisionRequest },
  ): Promise<CountdownRevisionResult> {
    const connection = await this.poolFactory().getConnection();
    try {
      await connection.beginTransaction();
      const revision = await this.lockRevision(connection, params);
      if (revision.status !== "PLAN" && revision.status !== "PROSES") {
        throw new Error("COUNTDOWN_REVISION_STATUS_INVALID");
      }
      if (revision.extensionRequestStatus === "REQUESTED" || revision.extensionRequestStatus === "MO_REVIEW") {
        throw new Error("COUNTDOWN_REVISION_ALREADY_REQUESTED");
      }
      await connection.execute(
        `UPDATE sm_jobdesc_countdown
         SET extension_request_status = 'REQUESTED', requested_extension_hours = ?,
             requested_deadline = ?, revision_reason = ?, user_update = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          params.input.requestedHours,
          params.input.requestedDeadline,
          params.input.reason,
          params.employeeId,
          params.countdownId,
        ],
      );
      await connection.commit();
      return { countdownId: params.countdownId, status: "REQUESTED", carId: revision.carId, divisionId: revision.divisionId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async decideCountdownRevision(
    params: ScopeParams & { countdownId: string; input: CountdownRevisionDecision; isMo: boolean },
  ): Promise<CountdownRevisionResult> {
    const connection = await this.poolFactory().getConnection();
    try {
      await connection.beginTransaction();
      const revision = await this.lockRevision(connection, params);
      const requiredStatus = params.isMo ? "MO_REVIEW" : "REQUESTED";
      if (revision.extensionRequestStatus !== requiredStatus) {
        throw new Error("COUNTDOWN_REVISION_STATUS_INVALID");
      }
      if (!params.isMo && !params.scope.canViewAllUnits && !await this.isActiveCountdownKp(connection, revision.carId, params.employeeId)) {
        throw new Error("COUNTDOWN_REVISION_FORBIDDEN");
      }

      let nextStatus: CountdownRevisionResult["status"] = params.input.isApproved ? "APPROVED" : "REJECTED";
      if (params.input.isApproved) {
        const extension = Number(revision.timeExtensionHours ?? 0) + params.input.approvedHours;
        const target = Number(revision.targetHoursInitial ?? 0) + extension;
        if (!params.isMo) {
          const [budgetRows] = await connection.query<Array<RowDataPacket & { allocatedHours: number | null }>>(
            `SELECT pm_allocated_hours AS allocatedHours FROM sm_unit_budgets
             WHERE car_id = ? AND division_id = ? LIMIT 1 FOR UPDATE`,
            [revision.carId, revision.divisionId],
          );
          const [usageRows] = await connection.query<Array<RowDataPacket & { totalUsed: number }>>(
            `SELECT COALESCE(SUM(target_hours_revised), 0) AS totalUsed
             FROM sm_jobdesc_countdown WHERE car_id = ? AND division_id = ? AND id <> ?`,
            [revision.carId, revision.divisionId, params.countdownId],
          );
          const budget = budgetRows[0]?.allocatedHours;
          if (!budgetRows[0] || (budget !== null && budget !== undefined && Number(usageRows[0]?.totalUsed ?? 0) + target > Number(budget))) {
            nextStatus = "MO_REVIEW";
          }
        }

        if (nextStatus === "MO_REVIEW") {
          await connection.execute(
            `UPDATE sm_jobdesc_countdown SET extension_request_status = 'MO_REVIEW', user_update = ?, updated_at = NOW() WHERE id = ?`,
            [params.employeeId, params.countdownId],
          );
        } else {
          if (params.isMo) {
            const [budgetUpdate] = await connection.execute<ResultSetHeader>(
              `UPDATE sm_unit_budgets
               SET pm_allocated_hours = pm_allocated_hours + ?, kd_allocated_hours = kd_allocated_hours + ?
               WHERE car_id = ? AND division_id = ?`,
              [params.input.approvedHours, params.input.approvedHours, revision.carId, revision.divisionId],
            );
            if (budgetUpdate.affectedRows !== 1) {
              throw new Error("COUNTDOWN_UNIT_BUDGET_NOT_FOUND");
            }
          }
          await connection.execute(
            `UPDATE sm_jobdesc_countdown
             SET extension_request_status = 'APPROVED', time_extension_hours = ?, target_hours_revised = ?, target_hours = ?,
                 remaining_hours = GREATEST(? - COALESCE(total_actual_hours, 0), 0), deadline_date = ?,
                 count_revisi = count_revisi + 1, user_update = ?, updated_at = NOW()
             WHERE id = ?`,
            [extension, target, target, target, params.input.approvedDeadline, params.employeeId, params.countdownId],
          );
          await insertCountdownRevision(connection, {
            countdownId: params.countdownId,
            oldTargetHours: currentCountdownTarget(revision),
            newTargetHours: target,
            oldDeadlineDate: revision.deadlineDate,
            newDeadlineDate: params.input.approvedDeadline,
            oldPicPlan: revision.picPlan,
            newPicPlan: revision.picPlan,
            oldRequiredGrade: revision.requiredGrade,
            newRequiredGrade: revision.requiredGrade,
            reasonCode: normalizeCountdownRevisionReason(revision.revisionReason),
            reasonDetail: revision.revisionReason,
            referenceType: params.isMo ? "MO_APPROVAL" : "KP_APPROVAL",
            referenceId: params.countdownId,
            changedBy: params.employeeId,
          });
        }
      } else {
        await connection.execute(
          `UPDATE sm_jobdesc_countdown SET extension_request_status = 'REJECTED', user_update = ?, updated_at = NOW() WHERE id = ?`,
          [params.employeeId, params.countdownId],
        );
      }
      await connection.commit();
      return { countdownId: params.countdownId, status: nextStatus, carId: revision.carId, divisionId: revision.divisionId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async lockRevision(
    connection: PoolConnection,
    params: ScopeParams & { countdownId: string },
  ): Promise<CountdownRevisionRowPacket> {
    const [rows] = await connection.query<CountdownRevisionRowPacket[]>(
      `SELECT id AS countdownId, car_id AS carId, division_id AS divisionId, status,
              extension_request_status AS extensionRequestStatus,
              COALESCE(time_extension_hours, 0) AS timeExtensionHours,
              COALESCE(target_hours_initial, 0) AS targetHoursInitial,
              target_hours AS targetHours,
              target_hours_revised AS targetHoursRevised,
              COALESCE(total_actual_hours, 0) AS totalActualHours,
              DATE_FORMAT(deadline_date, '%Y-%m-%d') AS deadlineDate,
              pic_plan AS picPlan,
              required_grade AS requiredGrade,
              revision_reason AS revisionReason
       FROM sm_jobdesc_countdown WHERE id = ? FOR UPDATE`,
      [params.countdownId],
    );
    const revision = rows[0];
    if (!revision) throw new Error("COUNTDOWN_NOT_FOUND");
    if (!await hasImportScopeAccess(connection, params.scope, params.employeeId, revision.carId, Number(revision.divisionId))) {
      throw new Error("SCOPE_FORBIDDEN");
    }
    return revision;
  }

  async isCountdownKp(countdownId: string, employeeId: string): Promise<boolean> {
    const [rows] = await this.poolFactory().query<ValidationPacket[]>(
      `SELECT cpa.car_id AS id
       FROM sm_jobdesc_countdown cd
       JOIN car_project_assignment cpa ON cpa.car_id = cd.car_id
       WHERE cd.id = ? AND cpa.kp_id = ? AND cpa.ended_at IS NULL
       LIMIT 1`,
      [countdownId, employeeId],
    );
    return rows.length > 0;
  }

  private async isActiveCountdownKp(
    connection: PoolConnection,
    carId: string,
    employeeId: string,
  ): Promise<boolean> {
    const [rows] = await connection.query<ValidationPacket[]>(
      `SELECT car_id AS id FROM car_project_assignment
       WHERE car_id = ? AND kp_id = ? AND ended_at IS NULL LIMIT 1`,
      [carId, employeeId],
    );
    return rows.length > 0;
  }

  async listFilterReferences(params: ScopeParams): Promise<CountdownReferenceOptions> {
    const pool = this.poolFactory();

    // Scope for Divisions
    const divisionWhereParams: unknown[] = [];
    let divisionWhere = "";
    if (!params.scope.canViewAllUnits && params.scope.divisionIds.length > 0) {
      divisionWhere = `WHERE d.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`;
      divisionWhereParams.push(...params.scope.divisionIds);
    }

    // Scope for Units
    const unitWhereParams: unknown[] = [];
    const unitClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      if (params.scope.unitIds.length > 0) {
        unitClauses.push(`id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        unitWhereParams.push(...params.scope.unitIds);
      }
      if (params.scope.canViewAssignedUnits) {
        unitClauses.push(`EXISTS (
          SELECT 1 FROM car_project_assignment cpa 
          WHERE cpa.car_id = cars.id 
            AND cpa.ended_at IS NULL 
            AND (cpa.kp_id = ? OR cpa.advisor_id = ? OR cpa.kd_id = ?)
        )`);
        unitWhereParams.push(params.employeeId, params.employeeId, params.employeeId);
      }
    }
    const unitWhere = unitClauses.length > 0 
      ? `WHERE ${unitClauses.join(" OR ")}` 
      : (params.scope.canViewAllUnits ? "" : "WHERE 1 = 0");

    const [divisionRows, unitRows, panelRows, sectionRows, jobTypeRows] = await Promise.all([
      pool.query<ReferenceOptionRow[]>(
        `
          SELECT
            d.id AS value,
            d.name AS label,
            d.code AS code,
            d.parent_id AS parentId,
            parent.name AS parentName,
            parent.code AS parentCode
          FROM sm_divisi d
          LEFT JOIN sm_divisi parent ON parent.id = d.parent_id
          ${divisionWhere}
          ORDER BY d.name ASC
        `,
        divisionWhereParams,
      ),
      pool.query<ReferenceOptionRow[]>(
        `
          SELECT id AS value, unit_name AS label
          FROM cars
          ${unitWhere}
          ORDER BY unit_name ASC
        `,
        unitWhereParams,
      ),
      pool.query<ReferenceOptionRow[]>(
        `
          SELECT
            id AS value,
            COALESCE(NULLIF(TRIM(panel_name), ''), NULLIF(TRIM(name_part), ''), CONCAT('MP-', id)) AS label,
            car_id AS carId,
            panel_name AS section,
            component_name AS category
          FROM master_panels
          ORDER BY component_name ASC, panel_name ASC, name_part ASC
        `,
      ),
      pool.query<ReferenceOptionRow[]>(
        `
          SELECT DISTINCT panel_name AS value, panel_name AS label
          FROM master_panels
          WHERE panel_name IS NOT NULL
            AND TRIM(panel_name) <> ''
          ORDER BY panel_name ASC
        `,
      ),
      pool.query<ReferenceOptionRow[]>(
        `
          SELECT
            mjt.id AS value,
            mjt.job_name AS label,
            mjt.division_id AS divisionId,
            division.name AS divisionName,
            division.parent_id AS divisionParentId,
            parent.name AS divisionParentName,
            parent.code AS divisionParentCode
          FROM master_job_types mjt
          LEFT JOIN sm_divisi division ON division.id = mjt.division_id
          LEFT JOIN sm_divisi parent ON parent.id = division.parent_id
          WHERE mjt.job_name IS NOT NULL
          ORDER BY mjt.job_name ASC
        `,
      ),
    ]);

    return {
      divisions: divisionRows[0].map(mapDivisionReference),
      units: unitRows[0].map(mapReferenceOption),
      panels: panelRows[0].map(mapPanelReference),
      sections: sectionRows[0].map(mapReferenceOption),
      jobTypes: jobTypeRows[0].map(mapJobTypeReference),
      taskCategories: [
        { label: "Main", value: "MAIN" },
        { label: "Additional", value: "ADDITIONAL" },
      ],
    };
  }

  async createCountdown(
    params: ScopeParams,
    input: CountdownCreateRequest,
  ): Promise<CountdownDetail> {
    const connection = await this.poolFactory().getConnection();

    try {
      await connection.beginTransaction();
      const normalized = await normalizeAndValidateCountdownMutation(connection, params, input);
      const countdownId = randomUUID();
      const now = new Date();
      const timeExtensionHours = 0;
      const targetHoursRevised = normalized.targetHoursInitial + timeExtensionHours;
      const remainingHours = Math.max(targetHoursRevised, 0);

      await connection.execute(
        `
          INSERT INTO sm_jobdesc_countdown (
            id,
            car_id,
            division_id,
            task_category,
            ref_taks_id,
            prerequisite_core_id,
            panel_id,
            section_name,
            job_type_id,
            target_hours_initial,
            time_extension_hours,
            target_hours_revised,
            target_hours,
            total_actual_hours,
            remaining_hours,
            actual_progress_percent,
            status,
            qc_last_status,
            created_at,
            start_date,
            deadline_date,
            latest_qc_id,
            ref_rework_qc_id,
            count_revisi,
            updated_at,
            user_update,
            extension_request_status,
            requested_extension_hours,
            requested_deadline,
            revision_reason,
            temuan_awal,
            keterangan,
            last_qc_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, 0, NULL, ?, ?, ?, NULL)
        `,
        [
          countdownId,
          normalized.carId,
          normalized.divisionId,
          normalized.taskCategory,
          normalized.refWoId,
          normalized.prerequisiteCoreId,
          normalized.panelId,
          normalized.sectionName,
          normalized.jobTypeId,
          normalized.targetHoursInitial,
          timeExtensionHours,
          targetHoursRevised,
          targetHoursRevised,
          remainingHours,
          normalized.status,
          now,
          normalized.startDate,
          normalized.deadlineDate,
          now,
          params.employeeId,
          normalized.note,
          normalized.temuanAwal,
          normalized.keterangan,
        ],
      );

      await connection.commit();
      const created = await this.findCountdownDetail({
        employeeId: params.employeeId,
        scope: params.scope,
        countdownId,
      });
      if (!created) {
        throw new Error("COUNTDOWN_NOT_FOUND");
      }

      return created;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateCountdown(
    params: ScopeParams,
    countdownId: string,
    input: CountdownCreateRequest,
  ): Promise<CountdownDetail | null> {
    const connection = await this.poolFactory().getConnection();

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.query<CountdownDetailRowPacket[]>(
        `
          ${countdownSelectSql()}
          WHERE cd.id = ?
          LIMIT 1
        `,
        [countdownId],
      );

      const existing = existingRows[0];
      if (!existing) {
        await connection.rollback();
        return null;
      }

      const existingScoped = await hasImportScopeAccess(
        connection,
        params.scope,
        params.employeeId,
        existing.carId,
        Number(existing.divisionId ?? 0),
      );
      if (!existingScoped) {
        throw new Error("SCOPE_FORBIDDEN");
      }

      const [lockedRows] = await connection.query<Array<RowDataPacket & {
        targetHours: number | null;
        targetHoursRevised: number | null;
        targetHoursInitial: number | null;
        timeExtensionHours: number | null;
        deadlineDate: string | null;
        picPlan: string | null;
        requiredGrade: string | null;
      }>>(
        `SELECT target_hours AS targetHours, target_hours_revised AS targetHoursRevised,
                target_hours_initial AS targetHoursInitial, time_extension_hours AS timeExtensionHours,
                DATE_FORMAT(deadline_date, '%Y-%m-%d') AS deadlineDate,
                pic_plan AS picPlan, required_grade AS requiredGrade
         FROM sm_jobdesc_countdown WHERE id = ? FOR UPDATE`,
        [countdownId],
      );

      const scopeParams: ScopeParams = params;
      const normalized = await normalizeAndValidateCountdownMutation(connection, scopeParams, input);
      const timeExtensionHours = Number(existing.timeExtensionHours ?? 0);
      const totalActualHours = Number(existing.totalActualHours ?? 0);
      const targetHoursRevised = normalized.targetHoursInitial + timeExtensionHours;
      const remainingHours = Math.max(targetHoursRevised - totalActualHours, 0);
      const actualProgressPercent =
        targetHoursRevised > 0
          ? Math.min((totalActualHours / targetHoursRevised) * 100, 100)
          : 0;

      await connection.execute(
        `
          UPDATE sm_jobdesc_countdown
          SET
            car_id = ?,
            division_id = ?,
            task_category = ?,
            ref_taks_id = ?,
            prerequisite_core_id = ?,
            panel_id = ?,
            section_name = ?,
            job_type_id = ?,
            target_hours_initial = ?,
            target_hours_revised = ?,
            target_hours = ?,
            remaining_hours = ?,
            actual_progress_percent = ?,
            status = ?,
            start_date = ?,
            deadline_date = ?,
            updated_at = ?,
            user_update = ?,
            revision_reason = ?,
            temuan_awal = ?,
            keterangan = ?
          WHERE id = ?
        `,
        [
          normalized.carId,
          normalized.divisionId,
          normalized.taskCategory,
          normalized.refWoId,
          normalized.prerequisiteCoreId,
          normalized.panelId,
          normalized.sectionName,
          normalized.jobTypeId,
          normalized.targetHoursInitial,
          targetHoursRevised,
          targetHoursRevised,
          remainingHours,
          actualProgressPercent,
          normalized.status,
          normalized.startDate,
          normalized.deadlineDate,
          new Date(),
          params.employeeId,
          normalized.note,
          normalized.temuanAwal,
          normalized.keterangan,
          countdownId,
        ],
      );

      const locked = lockedRows[0];
      if (locked) {
        const oldTarget = currentCountdownTarget(locked);
        const targetChanged = oldTarget !== targetHoursRevised;
        const deadlineChanged = locked.deadlineDate !== normalized.deadlineDate;
        if (targetChanged || deadlineChanged) {
          await insertCountdownRevision(connection, {
            countdownId,
            oldTargetHours: oldTarget,
            newTargetHours: targetHoursRevised,
            oldDeadlineDate: locked.deadlineDate,
            newDeadlineDate: normalized.deadlineDate,
            oldPicPlan: locked.picPlan,
            newPicPlan: locked.picPlan,
            oldRequiredGrade: locked.requiredGrade,
            newRequiredGrade: locked.requiredGrade,
            reasonCode: "SYSTEM_CORRECTION",
            reasonDetail: normalized.note,
            referenceType: "COUNTDOWN_EDIT",
            referenceId: countdownId,
            changedBy: params.employeeId,
          });
        }
      }

      await connection.commit();
      const updated = await this.findCountdownDetail({
        employeeId: params.employeeId,
        scope: params.scope,
        countdownId,
      });

      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteCountdown(
    params: ScopeParams,
    countdownId: string,
  ): Promise<boolean> {
    const connection = await this.poolFactory().getConnection();

    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query<CountdownDetailRowPacket[]>(
        `
          ${countdownSelectSql()}
          WHERE cd.id = ?
          LIMIT 1
        `,
        [countdownId],
      );

      const existing = existingRows[0];
      if (!existing) {
        await connection.rollback();
        return false;
      }

      const existingScoped = await hasImportScopeAccess(
        connection,
        params.scope,
        params.employeeId,
        existing.carId,
        Number(existing.divisionId ?? 0),
      );
      if (!existingScoped) {
        throw new Error("SCOPE_FORBIDDEN");
      }

      await connection.execute(
        "DELETE FROM sm_jobdesc_countdown_detail WHERE countdown_id = ?",
        [countdownId],
      );
      await connection.execute(
        "DELETE FROM sm_jobdesc_countdown WHERE id = ?",
        [countdownId],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createCountdownImports(
    params: ScopeParams,
    rows: ImportRowInput[],
  ): Promise<CountdownImportResult> {
    const connection = await this.poolFactory().getConnection();
    const issues: Array<{ rowNumber: number; field: string; message: string; value: string | null }> = [];
    let inserted = 0;
    const updated = 0;
    let rejected = 0;

    try {
      await connection.beginTransaction();

      for (const row of rows) {
        const taskCategory = row.taskCategory.toUpperCase();
        const carId = toStringValue(row.carId).trim();
        const divisionId = toNumber(row.divisionId);
        const panelId = row.panelId ? toNumber(row.panelId) : null;
        const jobTypeId = row.jobTypeId ? toStringValue(row.jobTypeId) : null;
        const sectionName = toStringValue(row.sectionName);
        const targetHoursInitial = toNumber(row.targetHoursInitial, NaN);
        const startDate = toIsoDate(row.startDate);
        const deadlineDate = toIsoDate(row.deadlineDate);
        const prerequisiteCoreId = toNullableString(row.prerequisiteCoreId);
        const refWoId = toNullableString(row.refWoId);
        const note = toNullableString(row.note);
        const temuanAwal = toNullableString(row.temuanAwal);
        const keterangan = toNullableString(row.keterangan);

        if (!carId) {
          issues.push(mapImportIssue(row.rowNumber, "carId", "carId wajib diisi.", row.carId));
          rejected += 1;
          continue;
        }

        if (!Number.isFinite(divisionId) || divisionId <= 0) {
          issues.push(mapImportIssue(row.rowNumber, "divisionId", "divisionId wajib diisi.", row.divisionId));
          rejected += 1;
          continue;
        }

        if (!sectionName) {
          issues.push(mapImportIssue(row.rowNumber, "sectionName", "sectionName wajib diisi.", row.sectionName));
          rejected += 1;
          continue;
        }

        if (!Number.isFinite(targetHoursInitial) || targetHoursInitial < 0) {
          issues.push(mapImportIssue(row.rowNumber, "targetHoursInitial", "targetHoursInitial tidak valid.", row.targetHoursInitial));
          rejected += 1;
          continue;
        }

        if (!deadlineDate) {
          issues.push(mapImportIssue(row.rowNumber, "deadlineDate", "deadlineDate wajib berformat YYYY-MM-DD.", row.deadlineDate));
          rejected += 1;
          continue;
        }

        const isAllowedTaskCategory = ["MAIN", "ADDITIONAL", "WO", "WOV"].includes(taskCategory);
        if (!isAllowedTaskCategory) {
          issues.push(mapImportIssue(row.rowNumber, "taskCategory", "taskCategory harus MAIN, ADDITIONAL, WO, atau WOV.", row.taskCategory));
          rejected += 1;
          continue;
        }

        const validUnit = await checkExists(
          connection,
          "SELECT id FROM cars WHERE id = ? LIMIT 1",
          [carId],
        );
        if (!validUnit) {
          issues.push(mapImportIssue(row.rowNumber, "carId", "carId tidak ditemukan di master unit.", row.carId));
          rejected += 1;
          continue;
        }

        const validDivision = await checkExists(
          connection,
          "SELECT id FROM sm_divisi WHERE id = ? LIMIT 1",
          [divisionId],
        );
        if (!validDivision) {
          issues.push(mapImportIssue(row.rowNumber, "divisionId", "divisionId tidak ditemukan.", row.divisionId));
          rejected += 1;
          continue;
        }

        const scoped = await hasImportScopeAccess(
          connection,
          params.scope,
          params.employeeId,
          carId,
          divisionId,
        );
        if (!scoped) {
          issues.push(
            mapImportIssue(
              row.rowNumber,
              "scope",
              "Row di luar scope unit/divisi user aktif.",
              `${carId}:${divisionId}`,
            ),
          );
          rejected += 1;
          continue;
        }

        if (panelId !== null) {
          const validPanel = await checkExists(
            connection,
            "SELECT id FROM master_panels WHERE id = ? AND (car_id IS NULL OR car_id = ?) LIMIT 1",
            [panelId, carId],
          );
          if (!validPanel) {
            issues.push(mapImportIssue(row.rowNumber, "panelId", "panelId tidak ditemukan atau tidak cocok dengan unit.", row.panelId));
            rejected += 1;
            continue;
          }
        }

        if (jobTypeId) {
          const validJobType = await checkAllowedJobType(connection, jobTypeId, divisionId);
          if (!validJobType) {
            issues.push(mapImportIssue(row.rowNumber, "jobTypeId", "jobTypeId tidak ditemukan atau tidak cocok dengan divisi.", row.jobTypeId));
            rejected += 1;
            continue;
          }
        }

        if (prerequisiteCoreId) {
          const prerequisiteExists = await checkExists(
            connection,
            "SELECT id FROM sm_jobdesc_countdown WHERE id = ? LIMIT 1",
            [prerequisiteCoreId],
          );
          if (!prerequisiteExists) {
            issues.push(mapImportIssue(row.rowNumber, "prerequisiteCoreId", "prerequisiteCoreId tidak ditemukan.", row.prerequisiteCoreId));
            rejected += 1;
            continue;
          }
        }

        if (refWoId) {
          const refWoExists = await checkExists(
            connection,
            "SELECT id FROM sm_jobdesc_wo WHERE id = ? LIMIT 1",
            [refWoId],
          );
          if (!refWoExists) {
            issues.push(mapImportIssue(row.rowNumber, "refWoId", "refWoId tidak ditemukan.", row.refWoId));
            rejected += 1;
            continue;
          }
        }

        const countdownId = randomUUID();
        const targetHoursRevised = targetHoursInitial;
        const now = new Date();

        await connection.execute(
          `
            INSERT INTO sm_jobdesc_countdown (
              id,
              car_id,
              division_id,
              task_category,
              ref_taks_id,
              prerequisite_core_id,
              panel_id,
              section_name,
              job_type_id,
              target_hours_initial,
              time_extension_hours,
              target_hours_revised,
              target_hours,
              total_actual_hours,
              remaining_hours,
              actual_progress_percent,
              status,
              qc_last_status,
              created_at,
              start_date,
              deadline_date,
              latest_qc_id,
              ref_rework_qc_id,
              count_revisi,
              updated_at,
              user_update,
              extension_request_status,
              requested_extension_hours,
              requested_deadline,
              revision_reason,
              temuan_awal,
              keterangan,
              last_qc_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 0, 'PLAN', NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, 0, NULL, ?, ?, ?, NULL)
          `,
          [
            countdownId,
            carId,
            divisionId,
            taskCategory,
            refWoId,
            prerequisiteCoreId,
            panelId,
            sectionName,
            jobTypeId,
            targetHoursInitial,
            targetHoursRevised,
            targetHoursRevised,
            targetHoursRevised,
            now,
            startDate,
            deadlineDate,
            now,
            params.employeeId,
            note,
            temuanAwal,
            keterangan,
          ],
        );

        inserted += 1;
      }

      await connection.commit();
      return {
        inserted,
        updated,
        rejected,
        issues,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
