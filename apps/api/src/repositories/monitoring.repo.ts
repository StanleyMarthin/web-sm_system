import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  MonitoringDivisionDetailSummary,
  MonitoringDivisionLoadRecord,
  MonitoringDivisionMemberRecord,
  MonitoringDivisionUnitRecord,
  MonitoringQuery,
  MonitoringSummary,
  MonitoringTaskRecord,
} from "@smsystem/contracts/monitoring";
import type { GridFilter } from "@smsystem/contracts/grid";
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
  jobDescription: string;
  planStatus: string;
  actualStatus: string | null;
  countdownStatus: string | null;
  progressPercent: number | null;
  totalActualHours: number | null;
  remainingHours: number | null;
  latestStartTime: string | null;
  latestFinishTime: string | null;
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
}

export interface MonitoringRepository {
  listTasks(params: MonitoringListParams): Promise<MonitoringListPayload>;
  getSummary(params: ScopeParams & { date: string }): Promise<MonitoringSummary>;
  listDivisionLoad(params: ScopeParams & { date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string }): Promise<MonitoringDivisionLoadRecord[]>;
  getDivisionDetail(params: ScopeParams & { divisionId: number; date: string; mode: "all" | "normal" | "overtime"; span: "daily" | "weekly"; dateTo: string }): Promise<{
    divisionName: string | null;
    summary: MonitoringDivisionDetailSummary;
    units: MonitoringDivisionUnitRecord[];
    members: MonitoringDivisionMemberRecord[];
  }>;
  listReferences(params: ScopeParams): Promise<{
    divisions: Array<{ label: string; value: string }>;
    units: Array<{ label: string; value: string }>;
    employees: Array<{ label: string; value: string }>;
  }>;
  listEmployeeTimesheet(params: ScopeParams & { date: string; dateTo: string }): Promise<Array<{
    employeeId: string | null;
    employeeName: string | null;
    carId: string;
    unitName: string;
    isOvertime: boolean;
    totalActualHours: number;
  }>>;
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

function buildMonitoringBaseSql(asOfDate: string): string {
  return `
    SELECT
      p.id AS planId,
      p.core_id AS coreId,
      c.id AS carId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      cd.division_id AS divisionId,
      d.name AS divisionName,
      p.assigned_user_id AS employeeId,
      e.full_name AS employeeName,
      DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
      COALESCE(cd.section_name, p.jobdescription) AS panelName,
      COALESCE(NULLIF(TRIM(p.jobdescription), ''), cd.section_name, '-') AS jobDescription,
      COALESCE(p.status, 'PLAN') AS planStatus,
      actual.actualStatus AS actualStatus,
      cd.status AS countdownStatus,
      ROUND(COALESCE(actual.progres, cd.actual_progress_percent, 0), 2) AS progressPercent,
      ROUND(COALESCE(cd.total_actual_hours, 0), 2) AS totalActualHours,
      ROUND(COALESCE(cd.remaining_hours, 0), 2) AS remainingHours,
      DATE_FORMAT(actual.startTime, '%Y-%m-%d %H:%i:%s') AS latestStartTime,
      DATE_FORMAT(actual.finishTime, '%Y-%m-%d %H:%i:%s') AS latestFinishTime,
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
    JOIN cars c ON c.id = cd.car_id
    LEFT JOIN sm_divisi d ON d.id = cd.division_id
    LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
    LEFT JOIN (
      SELECT
        a.plandaily_id,
        a.id AS latestActualId,
        a.status AS actualStatus,
        a.progres AS progres,
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
  `;
}

function buildModeClauses(
  mode: MonitoringMode,
  date: string,
  params: unknown[],
): string[] {
  const clauses: string[] = [];

  if (mode === "today") {
    clauses.push("p.task_date = ?", "COALESCE(p.is_overtime, 0) = 0");
    params.push(date);
    return clauses;
  }

  if (mode === "all") {
    clauses.push("p.task_date = ?");
    params.push(date);
    return clauses;
  }

  if (mode === "overtime") {
    clauses.push("p.task_date = ?", "COALESCE(p.is_overtime, 0) = 1");
    params.push(date);
    return clauses;
  }

  if (mode === "no-start") {
    clauses.push("p.task_date = ?", "actual.latestActualId IS NULL");
    params.push(date);
    return clauses;
  }

  if (mode === "no-submit") {
    clauses.push("p.task_date <= ?", "actual.latestActualId IS NOT NULL", "actual.actualStatus = 'onprogress'");
    params.push(date);
    return clauses;
  }

  clauses.push("p.task_date <= ?", "actual.actualStatus = 'onprogress'");
  params.push(date);
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
        c.unit_name LIKE ?
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
      clauses.push("c.id = ?");
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
      clauses.push("actual.actualStatus = ?");
      params.push(filter.value);
      continue;
    }
  }

  return clauses;
}

function buildOrderBy(sortBy: string, direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    taskDate: "p.task_date",
    unitName: "c.unit_name",
    divisionName: "d.name",
    employeeName: "e.full_name",
    progressPercent: "progressPercent",
    remainingHours: "remainingHours",
    planStatus: "p.status",
    actualStatus: "actual.actualStatus",
  };

  const column = columnMap[sortBy] ?? "p.task_date";
  return `${column} ${direction.toUpperCase()}, c.unit_name ASC, p.id ASC`;
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
    jobDescription: row.jobDescription,
    planStatus: row.planStatus,
    actualStatus: row.actualStatus,
    countdownStatus: row.countdownStatus,
    progressPercent: Number(row.progressPercent ?? 0),
    totalActualHours: Number(row.totalActualHours ?? 0),
    remainingHours: Number(row.remainingHours ?? 0),
    latestStartTime: row.latestStartTime,
    latestFinishTime: row.latestFinishTime,
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

  return whereClauses;
}

export class MySqlMonitoringRepository implements MonitoringRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async listTasks(params: MonitoringListParams): Promise<MonitoringListPayload> {
    const pool = this.poolFactory();
    const baseParams: unknown[] = [params.query.date, params.query.date];
    const whereClauses = buildModeClauses(params.mode, params.query.date, baseParams);
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

    whereClauses.push(...buildFilterClauses(params.query, baseParams));
    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const limit = params.query.limit;
    const offset = (params.query.page - 1) * params.query.limit;

    const [rows] = (await pool.query(
      `
        ${buildMonitoringBaseSql(params.query.date)}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      [...baseParams, limit, offset],
    )) as [MonitoringTaskRow[], unknown];

    const countParams: unknown[] = [params.query.date, params.query.date];
    const countWhereClauses = buildModeClauses(params.mode, params.query.date, countParams);
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
    countWhereClauses.push(...buildFilterClauses(params.query, countParams));

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM (
          ${buildMonitoringBaseSql(params.query.date)}
        ) monitoring_base
        JOIN sm_jobdesc_plan p ON p.id = monitoring_base.planId
        JOIN sm_jobdesc_countdown cd ON cd.id = monitoring_base.coreId
        JOIN cars c ON c.id = monitoring_base.carId
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.id AS latestActualId,
            a.status AS actualStatus
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

  async getSummary(params: ScopeParams & { date: string }): Promise<MonitoringSummary> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.date];
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

    const [rows] = (await pool.query(
      `
        SELECT
          SUM(CASE WHEN p.task_date <= ? AND actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS activeWork,
          SUM(CASE WHEN p.task_date = ? AND actual.latestActualId IS NULL AND COALESCE(p.is_overtime, 0) = 0 THEN 1 ELSE 0 END) AS noStart,
          SUM(CASE WHEN p.task_date <= ? AND actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS noSubmit,
          SUM(
            CASE
              WHEN (p.task_date < ? AND COALESCE(cd.remaining_hours, 0) > 0)
                OR (cd.deadline_date IS NOT NULL AND cd.deadline_date < ? AND cd.status <> 'DONE')
              THEN 1
              ELSE 0
            END
          ) AS delayRisk,
          SUM(CASE WHEN p.task_date = ? AND COALESCE(p.is_overtime, 0) = 1 THEN 1 ELSE 0 END) AS overtimeCount
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN (
          SELECT
            a.plandaily_id,
            a.id AS latestActualId,
            a.status AS actualStatus
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
      [params.date, params.date, params.date, params.date, params.date, params.date, ...queryParams.slice(2)],
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

    const [rows] = (await pool.query(
      `
        SELECT
          cd.division_id AS divisionId,
          d.name AS divisionName,
          COUNT(*) AS totalTasks,
          SUM(CASE WHEN actual.latestActualId IS NOT NULL THEN 1 ELSE 0 END) AS startedTasks,
          SUM(CASE WHEN actual.actualStatus = 'onprogress' THEN 1 ELSE 0 END) AS pendingSubmitTasks,
          SUM(CASE WHEN actual.actualStatus = 'done' OR p.status = 'READY_QC' THEN 1 ELSE 0 END) AS doneTasks,
          ROUND(SUM(COALESCE(cd.total_actual_hours, 0)), 2) AS totalActualHours,
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
            a.status AS actualStatus,
            a.progres AS progres
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

    return rows.map((row) => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      totalTasks: Number(row.totalTasks ?? 0),
      startedTasks: Number(row.startedTasks ?? 0),
      pendingSubmitTasks: Number(row.pendingSubmitTasks ?? 0),
      doneTasks: Number(row.doneTasks ?? 0),
      totalActualHours: Number(row.totalActualHours ?? 0),
      totalRemainingHours: Number(row.totalRemainingHours ?? 0),
      averageProgressPercent: Number(row.averageProgressPercent ?? 0),
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
            ROUND(SUM(COALESCE(p.total_jam, 0)), 2) AS totalPlannedHours,
            ROUND(SUM(COALESCE(cd.total_actual_hours, 0)), 2) AS totalActualHours,
            ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS totalRemainingHours,
            ROUND(AVG(COALESCE(actual.progres, cd.actual_progress_percent, 0)), 2) AS averageProgressPercent
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN (
            SELECT
              a.plandaily_id,
              a.id AS latestActualId,
              a.status AS actualStatus,
              a.progres AS progres
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
            ROUND(SUM(COALESCE(p.total_jam, 0)), 2) AS totalPlannedHours,
            ROUND(SUM(COALESCE(cd.total_actual_hours, 0)), 2) AS totalActualHours,
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
              a.status AS actualStatus,
              a.progres AS progres
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
    const divisionScopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      divisionParams,
      {
        carId: "c.id",
        divisionId: "cd.division_id",
      },
    );
    if (divisionScopeWhere) {
      divisionWhereClauses.push(divisionScopeWhere);
    }

    const [divisionRows, unitRows, employeeRows] = await Promise.all([
      pool.query(
        `
          SELECT DISTINCT
            cd.division_id AS value,
            d.name AS label
          FROM sm_jobdesc_countdown cd
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
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
          JOIN sm_jobdesc_countdown cd ON cd.car_id = c.id
          ${divisionWhereClauses.length > 0 ? `WHERE ${divisionWhereClauses.join(" AND ")}` : ""}
          ORDER BY c.unit_name ASC
        `,
        divisionParams,
      ) as Promise<[OptionRow[], unknown]>,
      pool.query(
        `
          SELECT DISTINCT
            e.employee_id AS value,
            e.full_name AS label
          FROM sm_employee e
          JOIN sm_jobdesc_plan p ON p.assigned_user_id = e.employee_id
          ORDER BY e.full_name ASC
        `,
      ) as Promise<[OptionRow[], unknown]>,
    ]);

    return {
      divisions: toOptionRows(divisionRows[0]),
      units: toOptionRows(unitRows[0]),
      employees: toOptionRows(employeeRows[0]),
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
          c.id AS carId,
          c.unit_name AS unitName,
          COALESCE(p.is_overtime, 0) AS isOvertime,
          ROUND(SUM(COALESCE(cd.total_actual_hours, 0)), 2) AS totalActualHours
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY p.assigned_user_id, e.full_name, c.id, c.unit_name, COALESCE(p.is_overtime, 0)
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
}
