import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateMonitoringActualRequest,
  MonitoringDivisionDetailSummary,
  MonitoringDivisionLoadRecord,
  MonitoringDivisionMemberRecord,
  MonitoringDivisionUnitRecord,
  MonitoringQuery,
  MonitoringSummary,
  MonitoringTaskRecord,
} from "@smsystem/contracts/monitoring";
import { randomUUID } from "node:crypto";
import { isNonTechnicalDivisionReference } from "@smsystem/contracts/division";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

type MonitoringMode =
  | "all"
  | "today"
  | "overtime"
  | "no-start"
  | "no-submit"
  | "active-work";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface MonitoringListParams extends ScopeParams {
  query: MonitoringQuery;
  mode: MonitoringMode;
}

interface MonitoringListPayload {
  rows: MonitoringTaskRecord[];
  total: number;
}

interface MonitoringTaskRow extends RowDataPacket {
  planId: string;
  coreId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  taskDate: string;
  panelName: string | null;
  masterJobName: string | null;
  jobDescription: string;
  instructionText: string;
  targetDailyHours: number | null;
  targetTotalHours: number | null;
  planStatus: string;
  actualStatus: string | null;
  executionStatus: MonitoringTaskRecord["executionStatus"];
  countdownStatus: string | null;
  progressPercent: number | null;
  totalActualHours: number | null;
  remainingHours: number | null;
  latestStartTime: string | null;
  latestFinishTime: string | null;
  latestBreakDurationMinutes: number | null;
  actualDurationHours: number | null;
  actualId: string | null;
  submittedToLedger: number | boolean;
  qcStatus: MonitoringTaskRecord["qcStatus"];
  qcResult: string | null;
  qcNotes: string | null;
  monitoringStatus: string | null;
  monitoringResult: string | null;
  isOvertime: number | boolean;
  isStarted: number | boolean;
  isSubmitted: number | boolean;
  hasDelayRisk: number | boolean;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  activeWork: number | null;
  noStart: number | null;
  noSubmit: number | null;
  delayRisk: number | null;
  overtimeCount: number | null;
}

interface DivisionLoadRow extends RowDataPacket {
  divisionId: number | null;
  divisionName: string | null;
  totalTasks: number | null;
  startedTasks: number | null;
  pendingSubmitTasks: number | null;
  doneTasks: number | null;
  totalActualHours: number | null;
  totalRemainingHours: number | null;
  averageProgressPercent: number | null;
}

interface DivisionUnitRow extends RowDataPacket {
  carId: string;
  unitName: string;
  customerName: string | null;
  totalTasks: number | null;
  startedTasks: number | null;
  pendingSubmitTasks: number | null;
  doneTasks: number | null;
  totalPlannedHours: number | null;
  totalActualHours: number | null;
  totalRemainingHours: number | null;
  averageProgressPercent: number | null;
}

interface DivisionLoadUnitRow extends DivisionUnitRow {
  divisionId: number | null;
}

interface DivisionMemberRow extends RowDataPacket {
  employeeId: string | null;
  employeeName: string | null;
  totalTasks: number | null;
  startedTasks: number | null;
  pendingSubmitTasks: number | null;
  doneTasks: number | null;
  totalPlannedHours: number | null;
  totalActualHours: number | null;
  totalRemainingHours: number | null;
  averageProgressPercent: number | null;
}

interface DivisionNameRow extends RowDataPacket {
  divisionName: string | null;
}

interface OptionRow extends RowDataPacket {
  value: string | number;
  label: string;
  code?: string | null;
  isTeknis?: number | boolean | null;
  divisionId?: number | null;
}

interface DivisionTechnicalRow extends RowDataPacket {
  value: string;
  label: string | null;
  code: string | null;
  isTeknis: number | boolean | null;
}

export interface MonitoringRepository {
  listTasks(params: MonitoringListParams): Promise<MonitoringListPayload>;
  getSummary(params: ScopeParams & { date: string; dateTo?: string }): Promise<MonitoringSummary>;
  listDivisionLoad(params: ScopeParams & { date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string }): Promise<MonitoringDivisionLoadRecord[]>;
  listUnitLoad(params: ScopeParams & { date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo?: string }): Promise<import("@smsystem/contracts/monitoring").MonitoringUnitTimesheetRecord[]>;
  getDivisionDetail(params: ScopeParams & { divisionId: number; date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string }): Promise<{
    divisionName: string | null;
    summary: MonitoringDivisionDetailSummary;
    units: MonitoringDivisionUnitRecord[];
    members: MonitoringDivisionMemberRecord[];
  }>;
  listReferences(params: ScopeParams): Promise<{
    divisions: Array<{ label: string; value: string; code?: string | null; isTeknis?: boolean | null; isTechnical?: boolean | null }>;
    units: Array<{ label: string; value: string }>;
    employees: Array<{ label: string; value: string; divisionId?: number | null }>;
  }>;
  listEmployeeTimesheet(params: ScopeParams & { date: string; dateTo: string }): Promise<Array<{
    employeeId: string | null;
    employeeName: string | null;
    carId: string;
    unitName: string;
    isOvertime: boolean;
    totalActualHours: number;
  }>>;
  createActual(params: ScopeParams & { actorId: string }, input: CreateMonitoringActualRequest): Promise<{
    planId: string;
    actualId: string;
  }>;
  submitActualToLedger(params: ScopeParams & { actorId: string; actorName: string }, actualId: string): Promise<{ ledgerId: string; alreadySubmitted: boolean }>;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  aliases: {
    carId: string;
    divisionId: string;
  },
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [];
  clauses.push("p.assigned_user_id = ?");
  params.push(employeeId);

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ${aliases.carId}
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
      `${aliases.divisionId} IN (${scope.divisionIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.divisionIds);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function executionStatusSql(): string {
  return `
    CASE
      WHEN COALESCE(cd.status, '') IN ('DONE') OR actual.actualStatus = 'done' THEN 'DONE'
      WHEN COALESCE(cd.status, '') IN ('READY_QC', 'QC_READY') OR COALESCE(p.status, '') = 'READY_QC' THEN 'READY_QC'
      WHEN actual.actualStatus = 'pending'
        OR (actual.actualStatus = 'onprogress' AND actual.finishTime IS NOT NULL)
      THEN 'SUBMITTED'
      WHEN actual.actualStatus = 'onprogress' THEN 'ONPROGRESS'
      WHEN actual.actualStatus = 'cancel' THEN 'CANCEL'
      ELSE 'PLAN'
    END
  `;
}

function buildMonitoringBaseSql(): string {
  return `
    SELECT
      p.id AS planId,
      p.core_id AS coreId,
      COALESCE(c.id, cd.id) AS carId,
      COALESCE(c.unit_name, NULLIF(cd.section_name, ''), p.jobdescription, cd.id) AS unitName,
      c.customer_name AS customerName,
      cd.division_id AS divisionId,
      d.name AS divisionName,
      p.assigned_user_id AS employeeId,
      e.full_name AS employeeName,
      DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
      COALESCE(mp.panel_name, mp.name_part, cd.section_name, p.jobdescription) AS panelName,
      COALESCE(mjt.job_name, wo.job_detail, cd.section_name, p.jobdescription, cd.task_category) AS masterJobName,
      COALESCE(
        NULLIF(TRIM(p.jobdescription), ''),
        NULLIF(TRIM(actual.dailyNotes), ''),
        wo.job_detail,
        mjt.job_name,
        cd.section_name,
        cd.task_category,
        '-'
      ) AS jobDescription,
      COALESCE(
        NULLIF(TRIM(p.jobdescription), ''),
        NULLIF(TRIM(actual.dailyNotes), ''),
        wo.job_detail,
        mjt.job_name,
        cd.section_name,
        cd.task_category,
        ''
      ) AS instructionText,
      ROUND(TIME_TO_SEC(p.dailyTargetHours) / 3600, 2) AS targetDailyHours,
      ROUND(COALESCE(cd.target_hours_revised, cd.target_hours_initial, 0), 2) AS targetTotalHours,
      COALESCE(p.status, 'PLAN') AS planStatus,
      actual.actualStatus AS actualStatus,
      ${executionStatusSql()} AS executionStatus,
      cd.status AS countdownStatus,
      ROUND(COALESCE(actual.progres, cd.actual_progress_percent, 0), 2) AS progressPercent,
      ROUND(
        CASE
          WHEN cd.car_id IS NULL THEN COALESCE(actual.durationHours, 0)
          ELSE COALESCE(cd.total_actual_hours, 0)
        END,
        2
      ) AS totalActualHours,
      ROUND(COALESCE(cd.remaining_hours, 0), 2) AS remainingHours,
      DATE_FORMAT(actual.startTime, '%Y-%m-%d %H:%i:%s') AS latestStartTime,
      DATE_FORMAT(actual.finishTime, '%Y-%m-%d %H:%i:%s') AS latestFinishTime,
      actual.breakDurationMinutes AS latestBreakDurationMinutes,
      actual.durationHours AS actualDurationHours,
      actual.latestActualId AS actualId,
      COALESCE(actual.submittedToLedger, 0) AS submittedToLedger,
      DATE_FORMAT(p.target_start_hours, '%H:%i') AS planStartTime,
      DATE_FORMAT(p.target_finish_hours, '%H:%i') AS planFinishTime,
      COALESCE(qc.resultStatus, cd.qc_last_status, 'BELUM_QC') AS qcStatus,
      COALESCE(qc.resultStatus, cd.qc_last_status) AS qcResult,
      qc.qcNotes AS qcNotes,
      validation.validationStatus AS monitoringStatus,
      validation.monitoringResult AS monitoringResult,
      COALESCE(p.is_overtime, 0) AS isOvertime,
      CASE WHEN actual.latestActualId IS NULL THEN 0 ELSE 1 END AS isStarted,
      CASE WHEN actual.actualStatus IN ('pending', 'done') THEN 1 ELSE 0 END AS isSubmitted,
      CASE
        WHEN (p.task_date < ? AND COALESCE(cd.remaining_hours, 0) > 0)
          OR (cd.deadline_date IS NOT NULL AND cd.deadline_date < ? AND cd.status <> 'DONE')
        THEN 1
        ELSE 0
      END AS hasDelayRisk
    FROM sm_jobdesc_plan p
    JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
    LEFT JOIN cars c ON c.id = cd.car_id
    LEFT JOIN sm_divisi d ON d.id = cd.division_id
    LEFT JOIN master_panels mp ON mp.id = cd.panel_id
    LEFT JOIN master_job_types mjt ON mjt.id = cd.job_type_id
    LEFT JOIN sm_jobdesc_wo wo ON wo.id = cd.ref_taks_id
    LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
    LEFT JOIN (
      SELECT
        a.plandaily_id,
        a.id AS latestActualId,
        CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
        a.progres AS progres,
        a.start_time AS startTime,
        a.finish_time AS finishTime,
        a.break_duration_minutes AS breakDurationMinutes,
        a.duration_hours AS durationHours,
        a.daily_notes AS dailyNotes
        ,a.submitted_to_ledger AS submittedToLedger
      FROM sm_jobdesc_actual a
      JOIN (
        SELECT
          plandaily_id,
          MAX(created_at) AS latestCreatedAt
        FROM sm_jobdesc_actual
        GROUP BY plandaily_id
      ) latest
        ON latest.plandaily_id = a.plandaily_id
       AND latest.latestCreatedAt = a.created_at
    ) actual ON actual.plandaily_id = p.id
    LEFT JOIN (
      SELECT q.core_id, q.result_status AS resultStatus, q.qc_notes AS qcNotes
      FROM sm_qc_inspections q
      JOIN (
        SELECT core_id, MAX(inspection_date) AS latestInspectionDate
        FROM sm_qc_inspections
        GROUP BY core_id
      ) latest_qc
        ON latest_qc.core_id = q.core_id
       AND latest_qc.latestInspectionDate = q.inspection_date
    ) qc ON qc.core_id = cd.id
    LEFT JOIN (
      SELECT v.plandaily_id, v.status AS validationStatus, v.note AS monitoringResult
      FROM sm_jobdesc_validation v
      JOIN (
        SELECT plandaily_id, MAX(checkpoint_time) AS latestCheckpointTime
        FROM sm_jobdesc_validation
        GROUP BY plandaily_id
      ) latest_validation
        ON latest_validation.plandaily_id = v.plandaily_id
       AND latest_validation.latestCheckpointTime = v.checkpoint_time
    ) validation ON validation.plandaily_id = p.id
  `;
}

function buildModeClauses(
  mode: MonitoringMode,
  date: string,
  dateTo: string | undefined,
  params: unknown[],
): string[] {
  const clauses: string[] = [];
  const hasRange = Boolean(dateTo && dateTo !== date);
  const pushDateClause = () => {
    if (hasRange) {
      clauses.push("p.task_date BETWEEN ? AND ?");
      params.push(date, dateTo);
      return;
    }

    clauses.push("p.task_date = ?");
    params.push(date);
  };

  if (mode === "today") {
    if (hasRange) {
      clauses.push("DATE(actual.startTime) BETWEEN ? AND ?");
      params.push(date, dateTo);
    } else {
      clauses.push("DATE(actual.startTime) = ?");
      params.push(date);
    }
    clauses.push("COALESCE(p.is_overtime, 0) = 0");
    return clauses;
  }

  if (mode === "all") {
    if (hasRange) {
      clauses.push("DATE(actual.startTime) BETWEEN ? AND ?");
      params.push(date, dateTo);
    } else {
      clauses.push("DATE(actual.startTime) = ?");
      params.push(date);
    }
    return clauses;
  }

  if (mode === "overtime") {
    if (hasRange) {
      clauses.push("DATE(actual.startTime) BETWEEN ? AND ?");
      params.push(date, dateTo);
    } else {
      clauses.push("DATE(actual.startTime) = ?");
      params.push(date);
    }
    clauses.push("COALESCE(p.is_overtime, 0) = 1");
    return clauses;
  }

  if (mode === "no-start") {
    if (hasRange) {
      clauses.push("p.task_date BETWEEN ? AND ?");
      params.push(date, dateTo);
    } else {
      clauses.push("p.task_date < ?");
      params.push(date);
    }
    clauses.push("actual.latestActualId IS NULL");
    return clauses;
  }

  if (mode === "no-submit") {
    if (hasRange) {
      clauses.push("p.task_date BETWEEN ? AND ?");
      params.push(date, dateTo);
    } else {
      clauses.push("p.task_date <= ?");
      params.push(date);
    }
    clauses.push("actual.latestActualId IS NOT NULL", "actual.actualStatus = 'onprogress'");
    return clauses;
  }

  clauses.push("p.task_date <= ?", "actual.actualStatus = 'onprogress'");
  params.push(dateTo ?? date);
  return clauses;
}

function buildFilterClauses(
  query: MonitoringQuery,
  params: unknown[],
): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        COALESCE(c.unit_name, cd.section_name, p.jobdescription, '') LIKE ?
        OR COALESCE(c.customer_name, '') LIKE ?
        OR COALESCE(d.name, '') LIKE ?
        OR COALESCE(e.full_name, '') LIKE ?
        OR COALESCE(cd.section_name, '') LIKE ?
        OR COALESCE(p.jobdescription, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "divisionId") {
      clauses.push("cd.division_id = ?");
      params.push(Number.parseInt(filter.value, 10));
      continue;
    }

    if (filter.field === "carId") {
      clauses.push("COALESCE(c.id, cd.id) = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "employeeId") {
      clauses.push("p.assigned_user_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "planStatus") {
      clauses.push("p.status = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "actualStatus") {
      clauses.push(`${executionStatusSql()} = ?`);
      params.push(filter.value.toUpperCase());
      continue;
    }
  }

  return clauses;
}

function buildOrderBy(sortBy: string, direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    taskDate: "p.task_date",
    unitName: "COALESCE(c.unit_name, cd.section_name, p.jobdescription)",
    divisionName: "d.name",
    employeeName: "e.full_name",
    progressPercent: "progressPercent",
    remainingHours: "remainingHours",
    planStatus: "p.status",
    actualStatus: "executionStatus",
  };

  const column = columnMap[sortBy] ?? "p.task_date";
  return `${column} ${direction.toUpperCase()}, COALESCE(c.unit_name, cd.section_name, p.jobdescription) ASC, p.id ASC`;
}

function mapTaskRow(row: MonitoringTaskRow): MonitoringTaskRecord {
  return {
    planId: row.planId,
    coreId: row.coreId,
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    taskDate: row.taskDate,
    panelName: row.panelName,
    masterJobName: row.masterJobName ?? row.jobDescription ?? row.panelName ?? "-",
    jobDescription: row.jobDescription,
    instructionText: row.instructionText,
    targetDailyHours: Number(row.targetDailyHours ?? 0),
    targetTotalHours:
      row.targetTotalHours === null || row.targetTotalHours === undefined
        ? null
        : Number(row.targetTotalHours),
    planStatus: row.planStatus,
    actualStatus: row.actualStatus,
    executionStatus: row.executionStatus,
    countdownStatus: row.countdownStatus,
    progressPercent: Number(row.progressPercent ?? 0),
    totalActualHours: Number(row.totalActualHours ?? 0),
    remainingHours: Number(row.remainingHours ?? 0),
    latestStartTime: row.latestStartTime,
    latestFinishTime: row.latestFinishTime,
    latestBreakDurationMinutes:
      row.latestBreakDurationMinutes === null || row.latestBreakDurationMinutes === undefined
        ? null
        : Number(row.latestBreakDurationMinutes),
    actualStartTime: row.latestStartTime,
    actualBreakMinutes:
      row.latestBreakDurationMinutes === null || row.latestBreakDurationMinutes === undefined
        ? null
        : Number(row.latestBreakDurationMinutes),
    actualFinishTime: row.latestFinishTime,
    actualDurationHours:
      row.actualDurationHours === null || row.actualDurationHours === undefined
        ? null
        : Number(row.actualDurationHours),
    actualId: row.actualId,
    submittedToLedger: Boolean(row.submittedToLedger),
    qcStatus: row.qcStatus,
    qcResult: row.qcResult,
    qcNotes: row.qcNotes,
    monitoringStatus: row.monitoringStatus,
    monitoringResult: row.monitoringResult,
    isOvertime: Boolean(row.isOvertime),
    isStarted: Boolean(row.isStarted),
    isSubmitted: Boolean(row.isSubmitted),
    hasDelayRisk: Boolean(row.hasDelayRisk),
  };
}

function toOptionRows(rows: OptionRow[]): Array<{ label: string; value: string }> {
  return rows.map((row) => ({
    label: row.label,
    value: String(row.value),
  }));
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

function calculateActualHours(date: string, startTime: string, finishTime: string, breakMinutes: number): number {
  const start = combineDateTime(date, startTime).getTime();
  let finish = combineDateTime(date, finishTime).getTime();
  if (finish < start) {
    finish += 86_400_000;
  }

  const minutes = Math.max(0, (finish - start) / 60_000 - breakMinutes);
  return Number((minutes / 60).toFixed(2));
}

function mapActualStatus(status: CreateMonitoringActualRequest["taskStatus"]): "pending" | "onprogress" | "done" | "cancel" {
  if (status === "DONE" || status === "READY_QC") {
    return "done";
  }

  if (status === "CANCEL") {
    return "cancel";
  }

  if (status === "PENDING") {
    return "pending";
  }

  return "onprogress";
}

async function getDivisionTechnicalReference(
  connection: Pick<Pool, "query">,
  divisionId: number,
) {
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
    ...row,
    isTeknis: row.isTeknis === null || row.isTeknis === undefined ? null : Boolean(row.isTeknis),
  } as any;
}

async function createManualCountdown(
  connection: Pick<Pool, "execute" | "query">,
  params: { actorId: string },
  input: CreateMonitoringActualRequest,
): Promise<string> {
  const division = await getDivisionTechnicalReference(connection, input.divisionId);
  if (!isNonTechnicalDivisionReference(division)) {
    throw new Error("MANUAL_TECHNICAL_ACTUAL_REQUIRES_PLAN");
  }

  const coreId = randomUUID();
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
      ) VALUES (?, ?, ?, 'ADDITIONAL', NULL, NULL, NULL, ?, NULL, 0, 0, 0, 0, 0, 0, 'PLAN', NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, 0, NULL, ?, NULL)
    `,
    [
      coreId,
      input.carId || null,
      input.divisionId,
      input.jobDescription,
      now,
      input.date,
      input.date,
      now,
      params.actorId,
      input.resultNote ?? null,
    ],
  );

  return coreId;
}

function buildDivisionMonitoringWhere(
  params: ScopeParams & {
    divisionId?: number;
    date: string;
    mode: "all" | "normal" | "overtime";
    span: "daily" | "weekly";
    dateTo: string;
  },
  queryParams: unknown[],
): string[] {
  const whereClauses: string[] = [];

  if (params.mode !== "all") {
    whereClauses.push(`COALESCE(p.is_overtime, 0) = ${params.mode === "overtime" ? "1" : "0"}`);
  }

  if (params.span === "weekly") {
    whereClauses.unshift("p.task_date BETWEEN ? AND ?");
    queryParams.push(params.date, params.dateTo);
  } else {
    whereClauses.unshift("p.task_date = ?");
    queryParams.push(params.date);
  }

  if (params.divisionId !== undefined) {
    whereClauses.push("cd.division_id = ?");
    queryParams.push(params.divisionId);
  }

  const scopeWhere = buildScopeWhereClause(
    params.scope,
    params.employeeId,
    queryParams,
    {
      carId: "c.id",
      divisionId: "cd.division_id",
    },
  );

  if (scopeWhere) {
    whereClauses.push(scopeWhere);
  }
  whereClauses.push("COALESCE(c.status, 'In_Progress') <> 'DONE'");
  whereClauses.push("p.assigned_user_id IS NOT NULL");

  return whereClauses;
}

export class MySqlMonitoringRepository implements MonitoringRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async createActual(
    params: ScopeParams & { actorId: string },
    input: CreateMonitoringActualRequest,
  ): Promise<{ planId: string; actualId: string }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    const actualHours = calculateActualHours(
      input.date,
      input.startTime,
      input.finishTime,
      input.breakMinutes,
    );
    const planStatus = input.taskStatus === "DONE"
      ? "DONE"
      : input.taskStatus === "READY_QC"
        ? "READY_QC"
        : input.taskStatus === "CANCEL"
          ? "CANCEL"
          : input.taskStatus === "PENDING"
            ? "ONPROGRESS"
            : "ONPROGRESS";

    try {
      await connection.beginTransaction();

      let planId = input.planId?.trim() || "";
      if (!planId) {
        const coreId = await createManualCountdown(connection, params, input);
        planId = `PLAN-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, SEC_TO_TIME(? * 3600), ?, 0, 0, 'PLAN', 0, ?)
          `,
          [
            planId,
            coreId,
            input.date,
            input.jobDescription,
            input.employeeId,
            input.startTime,
            input.finishTime,
            Math.max(actualHours, 0.01),
            input.isOvertime ? 1 : 0,
            input.resultNote ?? null,
          ],
        );
      } else {
        await connection.execute(
          `
            UPDATE sm_jobdesc_plan
            SET status = ?,
                jobdescription = COALESCE(NULLIF(?, ''), jobdescription),
                target_start_hours = COALESCE(?, target_start_hours),
                target_finish_hours = COALESCE(?, target_finish_hours),
                is_overtime = ?,
                note = COALESCE(?, note)
            WHERE id = ?
          `,
          [
            planStatus,
            input.jobDescription,
            input.startTime,
            input.finishTime,
            input.isOvertime ? 1 : 0,
            input.resultNote ?? null,
            planId,
          ],
        );
      }

      const actualId = randomUUID();
      await connection.execute(
        `
          INSERT INTO sm_jobdesc_actual (
            id,
            plandaily_id,
            start_time,
            finish_time,
            break_duration_minutes,
            billed_duration_hours,
            duration_hours,
            is_overtime,
            is_verify,
            verified_by,
            daily_notes,
            status,
            progres,
            submitted_to_ledger,
            submitted_at,
            submitted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 0, ?, ?)
        `,
        [
          actualId,
          planId,
          `${input.date} ${input.startTime}:00`,
          `${input.date} ${input.finishTime}:00`,
          input.breakMinutes,
          actualHours,
          actualHours,
          input.isOvertime ? 1 : 0,
          input.resultNote || input.jobDescription,
          mapActualStatus(input.taskStatus),
          Math.round(input.progressPercent),
          input.taskStatus === "PENDING" ? new Date() : null,
          params.actorId,
        ],
      );

      await connection.execute(
        `
          UPDATE sm_jobdesc_plan
          SET status = ?
          WHERE id = ?
        `,
        [planStatus, planId],
      );

      await connection.commit();
      return { planId, actualId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async submitActualToLedger(
    params: ScopeParams & { actorId: string; actorName: string }, actualId: string,
  ): Promise<{ ledgerId: string; alreadySubmitted: boolean }> {
    const connection = await this.poolFactory().getConnection();
    try {
      await connection.beginTransaction();
      const scopeParams: unknown[] = [];
      const scopeWhere = buildScopeWhereClause(
        params.scope,
        params.employeeId,
        scopeParams,
        {
          carId: "COALESCE(cd.car_id, p.car_id)",
          divisionId: "COALESCE(cd.division_id, p.division_id)",
        },
      );
      const [rows] = await connection.query<Array<RowDataPacket & Record<string, unknown>>>(`
        SELECT a.submitted_to_ledger submittedToLedger, p.id planId, p.core_id countdownId,
          COALESCE(cd.car_id, p.car_id) carId,
          COALESCE(cd.division_id, p.division_id) divisionId,
          p.assigned_user_id employeeId,
          COALESCE(e.full_name, p.assigned_user_id) employeeName,
          DATE(COALESCE(a.start_time, p.task_date)) workDate, TIME(a.start_time) startTime,
          TIME(a.finish_time) finishTime, COALESCE(a.break_duration_minutes, 0) / 60 breakHours,
          COALESCE(a.billed_duration_hours, a.duration_hours, 0) durationHours,
          IF(a.is_overtime = 1, COALESCE(a.billed_duration_hours, a.duration_hours, 0), 0) overtimeHours,
          a.progres progressPercent, a.daily_notes progressNotes, a.status actualStatus
        FROM sm_jobdesc_actual a JOIN sm_jobdesc_plan p ON p.id = a.plandaily_id
        LEFT JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        WHERE a.id = ?${scopeWhere ? ` AND ${scopeWhere}` : ""} FOR UPDATE`, [actualId, ...scopeParams]);
      const row = rows[0];
      if (!row) throw new Error("ACTUAL_NOT_FOUND");
      const [existing] = await connection.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM sm_work_ledger WHERE actual_id = ? LIMIT 1", [actualId]);
      if (row.submittedToLedger || existing[0]) {
        await connection.rollback();
        return { ledgerId: existing[0]?.id ?? "", alreadySubmitted: true };
      }
      if (!row.finishTime || !["done", "pending"].includes(String(row.actualStatus))) throw new Error("ACTUAL_NOT_READY");
      const ledgerId = randomUUID();
      await connection.execute(`INSERT INTO sm_work_ledger (
        id, actual_id, plan_id, countdown_id, car_id, division_id, employee_id, employee_name,
        work_date, start_time, finish_time, break_hours, duration_hours, overtime_hours,
        progress_percent, progress_notes, task_status, submitted_by, submitted_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        ledgerId, actualId, row.planId, row.countdownId, row.carId, row.divisionId,
        row.employeeId, row.employeeName, row.workDate, row.startTime, row.finishTime,
        row.breakHours, row.durationHours, row.overtimeHours, row.progressPercent,
        row.progressNotes, String(row.actualStatus) === "done" ? "DONE" : "ON_PROGRESS",
        params.actorId, params.actorName,
      ]);
      await connection.execute(`INSERT INTO sm_work_ledger_photos (
        id, ledger_id, photo_type, photo_url, caption, taken_by, taken_by_name, taken_at
      ) SELECT UUID(), ?, tp.photo_type, tp.photo_url, tp.caption, tp.uploaded_by,
        COALESCE(u.full_name, tp.uploaded_by), tp.uploaded_at
        FROM sm_work_photos_temp tp LEFT JOIN sm_employee u ON u.employee_id = tp.uploaded_by
        WHERE tp.actual_id = ?`, [ledgerId, actualId]);
      await connection.execute("UPDATE sm_jobdesc_actual SET submitted_to_ledger = 1, submitted_at = NOW(), submitted_by = ? WHERE id = ?", [params.actorId, actualId]);
      await connection.commit();
      return { ledgerId, alreadySubmitted: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listTasks(params: MonitoringListParams): Promise<MonitoringListPayload> {
    const pool = this.poolFactory();
    const asOfDate = params.query.dateTo ?? params.query.date;
    const baseParams: unknown[] = [asOfDate, asOfDate];
    const whereClauses = buildModeClauses(params.mode, params.query.date, params.query.dateTo, baseParams);
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      baseParams,
      {
        carId: "c.id",
        divisionId: "cd.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    whereClauses.push("COALESCE(c.status, 'In_Progress') <> 'DONE'");
    whereClauses.push("p.assigned_user_id IS NOT NULL");
    whereClauses.push(...buildFilterClauses(params.query, baseParams));
    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const limit = params.query.limit;
    const offset = (params.query.page - 1) * params.query.limit;

    const [rows] = (await pool.query(
      `
        ${buildMonitoringBaseSql()}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      [...baseParams, limit, offset],
    )) as [MonitoringTaskRow[], unknown];

    const countParams: unknown[] = [asOfDate, asOfDate];
    const countWhereClauses = buildModeClauses(params.mode, params.query.date, params.query.dateTo, countParams);
    const countScopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      countParams,
      {
        carId: "c.id",
        divisionId: "cd.division_id",
      },
    );
    if (countScopeWhere) {
      countWhereClauses.push(countScopeWhere);
    }
    countWhereClauses.push("COALESCE(c.status, 'In_Progress') <> 'DONE'");
    countWhereClauses.push("p.assigned_user_id IS NOT NULL");
    countWhereClauses.push(...buildFilterClauses(params.query, countParams));

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM (
          ${buildMonitoringBaseSql()}
        ) monitoring_base
        JOIN sm_jobdesc_plan p ON p.id = monitoring_base.planId
        JOIN sm_jobdesc_countdown cd ON cd.id = monitoring_base.coreId
        LEFT JOIN cars c ON c.id = cd.car_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.id AS latestActualId,
            CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
            a.start_time AS startTime,
            a.finish_time AS finishTime
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT
              plandaily_id,
              MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual
            GROUP BY plandaily_id
          ) latest
            ON latest.plandaily_id = a.plandaily_id
           AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        ${
          countWhereClauses.length > 0
            ? `WHERE ${countWhereClauses.join(" AND ")}`
            : ""
        }
      `,
      countParams,
    )) as [CountRow[], unknown];

    return {
      rows: rows.map(mapTaskRow),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async getSummary(params: ScopeParams & { date: string; dateTo?: string }): Promise<MonitoringSummary> {
    const pool = this.poolFactory();
    const asOfDate = params.dateTo ?? params.date;
    const queryParams: unknown[] = [];
    const whereClauses: string[] = [];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "c.id",
        divisionId: "cd.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }
    whereClauses.push("COALESCE(c.status, 'In_Progress') <> 'DONE'");
    whereClauses.push("p.assigned_user_id IS NOT NULL");

    const [rows] = (await pool.query(
      `
        SELECT
          SUM(CASE WHEN p.task_date <= ? AND actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS activeWork,
          SUM(CASE WHEN p.task_date < ? AND actual.latestActualId IS NULL AND COALESCE(p.is_overtime, 0) = 0 THEN 1 ELSE 0 END) AS noStart,
          SUM(CASE WHEN p.task_date BETWEEN ? AND ? AND actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS noSubmit,
          SUM(
            CASE
              WHEN (p.task_date < ? AND COALESCE(cd.remaining_hours, 0) > 0)
                OR (cd.deadline_date IS NOT NULL AND cd.deadline_date < ? AND cd.status <> 'DONE')
              THEN 1
              ELSE 0
            END
          ) AS delayRisk,
          SUM(CASE WHEN p.task_date BETWEEN ? AND ? AND COALESCE(p.is_overtime, 0) = 1 THEN 1 ELSE 0 END) AS overtimeCount
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.id AS latestActualId,
            CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT
              plandaily_id,
              MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual
            GROUP BY plandaily_id
          ) latest
            ON latest.plandaily_id = a.plandaily_id
           AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      `,
      [
        params.date,
        asOfDate,
        params.date,
        asOfDate,
        asOfDate,
        asOfDate,
        params.date,
        asOfDate,
        ...queryParams,
      ],
    )) as [SummaryRow[], unknown];

    const row = rows[0];
    return {
      activeWork: Number(row?.activeWork ?? 0),
      noStart: Number(row?.noStart ?? 0),
      noSubmit: Number(row?.noSubmit ?? 0),
      delayRisk: Number(row?.delayRisk ?? 0),
      overtimeCount: Number(row?.overtimeCount ?? 0),
    };
  }

  async listDivisionLoad(
    params: ScopeParams & { date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string },
  ): Promise<MonitoringDivisionLoadRecord[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const whereClauses = buildDivisionMonitoringWhere(params, queryParams);
    const unitParams: unknown[] = [];
    const unitWhereClauses = buildDivisionMonitoringWhere(params, unitParams);

    const rows = (await pool.query(
      `
        SELECT
          cd.division_id AS divisionId,
          d.name AS divisionName,
          COUNT(*) AS totalTasks,
          SUM(CASE WHEN actual.latestActualId IS NOT NULL THEN 1 ELSE 0 END) AS startedTasks,
          SUM(CASE WHEN actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS pendingSubmitTasks,
          SUM(CASE WHEN actual.actualStatus = 'done' OR p.status = 'READY_QC' THEN 1 ELSE 0 END) AS doneTasks,
          ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours,
          ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 0 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS normalActualHours,
          ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 1 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS overtimeActualHours,
          ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
          ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.id AS latestActualId,
            CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
            a.progres AS progres,
            a.duration_hours AS durationHours
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT
              plandaily_id,
              MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual
            GROUP BY plandaily_id
          ) latest
            ON latest.plandaily_id = a.plandaily_id
           AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY cd.division_id, d.name
        ORDER BY d.name ASC
      `,
      queryParams,
    )) as [DivisionLoadRow[], unknown];

    let unitRows: [DivisionLoadUnitRow[], unknown] = [[], undefined];
    try {
      unitRows = (await pool.query(
        `
          SELECT
            cd.division_id AS divisionId,
            c.id AS carId,
            c.unit_name AS unitName,
            c.customer_name AS customerName,
            COUNT(*) AS totalTasks,
            SUM(CASE WHEN actual.latestActualId IS NOT NULL THEN 1 ELSE 0 END) AS startedTasks,
            SUM(CASE WHEN actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS pendingSubmitTasks,
            SUM(CASE WHEN actual.actualStatus = 'done' OR p.status = 'READY_QC' THEN 1 ELSE 0 END) AS doneTasks,
            ROUND(SUM(COALESCE(TIME_TO_SEC(p.dailyTargetHours) / 3600, 0)), 2) AS totalPlannedHours,
            ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 0 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS normalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 1 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS overtimeActualHours,
            ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
            ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN (
            SELECT
              a.plandaily_id,
              a.id AS latestActualId,
              CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
              a.progres AS progres,
              a.duration_hours AS durationHours
            FROM sm_jobdesc_actual a
            JOIN (
              SELECT
                plandaily_id,
                MAX(created_at) AS latestCreatedAt
              FROM sm_jobdesc_actual
              GROUP BY plandaily_id
            ) latest
              ON latest.plandaily_id = a.plandaily_id
             AND latest.latestCreatedAt = a.created_at
          ) actual ON actual.plandaily_id = p.id
          WHERE ${unitWhereClauses.join(" AND ")}
          GROUP BY cd.division_id, c.id, c.unit_name, c.customer_name
          ORDER BY c.unit_name ASC
        `,
        unitParams,
      )) as [DivisionLoadUnitRow[], unknown];
    } catch (error) {
      console.error("[monitoring] division unit load failed", error);
    }

    const unitsByDivision = new Map<string, MonitoringDivisionUnitRecord[]>();
    for (const row of unitRows[0]) {
      const divisionKey = String(row.divisionId ?? "unknown");
      const units = unitsByDivision.get(divisionKey) ?? [];
      units.push({
        carId: row.carId,
        unitName: row.unitName,
        customerName: row.customerName,
        totalTasks: Number(row.totalTasks ?? 0),
        startedTasks: Number(row.startedTasks ?? 0),
        pendingSubmitTasks: Number(row.pendingSubmitTasks ?? 0),
        doneTasks: Number(row.doneTasks ?? 0),
        totalPlannedHours: Number(row.totalPlannedHours ?? 0),
        totalActualHours: Number(row.totalActualHours ?? 0),
        normalActualHours: Number(row.normalActualHours ?? 0),
        overtimeActualHours: Number(row.overtimeActualHours ?? 0),
        totalRemainingHours: Number(row.totalRemainingHours ?? 0),
        averageProgressPercent: Number(row.averageProgressPercent ?? 0),
      });
      unitsByDivision.set(divisionKey, units);
    }

    return rows[0].map((row) => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      totalTasks: Number(row.totalTasks ?? 0),
      startedTasks: Number(row.startedTasks ?? 0),
      pendingSubmitTasks: Number(row.pendingSubmitTasks ?? 0),
      doneTasks: Number(row.doneTasks ?? 0),
      totalActualHours: Number(row.totalActualHours ?? 0),
      normalActualHours: Number(row.normalActualHours ?? 0),
      overtimeActualHours: Number(row.overtimeActualHours ?? 0),
      totalRemainingHours: Number(row.totalRemainingHours ?? 0),
      averageProgressPercent: Number(row.averageProgressPercent ?? 0),
      units: unitsByDivision.get(String(row.divisionId ?? "unknown")) ?? [],
    }));
  }

  async getDivisionDetail(
    params: ScopeParams & { divisionId: number; date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string },
  ): Promise<{
    divisionName: string | null;
    summary: MonitoringDivisionDetailSummary;
    units: MonitoringDivisionUnitRecord[];
    members: MonitoringDivisionMemberRecord[];
  }> {
    const pool = this.poolFactory();
    const unitParams: unknown[] = [];
    const unitWhereClauses = buildDivisionMonitoringWhere(params, unitParams);
    const memberParams: unknown[] = [];
    const memberWhereClauses = buildDivisionMonitoringWhere(params, memberParams);

    const nameParams: unknown[] = [];
    const nameWhereClauses = buildDivisionMonitoringWhere(params, nameParams);

    const [unitRows, memberRows, divisionNameRows] = await Promise.all([
      pool.query(
        `
          SELECT
            c.id AS carId,
            c.unit_name AS unitName,
            c.customer_name AS customerName,
            COUNT(*) AS totalTasks,
            SUM(CASE WHEN actual.latestActualId IS NOT NULL THEN 1 ELSE 0 END) AS startedTasks,
            SUM(CASE WHEN actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS pendingSubmitTasks,
            SUM(CASE WHEN actual.actualStatus = 'done' OR p.status = 'READY_QC' THEN 1 ELSE 0 END) AS doneTasks,
            ROUND(SUM(COALESCE(TIME_TO_SEC(p.dailyTargetHours) / 3600, 0)), 2) AS totalPlannedHours,
            ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 0 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS normalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 1 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS overtimeActualHours,
            ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
            ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN (
            SELECT
              a.plandaily_id,
              a.id AS latestActualId,
              CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
              a.progres AS progres,
              a.duration_hours AS durationHours
            FROM sm_jobdesc_actual a
            JOIN (
              SELECT
                plandaily_id,
                MAX(created_at) AS latestCreatedAt
              FROM sm_jobdesc_actual
              GROUP BY plandaily_id
            ) latest
              ON latest.plandaily_id = a.plandaily_id
             AND latest.latestCreatedAt = a.created_at
          ) actual ON actual.plandaily_id = p.id
          WHERE ${unitWhereClauses.join(" AND ")}
          GROUP BY c.id, c.unit_name, c.customer_name
          ORDER BY c.unit_name ASC
        `,
        unitParams,
      ) as Promise<[DivisionUnitRow[], unknown]>,
      pool.query(
        `
          SELECT
            p.assigned_user_id AS employeeId,
            e.full_name AS employeeName,
            COUNT(*) AS totalTasks,
            SUM(CASE WHEN actual.latestActualId IS NOT NULL THEN 1 ELSE 0 END) AS startedTasks,
            SUM(CASE WHEN actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS pendingSubmitTasks,
            SUM(CASE WHEN actual.actualStatus = 'done' OR p.status = 'READY_QC' THEN 1 ELSE 0 END) AS doneTasks,
            ROUND(SUM(COALESCE(TIME_TO_SEC(p.dailyTargetHours) / 3600, 0)), 2) AS totalPlannedHours,
            ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 0 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS normalActualHours,
            ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 1 THEN COALESCE(actual.durationHours, 0) ELSE 0 END), 2) AS overtimeActualHours,
            ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
            ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
          LEFT JOIN (
            SELECT
              a.plandaily_id,
              a.id AS latestActualId,
              CASE WHEN a.status = 'onprogress' AND a.finish_time IS NOT NULL THEN 'pending' ELSE a.status END AS actualStatus,
              a.progres AS progres,
              a.duration_hours AS durationHours
            FROM sm_jobdesc_actual a
            JOIN (
              SELECT
                plandaily_id,
                MAX(created_at) AS latestCreatedAt
              FROM sm_jobdesc_actual
              GROUP BY plandaily_id
            ) latest
              ON latest.plandaily_id = a.plandaily_id
             AND latest.latestCreatedAt = a.created_at
          ) actual ON actual.plandaily_id = p.id
          WHERE ${memberWhereClauses.join(" AND ")}
          GROUP BY p.assigned_user_id, e.full_name
          ORDER BY e.full_name ASC, p.assigned_user_id ASC
        `,
        memberParams,
      ) as Promise<[DivisionMemberRow[], unknown]>,
      pool.query(
        `
          SELECT
            d.name AS divisionName
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
          WHERE ${nameWhereClauses.join(" AND ")}
          LIMIT 1
        `,
        nameParams,
      ) as Promise<[DivisionNameRow[], unknown]>,
    ]);

    const units = unitRows[0].map((row) => ({
      carId: row.carId,
      unitName: row.unitName,
      customerName: row.customerName,
      totalTasks: Number(row.totalTasks ?? 0),
      startedTasks: Number(row.startedTasks ?? 0),
      pendingSubmitTasks: Number(row.pendingSubmitTasks ?? 0),
      doneTasks: Number(row.doneTasks ?? 0),
      totalPlannedHours: Number(row.totalPlannedHours ?? 0),
      totalActualHours: Number(row.totalActualHours ?? 0),
      normalActualHours: Number(row.normalActualHours ?? 0),
      overtimeActualHours: Number(row.overtimeActualHours ?? 0),
      totalRemainingHours: Number(row.totalRemainingHours ?? 0),
      averageProgressPercent: Number(row.averageProgressPercent ?? 0),
    }));

    const members = memberRows[0].map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      totalTasks: Number(row.totalTasks ?? 0),
      startedTasks: Number(row.startedTasks ?? 0),
      pendingSubmitTasks: Number(row.pendingSubmitTasks ?? 0),
      doneTasks: Number(row.doneTasks ?? 0),
      totalPlannedHours: Number(row.totalPlannedHours ?? 0),
      totalActualHours: Number(row.totalActualHours ?? 0),
      normalActualHours: Number(row.normalActualHours ?? 0),
      overtimeActualHours: Number(row.overtimeActualHours ?? 0),
      totalRemainingHours: Number(row.totalRemainingHours ?? 0),
      averageProgressPercent: Number(row.averageProgressPercent ?? 0),
    }));

    const summary: MonitoringDivisionDetailSummary = {
      totalUnits: units.length,
      totalMembers: members.length,
      totalTasks: units.reduce((sum, row) => sum + row.totalTasks, 0),
      totalPlannedHours: Number(units.reduce((sum, row) => sum + row.totalPlannedHours, 0).toFixed(2)),
      totalActualHours: Number(units.reduce((sum, row) => sum + row.totalActualHours, 0).toFixed(2)),
      totalRemainingHours: Number(units.reduce((sum, row) => sum + row.totalRemainingHours, 0).toFixed(2)),
    };

    return {
      divisionName: divisionNameRows[0]?.[0]?.divisionName ?? null,
      summary,
      units,
      members,
    };
  }

  async listReferences(params: ScopeParams) {
    const pool = this.poolFactory();
    const divisionParams: unknown[] = [];
    const divisionWhereClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      if (params.scope.divisionIds.length > 0) {
        divisionWhereClauses.push(`d.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`);
        divisionParams.push(...params.scope.divisionIds);
      } else {
        divisionWhereClauses.push("d.id = (SELECT e_scope.division_id FROM sm_employee e_scope WHERE e_scope.employee_id = ? LIMIT 1)");
        divisionParams.push(params.employeeId);
      }
    }

    const unitParams: unknown[] = [];
    const unitWhereClauses: string[] = [];
    if (!params.scope.canViewAllUnits) {
      if (params.scope.unitIds.length > 0) {
        unitWhereClauses.push(`c.id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        unitParams.push(...params.scope.unitIds);
      }

      if (params.scope.canViewAssignedUnits) {
        unitWhereClauses.push(
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

    const [divisionRows, unitRows, employeeRows] = await Promise.all([
      pool.query(
        `
          SELECT DISTINCT
            d.id AS value,
            d.name AS label,
            d.code AS code,
            d.isteknis AS isTeknis
          FROM sm_divisi d
          ${divisionWhereClauses.length > 0 ? `WHERE ${divisionWhereClauses.join(" AND ")}` : ""}
          ORDER BY d.name ASC
        `,
        divisionParams,
      ) as Promise<[OptionRow[], unknown]>,
      pool.query(
        `
          SELECT DISTINCT
            c.id AS value,
            c.unit_name AS label
          FROM cars c
          ${
            params.scope.canViewAllUnits
              ? ""
              : unitWhereClauses.length > 0
                ? `WHERE ${unitWhereClauses.join(" OR ")}`
                : "WHERE 1 = 0"
          }
          ORDER BY c.unit_name ASC
        `,
        unitParams,
      ) as Promise<[OptionRow[], unknown]>,
      pool.query(
        `
          SELECT DISTINCT
            e.employee_id AS value,
            e.full_name AS label,
            e.division_id AS divisionId
          FROM sm_employee e
          WHERE e.is_active = 1
          ORDER BY e.full_name ASC
        `,
      ) as Promise<[OptionRow[], unknown]>,
    ]);

    return {
      divisions: divisionRows[0].map((row) => ({
        label: row.label,
        value: String(row.value),
        code: row.code ?? null,
        isTeknis:
          row.isTeknis === null || row.isTeknis === undefined
            ? null
            : toBoolean(row.isTeknis),
        isTechnical:
          row.isTeknis === null || row.isTeknis === undefined
            ? null
            : toBoolean(row.isTeknis),
      })),
      units: toOptionRows(unitRows[0]),
      employees: employeeRows[0].map((row) => ({
        label: row.label,
        value: String(row.value),
        divisionId: row.divisionId ?? null,
      })),
    };
  }

  async listEmployeeTimesheet(params: ScopeParams & { date: string; dateTo: string }) {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.dateTo];
    const whereClauses: string[] = ["p.task_date BETWEEN ? AND ?"];

    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "c.id",
        divisionId: "cd.division_id",
      },
    );

    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          p.assigned_user_id AS employeeId,
          e.full_name AS employeeName,
          COALESCE(c.id, cd.id) AS carId,
          COALESCE(c.unit_name, NULLIF(cd.section_name, ''), p.jobdescription, cd.id) AS unitName,
          COALESCE(p.is_overtime, 0) AS isOvertime,
          ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        LEFT JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.duration_hours AS durationHours
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT
              plandaily_id,
              MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual
            GROUP BY plandaily_id
          ) latest
            ON latest.plandaily_id = a.plandaily_id
           AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY e.full_name ASC
      `,
      queryParams,
    );

    return rows.map((row) => ({
      employeeId: row.employeeId as string | null,
      employeeName: row.employeeName as string | null,
      carId: row.carId as string,
      unitName: row.unitName as string,
      isOvertime: Boolean(row.isOvertime),
      totalActualHours: Number(row.totalActualHours ?? 0),
    }));
  }

  async listUnitLoad(
    params: ScopeParams & { date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo?: string }
  ): Promise<import("@smsystem/contracts/monitoring").MonitoringUnitTimesheetRecord[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const resolvedDateTo = params.dateTo ?? params.date;
    const whereClauses = buildDivisionMonitoringWhere(
      { ...params, dateTo: resolvedDateTo },
      queryParams,
    );

    const unitParams = [...queryParams];
    const [unitRows] = (await pool.query(
      `
        SELECT
          COALESCE(c.id, cd.id) AS carId,
          COALESCE(c.unit_name, NULLIF(cd.section_name, ''), p.jobdescription, cd.id) AS unitName,
          c.customer_name AS customerName,
          COUNT(*) AS totalTasks,
          ROUND(SUM(COALESCE(TIME_TO_SEC(p.dailyTargetHours) / 3600, 0)), 2) AS totalPlannedHours,
          ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
          ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        LEFT JOIN cars c ON c.id = cd.car_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.progres AS progres
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT plandaily_id, MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual GROUP BY plandaily_id
          ) latest ON latest.plandaily_id = a.plandaily_id AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY 1, 2, 3
      `,
      unitParams,
    )) as [any[], unknown];

    const empParams = [...queryParams];
    const [empRows] = (await pool.query(
      `
        SELECT
          COALESCE(c.id, cd.id) AS carId,
          p.assigned_user_id AS employeeId,
          e.full_name AS employeeName,
          d.name AS divisionName,
          DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
          COALESCE(p.is_overtime, 0) AS isOvertime,
          ROUND(SUM(COALESCE(actual.durationHours, 0)), 2) AS totalActualHours
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        LEFT JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.duration_hours AS durationHours
          FROM sm_jobdesc_actual a
          JOIN (
            SELECT plandaily_id, MAX(created_at) AS latestCreatedAt
            FROM sm_jobdesc_actual GROUP BY plandaily_id
          ) latest ON latest.plandaily_id = a.plandaily_id AND latest.latestCreatedAt = a.created_at
        ) actual ON actual.plandaily_id = p.id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY 1, 2, 3, 4, 5, 6
      `,
      empParams,
    )) as [any[], unknown];

    const unitMap = new Map<string, any>();
    for (const u of unitRows) {
      unitMap.set(u.carId, u);
    }

    const results: import("@smsystem/contracts/monitoring").MonitoringUnitTimesheetRecord[] = [];
    const carsWithEmp = new Set<string>();

    for (const emp of empRows) {
      const u = unitMap.get(emp.carId);
      if (!u) continue;
      carsWithEmp.add(emp.carId);
      results.push({
        carId: emp.carId,
        unitName: u.unitName,
        customerName: u.customerName ?? null,
        employeeId: emp.employeeId ?? null,
        employeeName: emp.employeeName ?? null,
        divisionName: emp.divisionName ?? null,
        taskDate: typeof emp.taskDate === "string" ? emp.taskDate : (emp.taskDate instanceof Date ? emp.taskDate.toISOString().slice(0, 10) : params.date),
        isOvertime: Boolean(emp.isOvertime),
        totalActualHours: Number(emp.totalActualHours ?? 0),
        totalPlannedHours: Number(u.totalPlannedHours ?? 0),
        totalRemainingHours: Number(u.totalRemainingHours ?? 0),
        averageProgressPercent: Number(u.averageProgressPercent ?? 0),
        totalTasks: Number(u.totalTasks ?? 0),
      });
    }

    for (const u of unitRows) {
      if (!carsWithEmp.has(u.carId)) {
        results.push({
          carId: u.carId,
          unitName: u.unitName,
          customerName: u.customerName ?? null,
          employeeId: null,
          employeeName: null,
          divisionName: null,
          taskDate: params.date,
          isOvertime: false,
          totalActualHours: 0,
          totalPlannedHours: Number(u.totalPlannedHours ?? 0),
          totalRemainingHours: Number(u.totalRemainingHours ?? 0),
          averageProgressPercent: Number(u.averageProgressPercent ?? 0),
          totalTasks: Number(u.totalTasks ?? 0),
        });
      }
    }

    return results;
  }
}
