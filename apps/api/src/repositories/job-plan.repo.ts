import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateJobPlanWorkspaceRequest,
  JobPlanDraftRecord,
  JobPlanGridQuery,
  JobPlanGridReference,
  JobPlanPicLoad,
  JobPlanRecord,
  JobPlanStatus,
  JobPlanSummary,
  JobPlanDraftItem,
  JobPlanWorkspaceDraftRow,
  UpdateJobPlanRequest,
  UpdateJobPlanStatusRequest,
} from "@smsystem/contracts/job-plan";
import {
  isNonTechnicalDivisionReference,
  type DivisionTechnicalReference,
} from "@smsystem/contracts/division";
import { buildJobPlanScheduleSegments } from "@smsystem/contracts/job-plan-schedule";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface JobPlanListParams extends ScopeParams {
  query: JobPlanGridQuery;
}

interface JobPlanMutationParams extends ScopeParams {
  planId: string;
}

interface CountdownContextRow extends RowDataPacket {
  coreId: string;
  carId: string | null;
  unitName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  remainingHours: number | null;
  progressPercent: number | null;
  currentStatus: string | null;
}

interface JobPlanRow extends RowDataPacket {
  planId: string;
  coreId: string;
  taskDate: string;
  unitName: string;
  divisionId: number | null;
  divisionName: string | null;
  panelName: string | null;
  panelSectionName: string | null;
  jobName: string | null;
  masterJobName: string | null;
  assignedUserId: string;
  assignedUserName: string;
  targetHours: number;
  targetTotalHours: number | null;
  startTime: string | null;
  finishTime: string | null;
  isOvertime: number | boolean;
  isPriority: number | boolean;
  status: string;
  jobDescription: string;
  note: string | null;
  availablePlanHours: number | null;
  remainingHours: number | null;
  progressPercent: number | null;
  actualStartTime: string | null;
  actualFinishTime: string | null;
  actualStatus: string | null;
  actualProgressPercent: number | null;
  actualBreakMinutes: number | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  totalHours: number | null;
  pendingCount: number | null;
  approvedCount: number | null;
  overtimeCount: number | null;
}

interface ReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  divisionId?: number | null;
  divisionName?: string | null;
  code?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  parentCode?: string | null;
  isTeknis?: number | boolean | null;
}

interface CountdownReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  carId: string;
  divisionId: number | null;
  unitName: string;
  divisionName: string;
  panelName?: string | null;
  jobName?: string | null;
  targetTotalHours: number | null;
  remainingHours: number | null;
  availablePlanHours: number | null;
  progressPercent: number | null;
}

interface UnitReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  unitName: string;
}

interface WorkOrderReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  carId: string;
  unitName: string;
  divisionId: number | null;
  divisionName: string | null;
  panelName: string | null;
  estimatedHours: number | null;
}

interface PanelReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  carId: string | null;
  panelName: string;
}

interface JobTypeReferenceRow extends RowDataPacket {
  value: string;
  label: string;
  divisionId: number | null;
  divisionName: string | null;
  divisionParentId: number | null;
  divisionParentName: string | null;
  divisionParentCode: string | null;
  jobName: string;
}

interface PicLoadRow extends RowDataPacket {
  normalHours: number | null;
  overtimeHours: number | null;
}

interface LockStateRow extends RowDataPacket {
  isLocked: number | boolean;
}

interface AdditionalContextRow extends RowDataPacket {
  carId: string;
  unitName: string;
  panelId: number | null;
  panelName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  jobTypeId: string;
  jobName: string | null;
}

interface DivisionTechnicalRow extends RowDataPacket {
  value: string;
  label: string | null;
  code: string | null;
  isTeknis: number | boolean | null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDurationHours(value: string): number {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/u);
  if (!match) {
    throw new Error("PROJECT_TARGET_INVALID");
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  return Number((hours + minutes / 60).toFixed(2));
}

function getOvertimeLimit(taskDate: string): number {
  const weekday = new Date(`${taskDate}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : 5;
}

function mapJobPlanRow(row: JobPlanRow): JobPlanRecord {
  return {
    planId: row.planId,
    coreId: row.coreId,
    taskDate: row.taskDate,
    unitName: row.unitName,
    divisionId: row.divisionId,
    divisionName: row.divisionName ?? "",
    panelName: row.panelName,
    panelSectionName: row.panelSectionName,
    jobName: row.jobName,
    masterJobName: row.masterJobName ?? row.jobName ?? row.jobDescription ?? row.panelName ?? "-",
    assignedUserId: row.assignedUserId,
    assignedUserName: row.assignedUserName,
    targetHours: Number(row.targetHours),
    targetDailyHours: Number(row.targetHours),
    targetTotalHours:
      row.targetTotalHours === null || row.targetTotalHours === undefined
        ? null
        : Number(row.targetTotalHours),
    startTime: row.startTime,
    finishTime: row.finishTime,
    isOvertime: toBoolean(row.isOvertime),
    isPriority: toBoolean(row.isPriority),
    status: row.status as JobPlanStatus,
    jobDescription: row.jobDescription,
    instructionText: row.jobDescription,
    note: row.note,
    availablePlanHours:
      row.availablePlanHours === null ? null : Number(row.availablePlanHours),
    remainingHours: row.remainingHours === null ? null : Number(row.remainingHours),
    progressPercent:
      row.progressPercent === null ? null : Number(row.progressPercent),
    actualStartTime: row.actualStartTime ?? null,
    actualFinishTime: row.actualFinishTime ?? null,
    actualStatus: row.actualStatus ?? null,
    actualProgressPercent:
      row.actualProgressPercent === null || row.actualProgressPercent === undefined
        ? null
        : Number(row.actualProgressPercent),
    actualBreakMinutes:
      row.actualBreakMinutes === null || row.actualBreakMinutes === undefined
        ? null
        : Number(row.actualBreakMinutes),
  };
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  countdownAlias = "jc",
  planAlias = "p",
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [`${planAlias}.assigned_user_id = ?`];
  params.push(employeeId);

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ${countdownAlias}.car_id
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
        ${countdownAlias}.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
        OR EXISTS (
          SELECT 1
          FROM sm_divisi selected_division
          WHERE selected_division.id IN (${scope.divisionIds.map(() => "?").join(", ")})
            AND selected_division.parent_id = ${countdownAlias}.division_id
        )
      )`,
    );
    params.push(...scope.divisionIds, ...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(
      `${countdownAlias}.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.unitIds);
  }

  return `(${clauses.join(" OR ")})`;
}

async function hasAssignmentScopeAccess(
  connection: Pick<PoolConnection, "query">,
  employeeId: string,
  carId: string,
): Promise<boolean> {
  const [rows] = (await connection.query(
    `
      SELECT 1 AS ok
      FROM car_project_assignment
      WHERE car_id = ?
        AND ended_at IS NULL
        AND (kp_id = ? OR advisor_id = ? OR kd_id = ?)
      LIMIT 1
    `,
    [carId, employeeId, employeeId, employeeId],
  )) as [Array<RowDataPacket & { ok: number }>, unknown];

  return rows.length > 0;
}

async function hasScopeAccess(
  connection: Pick<PoolConnection, "query">,
  scope: AuthScope,
  employeeId: string,
  params: {
    carId: string | null;
    divisionId: number | null;
    assignedUserId?: string | null;
  },
): Promise<boolean> {
  if (scope.canViewAllUnits) {
    return true;
  }

  if (params.assignedUserId && params.assignedUserId === employeeId) {
    return true;
  }

  if (params.carId && scope.unitIds.includes(params.carId)) {
    return true;
  }

  if (
    params.divisionId !== null &&
    scope.divisionIds.includes(params.divisionId)
  ) {
    return true;
  }

  if (params.divisionId !== null && scope.divisionIds.length > 0) {
    const [rows] = (await connection.query(
      `
        SELECT 1 AS ok
        FROM sm_divisi
        WHERE id IN (${scope.divisionIds.map(() => "?").join(", ")})
          AND parent_id = ?
        LIMIT 1
      `,
      [...scope.divisionIds, params.divisionId],
    )) as [Array<RowDataPacket & { ok: number }>, unknown];

    if (rows.length > 0) {
      return true;
    }
  }

  if (!scope.canViewAssignedUnits) {
    return false;
  }

  return params.carId ? hasAssignmentScopeAccess(connection, employeeId, params.carId) : false;
}

async function hasActiveAdvisor(
  connection: Pick<PoolConnection, "query">,
  carId: string | null,
): Promise<boolean> {
  if (!carId) {
    return false;
  }

  const [rows] = (await connection.query(
    `
      SELECT 1 AS ok
      FROM car_project_assignment
      WHERE car_id = ?
        AND ended_at IS NULL
        AND advisor_id IS NOT NULL
      LIMIT 1
    `,
    [carId],
  )) as [Array<RowDataPacket & { ok: number }>, unknown];

  return rows.length > 0;
}

async function resolveInitialSubmittedStatus(
  connection: Pick<PoolConnection, "query">,
  carId: string | null,
): Promise<JobPlanStatus> {
  return (await hasActiveAdvisor(connection, carId)) ? "PENDING_ADV" : "PENDING_KP";
}

async function getDivisionTechnicalReference(
  connection: Pick<PoolConnection, "query">,
  divisionId: number,
): Promise<DivisionTechnicalReference | null> {
  const [rows] = (await connection.query(
    `
      SELECT
        CAST(id AS CHAR) AS value,
        name AS label,
        code,
        isteknis AS isTeknis
      FROM sm_divisi
      WHERE id = ?
      LIMIT 1
    `,
    [divisionId],
  )) as [DivisionTechnicalRow[], unknown];

  const row = rows[0];
  if (!row) return null;

  return {
    value: row.value,
    label: row.label,
    code: row.code,
    isTeknis: row.isTeknis === null || row.isTeknis === undefined ? null : toBoolean(row.isTeknis),
  };
}

async function isNonTechnicalDivisionId(
  connection: Pick<PoolConnection, "query">,
  divisionId: number | null | undefined,
): Promise<boolean> {
  if (!divisionId) {
    return false;
  }

  return isNonTechnicalDivisionReference(await getDivisionTechnicalReference(connection, divisionId));
}

async function isPlanLocked(
  connection: Pick<PoolConnection, "query">,
  planId: string,
): Promise<boolean> {
  const [rows] = (await connection.query(
    `
      SELECT COALESCE(acc_tracking, 0) AS isLocked
      FROM sm_jobdesc_plan
      WHERE id = ?
      LIMIT 1
    `,
    [planId],
  )) as [LockStateRow[], unknown];

  return toBoolean(rows[0]?.isLocked ?? 0);
}

function buildFilterClauses(query: JobPlanGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [
    "p.task_date BETWEEN ? AND ?",
  ];
  params.push(query.dateStart, query.dateEnd);

  if (query.mode !== "all") {
    clauses.push("p.is_overtime = ?");
    params.push(query.mode === "overtime" ? 1 : 0);
  }

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        p.id LIKE ?
        OR c.unit_name LIKE ?
        OR COALESCE(d.name, '') LIKE ?
        OR COALESCE(e.full_name, p.assigned_user_id) LIKE ?
        OR COALESCE(p.jobdescription, '') LIKE ?
        OR COALESCE(p.note, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("p.status = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "divisionId") {
      clauses.push(`(
        jc.division_id = ?
        OR EXISTS (
          SELECT 1
          FROM sm_divisi selected_division
          WHERE selected_division.id = ?
            AND selected_division.parent_id = jc.division_id
        )
      )`);
      params.push(filter.value, filter.value);
      continue;
    }

    if (filter.field === "assignedUserId") {
      clauses.push("p.assigned_user_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "isPriority") {
      clauses.push("p.isPriority = ?");
      params.push(filter.value === "1" ? 1 : 0);
    }
  }

  return clauses;
}

function buildOrderBy(query: JobPlanGridQuery): string {
  const direction = query.sortDirection.toUpperCase();
  const columnMap: Record<string, string> = {
    taskDate: "p.task_date",
    unitName: "c.unit_name",
    divisionName: "d.name",
    assignedUserName: "COALESCE(e.full_name, p.assigned_user_id)",
    targetHours: "TIME_TO_SEC(p.dailyTargetHours)",
    status: "p.status",
    availablePlanHours:
      "GREATEST(COALESCE(jc.remaining_hours, 0) - COALESCE(planCapacity.reservedPlanHours, 0), 0)",
    remainingHours: "COALESCE(jc.remaining_hours, 0)",
    progressPercent: "COALESCE(jc.actual_progress_percent, 0)",
    createdAt: "p.created_at",
  };

  const column = columnMap[query.sortBy] ?? columnMap.taskDate;
  if (query.mode === "all") {
    return `p.is_overtime ASC, ${column} ${direction}, p.created_at DESC, p.id DESC`;
  }

  return `${column} ${direction}, p.created_at DESC, p.id DESC`;
}

function buildListSelectSql(): string {
  return `
    SELECT
      p.id AS planId,
      p.core_id AS coreId,
      DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
      COALESCE(c.unit_name, jc.car_id, NULLIF(jc.section_name, ''), p.jobdescription, '-') AS unitName,
      jc.division_id AS divisionId,
      d.name AS divisionName,
      COALESCE(mp.name, jc.section_name) AS panelName,
      jc.section_name AS panelSectionName,
      COALESCE(mjt.job_name, wo.job_detail, jc.section_name, jc.task_category) AS jobName,
      COALESCE(mjt.job_name, wo.job_detail, jc.section_name, p.jobdescription, jc.task_category) AS masterJobName,
      p.assigned_user_id AS assignedUserId,
      COALESCE(e.full_name, p.assigned_user_id) AS assignedUserName,
      ROUND(TIME_TO_SEC(p.dailyTargetHours) / 3600, 2) AS targetHours,
      ROUND(COALESCE(jc.target_hours_revised, jc.target_hours_initial, 0), 2) AS targetTotalHours,
      IFNULL(TIME_FORMAT(p.target_start_hours, '%H:%i'), NULL) AS startTime,
      IFNULL(TIME_FORMAT(p.target_finish_hours, '%H:%i'), NULL) AS finishTime,
      p.is_overtime AS isOvertime,
      p.isPriority AS isPriority,
      COALESCE(p.status, 'PLAN') AS status,
      COALESCE(p.jobdescription, '') AS jobDescription,
      p.note AS note,
      ROUND(GREATEST(COALESCE(jc.remaining_hours, 0) - COALESCE(planCapacity.reservedPlanHours, 0), 0), 2) AS availablePlanHours,
      ROUND(COALESCE(jc.remaining_hours, 0), 2) AS remainingHours,
      ROUND(COALESCE(jc.actual_progress_percent, 0), 2) AS progressPercent,
      DATE_FORMAT(latest_actual.start_time, '%H:%i') AS actualStartTime,
      DATE_FORMAT(latest_actual.finish_time, '%H:%i') AS actualFinishTime,
      CASE
        WHEN latest_actual.status = 'onprogress' AND latest_actual.finish_time IS NOT NULL THEN 'DONE'
        WHEN latest_actual.status = 'done' THEN 'DONE'
        WHEN latest_actual.status = 'onprogress' THEN 'ONPROGRESS'
        ELSE latest_actual.status
      END AS actualStatus,
      latest_actual.progres AS actualProgressPercent,
      latest_actual.break_duration_minutes AS actualBreakMinutes
    FROM sm_jobdesc_plan p
    JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
    LEFT JOIN cars c ON c.id = jc.car_id
    LEFT JOIN sm_divisi d ON d.id = jc.division_id
    LEFT JOIN master_panels mp ON mp.id = jc.panel_id
    LEFT JOIN master_job_types mjt ON mjt.id = jc.job_type_id
    LEFT JOIN sm_jobdesc_wo wo ON wo.id = jc.ref_taks_id
    LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
    LEFT JOIN (
      SELECT
        p.core_id,
        ROUND(
          COALESCE(
            SUM(
              CASE
                WHEN p.status NOT IN ('REJECTED', 'READY_QC', 'CANCEL')
                  AND (a.id IS NULL OR a.finish_time IS NULL)
                THEN TIME_TO_SEC(p.dailyTargetHours) / 3600
                ELSE 0
              END
            ),
            0
          ),
          2
        ) AS reservedPlanHours
      FROM sm_jobdesc_plan p
      LEFT JOIN (
        SELECT
          plandaily_id,
          MAX(id) AS latestActualId
        FROM sm_jobdesc_actual
        GROUP BY plandaily_id
      ) latest ON latest.plandaily_id = p.id
      LEFT JOIN sm_jobdesc_actual a ON a.id = latest.latestActualId
      GROUP BY p.core_id
    ) planCapacity ON planCapacity.core_id = jc.id
    LEFT JOIN (
      SELECT a.plandaily_id, a.start_time, a.finish_time, a.status, a.progres, a.break_duration_minutes
      FROM sm_jobdesc_actual a
      JOIN (
        SELECT plandaily_id, MAX(created_at) AS latestCreatedAt
        FROM sm_jobdesc_actual
        GROUP BY plandaily_id
      ) la ON la.plandaily_id = a.plandaily_id AND la.latestCreatedAt = a.created_at
    ) latest_actual ON latest_actual.plandaily_id = p.id
  `;
}

async function getCountdownContext(
  connection: Pick<PoolConnection, "query">,
  coreId: string,
  lockForUpdate = false,
): Promise<CountdownContextRow | null> {
  const [rows] = (await connection.query(
    `
      SELECT
        jc.id AS coreId,
        jc.car_id AS carId,
        COALESCE(c.unit_name, jc.car_id) AS unitName,
        jc.division_id AS divisionId,
        d.name AS divisionName,
        jc.panel_id AS panelId,
        ROUND(COALESCE(jc.remaining_hours, 0), 2) AS remainingHours,
        ROUND(COALESCE(jc.actual_progress_percent, 0), 2) AS progressPercent,
        COALESCE(jc.status, 'PLAN') AS currentStatus
      FROM sm_jobdesc_countdown jc
      LEFT JOIN cars c ON c.id = jc.car_id
      LEFT JOIN sm_divisi d ON d.id = jc.division_id
      WHERE jc.id = ?
      LIMIT 1
      ${lockForUpdate ? "FOR UPDATE" : ""}
    `,
    [coreId],
  )) as [CountdownContextRow[], unknown];

  return rows[0] ?? null;
}

async function assertCountdownAccessible(
  connection: PoolConnection,
  params: ScopeParams,
  coreId: string,
): Promise<CountdownContextRow> {
  const countdown = await getCountdownContext(connection, coreId, true);
  if (!countdown) {
    throw new Error("COUNTDOWN_NOT_FOUND");
  }

  const scoped = await hasScopeAccess(connection, params.scope, params.employeeId, {
    carId: countdown.carId,
    divisionId: countdown.divisionId,
  });
  if (!scoped) {
    throw new Error("SCOPE_FORBIDDEN");
  }

  return countdown;
}

async function checkPanelLock(
  connection: PoolConnection,
  countdown: CountdownContextRow,
): Promise<void> {
  if (!countdown.panelId || countdown.divisionId === null) {
    return;
  }

  const [rows] = (await connection.query(
    `
      SELECT is_locked AS isLocked, current_division_id AS currentDivisionId
      FROM sm_car_panel_status
      WHERE car_id = ? AND panel_id = ?
      LIMIT 1
    `,
    [countdown.carId, countdown.panelId],
  )) as [Array<RowDataPacket & { isLocked: number; currentDivisionId: number | null }>, unknown];

  const panel = rows[0];
  if (
    panel &&
    toBoolean(panel.isLocked) &&
    panel.currentDivisionId !== null &&
    panel.currentDivisionId !== countdown.divisionId
  ) {
    throw new Error("PANEL_LOCKED");
  }
}

async function lockPanel(
  connection: PoolConnection,
  countdown: CountdownContextRow,
): Promise<void> {
  if (!countdown.panelId || countdown.divisionId === null) {
    return;
  }

  await connection.execute(
    `
      INSERT INTO sm_car_panel_status (
        id,
        car_id,
        panel_id,
        current_division_id,
        is_locked
      ) VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        current_division_id = VALUES(current_division_id),
        is_locked = 1,
        last_updated_at = CURRENT_TIMESTAMP
    `,
    [randomUUID(), countdown.carId, countdown.panelId, countdown.divisionId],
  );
}

async function syncPanelLock(
  connection: PoolConnection,
  countdown: CountdownContextRow,
): Promise<void> {
  if (!countdown.panelId) {
    return;
  }

  const [rows] = (await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM sm_jobdesc_plan p
      JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
      WHERE jc.car_id = ?
        AND jc.panel_id = ?
        AND p.status NOT IN ('REJECTED', 'DONE', 'CANCEL')
    `,
    [countdown.carId, countdown.panelId],
  )) as [CountRow[], unknown];

  if ((rows[0]?.total ?? 0) > 0) {
    return;
  }

  await connection.execute(
    `
      UPDATE sm_car_panel_status
      SET is_locked = 0,
          current_division_id = NULL,
          last_updated_at = CURRENT_TIMESTAMP
      WHERE car_id = ? AND panel_id = ?
    `,
    [countdown.carId, countdown.panelId],
  );
}

async function getReservedPlanHours(
  connection: Pick<PoolConnection, "query">,
  coreId: string,
  excludePlanId?: string,
): Promise<number> {
  const params: unknown[] = [coreId];
  let sql = `
    SELECT COALESCE(
      SUM(
        CASE
          WHEN p.status NOT IN ('REJECTED', 'READY_QC', 'CANCEL')
            AND (a.id IS NULL OR a.finish_time IS NULL)
          THEN TIME_TO_SEC(p.dailyTargetHours) / 3600
          ELSE 0
        END
      ),
      0
    ) AS total
    FROM sm_jobdesc_plan p
    LEFT JOIN (
      SELECT
        plandaily_id,
        MAX(id) AS latestActualId
      FROM sm_jobdesc_actual
      GROUP BY plandaily_id
    ) latest ON latest.plandaily_id = p.id
    LEFT JOIN sm_jobdesc_actual a ON a.id = latest.latestActualId
    WHERE p.core_id = ?
  `;

  if (excludePlanId) {
    sql += " AND p.id <> ?";
    params.push(excludePlanId);
  }

  const [rows] = (await connection.query(sql, params)) as [CountRow[], unknown];
  return Number(rows[0]?.total ?? 0);
}

async function assertCountdownCapacity(
  connection: PoolConnection,
  countdown: CountdownContextRow,
  requestedHours: number,
  excludePlanId?: string,
): Promise<void> {
  const remainingHours = toNumber(countdown.remainingHours, 0);
  const reservedHours = await getReservedPlanHours(connection, countdown.coreId, excludePlanId);
  const availableHours = Math.max(0, remainingHours - reservedHours);

  if (requestedHours > availableHours + 0.0001) {
    throw new Error("COUNTDOWN_CAPACITY_EXCEEDED");
  }
}

async function getAdditionalContext(
  connection: Pick<PoolConnection, "query">,
  carId: string,
  divisionId: number,
  panelId: number,
  jobTypeId: string,
): Promise<AdditionalContextRow | null> {
  const allowed = await checkAllowedJobTypeForDivision(connection, jobTypeId, divisionId);
  if (!allowed) {
    return null;
  }

  const [rows] = (await connection.query(
    `
      SELECT
        c.id AS carId,
        COALESCE(c.unit_name, c.id) AS unitName,
        mp.id AS panelId,
        mp.name AS panelName,
        COALESCE(parent_division.id, selected_division.id) AS divisionId,
        COALESCE(parent_division.name, selected_division.name) AS divisionName,
        mjt.id AS jobTypeId,
        mjt.job_name AS jobName
      FROM cars c
      JOIN sm_divisi selected_division
        ON selected_division.id = ?
      LEFT JOIN sm_divisi parent_division
        ON parent_division.id = selected_division.parent_id
      JOIN master_panels mp
        ON mp.id = ?
       AND (mp.car_id IS NULL OR mp.car_id = c.id)
      JOIN master_job_types mjt
        ON mjt.id = ?
      WHERE c.id = ?
      LIMIT 1
    `,
    [divisionId, panelId, jobTypeId, carId],
  )) as [AdditionalContextRow[], unknown];

  return rows[0] ?? null;
}

async function checkAllowedJobTypeForDivision(
  connection: Pick<PoolConnection, "query">,
  jobTypeId: string,
  divisionId: number,
): Promise<boolean> {
  const [rows] = (await connection.query(
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
  )) as [Array<RowDataPacket & { id: string }>, unknown];

  return rows.length > 0;
}

async function findExistingWorkOrderCountdown(
  connection: Pick<PoolConnection, "query">,
  workOrderId: string,
): Promise<CountdownContextRow | null> {
  const [rows] = (await connection.query(
    `
      SELECT id AS coreId
      FROM sm_jobdesc_countdown
      WHERE task_category = 'WO'
        AND ref_taks_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [workOrderId],
  )) as [Array<RowDataPacket & { coreId: string }>, unknown];

  if (!rows[0]?.coreId) {
    return null;
  }

  return getCountdownContext(connection, rows[0].coreId);
}

async function createCountdownInTransaction(
  connection: PoolConnection,
  params: ScopeParams,
  input: {
    carId: string;
    divisionId: number;
    panelId: number | null;
    taskCategory: "ADDITIONAL" | "WO";
    sectionName: string;
    jobTypeId: string | null;
    targetHoursInitial: number;
    startDate: string;
    deadlineDate: string;
    refTaskId: string | null;
    note: string | null;
  },
): Promise<CountdownContextRow> {
  const scoped = await hasScopeAccess(connection, params.scope, params.employeeId, {
    carId: input.carId,
    divisionId: input.divisionId,
  });
  if (!scoped) {
    throw new Error("SCOPE_FORBIDDEN");
  }

  const countdownId = randomUUID();
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
        last_qc_level
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, 0, ?, 0, 'PLAN', NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, 0, NULL, ?, NULL)
    `,
    [
      countdownId,
      input.carId,
      input.divisionId,
      input.taskCategory,
      input.refTaskId,
      input.panelId,
      input.sectionName,
      input.jobTypeId,
      input.targetHoursInitial,
      input.targetHoursInitial,
      input.targetHoursInitial,
      now,
      input.startDate,
      input.deadlineDate,
      now,
      params.employeeId,
      input.note,
    ],
  );

  const created = await getCountdownContext(connection, countdownId);
  if (!created) {
    throw new Error("COUNTDOWN_NOT_FOUND");
  }

  return created;
}

async function createNonTechnicalCountdownInTransaction(
  connection: PoolConnection,
  params: { actorId: string },
  input: {
    carId: string | null;
    divisionId: number;
    sectionName: string;
    jobTypeId: string | null;
    taskDate: string;
    deadlineDate: string;
    note: string | null;
  },
): Promise<CountdownContextRow> {
  const countdownId = randomUUID();
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
        last_qc_level
      ) VALUES (?, ?, ?, 'ADDITIONAL', NULL, NULL, NULL, ?, ?, 0, 0, 0, 0, 0, 0, 'PLAN', NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, 0, NULL, ?, NULL)
    `,
    [
      countdownId,
      input.carId,
      input.divisionId,
      input.sectionName,
      input.jobTypeId,
      now,
      input.taskDate,
      input.deadlineDate,
      now,
      params.actorId,
      input.note,
    ],
  );

  const created = await getCountdownContext(connection, countdownId);
  if (!created) {
    throw new Error("COUNTDOWN_NOT_FOUND");
  }

  return created;
}

async function resolveWorkspaceCountdown(
  connection: PoolConnection,
  params: ScopeParams,
  row: JobPlanWorkspaceDraftRow,
  workspaceMeta: {
    projectTargetHours: number;
    taskDate: string;
    deadlineDate: string;
  },
): Promise<CountdownContextRow> {
  if (row.source === "countdown") {
    if (!row.referenceId) {
      throw new Error("COUNTDOWN_NOT_FOUND");
    }

    return assertCountdownAccessible(connection, params, row.referenceId);
  }

  if (row.source === "wo") {
    if (!row.referenceId) {
      throw new Error("WORK_ORDER_COUNTDOWN_NOT_FOUND");
    }

    const existingCountdown = await findExistingWorkOrderCountdown(connection, row.referenceId);
    if (!existingCountdown) {
      throw new Error("WORK_ORDER_COUNTDOWN_NOT_FOUND");
    }

    return assertCountdownAccessible(connection, params, existingCountdown.coreId);
  }

  if (!row.carId || !row.divisionId || !row.panelId || !row.jobTypeId) {
    const divisionId = row.divisionId ?? null;
    if (divisionId !== null && await isNonTechnicalDivisionId(connection, divisionId)) {
      return createNonTechnicalCountdownInTransaction(connection, { actorId: params.employeeId }, {
        carId: row.carId || null,
        divisionId,
        sectionName: row.jobDescription.trim(),
        jobTypeId: row.jobTypeId || null,
        taskDate: workspaceMeta.taskDate,
        deadlineDate: workspaceMeta.deadlineDate,
        note: row.note ?? null,
      });
    }

    throw new Error("ADDITIONAL_REFERENCE_INCOMPLETE");
  }

  const additional = await getAdditionalContext(
    connection,
    row.carId,
    row.divisionId,
    row.panelId,
    row.jobTypeId,
  );
  if (!additional || !additional.divisionId) {
    throw new Error("ADDITIONAL_REFERENCE_INCOMPLETE");
  }

  return createCountdownInTransaction(connection, params, {
    carId: additional.carId,
    divisionId: additional.divisionId,
    panelId: additional.panelId,
    taskCategory: "ADDITIONAL",
    sectionName: `${additional.panelName ?? "Panel"} · ${additional.jobName ?? "Tambahan"}`,
    jobTypeId: additional.jobTypeId,
    targetHoursInitial: workspaceMeta.projectTargetHours,
    startDate: workspaceMeta.taskDate,
    deadlineDate: workspaceMeta.deadlineDate,
    refTaskId: null,
    note: row.note ?? null,
  });
}

export interface JobPlanRepository {
  list(params: JobPlanListParams): Promise<{
    rows: JobPlanRecord[];
    total: number;
    summary: JobPlanSummary;
  }>;
  listReferences(params: ScopeParams & {
    mode: JobPlanGridQuery["mode"];
    countdownIds?: string[];
  }): Promise<JobPlanGridReference>;
  getPicLoad(
    employeeId: string,
    taskDate: string,
    excludePlanId?: string,
  ): Promise<JobPlanPicLoad>;
  createMany(
    params: ScopeParams & { actorId: string; actorName: string },
    plans: JobPlanDraftItem[],
  ): Promise<{ createdIds: string[] }>;
  createWorkspace(
    params: ScopeParams & { actorId: string; actorName: string },
    input: CreateJobPlanWorkspaceRequest,
  ): Promise<{ createdIds: string[] }>;
  submitDrafts(
    params: ScopeParams & { actorId: string; actorName: string },
    drafts: JobPlanDraftRecord[],
  ): Promise<{ createdIds: string[] }>;
  findById(params: JobPlanMutationParams): Promise<JobPlanRecord | null>;
  update(
    params: JobPlanMutationParams,
    input: UpdateJobPlanRequest,
  ): Promise<{ updatedPlanId: string }>;
  updateStatus(
    params: JobPlanMutationParams,
    input: UpdateJobPlanStatusRequest,
  ): Promise<{ planId: string; status: JobPlanStatus }>;
  delete(params: JobPlanMutationParams): Promise<void>;
  getApproversForCars(
    carIds: string[],
  ): Promise<Array<{ carId: string; kpId: string | null; advisorId: string | null; kdId: string | null }>>;
}

export class MySqlJobPlanRepository implements JobPlanRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async list(params: JobPlanListParams) {
    const pool = this.poolFactory();
    const baseSql = buildListSelectSql();
    const whereParams: unknown[] = [];
    const whereClauses = buildFilterClauses(params.query, whereParams);
    const scopeSql = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
    );

    if (scopeSql) {
      whereClauses.push(scopeSql);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
    const limitOffsetParams = [...whereParams, params.query.limit, (params.query.page - 1) * params.query.limit];

    const [rows] = (await pool.query(
      `
        ${baseSql}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query)}
        LIMIT ? OFFSET ?
      `,
      limitOffsetParams,
    )) as [JobPlanRow[], unknown];

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
        LEFT JOIN cars c ON c.id = jc.car_id
        LEFT JOIN sm_divisi d ON d.id = jc.division_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        ${whereSql}
      `,
      whereParams,
    )) as [CountRow[], unknown];

    const [summaryRows] = (await pool.query(
      `
        SELECT
          ROUND(COALESCE(SUM(TIME_TO_SEC(p.dailyTargetHours) / 3600), 0), 2) AS totalHours,
          SUM(CASE WHEN p.status IN ('PENDING', 'PENDING_ADV', 'PENDING_KP', 'PENDING_MP') THEN 1 ELSE 0 END) AS pendingCount,
          SUM(CASE WHEN p.status = 'PLAN' THEN 1 ELSE 0 END) AS approvedCount,
          SUM(CASE WHEN p.is_overtime = 1 THEN 1 ELSE 0 END) AS overtimeCount
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
        LEFT JOIN cars c ON c.id = jc.car_id
        LEFT JOIN sm_divisi d ON d.id = jc.division_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        ${whereSql}
      `,
      whereParams,
    )) as [SummaryRow[], unknown];

    return {
      rows: rows.map(mapJobPlanRow),
      total: countRows[0]?.total ?? 0,
      summary: {
        totalHours: Number(summaryRows[0]?.totalHours ?? 0),
        pendingCount: Number(summaryRows[0]?.pendingCount ?? 0),
        approvedCount: Number(summaryRows[0]?.approvedCount ?? 0),
        overtimeCount: Number(summaryRows[0]?.overtimeCount ?? 0),
      },
    };
  }

  async listReferences(
    params: ScopeParams & { mode: JobPlanGridQuery["mode"]; countdownIds?: string[] },
  ): Promise<JobPlanGridReference> {
    const pool = this.poolFactory();
    const employeeParams: unknown[] = [];
    const divisionParams: unknown[] = [];
    const countdownParams: unknown[] = [];
    const unitParams: unknown[] = [];
    const workOrderParams: unknown[] = [];
    const panelParams: unknown[] = [];
    const jobTypeParams: unknown[] = [];

    const divisionScopeSql = params.scope.canViewAllUnits
      ? ""
      : params.scope.divisionIds.length > 0
        ? `AND e.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`
        : "AND e.employee_id = ?";

    if (!params.scope.canViewAllUnits) {
      if (params.scope.divisionIds.length > 0) {
        employeeParams.push(...params.scope.divisionIds);
        divisionParams.push(...params.scope.divisionIds);
      } else {
        employeeParams.push(params.employeeId);
      }
    }

    const countdownScopeSql = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      countdownParams,
      "jc",
      "p_scope",
    );
    const countdownIdSql = params.countdownIds?.length
      ? `AND jc.id IN (${params.countdownIds.map(() => "?").join(", ")})`
      : "";
    countdownParams.push(...(params.countdownIds ?? []));

    const unitScopeClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      if (params.scope.unitIds.length > 0) {
        unitScopeClauses.push(`c.id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        unitParams.push(...params.scope.unitIds);
      }

      if (params.scope.divisionIds.length > 0) {
        unitScopeClauses.push(
          `EXISTS (
            SELECT 1
            FROM sm_jobdesc_countdown jc_unit
            WHERE jc_unit.car_id = c.id
              AND (
                jc_unit.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                OR EXISTS (
                  SELECT 1
                  FROM sm_divisi selected_division
                  WHERE selected_division.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                    AND selected_division.parent_id = jc_unit.division_id
                )
              )
          )`,
        );
        unitParams.push(...params.scope.divisionIds, ...params.scope.divisionIds);
      }

      if (params.scope.canViewAssignedUnits) {
        unitScopeClauses.push(
          `EXISTS (
            SELECT 1
            FROM car_project_assignment cpa_unit
            WHERE cpa_unit.car_id = c.id
              AND cpa_unit.ended_at IS NULL
              AND (
                cpa_unit.kp_id = ?
                OR cpa_unit.advisor_id = ?
                OR cpa_unit.kd_id = ?
              )
          )`,
        );
        unitParams.push(params.employeeId, params.employeeId, params.employeeId);
      }
    }

    const workOrderScopeClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      if (params.scope.unitIds.length > 0) {
        workOrderScopeClauses.push(
          `wo.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`,
        );
        workOrderParams.push(...params.scope.unitIds);
      }

      if (params.scope.divisionIds.length > 0) {
        workOrderScopeClauses.push(
          `(
            COALESCE(wo.to_div_id, wo.from_div_id) IN (${params.scope.divisionIds.map(() => "?").join(", ")})
            OR EXISTS (
              SELECT 1
              FROM sm_divisi selected_division
              WHERE selected_division.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                AND selected_division.parent_id = COALESCE(wo.to_div_id, wo.from_div_id)
            )
          )`,
        );
        workOrderParams.push(...params.scope.divisionIds, ...params.scope.divisionIds);
      }

      if (params.scope.canViewAssignedUnits) {
        workOrderScopeClauses.push(
          `EXISTS (
            SELECT 1
            FROM car_project_assignment cpa_wo
            WHERE cpa_wo.car_id = wo.car_id
              AND cpa_wo.ended_at IS NULL
              AND (
                cpa_wo.kp_id = ?
                OR cpa_wo.advisor_id = ?
                OR cpa_wo.kd_id = ?
              )
          )`,
        );
        workOrderParams.push(params.employeeId, params.employeeId, params.employeeId);
      }
    }

    const panelScopeClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      panelScopeClauses.push("mp.car_id IS NULL");

      if (params.scope.unitIds.length > 0) {
        panelScopeClauses.push(
          `mp.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`,
        );
        panelParams.push(...params.scope.unitIds);
      }

      if (params.scope.canViewAssignedUnits) {
        panelScopeClauses.push(
          `EXISTS (
            SELECT 1
            FROM car_project_assignment cpa_panel
            WHERE cpa_panel.car_id = mp.car_id
              AND cpa_panel.ended_at IS NULL
              AND (
                cpa_panel.kp_id = ?
                OR cpa_panel.advisor_id = ?
                OR cpa_panel.kd_id = ?
              )
          )`,
        );
        panelParams.push(params.employeeId, params.employeeId, params.employeeId);
      }

      if (params.scope.divisionIds.length > 0) {
        panelScopeClauses.push(
          `EXISTS (
            SELECT 1
            FROM sm_jobdesc_countdown jc_panel
            WHERE jc_panel.panel_id = mp.id
              AND (
                jc_panel.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                OR EXISTS (
                  SELECT 1
                  FROM sm_divisi selected_division
                  WHERE selected_division.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                    AND selected_division.parent_id = jc_panel.division_id
                )
              )
          )`,
        );
        panelParams.push(...params.scope.divisionIds, ...params.scope.divisionIds);
      }
    }

    const jobTypeScopeSql = params.scope.canViewAllUnits
      ? ""
      : params.scope.divisionIds.length > 0
        ? `
          AND (
            mjt.division_id IS NULL
            OR mjt.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
            OR EXISTS (
              SELECT 1
              FROM sm_divisi selected_division
              WHERE selected_division.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
                AND mjt.division_id = selected_division.parent_id
            )
          )
        `
        : "AND 1 = 0";

    if (!params.scope.canViewAllUnits && params.scope.divisionIds.length > 0) {
      jobTypeParams.push(...params.scope.divisionIds, ...params.scope.divisionIds);
    }

    const [
      [employeeRows],
      [divisionRows],
      [unitRows],
      [countdownRows],
      [workOrderRows],
      [panelRows],
      [jobTypeRows],
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            e.employee_id AS value,
            CONCAT(e.employee_id, ' · ', e.full_name) AS label,
            e.division_id AS divisionId,
            d.name AS divisionName
          FROM sm_employee e
          LEFT JOIN sm_divisi d ON d.id = e.division_id
          WHERE e.is_active = 1
            ${divisionScopeSql}
          ORDER BY e.full_name ASC
          LIMIT 100
        `,
        employeeParams,
      ),
      pool.query(
        `
      SELECT
        CAST(d.id AS CHAR) AS value,
        d.name AS label,
        d.code AS code,
        d.isteknis AS isTeknis,
        d.parent_id AS parentId,
        parent.name AS parentName,
        parent.code AS parentCode
          FROM sm_divisi d
          LEFT JOIN sm_divisi parent ON parent.id = d.parent_id
          WHERE 1 = 1
            ${
              params.scope.canViewAllUnits
                ? ""
                : params.scope.divisionIds.length > 0
                  ? `AND d.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`
                  : "AND 1 = 0"
            }
          ORDER BY d.name ASC
        `,
        divisionParams,
      ),
      pool.query(
        `
          SELECT DISTINCT
            c.id AS value,
            COALESCE(c.unit_name, c.id) AS label,
            COALESCE(c.unit_name, c.id) AS unitName
          FROM cars c
          WHERE ${
            params.scope.canViewAllUnits
              ? "1 = 1"
              : unitScopeClauses.length > 0
                ? `(${unitScopeClauses.join(" OR ")})`
                : "1 = 0"
          }
          ORDER BY label ASC
          LIMIT 200
        `,
        unitParams,
      ),
      pool.query(
        `
          SELECT
            jc.id AS value,
            CONCAT(
              COALESCE(c.unit_name, jc.car_id),
              ' · ',
              COALESCE(mjt.job_name, mp.name, jc.section_name),
              ' · ',
              ROUND(COALESCE(jc.remaining_hours, 0), 2),
              'j'
            ) AS label,
            jc.car_id AS carId,
            jc.division_id AS divisionId,
            COALESCE(c.unit_name, jc.car_id) AS unitName,
            COALESCE(d.name, '-') AS divisionName,
            COALESCE(mp.name, jc.section_name) AS panelName,
            mjt.job_name AS jobName,
            ROUND(COALESCE(jc.target_hours_revised, jc.target_hours_initial, 0), 2) AS targetTotalHours,
            ROUND(COALESCE(jc.remaining_hours, 0), 2) AS remainingHours,
            ROUND(GREATEST(COALESCE(jc.remaining_hours, 0) - COALESCE(planCapacity.reservedPlanHours, 0), 0), 2) AS availablePlanHours,
            ROUND(COALESCE(jc.actual_progress_percent, 0), 2) AS progressPercent
          FROM sm_jobdesc_countdown jc
          LEFT JOIN cars c ON c.id = jc.car_id
          LEFT JOIN master_panels mp ON mp.id = jc.panel_id
          LEFT JOIN sm_divisi d ON d.id = jc.division_id
          LEFT JOIN master_job_types mjt ON mjt.id = jc.job_type_id
          LEFT JOIN (
            SELECT
              p.core_id,
              ROUND(
                COALESCE(
                  SUM(
                    CASE
                      WHEN p.status NOT IN ('REJECTED', 'READY_QC', 'CANCEL')
                        AND (a.id IS NULL OR a.finish_time IS NULL)
                      THEN TIME_TO_SEC(p.dailyTargetHours) / 3600
                      ELSE 0
                    END
                  ),
                  0
                ),
                2
              ) AS reservedPlanHours
            FROM sm_jobdesc_plan p
            LEFT JOIN (
              SELECT
                plandaily_id,
                MAX(id) AS latestActualId
              FROM sm_jobdesc_actual
              GROUP BY plandaily_id
            ) latest ON latest.plandaily_id = p.id
            LEFT JOIN sm_jobdesc_actual a ON a.id = latest.latestActualId
            GROUP BY p.core_id
          ) planCapacity ON planCapacity.core_id = jc.id
          LEFT JOIN sm_jobdesc_plan p_scope ON p_scope.core_id = jc.id
          WHERE COALESCE(jc.status, 'PLAN') NOT IN ('DONE', 'CANCEL')
            AND COALESCE(jc.remaining_hours, 0) > 0
            ${countdownScopeSql ? `AND ${countdownScopeSql}` : ""}
            ${countdownIdSql}
          GROUP BY
            jc.id,
            jc.car_id,
            jc.division_id,
            c.unit_name,
            mp.name,
            jc.section_name,
            d.name,
            mjt.job_name,
            jc.remaining_hours,
            jc.actual_progress_percent,
            planCapacity.reservedPlanHours
          ORDER BY jc.updated_at DESC, jc.created_at DESC
          ${params.countdownIds?.length ? "" : "LIMIT 200"}
        `,
        countdownParams,
      ),
      pool.query(
        `
          SELECT
            wo.id AS value,
            CONCAT(COALESCE(wo.wo_number, wo.id), ' · ', COALESCE(c.unit_name, wo.car_id)) AS label,
            wo.car_id AS carId,
            COALESCE(c.unit_name, wo.car_id) AS unitName,
            COALESCE(wo.to_div_id, wo.from_div_id) AS divisionId,
            d.name AS divisionName,
            wo.panel_name AS panelName,
            ROUND(COALESCE(wo.estimated_hours, 0), 2) AS estimatedHours
          FROM sm_jobdesc_wo wo
          LEFT JOIN cars c ON c.id = wo.car_id
          LEFT JOIN sm_divisi d ON d.id = COALESCE(wo.to_div_id, wo.from_div_id)
          WHERE COALESCE(wo.status, 'PLAN') NOT IN ('DONE', 'CANCEL')
            AND ${
              params.scope.canViewAllUnits
                ? "1 = 1"
                : workOrderScopeClauses.length > 0
                  ? `(${workOrderScopeClauses.join(" OR ")})`
                  : "1 = 0"
            }
          ORDER BY wo.updated_at DESC, wo.created_at DESC
          LIMIT 200
        `,
        workOrderParams,
      ),
      pool.query(
        `
          SELECT
            CAST(mp.id AS CHAR) AS value,
            CASE
              WHEN mp.car_id IS NULL THEN mp.name
              ELSE CONCAT(COALESCE(c.unit_name, mp.car_id), ' · ', mp.name)
            END AS label,
            mp.car_id AS carId,
            mp.name AS panelName
          FROM master_panels mp
          LEFT JOIN cars c ON c.id = mp.car_id
          WHERE ${
            params.scope.canViewAllUnits
              ? "1 = 1"
              : panelScopeClauses.length > 0
                ? `(${panelScopeClauses.join(" OR ")})`
                : "1 = 0"
          }
          ORDER BY mp.name ASC
          LIMIT 300
        `,
        panelParams,
      ),
      pool.query(
        `
          SELECT
            mjt.id AS value,
            COALESCE(mjt.job_name, mjt.id) AS label,
            mjt.division_id AS divisionId,
            d.name AS divisionName,
            d.parent_id AS divisionParentId,
            parent.name AS divisionParentName,
            parent.code AS divisionParentCode,
            COALESCE(mjt.job_name, mjt.id) AS jobName
          FROM master_job_types mjt
          LEFT JOIN sm_divisi d ON d.id = mjt.division_id
          LEFT JOIN sm_divisi parent ON parent.id = d.parent_id
          WHERE mjt.job_name IS NOT NULL
            ${jobTypeScopeSql}
          ORDER BY label ASC
          LIMIT 300
        `,
        jobTypeParams,
      ),
    ]) as [
      [ReferenceRow[], unknown],
      [ReferenceRow[], unknown],
      [UnitReferenceRow[], unknown],
      [CountdownReferenceRow[], unknown],
      [WorkOrderReferenceRow[], unknown],
      [PanelReferenceRow[], unknown],
      [JobTypeReferenceRow[], unknown],
    ];

    return {
      employees: employeeRows.map((row) => ({
        value: row.value,
        label: row.label,
        divisionId: row.divisionId ?? null,
        divisionName: row.divisionName ?? null,
      })),
      divisions: divisionRows.map((row) => ({
        value: row.value,
        label: row.label,
        code: row.code ?? null,
        isTeknis:
          row.isTeknis === null || row.isTeknis === undefined
            ? null
            : toBoolean(row.isTeknis),
        isTechnical:
          row.isTeknis === null || row.isTeknis === undefined
            ? null
            : toBoolean(row.isTeknis),
        parentId: row.parentId ?? null,
        parentName: row.parentName ?? null,
        parentCode: row.parentCode ?? null,
      })),
      units: unitRows.map((row) => ({
        value: row.value,
        label: row.label,
        unitName: row.unitName,
      })),
      countdowns: countdownRows.map((row) => ({
        value: row.value,
        label: row.label,
        carId: row.carId,
        divisionId: row.divisionId,
        unitName: row.unitName,
        divisionName: row.divisionName,
        panelName: row.panelName,
        jobName: row.jobName,
        targetTotalHours:
          row.targetTotalHours === null ? null : Number(row.targetTotalHours),
        remainingHours: Number(row.remainingHours ?? 0),
        availablePlanHours:
          row.availablePlanHours === null ? null : Number(row.availablePlanHours),
        progressPercent:
          row.progressPercent === null ? null : Number(row.progressPercent),
      })),
      workOrders: workOrderRows.map((row) => ({
        value: row.value,
        label: row.label,
        carId: row.carId,
        unitName: row.unitName,
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        panelName: row.panelName,
        estimatedHours: Number(row.estimatedHours ?? 0),
      })),
      panels: panelRows.map((row) => ({
        value: row.value,
        label: row.label,
        carId: row.carId,
        panelName: row.panelName,
      })),
      jobTypes: jobTypeRows.map((row) => ({
        value: row.value,
        label: row.label,
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        divisionParentId: row.divisionParentId,
        divisionParentName: row.divisionParentName,
        divisionParentCode: row.divisionParentCode,
        jobName: row.jobName,
      })),
      statuses: [
        { value: "DRAFT", label: "DRAFT" },
        { value: "PENDING", label: "PENDING" },
        { value: "PENDING_ADV", label: "Menunggu QA" },
        { value: "PENDING_KP", label: "PENDING_KP" },
        { value: "PENDING_MP", label: "PENDING_MP" },
        { value: "PLAN", label: "PLAN" },
        { value: "ONPROGRESS", label: "ONPROGRESS" },
        { value: "READY_QC", label: "READY_QC" },
        { value: "DONE", label: "DONE" },
        { value: "REJECTED", label: "REJECTED" },
      ],
    };
  }

  async getPicLoad(
    employeeId: string,
    taskDate: string,
    excludePlanId?: string,
  ): Promise<JobPlanPicLoad> {
    const pool = this.poolFactory();
    const params: unknown[] = [employeeId, taskDate];
    let sql = `
      SELECT
        SUM(CASE WHEN is_overtime = 0 THEN TIME_TO_SEC(dailyTargetHours) / 3600 ELSE 0 END) AS normalHours,
        SUM(CASE WHEN is_overtime = 1 THEN TIME_TO_SEC(dailyTargetHours) / 3600 ELSE 0 END) AS overtimeHours
      FROM sm_jobdesc_plan
      WHERE assigned_user_id = ?
        AND task_date = ?
        AND status != 'REJECTED'
    `;

    if (excludePlanId) {
      sql += " AND id <> ?";
      params.push(excludePlanId);
    }

    const [rows] = (await pool.query(sql, params)) as [PicLoadRow[], unknown];
    const normalUsed = Number(rows[0]?.normalHours ?? 0);
    const overtimeUsed = Number(rows[0]?.overtimeHours ?? 0);
    const overtimeMax = getOvertimeLimit(taskDate);

    return {
      normal: {
        used: normalUsed,
        max: 8,
        remaining: Math.max(0, Number((8 - normalUsed).toFixed(2))),
      },
      overtime: {
        used: overtimeUsed,
        max: overtimeMax,
        remaining: Math.max(0, Number((overtimeMax - overtimeUsed).toFixed(2))),
      },
    };
  }

  async createMany(
    params: ScopeParams & { actorId: string; actorName: string },
    plans: JobPlanDraftItem[],
  ) {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    const createdIds: string[] = [];

    try {
      await connection.beginTransaction();

      for (const plan of plans) {
        const countdown = await assertCountdownAccessible(connection, params, plan.coreId);
        await checkPanelLock(connection, countdown);
        await assertCountdownCapacity(connection, countdown, plan.targetHours);
        const initialStatus = await resolveInitialSubmittedStatus(
          connection,
          countdown.carId,
        );

        const planId = `PLAN-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
        await connection.execute(
          `
            INSERT INTO sm_jobdesc_plan (
              id,
              core_id,
              task_date,
              jobdescription,
              assigned_user_id,
              target_start_hours,
              target_finish_hours,
              dailyTargetHours,
              is_overtime,
              is_rework,
              isPriority,
              status,
              acc_tracking,
              note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, SEC_TO_TIME(? * 3600), ?, 0, ?, ?, 0, ?)
          `,
          [
            planId,
            plan.coreId,
            plan.taskDate,
            plan.jobDescription,
            plan.assignedUserId,
            plan.startTime,
            plan.finishTime,
            plan.targetHours,
            plan.isOvertime ? 1 : 0,
            plan.isPriority ? 1 : 0,
            initialStatus,
            plan.note,
          ],
        );

        await lockPanel(connection, countdown);
        createdIds.push(planId);
      }

      await connection.commit();
      return { createdIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createWorkspace(
    params: ScopeParams & { actorId: string; actorName: string },
    input: CreateJobPlanWorkspaceRequest,
  ) {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    const createdIds: string[] = [];

    try {
      await connection.beginTransaction();

      const projectTargetHours = parseDurationHours(input.projectTargetHours);
      if (input.deadlineDate < input.taskDate) {
        throw new Error("PROJECT_DEADLINE_INVALID");
      }

      for (const row of input.rows) {
        const isManualNonTechnical =
          row.source === "additional" &&
          (await isNonTechnicalDivisionId(connection, row.divisionId ?? null));
        const countdown = await resolveWorkspaceCountdown(connection, params, row, {
          projectTargetHours,
          taskDate: input.taskDate,
          deadlineDate: input.deadlineDate,
        });
        const initialStatus = isManualNonTechnical
          ? "PLAN"
          : await resolveInitialSubmittedStatus(
              connection,
              countdown.carId,
            );
        const scheduleSegments = buildJobPlanScheduleSegments({
          taskDate: input.taskDate,
          requestedMode: input.mode,
          targetHours: row.targetHours,
        });

        if (!isManualNonTechnical) {
          await checkPanelLock(connection, countdown);
          await assertCountdownCapacity(connection, countdown, row.targetHours);
        }

        for (const segment of scheduleSegments) {
          const planId = `PLAN-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
          await connection.execute(
            `
              INSERT INTO sm_jobdesc_plan (
                id,
                core_id,
                task_date,
                jobdescription,
                assigned_user_id,
                target_start_hours,
                target_finish_hours,
                dailyTargetHours,
                is_overtime,
                is_rework,
                isPriority,
                status,
                acc_tracking,
                note
              ) VALUES (?, ?, ?, ?, ?, ?, ?, SEC_TO_TIME(? * 3600), ?, ?, ?, ?, 0, ?)
            `,
            [
              planId,
              countdown.coreId,
              input.taskDate,
              row.jobDescription,
              row.assignedUserId,
              segment.startTime,
              segment.finishTime,
              segment.targetHours,
              segment.mode === "overtime" ? 1 : 0,
              input.isRework ? 1 : 0,
              row.isPriority ? 1 : 0,
              initialStatus,
              row.note,
            ],
          );

          createdIds.push(planId);
        }

        if (!isManualNonTechnical) {
          await lockPanel(connection, countdown);
        }
      }

      await connection.commit();
      return { createdIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async submitDrafts(
    params: ScopeParams & { actorId: string; actorName: string },
    drafts: JobPlanDraftRecord[],
  ) {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    const createdIds: string[] = [];

    try {
      await connection.beginTransaction();

      for (const draft of drafts) {
        if (draft.sourceType === "ADDITIONAL") {
          const isManualNonTechnical = await isNonTechnicalDivisionId(
            connection,
            draft.divisionId ?? null,
          );
          const row: JobPlanWorkspaceDraftRow = {
            source: "additional",
            referenceId: null,
            carId: draft.carId,
            divisionId: draft.divisionId,
            panelId: draft.panelId,
            jobTypeId: draft.jobTypeId,
            assignedUserId: draft.assignedUserId,
            targetHours: draft.targetHours,
            startTime: draft.startTime,
            finishTime: draft.finishTime,
            jobDescription: draft.jobDescription,
            note: draft.note ?? null,
            isPriority: draft.isPriority,
          };
          const countdown = await resolveWorkspaceCountdown(connection, params, row, {
            projectTargetHours: draft.targetHours,
            taskDate: draft.taskDate,
            deadlineDate: draft.deadlineDate ?? draft.taskDate,
          });
          const initialStatus = isManualNonTechnical
            ? "PLAN"
            : await resolveInitialSubmittedStatus(
                connection,
                countdown.carId,
              );
          const scheduleSegments = buildJobPlanScheduleSegments({
            taskDate: draft.taskDate,
            requestedMode: draft.isOvertime ? "overtime" : "normal",
            targetHours: draft.targetHours,
          });

          if (!isManualNonTechnical) {
            await checkPanelLock(connection, countdown);
            await assertCountdownCapacity(connection, countdown, draft.targetHours);
          }

          for (const segment of scheduleSegments) {
            const planId = `PLAN-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
            await connection.execute(
              `
                INSERT INTO sm_jobdesc_plan (
                  id,
                  core_id,
                  task_date,
                  jobdescription,
                  assigned_user_id,
                  target_start_hours,
                  target_finish_hours,
                  dailyTargetHours,
                  is_overtime,
                  is_rework,
                  isPriority,
                  status,
                  acc_tracking,
                  note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, SEC_TO_TIME(? * 3600), ?, ?, ?, ?, 0, ?)
              `,
              [
                planId,
                countdown.coreId,
                draft.taskDate,
                draft.jobDescription,
                draft.assignedUserId,
                segment.startTime,
                segment.finishTime,
                segment.targetHours,
                segment.mode === "overtime" ? 1 : 0,
                draft.isRework ? 1 : 0,
                draft.isPriority ? 1 : 0,
                initialStatus,
                draft.note ?? null,
              ],
            );
            createdIds.push(planId);
          }

          if (!isManualNonTechnical) {
            await lockPanel(connection, countdown);
          }
          continue;
        }

        if (!draft.coreId) {
          throw new Error("COUNTDOWN_NOT_FOUND");
        }

        const countdown = await assertCountdownAccessible(connection, params, draft.coreId);
        const initialStatus = await resolveInitialSubmittedStatus(
          connection,
          countdown.carId,
        );
        const scheduleSegments = buildJobPlanScheduleSegments({
          taskDate: draft.taskDate,
          requestedMode: draft.isOvertime ? "overtime" : "normal",
          targetHours: draft.targetHours,
        });

        await checkPanelLock(connection, countdown);
        await assertCountdownCapacity(connection, countdown, draft.targetHours);

        for (const segment of scheduleSegments) {
          const planId = `PLAN-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
          await connection.execute(
            `
              INSERT INTO sm_jobdesc_plan (
                id,
                core_id,
                task_date,
                jobdescription,
                assigned_user_id,
                target_start_hours,
                target_finish_hours,
                dailyTargetHours,
                is_overtime,
                is_rework,
                isPriority,
                status,
                acc_tracking,
                note
              ) VALUES (?, ?, ?, ?, ?, ?, ?, SEC_TO_TIME(? * 3600), ?, 0, ?, ?, 0, ?)
            `,
            [
              planId,
              draft.coreId,
              draft.taskDate,
              draft.jobDescription,
              draft.assignedUserId,
              segment.startTime,
              segment.finishTime,
              segment.targetHours,
              segment.mode === "overtime" ? 1 : 0,
              draft.isPriority ? 1 : 0,
              initialStatus,
              draft.note ?? null,
            ],
          );
          createdIds.push(planId);
        }

        await lockPanel(connection, countdown);
      }

      await connection.commit();
      return { createdIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(params: JobPlanMutationParams): Promise<JobPlanRecord | null> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.planId];
    const scopeSql = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );

    const [rows] = (await pool.query(
      `
        ${buildListSelectSql()}
        WHERE p.id = ?
        ${scopeSql ? `AND ${scopeSql}` : ""}
        LIMIT 1
      `,
      queryParams,
    )) as [JobPlanRow[], unknown];

    return rows[0] ? mapJobPlanRow(rows[0]) : null;
  }

  async update(
    params: JobPlanMutationParams,
    input: UpdateJobPlanRequest,
  ): Promise<{ updatedPlanId: string }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await this.findById(params);
      if (!existing) {
        throw new Error("PLAN_NOT_FOUND");
      }

      if (await isPlanLocked(connection, params.planId)) {
        throw new Error("PLAN_LOCKED");
      }

      const countdown = await assertCountdownAccessible(connection, params, existing.coreId);
      const nextTargetHours = input.targetHours ?? existing.targetHours;
      await checkPanelLock(connection, countdown);
      await assertCountdownCapacity(connection, countdown, nextTargetHours, params.planId);

      await connection.execute(
        `
          UPDATE sm_jobdesc_plan
          SET
            task_date = COALESCE(?, task_date),
            jobdescription = COALESCE(?, jobdescription),
            assigned_user_id = COALESCE(?, assigned_user_id),
            target_start_hours = COALESCE(?, target_start_hours),
            target_finish_hours = COALESCE(?, target_finish_hours),
            dailyTargetHours = COALESCE(SEC_TO_TIME(? * 3600), dailyTargetHours),
            is_overtime = COALESCE(?, is_overtime),
            isPriority = COALESCE(?, isPriority),
            note = COALESCE(?, note)
          WHERE id = ?
        `,
        [
          input.taskDate ?? null,
          input.jobDescription ?? null,
          input.assignedUserId ?? null,
          input.startTime ?? null,
          input.finishTime ?? null,
          input.targetHours ?? null,
          typeof input.isOvertime === "boolean" ? (input.isOvertime ? 1 : 0) : null,
          typeof input.isPriority === "boolean" ? (input.isPriority ? 1 : 0) : null,
          input.note ?? null,
          params.planId,
        ],
      );

      await connection.commit();
      return { updatedPlanId: params.planId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateStatus(
    params: JobPlanMutationParams,
    input: UpdateJobPlanStatusRequest,
  ): Promise<{ planId: string; status: JobPlanStatus }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await this.findById(params);
      if (!existing) {
        throw new Error("PLAN_NOT_FOUND");
      }

      await connection.execute(
        `
          UPDATE sm_jobdesc_plan
          SET status = ?, note = COALESCE(?, note)
          WHERE id = ?
        `,
        [input.status, input.note ?? null, params.planId],
      );

      const countdown = await getCountdownContext(connection, existing.coreId);
      if (countdown && input.status === "REJECTED") {
        await syncPanelLock(connection, countdown);
      }

      await connection.commit();
      return {
        planId: params.planId,
        status: input.status,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(params: JobPlanMutationParams): Promise<void> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await this.findById(params);
      if (!existing) {
        throw new Error("PLAN_NOT_FOUND");
      }

      if (await isPlanLocked(connection, params.planId)) {
        throw new Error("PLAN_LOCKED");
      }

      const countdown = await getCountdownContext(connection, existing.coreId);
      await connection.execute("DELETE FROM sm_jobdesc_plan WHERE id = ?", [params.planId]);
      if (countdown) {
        await syncPanelLock(connection, countdown);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getApproversForCars(
    carIds: string[],
  ): Promise<Array<{ carId: string; kpId: string | null; advisorId: string | null; kdId: string | null }>> {
    if (carIds.length === 0) {
      return [];
    }

    const pool = this.poolFactory();
    const placeholders = carIds.map(() => "?").join(", ");

    interface ApproverRow extends RowDataPacket {
      carId: string;
      kpId: string | null;
      advisorId: string | null;
      kdId: string | null;
    }

    const [rows] = (await pool.query(
      `
        SELECT
          car_id AS carId,
          kp_id AS kpId,
          advisor_id AS advisorId,
          kd_id AS kdId
        FROM car_project_assignment
        WHERE car_id IN (${placeholders})
          AND ended_at IS NULL
      `,
      carIds,
    )) as [ApproverRow[], unknown];

    return rows;
  }
}
