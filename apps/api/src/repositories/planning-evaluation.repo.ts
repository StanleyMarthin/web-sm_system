import type { AuthScope } from "@smsystem/contracts/auth";
import type { PlanningEvaluationMode } from "@smsystem/contracts/planning-evaluation";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

export interface PlanningEvaluationDivisionAggregate {
  divisionId: number | null;
  divisionName: string | null;
  baselineHours: number;
  revisionHours: number;
  actualHours: number;
  baselineUnitCount: number;
  revisionJobCount: number;
  actualUnitCount: number;
}

interface PlanningEvaluationQueryParams extends ScopeParams {
  date: string;
  dateTo: string;
  mode: PlanningEvaluationMode;
}

interface DivisionHoursRow extends RowDataPacket {
  divisionId: number | null;
  divisionName: string | null;
  hours: number | null;
  unitCount?: number | null;
  jobCount?: number | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  aliases: {
    car?: string;
    division?: string;
  },
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [];

  if (aliases.division && scope.divisionIds.length > 0) {
    clauses.push(`${aliases.division} IN (${scope.divisionIds.map(() => "?").join(", ")})`);
    params.push(...scope.divisionIds);
  }

  if (aliases.car && scope.unitIds.length > 0) {
    clauses.push(`${aliases.car} IN (${scope.unitIds.map(() => "?").join(", ")})`);
    params.push(...scope.unitIds);
  }

  if (aliases.car && scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ${aliases.car}
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

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function createAggregateMap() {
  return new Map<string, PlanningEvaluationDivisionAggregate>();
}

function getAggregateKey(divisionId: number | null, divisionName: string | null) {
  return `${divisionId ?? "null"}::${divisionName ?? "-"}`;
}

function ensureAggregateRow(
  rows: Map<string, PlanningEvaluationDivisionAggregate>,
  divisionId: number | null,
  divisionName: string | null,
) {
  const key = getAggregateKey(divisionId, divisionName);
  const existing = rows.get(key);
  if (existing) {
    return existing;
  }

  const created: PlanningEvaluationDivisionAggregate = {
    divisionId,
    divisionName,
    baselineHours: 0,
    revisionHours: 0,
    actualHours: 0,
    baselineUnitCount: 0,
    revisionJobCount: 0,
    actualUnitCount: 0,
  };
  rows.set(key, created);
  return created;
}

export interface PlanningEvaluationRepository {
  listDivisionAggregate(
    params: PlanningEvaluationQueryParams,
  ): Promise<PlanningEvaluationDivisionAggregate[]>;
}

export class MySqlPlanningEvaluationRepository implements PlanningEvaluationRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async listDivisionAggregate(
    params: PlanningEvaluationQueryParams,
  ): Promise<PlanningEvaluationDivisionAggregate[]> {
    const rows = createAggregateMap();
    const [baselineRows, splRows, revisionRows, actualRows] = await Promise.all([
      params.mode === "overtime" ? Promise.resolve<DivisionHoursRow[]>([]) : this.listBaselineSpk(params),
      params.mode === "normal" ? Promise.resolve<DivisionHoursRow[]>([]) : this.listBaselineSpl(params),
      this.listRevision(params),
      this.listActual(params),
    ]);

    for (const row of baselineRows) {
      const aggregate = ensureAggregateRow(rows, row.divisionId, row.divisionName);
      aggregate.baselineHours += toNumber(row.hours);
      aggregate.baselineUnitCount += Math.trunc(toNumber(row.unitCount));
    }

    for (const row of splRows) {
      const aggregate = ensureAggregateRow(rows, row.divisionId, row.divisionName);
      aggregate.baselineHours += toNumber(row.hours);
    }

    for (const row of revisionRows) {
      const aggregate = ensureAggregateRow(rows, row.divisionId, row.divisionName);
      aggregate.revisionHours += toNumber(row.hours);
      aggregate.revisionJobCount += Math.trunc(toNumber(row.jobCount));
    }

    for (const row of actualRows) {
      const aggregate = ensureAggregateRow(rows, row.divisionId, row.divisionName);
      aggregate.actualHours += toNumber(row.hours);
      aggregate.actualUnitCount += Math.trunc(toNumber(row.unitCount));
    }

    return [...rows.values()]
      .map((row) => ({
        ...row,
        baselineHours: Number(row.baselineHours.toFixed(2)),
        revisionHours: Number(row.revisionHours.toFixed(2)),
        actualHours: Number(row.actualHours.toFixed(2)),
      }))
      .sort((left, right) => {
        const rightWeight = Math.max(right.actualHours, right.revisionHours, right.baselineHours);
        const leftWeight = Math.max(left.actualHours, left.revisionHours, left.baselineHours);
        if (rightWeight !== leftWeight) {
          return rightWeight - leftWeight;
        }

        return (left.divisionName ?? "-").localeCompare(right.divisionName ?? "-", "id");
      });
  }

  private async listBaselineSpk(params: PlanningEvaluationQueryParams): Promise<DivisionHoursRow[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.dateTo, "[PLANNER_AUTO_DRAFT]%"];
    const whereClauses = [
      "sd.target_date_snapshot BETWEEN ? AND ?",
      "sh.notes LIKE ?",
    ];

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "c.id",
      division: "d.id",
    });
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = await pool.query<DivisionHoursRow[]>(
      `
        SELECT
          d.id AS divisionId,
          COALESCE(sd.division_name_snapshot, d.name) AS divisionName,
          ROUND(SUM(COALESCE(sd.target_hours_snapshot, 0)), 2) AS hours,
          COUNT(DISTINCT sd.unit_name_snapshot) AS unitCount
        FROM sm_spk_detail sd
        JOIN sm_spk_header sh ON sh.id = sd.spk_id
        LEFT JOIN cars c ON c.unit_name = sd.unit_name_snapshot
        LEFT JOIN sm_divisi d ON d.name = sd.division_name_snapshot
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY d.id, COALESCE(sd.division_name_snapshot, d.name)
        ORDER BY divisionName ASC
      `,
      queryParams,
    );

    return rows;
  }

  private async listBaselineSpl(params: PlanningEvaluationQueryParams): Promise<DivisionHoursRow[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.dateTo];
    const whereClauses = [
      "ptd.target_finish_date BETWEEN ? AND ?",
      "pt.status = 'RELEASED'",
      "COALESCE(ptd.shortage_hours, 0) > 0",
    ];

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "ptd.car_id",
      division: "ptd.division_id",
    });
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = await pool.query<DivisionHoursRow[]>(
      `
        SELECT
          ptd.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(COALESCE(ptd.shortage_hours, 0)), 2) AS hours
        FROM planning_target_divisions ptd
        JOIN planning_targets pt ON pt.id = ptd.planning_target_id
        LEFT JOIN sm_divisi d ON d.id = ptd.division_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY ptd.division_id, d.name
        ORDER BY d.name ASC
      `,
      queryParams,
    );

    return rows;
  }

  private async listRevision(params: PlanningEvaluationQueryParams): Promise<DivisionHoursRow[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.dateTo];
    const whereClauses = [
      "p.task_date BETWEEN ? AND ?",
      "COALESCE(p.status, 'PLAN') IN ('PLAN', 'ONPROGRESS', 'READY_QC', 'DONE')",
    ];

    if (params.mode !== "all") {
      whereClauses.push(`COALESCE(p.is_overtime, 0) = ${params.mode === "overtime" ? "1" : "0"}`);
    }

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "c.id",
      division: "cd.division_id",
    });
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = await pool.query<DivisionHoursRow[]>(
      `
        SELECT
          cd.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(TIME_TO_SEC(p.dailyTargetHours) / 3600), 2) AS hours,
          COUNT(DISTINCT p.id) AS jobCount
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY cd.division_id, d.name
        ORDER BY d.name ASC
      `,
      queryParams,
    );

    return rows;
  }

  private async listActual(params: PlanningEvaluationQueryParams): Promise<DivisionHoursRow[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.date, params.dateTo];
    const whereClauses = ["wl.work_date BETWEEN ? AND ?"];

    const actualHoursSql =
      params.mode === "normal"
        ? "COALESCE(wl.duration_hours, 0)"
        : params.mode === "overtime"
          ? "COALESCE(wl.overtime_hours, 0)"
          : "COALESCE(wl.duration_hours, 0) + COALESCE(wl.overtime_hours, 0)";

    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "wl.car_id",
      division: "wl.division_id",
    });
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = await pool.query<DivisionHoursRow[]>(
      `
        SELECT
          wl.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(${actualHoursSql}), 2) AS hours,
          COUNT(DISTINCT wl.car_id) AS unitCount
        FROM sm_work_ledger wl
        LEFT JOIN sm_divisi d ON d.id = wl.division_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY wl.division_id, d.name
        ORDER BY d.name ASC
      `,
      queryParams,
    );

    return rows;
  }
}
