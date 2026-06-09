import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  DashboardCountdownOverdueItem,
  DashboardDivisionKpiItem,
  DashboardKpi,
  DashboardManhourSummary,
  DashboardMonitoringFlags,
  DashboardPendingActions,
  DashboardQcTrendPoint,
  DashboardUnitProgressItem,
  DashboardUrgentIssueItem,
} from "@smsystem/contracts/dashboard";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";
import {
  RedisWeeklyPlanningTempStore,
  type WeeklyPlanningTempStore,
} from "@/repositories/calendar.repo";
import {
  MySqlMonitoringRepository,
  type MonitoringRepository,
} from "@/repositories/monitoring.repo";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface DashboardQueryParams extends ScopeParams {
  asOfDate: string;
  weekStartDate: string;
  weekEndDate: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  divisionId?: string;
  unitId?: string;
}

interface CountRow extends RowDataPacket {
  total: number | null;
}

interface KpiRow extends RowDataPacket {
  activeUnits: number | null;
  deliveryThisWeek: number | null;
  overdueUnits: number | null;
}

interface DivisionAggregateRow extends RowDataPacket {
  divisionId: number | null;
  divisionName: string | null;
  activeUnits: number | null;
  avgProgressPercent: number | null;
  completedPanels: number | null;
  plannedPanels: number | null;
  actualHours: number | null;
}

interface QcTrendRow extends RowDataPacket {
  date: string;
  passCount: number | null;
  rejectCount: number | null;
}

interface UrgentIssueRow extends RowDataPacket {
  issueId: string;
  issueNumber: string | null;
  title: string | null;
  unitName: string | null;
  divisionName: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: string | null;
  ageDays: number | null;
}

interface CountdownOverdueRow extends RowDataPacket {
  countdownId: string;
  carId: string;
  unitName: string | null;
  divisionName: string | null;
  panelName: string | null;
  deadlineDate: string | null;
  overdueDays: number | null;
  remainingHours: number | null;
}

interface WeeklyPlanRow extends RowDataPacket {
  planId: string;
  weekStartDate: string;
  targetHours: number | null;
  planStatus: "DRAFT" | "PUBLISHED" | "CLOSED";
}

interface ManhourDivisionRow extends RowDataPacket {
  divisionId: number;
  divisionName: string | null;
  capacityHours: number | null;
  plannedHours: number | null;
  actualHours: number | null;
  remainingHours: number | null;
  utilizationPercent: number | null;
}

interface ManhourEmployeeRow extends RowDataPacket {
  employeeId: string;
  employeeName: string | null;
  divisionName: string | null;
  actualHours: number | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    clauses.push(
      `${aliases.division} IN (${scope.divisionIds.map(() => "?").join(", ")})`,
    );
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

function getWeekStartDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value.toISOString().slice(0, 10);
}

function getWeekEndDate(weekStartDate: string): string {
  const value = new Date(`${weekStartDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 6);
  return value.toISOString().slice(0, 10);
}

export interface DashboardRepository {
  getKpis(params: DashboardQueryParams): Promise<DashboardKpi>;
  listUnitProgress(params: DashboardQueryParams): Promise<DashboardUnitProgressItem[]>;
  listQcTrend(params: DashboardQueryParams): Promise<DashboardQcTrendPoint[]>;
  listUrgentIssues(params: DashboardQueryParams): Promise<DashboardUrgentIssueItem[]>;
  listCountdownOverdue(params: DashboardQueryParams): Promise<DashboardCountdownOverdueItem[]>;
  getManhourSummary(params: DashboardQueryParams): Promise<DashboardManhourSummary | null>;
  listDivisionKpis(params: DashboardQueryParams): Promise<DashboardDivisionKpiItem[]>;
  getPendingActions(params: DashboardQueryParams): Promise<DashboardPendingActions>;
  getMonitoringFlags(params: DashboardQueryParams): Promise<DashboardMonitoringFlags>;
  listUnitWorkHours(params: DashboardQueryParams): Promise<Array<{ carId: string; unitName: string; actualHours: number }>>;
}

export class MySqlDashboardRepository implements DashboardRepository {
  private readonly pool: Pool;
  private readonly env = getApiEnv();
  private readonly monitoringRepository: MonitoringRepository;
  private readonly weeklyPlanningTempStore: WeeklyPlanningTempStore;

  constructor() {
    this.pool = getMySqlPool(this.env);
    this.monitoringRepository = new MySqlMonitoringRepository();
    this.weeklyPlanningTempStore = new RedisWeeklyPlanningTempStore();
  }

  private get tables() {
    return {
      assignments: qualifyTable(this.env.CORE_DB_NAME, "car_project_assignment"),
      cars: qualifyTable(this.env.CORE_DB_NAME, "cars"),
      countdown: qualifyTable(this.env.CORE_DB_NAME, "sm_jobdesc_countdown"),
      divisions: qualifyTable(this.env.CORE_DB_NAME, "sm_divisi"),
      issues: qualifyTable(this.env.CORE_DB_NAME, "sm_issue_log"),
      ledger: qualifyTable(this.env.CORE_DB_NAME, "sm_work_ledger"),
      qcInspections: qualifyTable(this.env.CORE_DB_NAME, "sm_qc_inspections"),
      weeklyPlan: qualifyTable(this.env.CORE_DB_NAME, "sm_weekly_plan"),
      divisionSummary: qualifyTable(this.env.CORE_DB_NAME, "summary_division_monitoring"),
      wo: qualifyTable(this.env.CORE_DB_NAME, "sm_jobdesc_wo"),
      employee: qualifyTable(this.env.CORE_DB_NAME, "sm_employee"),
      prHeader: qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header"),
      vendorWo: qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor"),
      warehouseTransactions: qualifyTable(this.env.WAREHOUSE_DB_NAME, "wh_transactions"),
    };
  }

  async getKpis(params: DashboardQueryParams): Promise<DashboardKpi> {
    const unitParams: unknown[] = [params.asOfDate, params.weekEndDate, params.asOfDate];
    const unitScope = buildScopeWhereClause(params.scope, params.employeeId, unitParams, {
      car: "cd.car_id",
      division: "cd.division_id",
    });

    const unitWhere = ["COALESCE(UPPER(cd.status), 'PLAN') <> 'DONE'"];
    if (unitScope) {
      unitWhere.push(unitScope);
    }
    if (params.divisionId) {
      unitWhere.push("cd.division_id = ?");
      unitParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      unitWhere.push("cd.car_id = ?");
      unitParams.push(params.unitId);
    }

    const [kpiRows] = await this.pool.query<KpiRow[]>(
      `
        SELECT
          COUNT(DISTINCT cd.car_id) AS activeUnits,
          COUNT(
            DISTINCT CASE
              WHEN c.contract_delivery_date BETWEEN ? AND ?
              THEN cd.car_id
              ELSE NULL
            END
          ) AS deliveryThisWeek,
          COUNT(
            DISTINCT CASE
              WHEN c.contract_delivery_date IS NOT NULL AND c.contract_delivery_date < ?
              THEN cd.car_id
              ELSE NULL
            END
          ) AS overdueUnits
        FROM ${this.tables.countdown} cd
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        WHERE ${unitWhere.join(" AND ")}
      `,
      unitParams,
    );

    const issueParams: unknown[] = [];
    const issueScope = buildScopeWhereClause(params.scope, params.employeeId, issueParams, {
      car: "il.car_id",
      division: "il.division_id",
    });

    const issueWhere = [
      "COALESCE(il.status, 'OPEN') NOT IN ('RESOLVED', 'WAIVED')",
      "(COALESCE(il.is_urgent, 0) = 1 OR COALESCE(il.severity, 'LOW') = 'HIGH')",
    ];
    if (issueScope) {
      issueWhere.push(issueScope);
    }
    if (params.divisionId) {
      issueWhere.push("il.division_id = ?");
      issueParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      issueWhere.push("il.car_id = ?");
      issueParams.push(params.unitId);
    }

    const [issueRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.issues} il
        WHERE ${issueWhere.join(" AND ")}
      `,
      issueParams,
    );

    const row = kpiRows[0];
    return {
      activeUnits: Math.max(0, toNumber(row?.activeUnits)),
      deliveryThisWeek: Math.max(0, toNumber(row?.deliveryThisWeek)),
      overdueUnits: Math.max(0, toNumber(row?.overdueUnits)),
      urgentIssues: Math.max(0, toNumber(issueRows[0]?.total)),
    };
  }

  async listUnitProgress(params: DashboardQueryParams): Promise<DashboardUnitProgressItem[]> {
    const rows = await this.listDivisionAggregateRows(params);
    return rows.map((row) => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName ?? "-",
      activeUnits: Math.max(0, toNumber(row.activeUnits)),
      avgProgressPercent: Number(toNumber(row.avgProgressPercent).toFixed(2)),
      completedPanels: Math.max(0, toNumber(row.completedPanels)),
      plannedPanels: Math.max(0, toNumber(row.plannedPanels)),
      actualHours: Number(toNumber(row.actualHours).toFixed(2)),
    }));
  }

  async listQcTrend(params: DashboardQueryParams): Promise<DashboardQcTrendPoint[]> {
    const queryParams: unknown[] = [params.asOfDate, params.asOfDate];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "cd.car_id",
      division: "cd.division_id",
    });

    const whereClauses = [
      "qc.inspection_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?",
    ];
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    if (params.divisionId) {
      whereClauses.push("cd.division_id = ?");
      queryParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      whereClauses.push("cd.car_id = ?");
      queryParams.push(params.unitId);
    }

    const [rows] = await this.pool.query<QcTrendRow[]>(
      `
        SELECT
          DATE_FORMAT(qc.inspection_date, '%Y-%m-%d') AS date,
          SUM(CASE WHEN qc.result_status = 'LOLOS' THEN 1 ELSE 0 END) AS passCount,
          SUM(CASE WHEN qc.result_status = 'TIDAK_LOLOS' THEN 1 ELSE 0 END) AS rejectCount
        FROM ${this.tables.qcInspections} qc
        JOIN ${this.tables.countdown} cd ON cd.id = qc.core_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY DATE_FORMAT(qc.inspection_date, '%Y-%m-%d')
        ORDER BY date ASC
      `,
      queryParams,
    );

    return rows.map((row) => ({
      date: row.date,
      passCount: Math.max(0, toNumber(row.passCount)),
      rejectCount: Math.max(0, toNumber(row.rejectCount)),
    }));
  }

  async listUrgentIssues(
    params: DashboardQueryParams,
  ): Promise<DashboardUrgentIssueItem[]> {
    const queryParams: unknown[] = [];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "il.car_id",
      division: "il.division_id",
    });

    const whereClauses = [
      "COALESCE(il.status, 'OPEN') NOT IN ('RESOLVED', 'WAIVED')",
      "(COALESCE(il.is_urgent, 0) = 1 OR COALESCE(il.severity, 'LOW') = 'HIGH')",
    ];
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    if (params.divisionId) {
      whereClauses.push("il.division_id = ?");
      queryParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      whereClauses.push("il.car_id = ?");
      queryParams.push(params.unitId);
    }

    const [rows] = await this.pool.query<UrgentIssueRow[]>(
      `
        SELECT
          il.id AS issueId,
          COALESCE(il.issue_number, il.id) AS issueNumber,
          il.title AS title,
          c.unit_name AS unitName,
          d.name AS divisionName,
          COALESCE(il.severity, 'LOW') AS severity,
          COALESCE(il.status, 'OPEN') AS status,
          GREATEST(TIMESTAMPDIFF(DAY, il.created_at, CURRENT_TIMESTAMP), 0) AS ageDays
        FROM ${this.tables.issues} il
        JOIN ${this.tables.cars} c ON c.id = il.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = il.division_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY
          CASE COALESCE(il.severity, 'LOW')
            WHEN 'HIGH' THEN 3
            WHEN 'MEDIUM' THEN 2
            ELSE 1
          END DESC,
          ageDays DESC,
          il.created_at ASC
        LIMIT 5
      `,
      queryParams,
    );

    return rows.map((row) => ({
      issueId: row.issueId,
      issueNumber: row.issueNumber ?? row.issueId,
      title: row.title?.trim() || "Masalah tanpa judul",
      unitName: row.unitName ?? "-",
      divisionName: row.divisionName,
      severity: row.severity,
      status: row.status ?? "OPEN",
      ageDays: Math.max(0, toNumber(row.ageDays)),
    }));
  }

  async listCountdownOverdue(
    params: DashboardQueryParams,
  ): Promise<DashboardCountdownOverdueItem[]> {
    const queryParams: unknown[] = [params.asOfDate, params.asOfDate];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "cd.car_id",
      division: "cd.division_id",
    });

    const whereClauses = [
      "cd.deadline_date IS NOT NULL",
      "cd.deadline_date < ?",
      "COALESCE(UPPER(cd.status), 'PLAN') <> 'DONE'",
    ];
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    if (params.divisionId) {
      whereClauses.push("cd.division_id = ?");
      queryParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      whereClauses.push("cd.car_id = ?");
      queryParams.push(params.unitId);
    }

    const [rows] = await this.pool.query<CountdownOverdueRow[]>(
      `
        SELECT
          cd.id AS countdownId,
          cd.car_id AS carId,
          c.unit_name AS unitName,
          d.name AS divisionName,
          COALESCE(NULLIF(TRIM(cd.section_name), ''), '-') AS panelName,
          DATE_FORMAT(cd.deadline_date, '%Y-%m-%d') AS deadlineDate,
          GREATEST(DATEDIFF(?, cd.deadline_date), 0) AS overdueDays,
          ROUND(COALESCE(cd.remaining_hours, 0), 2) AS remainingHours
        FROM ${this.tables.countdown} cd
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY overdueDays DESC, remainingHours DESC, cd.deadline_date ASC
        LIMIT 5
      `,
      queryParams,
    );

    return rows.map((row) => ({
      countdownId: row.countdownId,
      carId: row.carId,
      unitName: row.unitName ?? row.carId,
      divisionName: row.divisionName,
      panelName: row.panelName?.trim() || "-",
      deadlineDate: row.deadlineDate,
      overdueDays: Math.max(0, toNumber(row.overdueDays)),
      remainingHours: Number(toNumber(row.remainingHours).toFixed(2)),
    }));
  }

  async getManhourSummary(
    params: DashboardQueryParams,
  ): Promise<DashboardManhourSummary | null> {
    try {
      const targetDate = params.dateFrom || params.asOfDate;
      const weekStart = getWeekStartDate(targetDate);
      const [planRows] = await this.pool.query<WeeklyPlanRow[]>(
        `
          SELECT
            id AS planId,
            DATE_FORMAT(week_start_date, '%Y-%m-%d') AS weekStartDate,
            target_hours AS targetHours,
            status AS planStatus
          FROM ${this.tables.weeklyPlan}
          WHERE week_start_date = ?
          LIMIT 1
        `,
        [weekStart],
      );

      const plan = planRows[0];
      const planId = plan?.id || null;
      const cachedCapacityRows = planId
        ? await this.weeklyPlanningTempStore.getCapacity(planId)
        : null;
      const capacityByDivision = new Map(
        (cachedCapacityRows ?? []).map((row) => [row.divisionId, row]),
      );

      const queryParams: unknown[] = [planId];
      
      let dateCond = "wl.work_date = ?";
      if (params.dateFrom && params.dateTo) {
        dateCond = "wl.work_date BETWEEN ? AND ?";
        queryParams.push(params.dateFrom, params.dateTo);
      } else {
        queryParams.push(params.asOfDate);
      }

      let carCond = "";
      if (params.unitId) {
        carCond = "AND wl.car_id = ?";
        queryParams.push(params.unitId);
      }

      const scopeDivisionParams: unknown[] = [];
      const scopeDivisionClause = buildScopeWhereClause(params.scope, params.employeeId, scopeDivisionParams, {
        division: "d.id",
      });

      const scopeCarParams: unknown[] = [];
      const scopeCarClause = buildScopeWhereClause(params.scope, params.employeeId, scopeCarParams, {
        car: "wl.car_id",
      });

      let scopeCarCond = "";
      if (scopeCarClause) {
        scopeCarCond = `AND ${scopeCarClause}`;
        queryParams.push(...scopeCarParams);
      }

      let whereCond = "1 = 1";
      if (scopeDivisionClause) {
        whereCond = scopeDivisionClause;
        queryParams.push(...scopeDivisionParams);
      }

      const [rows] = await this.pool.query<RowDataPacket[]>(
        `
          SELECT
            d.id AS divisionId,
            d.name AS divisionName,
            ROUND(COALESCE(plan_units.allocated_hours, 0), 2) AS plannedHours,
            ROUND(COALESCE(SUM(COALESCE(wl.duration_hours, 0) + COALESCE(wl.overtime_hours, 0)), 0), 2) AS actualHours
          FROM ${this.tables.divisions} d
          LEFT JOIN (
            SELECT
              division_id,
              SUM(COALESCE(allocated_hours, 0)) AS allocated_hours
            FROM ${qualifyTable(this.env.CORE_DB_NAME, "sm_weekly_plan_units")}
            WHERE plan_id = ?
            GROUP BY division_id
          ) plan_units ON plan_units.division_id = d.id
          LEFT JOIN ${this.tables.ledger} wl ON wl.division_id = d.id AND ${dateCond} ${carCond} ${scopeCarCond}
          WHERE ${whereCond}
          GROUP BY d.id, d.name, plan_units.allocated_hours
          ORDER BY actualHours DESC, d.name ASC
        `,
        queryParams,
      );

      const empQueryParams: unknown[] = [];
      let empDateCond = "wl.work_date = ?";
      if (params.dateFrom && params.dateTo) {
        empDateCond = "wl.work_date BETWEEN ? AND ?";
        empQueryParams.push(params.dateFrom, params.dateTo);
      } else {
        empQueryParams.push(params.asOfDate);
      }

      let empCarCond = "";
      if (params.unitId) {
        empCarCond = "AND wl.car_id = ?";
        empQueryParams.push(params.unitId);
      }

      const empScopeParams: unknown[] = [];
      const empScopeClause = buildScopeWhereClause(params.scope, params.employeeId, empScopeParams, {
        division: "wl.division_id",
        car: "wl.car_id",
      });

      const empWhereClauses = [empDateCond];
      if (empCarCond) empWhereClauses.push(empCarCond);
      if (empScopeClause) {
        empWhereClauses.push(empScopeClause);
        empQueryParams.push(...empScopeParams);
      }

      const [empRows] = await this.pool.query<ManhourEmployeeRow[]>(
        `
          SELECT
            wl.employee_id AS employeeId,
            e.full_name AS employeeName,
            d.name AS divisionName,
            ROUND(SUM(COALESCE(wl.duration_hours, 0) + COALESCE(wl.overtime_hours, 0)), 2) AS actualHours
          FROM ${this.tables.ledger} wl
          JOIN ${this.tables.employee} e ON e.employee_id = wl.employee_id
          LEFT JOIN ${this.tables.divisions} d ON d.id = wl.division_id
          WHERE ${empWhereClauses.join(" AND ")}
          GROUP BY wl.employee_id, e.full_name, d.name
          ORDER BY actualHours DESC, employeeName ASC
        `,
        empQueryParams,
      );

      const byEmployee = empRows.map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName ?? "-",
        divisionName: row.divisionName,
        actualHours: Number(toNumber(row.actualHours).toFixed(2)),
      }));

      return {
        weekStartDate: plan?.weekStartDate || weekStart,
        planStatus: plan?.planStatus || "DRAFT",
        targetHours: plan ? toNullableNumber(plan.targetHours) : null,
        byDivision: rows.map((row) => {
          const actual = toNumber(row.actualHours);
          const planned = toNumber(row.plannedHours);
          const cachedCapacity = capacityByDivision.get(Number(row.divisionId));
          return {
            divisionId: row.divisionId,
            divisionName: row.divisionName ?? "-",
            capacityHours: Number(toNumber(cachedCapacity?.netCapacityHours).toFixed(2)),
            plannedHours: Number(planned.toFixed(2)),
            actualHours: Number(actual.toFixed(2)),
            remainingHours: Number(Math.max(0, planned - actual).toFixed(2)),
            utilizationPercent:
              planned > 0
                ? Number(Math.min(100, (actual / planned) * 100).toFixed(2))
                : null,
          };
        }),
        byEmployee,
      };
    } catch (error) {
      if (error instanceof Error && /doesn't exist|no such table/iu.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  async listUnitWorkHours(
    params: DashboardQueryParams,
  ): Promise<Array<{ carId: string; unitName: string; actualHours: number }>> {
    try {
      const queryParams: unknown[] = [];
      let dateCond = "wl.work_date = ?";
      if (params.dateFrom && params.dateTo) {
        dateCond = "wl.work_date BETWEEN ? AND ?";
        queryParams.push(params.dateFrom, params.dateTo);
      } else {
        queryParams.push(params.asOfDate);
      }

      let carCond = "";
      if (params.unitId) {
        carCond = "AND wl.car_id = ?";
        queryParams.push(params.unitId);
      }

      const scopeParams: unknown[] = [];
      const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, scopeParams, {
        division: "wl.division_id",
        car: "wl.car_id",
      });

      const whereClauses = [dateCond];
      if (carCond) whereClauses.push(carCond);
      if (scopeClause) {
        whereClauses.push(scopeClause);
        queryParams.push(...scopeParams);
      }

      const [rows] = await this.pool.query<RowDataPacket[]>(
        `
          SELECT
            wl.car_id AS carId,
            c.unit_name AS unitName,
            ROUND(SUM(COALESCE(wl.duration_hours, 0) + COALESCE(wl.overtime_hours, 0)), 2) AS actualHours
          FROM ${this.tables.ledger} wl
          JOIN ${this.tables.cars} c ON c.id = wl.car_id
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY wl.car_id, c.unit_name
          ORDER BY actualHours DESC, c.unit_name ASC
        `,
        queryParams,
      );

      return rows.map((row) => ({
        carId: row.carId,
        unitName: row.unitName ?? row.carId,
        actualHours: Number(toNumber(row.actualHours).toFixed(2)),
      }));
    } catch {
      return [];
    }
  }

  async listDivisionKpis(
    params: DashboardQueryParams,
  ): Promise<DashboardDivisionKpiItem[]> {
    const rows = await this.listDivisionAggregateRows(params);
    return rows.map((row) => ({
      divisionId: toNumber(row.divisionId),
      divisionName: row.divisionName ?? "-",
      activeUnits: Math.max(0, toNumber(row.activeUnits)),
      avgProgressPercent: Number(toNumber(row.avgProgressPercent).toFixed(2)),
      completedPanels: Math.max(0, toNumber(row.completedPanels)),
      plannedPanels: Math.max(0, toNumber(row.plannedPanels)),
      totalHours: Number(toNumber(row.actualHours).toFixed(2)),
    }));
  }

  async getPendingActions(
    params: DashboardQueryParams,
  ): Promise<DashboardPendingActions> {
    const [woApproval, prApproval, vendorApproval, warehouseApproval] = await Promise.all([
      this.countWoPendingApproval(params),
      this.countPrPendingApproval(params),
      this.countVendorPendingApproval(params),
      this.countWarehousePendingApproval(params),
    ]);

    return {
      woApproval,
      prApproval,
      vendorApproval,
      warehouseApproval,
      total: [woApproval, prApproval, vendorApproval, warehouseApproval].reduce<number>(
        (sum, item) => sum + (item ?? 0),
        0,
      ),
    };
  }

  async getMonitoringFlags(
    params: DashboardQueryParams,
  ): Promise<DashboardMonitoringFlags> {
    const summary = await this.monitoringRepository.getSummary({
      employeeId: params.employeeId,
      scope: params.scope,
      date: params.asOfDate,
    });

    return {
      noStart: summary.noStart,
      noSubmit: summary.noSubmit,
      delayRisk: summary.delayRisk,
      overtimeCount: summary.overtimeCount,
    };
  }

  private async listDivisionAggregateRows(
    params: DashboardQueryParams,
  ): Promise<DivisionAggregateRow[]> {
    const queryParams: unknown[] = [];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      car: "sdm.car_id",
      division: "sdm.division_id",
    });

    const whereClauses = ["COALESCE(sdm.count_panel_plan, 0) > 0"];
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    if (params.divisionId) {
      whereClauses.push("sdm.division_id = ?");
      queryParams.push(Number(params.divisionId));
    }
    if (params.unitId) {
      whereClauses.push("sdm.car_id = ?");
      queryParams.push(params.unitId);
    }

    const [rows] = await this.pool.query<DivisionAggregateRow[]>(
      `
        SELECT
          sdm.division_id AS divisionId,
          COALESCE(d.name, '-') AS divisionName,
          COUNT(DISTINCT sdm.car_id) AS activeUnits,
          ROUND(AVG(COALESCE(sdm.avg_progress_percentage, 0)), 2) AS avgProgressPercent,
          SUM(COALESCE(sdm.count_panel_done, 0)) AS completedPanels,
          SUM(COALESCE(sdm.count_panel_plan, 0)) AS plannedPanels,
          ROUND(SUM(COALESCE(sdm.total_man_hours_spent, 0)), 2) AS actualHours
        FROM ${this.tables.divisionSummary} sdm
        LEFT JOIN ${this.tables.divisions} d ON d.id = sdm.division_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY sdm.division_id, d.name
        ORDER BY avgProgressPercent ASC, actualHours DESC, activeUnits DESC
        LIMIT 8
      `,
      queryParams,
    );

    return rows;
  }

  private async countWoPendingApproval(params: DashboardQueryParams): Promise<number | null> {
    try {
      const queryParams: unknown[] = [];
      const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
        car: "w.car_id",
        division: "w.from_div_id",
      });

      const whereClauses = ["COALESCE(w.status, 'SUBMITTED') IN ('OPEN', 'SUBMITTED')"];
      if (scopeClause) {
        whereClauses.push(scopeClause);
      }
      if (params.divisionId) {
        whereClauses.push("(w.from_div_id = ? OR w.to_div_id = ?)");
        queryParams.push(Number(params.divisionId), Number(params.divisionId));
      }
      if (params.unitId) {
        whereClauses.push("w.car_id = ?");
        queryParams.push(params.unitId);
      }

      const [rows] = await this.pool.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM ${this.tables.wo} w
          WHERE ${whereClauses.join(" AND ")}
        `,
        queryParams,
      );

      return Math.max(0, toNumber(rows[0]?.total));
    } catch {
      return null;
    }
  }

  private async countPrPendingApproval(params: DashboardQueryParams): Promise<number | null> {
    try {
      const queryParams: unknown[] = [];
      const scopeClauses: string[] = [];

      if (!params.scope.canViewAllUnits) {
        scopeClauses.push("h.requested_by = ?");
        queryParams.push(params.employeeId);

        if (params.scope.divisionIds.length > 0) {
          scopeClauses.push(
            `req.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.divisionIds);
        }

        if (params.scope.unitIds.length > 0) {
          scopeClauses.push(
            `h.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.unitIds);
        }

        if (params.scope.canViewAssignedUnits) {
          scopeClauses.push(
            `EXISTS (
              SELECT 1
              FROM ${this.tables.assignments} cpa_scope
              WHERE cpa_scope.car_id = h.car_id
                AND cpa_scope.ended_at IS NULL
                AND (
                  cpa_scope.kp_id = ?
                  OR cpa_scope.advisor_id = ?
                  OR cpa_scope.kd_id = ?
                )
            )`,
          );
          queryParams.push(params.employeeId, params.employeeId, params.employeeId);
        }
      }

      const whereClauses = [
        "COALESCE(h.acc_tracking, 'PENDING_ADV') <> 'APPROVED'",
        "COALESCE(h.status, 'OPEN') NOT IN ('REJECTED', 'CANCELLED')",
      ];
      if (scopeClauses.length > 0) {
        whereClauses.push(`(${scopeClauses.join(" OR ")})`);
      }
      if (params.unitId) {
        whereClauses.push("h.car_id = ?");
        queryParams.push(params.unitId);
      }

      const [rows] = await this.pool.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM ${this.tables.prHeader} h
          LEFT JOIN ${this.tables.employee} req ON req.employee_id = h.requested_by
          WHERE ${whereClauses.join(" AND ")}
        `,
        queryParams,
      );

      return Math.max(0, toNumber(rows[0]?.total));
    } catch {
      return null;
    }
  }

  private async countVendorPendingApproval(
    params: DashboardQueryParams,
  ): Promise<number | null> {
    try {
      const queryParams: unknown[] = [];
      const scopeClauses: string[] = [];

      if (!params.scope.canViewAllUnits) {
        scopeClauses.push("w.requested_by = ?");
        queryParams.push(params.employeeId);

        if (params.scope.divisionIds.length > 0) {
          scopeClauses.push(
            `req.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.divisionIds);
        }

        if (params.scope.unitIds.length > 0) {
          scopeClauses.push(
            `w.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.unitIds);
        }

        if (params.scope.canViewAssignedUnits) {
          scopeClauses.push(
            `EXISTS (
              SELECT 1
              FROM ${this.tables.assignments} cpa_scope
              WHERE cpa_scope.car_id = w.car_id
                AND cpa_scope.ended_at IS NULL
                AND (
                  cpa_scope.kp_id = ?
                  OR cpa_scope.advisor_id = ?
                  OR cpa_scope.kd_id = ?
                )
            )`,
          );
          queryParams.push(params.employeeId, params.employeeId, params.employeeId);
        }
      }

      const whereClauses = [
        "COALESCE(w.acc_tracking, 'PENDING_ADV') <> 'APPROVED'",
        "COALESCE(w.status, 'OPEN') NOT IN ('CANCELLED')",
      ];
      if (scopeClauses.length > 0) {
        whereClauses.push(`(${scopeClauses.join(" OR ")})`);
      }
      if (params.unitId) {
        whereClauses.push("w.car_id = ?");
        queryParams.push(params.unitId);
      }

      const [rows] = await this.pool.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM ${this.tables.vendorWo} w
          LEFT JOIN ${this.tables.employee} req ON req.employee_id = w.requested_by
          WHERE ${whereClauses.join(" AND ")}
        `,
        queryParams,
      );

      return Math.max(0, toNumber(rows[0]?.total));
    } catch {
      return null;
    }
  }

  private async countWarehousePendingApproval(
    params: DashboardQueryParams,
  ): Promise<number | null> {
    try {
      const queryParams: unknown[] = [];
      const scopeClauses: string[] = [];

      if (!params.scope.canViewAllUnits) {
        scopeClauses.push("t.employee_id = ?");
        queryParams.push(params.employeeId);

        if (params.scope.divisionIds.length > 0) {
          scopeClauses.push(
            `t.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.divisionIds);
        }

        if (params.scope.unitIds.length > 0) {
          scopeClauses.push(
            `t.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`,
          );
          queryParams.push(...params.scope.unitIds);
        }

        if (params.scope.canViewAssignedUnits) {
          scopeClauses.push(
            `EXISTS (
              SELECT 1
              FROM ${this.tables.assignments} cpa_scope
              WHERE cpa_scope.car_id = t.car_id
                AND cpa_scope.ended_at IS NULL
                AND (
                  cpa_scope.kp_id = ?
                  OR cpa_scope.advisor_id = ?
                  OR cpa_scope.kd_id = ?
                )
            )`,
          );
          queryParams.push(params.employeeId, params.employeeId, params.employeeId);
        }
      }

      const whereClauses = [
        "COALESCE(t.approval_status, 'PENDING_KD') IN ('PENDING_KD', 'PENDING_KEPALA_GUDANG', 'PENDING_PPIC')",
        "COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED')",
      ];
      if (scopeClauses.length > 0) {
        whereClauses.push(`(${scopeClauses.join(" OR ")})`);
      }
      if (params.unitId) {
        whereClauses.push("t.car_id = ?");
        queryParams.push(params.unitId);
      }
      if (params.divisionId) {
        whereClauses.push("t.division_id = ?");
        queryParams.push(Number(params.divisionId));
      }

      const [rows] = await this.pool.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM ${this.tables.warehouseTransactions} t
          WHERE ${whereClauses.join(" AND ")}
        `,
        queryParams,
      );

      return Math.max(0, toNumber(rows[0]?.total));
    } catch {
      return null;
    }
  }
}

export function buildDashboardQueryParams(
  session: ScopeParams,
  asOfDate: string,
  options?: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    divisionId?: string;
    unitId?: string;
  },
): DashboardQueryParams {
  const weekStartDate = getWeekStartDate(asOfDate);
  return {
    employeeId: session.employeeId,
    scope: session.scope,
    asOfDate,
    weekStartDate,
    weekEndDate: getWeekEndDate(weekStartDate),
    date: options?.date,
    dateFrom: options?.dateFrom,
    dateTo: options?.dateTo,
    divisionId: options?.divisionId,
    unitId: options?.unitId,
  };
}
