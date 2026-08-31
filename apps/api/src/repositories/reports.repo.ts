import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  ReportQuery,
  ReportRow,
  ReportSummaryItem,
  ReportType,
} from "@smsystem/contracts/reports";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ReportDataParams {
  type: ReportType;
  employeeId: string;
  scope: AuthScope;
  query: ReportQuery;
  exportAll: boolean;
}

interface ReportDataset {
  rows: ReportRow[];
  total: number;
  summary: ReportSummaryItem[];
  filterOptions: Record<string, Array<{ value: string; label: string }>>;
}

interface CountRow extends RowDataPacket {
  total: number | string | null;
}

type GenericRow = RowDataPacket & Record<string, unknown>;

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

function toStringValue(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function buildOptionRows(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

const DELIVERY_STATUS_OPTIONS = buildOptionRows([
  "ON_TIME",
  "DELAYED",
  "IN_PROGRESS",
  "NO_TARGET",
]);
const TASK_STATUS_OPTIONS = buildOptionRows(["ON_PROGRESS", "DONE"]);
const QC_LEVEL_OPTIONS = buildOptionRows([
  "QC_KD",
  "QC_ADVISOR",
  "QC_KP",
  "QC_MP",
  "QC_MO",
]);
const ISSUE_STATUS_OPTIONS = buildOptionRows([
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "QC_RECHECK",
  "RESOLVED",
  "ESCALATED",
  "WAIVED",
]);
const ISSUE_SEVERITY_OPTIONS = buildOptionRows(["LOW", "MEDIUM", "HIGH"]);
const ISSUE_SOURCE_OPTIONS = buildOptionRows(["QC_REJECT", "WORK_LEDGER", "MANUAL"]);
const SPK_STATUS_OPTIONS = buildOptionRows([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "DONE",
]);
const SPK_APPROVAL_OPTIONS = buildOptionRows(["PENDING", "APPROVED", "REJECTED"]);
const WO_STATUS_OPTIONS = buildOptionRows([
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "DONE",
]);
const PR_STATUS_OPTIONS = buildOptionRows([
  "OPEN",
  "HUNTING",
  "ORDERED",
  "ARRIVED",
  "NOT_FOUND",
  "REJECTED",
  "CANCELLED",
]);
const PR_APPROVAL_OPTIONS = buildOptionRows([
  "PENDING_ADV",
  "PENDING_KP",
  "PENDING_MP",
  "PENDING_PUR",
  "APPROVED",
]);
const ITEM_CATEGORY_OPTIONS = buildOptionRows([
  "TOOLS",
  "BAHAN",
  "SPARE_PART",
  "CONSUMABLE",
]);
const CASH_SOURCE_OPTIONS = buildOptionRows(["PR", "VENDOR_WO", "MATERIAL_USAGE"]);
const WORK_TYPE_OPTIONS = buildOptionRows(["NORMAL", "PENGULANGAN"]);
const HOUR_TYPE_OPTIONS = buildOptionRows(["NORMAL", "LEMBUR"]);
const MATERIAL_USAGE_OPTIONS = buildOptionRows(["DENGAN_BAHAN", "TANPA_BAHAN"]);

export interface ReportsRepository {
  getReportData(params: ReportDataParams): Promise<ReportDataset>;
}

export class MySqlReportsRepository implements ReportsRepository {
  private readonly pool: Pool;
  private readonly coreDb: string;
  private readonly purchaseDb: string;
  private readonly warehouseDb: string;

  constructor() {
    const env = getApiEnv();
    this.pool = getMySqlPool(env);
    this.coreDb = env.CORE_DB_NAME;
    this.purchaseDb = env.PURCHASE_DB_NAME;
    this.warehouseDb = env.WAREHOUSE_DB_NAME;
  }

  private get tables() {
    return {
      assignments: qualifyTable(this.coreDb, "car_project_assignment"),
      cars: qualifyTable(this.coreDb, "cars"),
      countdown: qualifyTable(this.coreDb, "sm_jobdesc_countdown"),
      divisions: qualifyTable(this.coreDb, "sm_divisi"),
      issues: qualifyTable(this.coreDb, "sm_issue_log"),
      ledger: qualifyTable(this.coreDb, "sm_work_ledger"),
      qcFinalApprovals: qualifyTable(this.coreDb, "sm_qc_final_approvals"),
      qcInspections: qualifyTable(this.coreDb, "sm_qc_inspections"),
      spkDetail: qualifyTable(this.coreDb, "sm_spk_detail"),
      spkHeader: qualifyTable(this.coreDb, "sm_spk_header"),
      divisionSummary: qualifyTable(this.coreDb, "summary_division_monitoring"),
      wo: qualifyTable(this.coreDb, "sm_jobdesc_wo"),
      prHeader: qualifyTable(this.purchaseDb, "pur_pr_header"),
      prItems: qualifyTable(this.purchaseDb, "pur_pr_items"),
      vendorWo: qualifyTable(this.purchaseDb, "vnd_wo_vendor"),
      materialUsage: qualifyTable(this.warehouseDb, "wh_material_usage"),
    };
  }

  async getReportData(params: ReportDataParams): Promise<ReportDataset> {
    switch (params.type) {
      case "delivery-accuracy":
        return this.listDeliveryAccuracy(params);
      case "manhour":
        return this.listManhour(params);
      case "division-kpi":
        return this.listDivisionKpi(params);
      case "qc-reject":
        return this.listQcReject(params);
      case "issues":
        return this.listIssues(params);
      case "spk":
        return this.listSpk(params);
      case "wo-aging":
        return this.listWoAging(params);
      case "pr-aging":
        return this.listPrAging(params);
      case "material-cost":
        return this.listMaterialCost(params);
      case "cash-flow":
        return this.listCashFlow(params);
      case "ar-labour":
        return this.listArLabour(params);
    }
  }

  private buildScopeClause(
    scope: AuthScope,
    employeeId: string,
    queryParams: unknown[],
    columns: {
      car?: string;
      division?: string;
      employee?: string;
    },
  ): string {
    if (scope.canViewAllUnits) {
      return "";
    }

    const clauses: string[] = [];
    if (columns.employee) {
      clauses.push(`${columns.employee} = ?`);
      queryParams.push(employeeId);
    }

    if (columns.division && scope.divisionIds.length > 0) {
      clauses.push(
        `${columns.division} IN (${scope.divisionIds.map(() => "?").join(", ")})`,
      );
      queryParams.push(...scope.divisionIds);
    }

    if (columns.car && scope.unitIds.length > 0) {
      clauses.push(`${columns.car} IN (${scope.unitIds.map(() => "?").join(", ")})`);
      queryParams.push(...scope.unitIds);
    }

    if (scope.canViewAssignedUnits && columns.car) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM ${this.tables.assignments} assignment_scope
          WHERE assignment_scope.car_id = ${columns.car}
            AND assignment_scope.ended_at IS NULL
            AND (
              assignment_scope.kp_id = ?
              OR assignment_scope.advisor_id = ?
              OR assignment_scope.kd_id = ?
            )
        )`,
      );
      queryParams.push(employeeId, employeeId, employeeId);
    }

    if (clauses.length === 0) {
      return "1 = 0";
    }

    return `(${clauses.join(" OR ")})`;
  }

  private pushDateRange(
    conditions: string[],
    queryParams: unknown[],
    query: ReportQuery,
    columnExpression: string,
  ) {
    if (query.dateFrom) {
      conditions.push(`DATE(${columnExpression}) >= ?`);
      queryParams.push(query.dateFrom);
    }

    if (query.dateTo) {
      conditions.push(`DATE(${columnExpression}) <= ?`);
      queryParams.push(query.dateTo);
    }
  }

  private pushSearch(
    conditions: string[],
    queryParams: unknown[],
    search: string,
    columns: string[],
  ) {
    if (!search) {
      return;
    }

    const value = `%${search}%`;
    conditions.push(`(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`);
    queryParams.push(...columns.map(() => value));
  }

  private buildWhereClause(conditions: string[]): string {
    return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  }

  private buildPagination(
    query: ReportQuery,
    exportAll: boolean,
    queryParams: unknown[],
  ): string {
    if (exportAll) {
      return "";
    }

    const offset = (query.page - 1) * query.limit;
    queryParams.push(query.limit, offset);
    return " LIMIT ? OFFSET ? ";
  }

  private async listDivisionOptions(
    scope: AuthScope,
    asName = false,
  ): Promise<Array<{ value: string; label: string }>> {
    if (!scope.canViewAllUnits && scope.divisionIds.length === 0) {
      return [];
    }

    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    if (!scope.canViewAllUnits) {
      conditions.push(`d.id IN (${scope.divisionIds.map(() => "?").join(", ")})`);
      queryParams.push(...scope.divisionIds);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await this.pool.query<Array<RowDataPacket & { id: number; name: string }>>(
      `
        SELECT d.id, d.name
        FROM ${this.tables.divisions} d
        ${whereClause}
        ORDER BY d.name ASC
      `,
      queryParams,
    );

    return rows.map((row) => ({
      value: asName ? row.name : String(row.id),
      label: row.name,
    }));
  }

  private async listDistinctOptions(
    selectSql: string,
    queryParams: unknown[] = [],
  ): Promise<Array<{ value: string; label: string }>> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { value: string | null }>>(
      selectSql,
      queryParams,
    );

    return rows
      .map((row) => row.value)
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ value, label: value }));
  }

  private async listCarOptions(scope: AuthScope): Promise<Array<{ value: string; label: string }>> {
    if (!scope.canViewAllUnits && scope.unitIds.length === 0) return [];
    const params: unknown[] = [];
    const where = scope.canViewAllUnits ? "" : `WHERE c.id IN (${scope.unitIds.map(() => "?").join(", ")})`;
    if (!scope.canViewAllUnits) params.push(...scope.unitIds);
    const [rows] = await this.pool.query<Array<RowDataPacket & { id: string; name: string }>>(
      `SELECT c.id, COALESCE(c.unit_name, c.id) name FROM ${this.tables.cars} c ${where} ORDER BY name`, params,
    );
    return rows.map((row) => ({ value: row.id, label: row.name }));
  }

  private async listDeliveryAccuracy(params: ReportDataParams): Promise<ReportDataset> {
    const deliveryStatusSql = `
      CASE
        WHEN c.contract_delivery_date IS NULL THEN 'NO_TARGET'
        WHEN qfa.approved_at IS NULL AND CURRENT_DATE > c.contract_delivery_date THEN 'DELAYED'
        WHEN qfa.approved_at IS NULL THEN 'IN_PROGRESS'
        WHEN DATE(qfa.approved_at) <= c.contract_delivery_date THEN 'ON_TIME'
        ELSE 'DELAYED'
      END
    `;
    const delayDaysSql = `
      CASE
        WHEN c.contract_delivery_date IS NULL THEN NULL
        WHEN qfa.approved_at IS NULL THEN GREATEST(DATEDIFF(CURRENT_DATE, c.contract_delivery_date), 0)
        ELSE GREATEST(DATEDIFF(DATE(qfa.approved_at), c.contract_delivery_date), 0)
      END
    `;
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "c.id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(
      conditions,
      queryParams,
      params.query,
      "COALESCE(DATE(qfa.approved_at), c.contract_delivery_date, c.incoming_date, DATE(c.created_at))",
    );
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(c.unit_name, c.id)",
      "COALESCE(c.customer_name, '')",
      "COALESCE(c.status, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "deliveryStatus") {
        conditions.push(`${deliveryStatusSql} = ?`);
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      delayDays: "delayDays",
      contractDeliveryDate: "contractDeliveryDate",
      qcApprovedAt: "qcApprovedAt",
      unitName: "unitName",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "delayDays";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COALESCE(c.unit_name, c.id) AS unitName,
          c.customer_name AS customerName,
          DATE_FORMAT(c.incoming_date, '%Y-%m-%d') AS incomingDate,
          DATE_FORMAT(c.contract_delivery_date, '%Y-%m-%d') AS contractDeliveryDate,
          DATE_FORMAT(qfa.approved_at, '%Y-%m-%d %H:%i:%s') AS qcApprovedAt,
          ${delayDaysSql} AS delayDays,
          ${deliveryStatusSql} AS deliveryStatus,
          COALESCE(c.status, 'IN_PROGRESS') AS carStatus
        FROM ${this.tables.cars} c
        LEFT JOIN ${this.tables.qcFinalApprovals} qfa ON qfa.car_id = c.id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, c.unit_name ASC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.cars} c
        LEFT JOIN ${this.tables.qcFinalApprovals} qfa ON qfa.car_id = c.id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalUnits,
          SUM(CASE WHEN status_bucket = 'ON_TIME' THEN 1 ELSE 0 END) AS onTimeCount,
          SUM(CASE WHEN status_bucket = 'DELAYED' THEN 1 ELSE 0 END) AS delayedCount,
          SUM(CASE WHEN status_bucket = 'NO_TARGET' THEN 1 ELSE 0 END) AS noTargetCount
        FROM (
          SELECT ${deliveryStatusSql} AS status_bucket
          FROM ${this.tables.cars} c
          LEFT JOIN ${this.tables.qcFinalApprovals} qfa ON qfa.car_id = c.id
          ${whereClause}
        ) summary_base
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        unitName: toStringValue(row.unitName),
        customerName: toNullableString(row.customerName),
        incomingDate: toNullableString(row.incomingDate),
        contractDeliveryDate: toNullableString(row.contractDeliveryDate),
        qcApprovedAt: toNullableString(row.qcApprovedAt),
        delayDays: toNullableNumber(row.delayDays),
        deliveryStatus: toStringValue(row.deliveryStatus),
        carStatus: toStringValue(row.carStatus),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Total Unit",
          value: String(toNumber(summaryRows[0]?.totalUnits)),
          helper: "Unit dalam scope query report.",
        },
        {
          label: "On Time",
          value: String(toNumber(summaryRows[0]?.onTimeCount)),
          helper: "Unit selesai tidak melewati target delivery.",
        },
        {
          label: "Delayed",
          value: String(toNumber(summaryRows[0]?.delayedCount)),
          helper: "Unit lewat target atau final approval lewat due date.",
        },
        {
          label: "No Target",
          value: String(toNumber(summaryRows[0]?.noTargetCount)),
          helper: "Unit belum memiliki target delivery contract.",
        },
      ],
      filterOptions: {
        deliveryStatus: DELIVERY_STATUS_OPTIONS,
      },
    };
  }

  private async listManhour(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "wl.car_id",
      division: "wl.division_id",
      employee: "wl.employee_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "wl.work_date");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(c.unit_name, wl.car_id)",
      "COALESCE(d.name, '')",
      "COALESCE(wl.employee_name, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(wl.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "taskStatus") {
        conditions.push("wl.task_status = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      workDate: "workDate",
      durationHours: "wl.duration_hours",
      overtimeHours: "wl.overtime_hours",
      unitName: "unitName",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "workDate";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          DATE_FORMAT(wl.work_date, '%Y-%m-%d') AS workDate,
          COALESCE(c.unit_name, wl.car_id) AS unitName,
          COALESCE(d.name, CAST(wl.division_id AS CHAR)) AS divisionName,
          wl.employee_name AS employeeName,
          wl.duration_hours AS durationHours,
          wl.overtime_hours AS overtimeHours,
          wl.progress_percent AS progressPercent,
          wl.task_status AS taskStatus
        FROM ${this.tables.ledger} wl
        LEFT JOIN ${this.tables.cars} c ON c.id = wl.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = wl.division_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, wl.work_date DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.ledger} wl
        LEFT JOIN ${this.tables.cars} c ON c.id = wl.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = wl.division_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COALESCE(SUM(wl.duration_hours), 0) AS totalHours,
          COALESCE(SUM(wl.overtime_hours), 0) AS overtimeHours,
          COALESCE(AVG(wl.progress_percent), 0) AS avgProgress,
          COUNT(*) AS totalRows
        FROM ${this.tables.ledger} wl
        LEFT JOIN ${this.tables.cars} c ON c.id = wl.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = wl.division_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        workDate: toStringValue(row.workDate),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        employeeName: toStringValue(row.employeeName),
        durationHours: toNumber(row.durationHours),
        overtimeHours: toNumber(row.overtimeHours),
        progressPercent: toNumber(row.progressPercent),
        taskStatus: toStringValue(row.taskStatus),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Total Hours",
          value: toNumber(summaryRows[0]?.totalHours).toFixed(2),
          helper: "Akumulasi jam kerja aktual pada query aktif.",
        },
        {
          label: "OT Hours",
          value: toNumber(summaryRows[0]?.overtimeHours).toFixed(2),
          helper: "Akumulasi jam lembur dari work ledger.",
        },
        {
          label: "Avg Progress",
          value: `${toNumber(summaryRows[0]?.avgProgress).toFixed(1)}%`,
          helper: "Rata-rata progress percent per log kerja.",
        },
        {
          label: "Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah work ledger row pada query aktif.",
        },
      ],
      filterOptions: {
        divisionId: await this.listDivisionOptions(params.scope),
        taskStatus: TASK_STATUS_OPTIONS,
      },
    };
  }

  private async listArLabour(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "wl.car_id",
      division: "wl.division_id",
      employee: "wl.employee_id",
    });
    if (scopeClause) conditions.push(scopeClause);
    this.pushDateRange(conditions, queryParams, params.query, "wl.work_date");
    this.pushSearch(conditions, queryParams, params.query.search, ["c.unit_name", "d.name", "p.jobdescription", "wl.employee_name"]);
    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") { conditions.push("CAST(wl.division_id AS CHAR) = ?"); queryParams.push(filter.value); }
      else if (filter.field === "carId") { conditions.push("wl.car_id = ?"); queryParams.push(filter.value); }
      else if (filter.field === "workType") conditions.push(filter.value === "PENGULANGAN" ? "p.is_rework = 1" : "COALESCE(p.is_rework, 0) = 0");
      else if (filter.field === "hourType") conditions.push(filter.value === "LEMBUR" ? "wl.overtime_hours > 0" : "wl.overtime_hours = 0");
      else if (filter.field === "materialUsage") conditions.push(filter.value === "DENGAN_BAHAN" ? "materials.materials IS NOT NULL" : "materials.materials IS NULL");
    }
    const whereClause = this.buildWhereClause(conditions);
    const sortColumn = ({ workDate: "wl.work_date", durationHours: "wl.duration_hours", unitName: "unitName" } as Record<string, string>)[params.query.sortBy] ?? "wl.work_date";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);
    const joins = `
      FROM ${this.tables.ledger} wl
      JOIN ${this.coreDb}.sm_jobdesc_plan p ON p.id = wl.plan_id
      LEFT JOIN ${this.tables.cars} c ON c.id = wl.car_id
      LEFT JOIN ${this.tables.divisions} d ON d.id = wl.division_id
      LEFT JOIN (
        SELECT countdown_id, usage_date,
          GROUP_CONCAT(DISTINCT item_name ORDER BY item_name SEPARATOR ', ') AS materials
        FROM ${this.tables.materialUsage}
        GROUP BY countdown_id, usage_date
      ) materials ON materials.countdown_id = wl.countdown_id
        AND materials.usage_date = wl.work_date`;
    const [rows] = await this.pool.query<GenericRow[]>(`
      SELECT DATE_FORMAT(wl.work_date, '%Y-%m-%d') workDate, wl.car_id carId,
        COALESCE(c.unit_name, wl.car_id) unitName, d.name divisionName,
        p.jobdescription jobDescription, wl.employee_name employeeName,
        IF(COALESCE(p.is_rework, 0) = 1, 'PENGULANGAN', 'NORMAL') workType,
        IF(wl.overtime_hours > 0, 'LEMBUR', 'NORMAL') hourType,
        wl.duration_hours durationHours, COALESCE(materials.materials, '-') materials,
        DATE_FORMAT(wl.submitted_at, '%Y-%m-%d %H:%i') submittedAt
      ${joins} ${whereClause}
      ORDER BY ${sortColumn} ${direction}, wl.id DESC ${pagination}`, listParams);
    const [countRows] = await this.pool.query<CountRow[]>(`SELECT COUNT(*) total ${joins} ${whereClause}`, queryParams);
    const [summaryRows] = await this.pool.query<GenericRow[]>(`SELECT COALESCE(SUM(wl.duration_hours),0) totalHours, COALESCE(SUM(wl.overtime_hours),0) overtimeHours, COUNT(DISTINCT wl.car_id) units, COUNT(*) totalRows ${joins} ${whereClause}`, queryParams);
    const summary = summaryRows[0];
    return {
      rows: rows.map((row) => ({ workDate: toStringValue(row.workDate), unitName: toStringValue(row.unitName), divisionName: toStringValue(row.divisionName), jobDescription: toStringValue(row.jobDescription), employeeName: toStringValue(row.employeeName), workType: toStringValue(row.workType), hourType: toStringValue(row.hourType), durationHours: toNumber(row.durationHours), materials: toStringValue(row.materials), submittedAt: toStringValue(row.submittedAt) })),
      total: toNumber(countRows[0]?.total),
      summary: [
        { label: "Total Jam", value: toNumber(summary?.totalHours).toFixed(2), helper: "Total jam final pada filter aktif." },
        { label: "Jam Lembur", value: toNumber(summary?.overtimeHours).toFixed(2), helper: "Bagian lembur yang siap ditagihkan." },
        { label: "Unit", value: String(toNumber(summary?.units)), helper: "Unit unik yang masuk laporan." },
        { label: "Baris Ledger", value: String(toNumber(summary?.totalRows)), helper: "Snapshot aktual final tanpa duplikasi." },
      ],
      filterOptions: { divisionId: await this.listDivisionOptions(params.scope), carId: await this.listCarOptions(params.scope), workType: WORK_TYPE_OPTIONS, hourType: HOUR_TYPE_OPTIONS, materialUsage: MATERIAL_USAGE_OPTIONS },
    };
  }

  private async listDivisionKpi(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "sdm.car_id",
      division: "sdm.division_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "sdm.last_updated_at");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(c.unit_name, sdm.car_id)",
      "COALESCE(d.name, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(sdm.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      completionRate: "completionRate",
      totalManHoursSpent: "sdm.total_man_hours_spent",
      avgProgressPercentage: "sdm.avg_progress_percentage",
      lastUpdatedAt: "sdm.last_updated_at",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "completionRate";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COALESCE(d.name, CAST(sdm.division_id AS CHAR)) AS divisionName,
          COALESCE(c.unit_name, sdm.car_id) AS unitName,
          sdm.total_man_hours_spent AS totalManHoursSpent,
          sdm.avg_progress_percentage AS avgProgressPercentage,
          sdm.count_panel_plan AS countPanelPlan,
          sdm.count_panel_done AS countPanelDone,
          CASE
            WHEN COALESCE(sdm.count_panel_plan, 0) = 0 THEN 0
            ELSE ROUND((sdm.count_panel_done / sdm.count_panel_plan) * 100, 2)
          END AS completionRate,
          DATE_FORMAT(sdm.last_updated_at, '%Y-%m-%d %H:%i:%s') AS lastUpdatedAt
        FROM ${this.tables.divisionSummary} sdm
        LEFT JOIN ${this.tables.cars} c ON c.id = sdm.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = sdm.division_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, sdm.last_updated_at DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.divisionSummary} sdm
        LEFT JOIN ${this.tables.cars} c ON c.id = sdm.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = sdm.division_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COALESCE(SUM(sdm.total_man_hours_spent), 0) AS totalManhour,
          COALESCE(AVG(sdm.avg_progress_percentage), 0) AS avgProgress,
          COALESCE(SUM(sdm.count_panel_plan), 0) AS totalPlan,
          COALESCE(SUM(sdm.count_panel_done), 0) AS totalDone
        FROM ${this.tables.divisionSummary} sdm
        LEFT JOIN ${this.tables.cars} c ON c.id = sdm.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = sdm.division_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        divisionName: toStringValue(row.divisionName),
        unitName: toStringValue(row.unitName),
        totalManHoursSpent: toNumber(row.totalManHoursSpent),
        avgProgressPercentage: toNumber(row.avgProgressPercentage),
        countPanelPlan: toNumber(row.countPanelPlan),
        countPanelDone: toNumber(row.countPanelDone),
        completionRate: toNumber(row.completionRate),
        lastUpdatedAt: toNullableString(row.lastUpdatedAt),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Total Manhour",
          value: toNumber(summaryRows[0]?.totalManhour).toFixed(2),
          helper: "Total manhour aggregate dari summary division monitoring.",
        },
        {
          label: "Avg Progress",
          value: `${toNumber(summaryRows[0]?.avgProgress).toFixed(1)}%`,
          helper: "Rata-rata progress aggregate semua division row.",
        },
        {
          label: "Panel Plan",
          value: String(toNumber(summaryRows[0]?.totalPlan)),
          helper: "Total panel plan dalam aggregate yang terambil.",
        },
        {
          label: "Panel Done",
          value: String(toNumber(summaryRows[0]?.totalDone)),
          helper: "Total panel done dalam aggregate yang terambil.",
        },
      ],
      filterOptions: {
        divisionId: await this.listDivisionOptions(params.scope),
      },
    };
  }

  private async listQcReject(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "cd.car_id",
      division: "cd.division_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "qi.inspection_date");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(c.unit_name, cd.car_id)",
      "COALESCE(d.name, '')",
      "COALESCE(qi.result_status, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "resultStatus") {
        conditions.push("qi.result_status = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "qcLevel") {
        conditions.push("qi.qc_level = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      inspectionDate: "qi.inspection_date",
      qcLevel: "qi.qc_level",
      resultStatus: "qi.result_status",
      unitName: "unitName",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "qi.inspection_date";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          DATE_FORMAT(qi.inspection_date, '%Y-%m-%d %H:%i:%s') AS inspectionDate,
          COALESCE(c.unit_name, cd.car_id) AS unitName,
          COALESCE(d.name, CAST(cd.division_id AS CHAR)) AS divisionName,
          qi.qc_level AS qcLevel,
          qi.result_status AS resultStatus,
          CASE WHEN qi.rework_plan_id IS NULL THEN 'NO' ELSE 'YES' END AS hasRework,
          qi.rework_plan_id AS reworkPlanId
        FROM ${this.tables.qcInspections} qi
        LEFT JOIN ${this.tables.countdown} cd ON cd.id = qi.core_id
        LEFT JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, qi.inspection_date DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.qcInspections} qi
        LEFT JOIN ${this.tables.countdown} cd ON cd.id = qi.core_id
        LEFT JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalInspections,
          SUM(CASE WHEN qi.result_status NOT IN ('LOLOS', 'PASS') THEN 1 ELSE 0 END) AS rejectCount,
          SUM(CASE WHEN qi.rework_plan_id IS NOT NULL THEN 1 ELSE 0 END) AS reworkCount
        FROM ${this.tables.qcInspections} qi
        LEFT JOIN ${this.tables.countdown} cd ON cd.id = qi.core_id
        LEFT JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        inspectionDate: toStringValue(row.inspectionDate),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        qcLevel: toStringValue(row.qcLevel),
        resultStatus: toStringValue(row.resultStatus),
        hasRework: toStringValue(row.hasRework),
        reworkPlanId: toNullableString(row.reworkPlanId),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Inspection Rows",
          value: String(toNumber(summaryRows[0]?.totalInspections)),
          helper: "Total QC inspection row yang terbaca.",
        },
        {
          label: "Reject Count",
          value: String(toNumber(summaryRows[0]?.rejectCount)),
          helper: "Inspection non-pass yang perlu follow up.",
        },
        {
          label: "Rework Linked",
          value: String(toNumber(summaryRows[0]?.reworkCount)),
          helper: "Inspection yang sudah mengarah ke rework plan.",
        },
      ],
      filterOptions: {
        resultStatus: await this.listDistinctOptions(
          `
            SELECT DISTINCT result_status AS value
            FROM ${this.tables.qcInspections}
            WHERE result_status IS NOT NULL
            ORDER BY result_status ASC
          `,
        ),
        qcLevel: QC_LEVEL_OPTIONS,
      },
    };
  }

  private async listIssues(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "il.car_id",
      division: "il.division_id",
      employee: "il.reported_by",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "il.created_at");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(il.issue_number, '')",
      "COALESCE(il.title, '')",
      "COALESCE(c.unit_name, il.car_id)",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(il.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "severity") {
        conditions.push("il.severity = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "status") {
        conditions.push("il.status = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "sourceType") {
        conditions.push("il.source_type = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      createdAt: "il.created_at",
      severity: "il.severity",
      status: "il.status",
      unitName: "unitName",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "il.created_at";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          il.issue_number AS issueNumber,
          COALESCE(c.unit_name, il.car_id) AS unitName,
          COALESCE(d.name, CAST(il.division_id AS CHAR)) AS divisionName,
          il.source_type AS sourceType,
          il.severity AS severity,
          il.status AS status,
          CASE WHEN il.is_urgent = 1 THEN 'YES' ELSE 'NO' END AS isUrgent,
          DATE_FORMAT(il.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(il.resolved_at, '%Y-%m-%d %H:%i:%s') AS resolvedAt
        FROM ${this.tables.issues} il
        LEFT JOIN ${this.tables.cars} c ON c.id = il.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = il.division_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, il.created_at DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.issues} il
        LEFT JOIN ${this.tables.cars} c ON c.id = il.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = il.division_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalIssues,
          SUM(CASE WHEN il.status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'QC_RECHECK', 'ESCALATED') THEN 1 ELSE 0 END) AS openCount,
          SUM(CASE WHEN il.is_urgent = 1 THEN 1 ELSE 0 END) AS urgentCount,
          SUM(CASE WHEN il.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolvedCount
        FROM ${this.tables.issues} il
        LEFT JOIN ${this.tables.cars} c ON c.id = il.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = il.division_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        issueNumber: toStringValue(row.issueNumber),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        sourceType: toStringValue(row.sourceType),
        severity: toStringValue(row.severity),
        status: toStringValue(row.status),
        isUrgent: toStringValue(row.isUrgent),
        createdAt: toStringValue(row.createdAt),
        resolvedAt: toNullableString(row.resolvedAt),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Total Issues",
          value: String(toNumber(summaryRows[0]?.totalIssues)),
          helper: "Jumlah issue pada query aktif.",
        },
        {
          label: "Open Backlog",
          value: String(toNumber(summaryRows[0]?.openCount)),
          helper: "Issue yang belum selesai/closed.",
        },
        {
          label: "Urgent",
          value: String(toNumber(summaryRows[0]?.urgentCount)),
          helper: "Issue yang ditandai urgent.",
        },
        {
          label: "Resolved",
          value: String(toNumber(summaryRows[0]?.resolvedCount)),
          helper: "Issue yang sudah selesai.",
        },
      ],
      filterOptions: {
        divisionId: await this.listDivisionOptions(params.scope),
        severity: ISSUE_SEVERITY_OPTIONS,
        status: ISSUE_STATUS_OPTIONS,
        sourceType: ISSUE_SOURCE_OPTIONS,
      },
    };
  }

  private async listSpk(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "c.id",
      division: "d.id",
      employee: "sh.created_by_employee_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "sh.spk_date");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(sh.spk_number, '')",
      "COALESCE(sd.unit_name_snapshot, '')",
      "COALESCE(sd.job_name_snapshot, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "status") {
        conditions.push("sh.status = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "approvalState") {
        conditions.push("sd.approval_state = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "divisionName") {
        conditions.push("sd.division_name_snapshot = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      spkDate: "sh.spk_date",
      targetDate: "sd.target_date_snapshot",
      targetHours: "sd.target_hours_snapshot",
      status: "sh.status",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "sh.spk_date";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          sh.spk_number AS spkNumber,
          DATE_FORMAT(sh.spk_date, '%Y-%m-%d') AS spkDate,
          sh.status AS status,
          sd.unit_name_snapshot AS unitName,
          sd.division_name_snapshot AS divisionName,
          sd.job_name_snapshot AS jobName,
          DATE_FORMAT(sd.target_date_snapshot, '%Y-%m-%d') AS targetDate,
          sd.target_hours_snapshot AS targetHours,
          sd.approval_state AS approvalState
        FROM ${this.tables.spkHeader} sh
        LEFT JOIN ${this.tables.spkDetail} sd ON sd.spk_id = sh.id
        LEFT JOIN ${this.tables.cars} c
          ON c.unit_name = sd.unit_name_snapshot
          OR c.id = sd.unit_name_snapshot
        LEFT JOIN ${this.tables.divisions} d ON d.name = sd.division_name_snapshot
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, sh.spk_date DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.spkHeader} sh
        LEFT JOIN ${this.tables.spkDetail} sd ON sd.spk_id = sh.id
        LEFT JOIN ${this.tables.cars} c
          ON c.unit_name = sd.unit_name_snapshot
          OR c.id = sd.unit_name_snapshot
        LEFT JOIN ${this.tables.divisions} d ON d.name = sd.division_name_snapshot
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(DISTINCT sh.id) AS totalSpk,
          COUNT(*) AS totalRows,
          COALESCE(SUM(sd.target_hours_snapshot), 0) AS totalTargetHours,
          SUM(CASE WHEN sh.status IN ('APPROVED', 'ACTIVE') THEN 1 ELSE 0 END) AS activeRows
        FROM ${this.tables.spkHeader} sh
        LEFT JOIN ${this.tables.spkDetail} sd ON sd.spk_id = sh.id
        LEFT JOIN ${this.tables.cars} c
          ON c.unit_name = sd.unit_name_snapshot
          OR c.id = sd.unit_name_snapshot
        LEFT JOIN ${this.tables.divisions} d ON d.name = sd.division_name_snapshot
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        spkNumber: toStringValue(row.spkNumber),
        spkDate: toStringValue(row.spkDate),
        status: toStringValue(row.status),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        jobName: toStringValue(row.jobName),
        targetDate: toNullableString(row.targetDate),
        targetHours: toNumber(row.targetHours),
        approvalState: toStringValue(row.approvalState),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "SPK Header",
          value: String(toNumber(summaryRows[0]?.totalSpk)),
          helper: "Jumlah SPK header dalam scope query.",
        },
        {
          label: "Detail Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah detail snapshot SPK yang tampil.",
        },
        {
          label: "Target Hours",
          value: toNumber(summaryRows[0]?.totalTargetHours).toFixed(2),
          helper: "Akumulasi target hours dari detail snapshot.",
        },
        {
          label: "Approved/Active",
          value: String(toNumber(summaryRows[0]?.activeRows)),
          helper: "Baris yang sudah approved atau active.",
        },
      ],
      filterOptions: {
        status: SPK_STATUS_OPTIONS,
        approvalState: SPK_APPROVAL_OPTIONS,
        divisionName: await this.listDivisionOptions(params.scope, true),
      },
    };
  }

  private async listWoAging(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "wo.car_id",
      division: "wo.to_div_id",
      employee: "wo.pic_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "wo.request_date");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(wo.wo_number, '')",
      "COALESCE(c.unit_name, wo.car_id)",
      "COALESCE(from_div.name, '')",
      "COALESCE(to_div.name, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "status") {
        conditions.push("wo.status = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "toDivisionId") {
        conditions.push("CAST(wo.to_div_id AS CHAR) = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      ageDays: "ageDays",
      requestDate: "wo.request_date",
      status: "wo.status",
      unitName: "unitName",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "ageDays";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          wo.wo_number AS woNumber,
          DATE_FORMAT(wo.request_date, '%Y-%m-%d') AS requestDate,
          COALESCE(c.unit_name, wo.car_id) AS unitName,
          COALESCE(from_div.name, CAST(wo.from_div_id AS CHAR)) AS fromDivisionName,
          COALESCE(to_div.name, CAST(wo.to_div_id AS CHAR)) AS toDivisionName,
          wo.estimated_hours AS estimatedHours,
          wo.status AS status,
          wo.acc_tracking AS accTracking,
          GREATEST(DATEDIFF(CURRENT_DATE, wo.request_date), 0) AS ageDays,
          CASE
            WHEN DATEDIFF(CURRENT_DATE, wo.request_date) >= 14 THEN '14+ DAYS'
            WHEN DATEDIFF(CURRENT_DATE, wo.request_date) >= 7 THEN '7-13 DAYS'
            WHEN DATEDIFF(CURRENT_DATE, wo.request_date) >= 3 THEN '3-6 DAYS'
            ELSE '0-2 DAYS'
          END AS agingBucket
        FROM ${this.tables.wo} wo
        LEFT JOIN ${this.tables.cars} c ON c.id = wo.car_id
        LEFT JOIN ${this.tables.divisions} from_div ON from_div.id = wo.from_div_id
        LEFT JOIN ${this.tables.divisions} to_div ON to_div.id = wo.to_div_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, wo.request_date DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.wo} wo
        LEFT JOIN ${this.tables.cars} c ON c.id = wo.car_id
        LEFT JOIN ${this.tables.divisions} from_div ON from_div.id = wo.from_div_id
        LEFT JOIN ${this.tables.divisions} to_div ON to_div.id = wo.to_div_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalRows,
          SUM(CASE WHEN wo.status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedRows,
          SUM(CASE WHEN wo.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedRows,
          SUM(CASE WHEN DATEDIFF(CURRENT_DATE, wo.request_date) >= 3 THEN 1 ELSE 0 END) AS agingRisk
        FROM ${this.tables.wo} wo
        LEFT JOIN ${this.tables.cars} c ON c.id = wo.car_id
        LEFT JOIN ${this.tables.divisions} from_div ON from_div.id = wo.from_div_id
        LEFT JOIN ${this.tables.divisions} to_div ON to_div.id = wo.to_div_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        woNumber: toStringValue(row.woNumber),
        requestDate: toStringValue(row.requestDate),
        unitName: toStringValue(row.unitName),
        fromDivisionName: toStringValue(row.fromDivisionName),
        toDivisionName: toStringValue(row.toDivisionName),
        estimatedHours: toNullableNumber(row.estimatedHours),
        status: toStringValue(row.status),
        accTracking: toNumber(row.accTracking),
        ageDays: toNumber(row.ageDays),
        agingBucket: toStringValue(row.agingBucket),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "WO Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah WO dalam scope query.",
        },
        {
          label: "Approved",
          value: String(toNumber(summaryRows[0]?.approvedRows)),
          helper: "WO yang sudah approved.",
        },
        {
          label: "Rejected",
          value: String(toNumber(summaryRows[0]?.rejectedRows)),
          helper: "WO yang sudah rejected.",
        },
        {
          label: "Aging Risk",
          value: String(toNumber(summaryRows[0]?.agingRisk)),
          helper: "WO dengan umur 3 hari atau lebih.",
        },
      ],
      filterOptions: {
        status: WO_STATUS_OPTIONS,
        toDivisionId: await this.listDivisionOptions(params.scope),
      },
    };
  }

  private async listPrAging(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "pr_base.carScopeId",
      employee: "pr_base.requestedBy",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "pr_base.createdAtDate");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(pr_base.prNumber, '')",
      "COALESCE(pr_base.unitName, '')",
      "COALESCE(pr_base.divisionName, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "status") {
        conditions.push("pr_base.status = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "approvalStatus") {
        conditions.push("pr_base.approvalStatus = ?");
        queryParams.push(filter.value);
      }
    }

    const baseSql = `
      SELECT
        ph.id AS id,
        ph.pr_number AS prNumber,
        DATE_FORMAT(ph.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE(ph.created_at) AS createdAtDate,
        COALESCE(c.unit_name, ph.car_name, ph.car_id, '-') AS unitName,
        ph.division_name AS divisionName,
        COUNT(pi.id) AS itemCount,
        COALESCE(SUM(COALESCE(pi.estimated_price, 0) * COALESCE(pi.qty, 0)), 0) AS estimatedTotal,
        COALESCE(SUM(COALESCE(pi.actual_price, 0) * COALESCE(pi.qty, 0)), 0) AS actualTotal,
        ph.acc_tracking AS approvalStatus,
        COALESCE(ph.status, 'OPEN') AS status,
        GREATEST(DATEDIFF(CURRENT_DATE, DATE(ph.created_at)), 0) AS ageDays,
        ph.car_id AS carScopeId,
        ph.requested_by AS requestedBy
      FROM ${this.tables.prHeader} ph
      LEFT JOIN ${this.tables.prItems} pi ON pi.pr_id = ph.id
      LEFT JOIN ${this.tables.cars} c ON c.id = ph.car_id
      GROUP BY ph.id
    `;
    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      ageDays: "pr_base.ageDays",
      createdAt: "pr_base.createdAtDate",
      estimatedTotal: "pr_base.estimatedTotal",
      actualTotal: "pr_base.actualTotal",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "pr_base.ageDays";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          pr_base.prNumber,
          pr_base.createdAt,
          pr_base.unitName,
          pr_base.divisionName,
          pr_base.itemCount,
          pr_base.estimatedTotal,
          pr_base.actualTotal,
          pr_base.approvalStatus,
          pr_base.status,
          pr_base.ageDays
        FROM (${baseSql}) pr_base
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, pr_base.createdAtDate DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM (${baseSql}) pr_base
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalRows,
          COALESCE(SUM(pr_base.estimatedTotal), 0) AS estimatedTotal,
          COALESCE(SUM(pr_base.actualTotal), 0) AS actualTotal,
          SUM(CASE WHEN pr_base.approvalStatus <> 'APPROVED' THEN 1 ELSE 0 END) AS pendingApproval
        FROM (${baseSql}) pr_base
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        prNumber: toStringValue(row.prNumber),
        createdAt: toStringValue(row.createdAt),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        itemCount: toNumber(row.itemCount),
        estimatedTotal: toNumber(row.estimatedTotal),
        actualTotal: toNumber(row.actualTotal),
        approvalStatus: toStringValue(row.approvalStatus),
        status: toStringValue(row.status),
        ageDays: toNumber(row.ageDays),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "PR Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah PR header dalam query aktif.",
        },
        {
          label: "Estimated",
          value: toNumber(summaryRows[0]?.estimatedTotal).toFixed(2),
          helper: "Akumulasi total estimasi nilai PR.",
        },
        {
          label: "Actual",
          value: toNumber(summaryRows[0]?.actualTotal).toFixed(2),
          helper: "Akumulasi actual price yang sudah tercatat.",
        },
        {
          label: "Pending Approval",
          value: String(toNumber(summaryRows[0]?.pendingApproval)),
          helper: "PR yang belum mencapai status approval final.",
        },
      ],
      filterOptions: {
        status: PR_STATUS_OPTIONS,
        approvalStatus: PR_APPROVAL_OPTIONS,
      },
    };
  }

  private async listMaterialCost(params: ReportDataParams): Promise<ReportDataset> {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "mu.car_id",
      division: "mu.division_id",
      employee: "mu.employee_id",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "mu.usage_date");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(c.unit_name, mu.car_id)",
      "COALESCE(mu.division_name, '')",
      "COALESCE(mu.item_name, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(mu.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "itemCategory") {
        conditions.push("mu.item_category = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      usageDate: "mu.usage_date",
      totalPrice: "mu.total_price",
      unitName: "unitName",
      itemName: "mu.item_name",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "mu.usage_date";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          DATE_FORMAT(mu.usage_date, '%Y-%m-%d') AS usageDate,
          COALESCE(c.unit_name, mu.car_id) AS unitName,
          COALESCE(mu.division_name, CAST(mu.division_id AS CHAR)) AS divisionName,
          mu.item_name AS itemName,
          mu.item_category AS itemCategory,
          mu.qty AS qty,
          mu.price_per_unit AS pricePerUnit,
          mu.total_price AS totalPrice
        FROM ${this.tables.materialUsage} mu
        LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, mu.usage_date DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.materialUsage} mu
        LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalRows,
          COALESCE(SUM(mu.total_price), 0) AS totalCost,
          COALESCE(SUM(mu.qty), 0) AS totalQty,
          COUNT(DISTINCT mu.car_id) AS totalUnits
        FROM ${this.tables.materialUsage} mu
        LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        usageDate: toStringValue(row.usageDate),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        itemName: toStringValue(row.itemName),
        itemCategory: toStringValue(row.itemCategory),
        qty: toNumber(row.qty),
        pricePerUnit: toNullableNumber(row.pricePerUnit),
        totalPrice: toNullableNumber(row.totalPrice),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Usage Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah material usage row pada query aktif.",
        },
        {
          label: "Total Cost",
          value: toNumber(summaryRows[0]?.totalCost).toFixed(2),
          helper: "Akumulasi biaya material usage.",
        },
        {
          label: "Total Qty",
          value: toNumber(summaryRows[0]?.totalQty).toFixed(3),
          helper: "Akumulasi qty material yang dipakai.",
        },
        {
          label: "Unit Count",
          value: String(toNumber(summaryRows[0]?.totalUnits)),
          helper: "Jumlah unit unik yang memakai material.",
        },
      ],
      filterOptions: {
        divisionId: await this.listDivisionOptions(params.scope),
        itemCategory: ITEM_CATEGORY_OPTIONS,
      },
    };
  }

  private async listCashFlow(params: ReportDataParams): Promise<ReportDataset> {
    const baseSql = `
      SELECT
        'PR' AS sourceType,
        ph.pr_number AS documentNumber,
        COALESCE(c.unit_name, ph.car_name, ph.car_id, '-') AS unitName,
        ph.division_name AS divisionName,
        MAX(pi.vendor_name) AS vendorName,
        COALESCE(MAX(pi.arrival_date), DATE(ph.created_at)) AS cashDate,
        COALESCE(SUM(COALESCE(pi.estimated_price, 0) * COALESCE(pi.qty, 0)), 0) AS estimatedAmount,
        COALESCE(SUM(COALESCE(pi.actual_price, 0) * COALESCE(pi.qty, 0)), 0) AS actualAmount,
        COALESCE(ph.status, 'OPEN') AS status,
        ph.car_id AS carScopeId,
        NULL AS divisionScopeId,
        ph.requested_by AS employeeScopeId
      FROM ${this.tables.prHeader} ph
      LEFT JOIN ${this.tables.prItems} pi ON pi.pr_id = ph.id
      LEFT JOIN ${this.tables.cars} c ON c.id = ph.car_id
      GROUP BY ph.id
      UNION ALL
      SELECT
        'VENDOR_WO' AS sourceType,
        vw.wov_number AS documentNumber,
        COALESCE(c.unit_name, vw.car_name, vw.car_id, '-') AS unitName,
        vw.division_name AS divisionName,
        vw.vendor_name AS vendorName,
        COALESCE(vw.date_in, vw.target_date_return, vw.date_out, DATE(vw.created_at)) AS cashDate,
        COALESCE(vw.estimated_cost, 0) AS estimatedAmount,
        COALESCE(vw.actual_cost, 0) AS actualAmount,
        COALESCE(vw.status, 'OPEN') AS status,
        vw.car_id AS carScopeId,
        NULL AS divisionScopeId,
        vw.requested_by AS employeeScopeId
      FROM ${this.tables.vendorWo} vw
      LEFT JOIN ${this.tables.cars} c ON c.id = vw.car_id
      UNION ALL
      SELECT
        'MATERIAL_USAGE' AS sourceType,
        COALESCE(mu.warehouse_trx_id, mu.id) AS documentNumber,
        COALESCE(c.unit_name, mu.car_id, '-') AS unitName,
        mu.division_name AS divisionName,
        NULL AS vendorName,
        mu.usage_date AS cashDate,
        0 AS estimatedAmount,
        COALESCE(mu.total_price, 0) AS actualAmount,
        'USED' AS status,
        mu.car_id AS carScopeId,
        mu.division_id AS divisionScopeId,
        mu.employee_id AS employeeScopeId
      FROM ${this.tables.materialUsage} mu
      LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
    `;
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams, {
      car: "cash_base.carScopeId",
      division: "cash_base.divisionScopeId",
      employee: "cash_base.employeeScopeId",
    });
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    this.pushDateRange(conditions, queryParams, params.query, "cash_base.cashDate");
    this.pushSearch(conditions, queryParams, params.query.search, [
      "COALESCE(cash_base.documentNumber, '')",
      "COALESCE(cash_base.unitName, '')",
      "COALESCE(cash_base.vendorName, '')",
    ]);
    for (const filter of params.query.filters) {
      if (filter.field === "sourceType") {
        conditions.push("cash_base.sourceType = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = this.buildWhereClause(conditions);
    const sortMap: Record<string, string> = {
      cashDate: "cash_base.cashDate",
      estimatedAmount: "cash_base.estimatedAmount",
      actualAmount: "cash_base.actualAmount",
      sourceType: "cash_base.sourceType",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "cash_base.cashDate";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const listParams = [...queryParams];
    const pagination = this.buildPagination(params.query, params.exportAll, listParams);

    const [rows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          DATE_FORMAT(cash_base.cashDate, '%Y-%m-%d') AS cashDate,
          cash_base.sourceType,
          cash_base.documentNumber,
          cash_base.unitName,
          cash_base.divisionName,
          cash_base.vendorName,
          cash_base.estimatedAmount,
          cash_base.actualAmount,
          cash_base.status
        FROM (${baseSql}) cash_base
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, cash_base.cashDate DESC
        ${pagination}
      `,
      listParams,
    );

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM (${baseSql}) cash_base
        ${whereClause}
      `,
      queryParams,
    );

    const [summaryRows] = await this.pool.query<GenericRow[]>(
      `
        SELECT
          COUNT(*) AS totalRows,
          COALESCE(SUM(cash_base.estimatedAmount), 0) AS estimatedTotal,
          COALESCE(SUM(cash_base.actualAmount), 0) AS actualTotal,
          COALESCE(SUM(CASE WHEN cash_base.sourceType = 'MATERIAL_USAGE' THEN cash_base.actualAmount ELSE 0 END), 0) AS materialActual
        FROM (${baseSql}) cash_base
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map((row) => ({
        cashDate: toStringValue(row.cashDate),
        sourceType: toStringValue(row.sourceType),
        documentNumber: toStringValue(row.documentNumber),
        unitName: toStringValue(row.unitName),
        divisionName: toStringValue(row.divisionName),
        vendorName: toNullableString(row.vendorName),
        estimatedAmount: toNumber(row.estimatedAmount),
        actualAmount: toNumber(row.actualAmount),
        status: toStringValue(row.status),
      })),
      total: toNumber(countRows[0]?.total),
      summary: [
        {
          label: "Cash Rows",
          value: String(toNumber(summaryRows[0]?.totalRows)),
          helper: "Jumlah row proyeksi cash out pada query aktif.",
        },
        {
          label: "Estimated",
          value: toNumber(summaryRows[0]?.estimatedTotal).toFixed(2),
          helper: "Akumulasi nilai estimasi cash out.",
        },
        {
          label: "Actual",
          value: toNumber(summaryRows[0]?.actualTotal).toFixed(2),
          helper: "Akumulasi nilai actual cash out.",
        },
        {
          label: "Material Actual",
          value: toNumber(summaryRows[0]?.materialActual).toFixed(2),
          helper: "Komponen actual yang berasal dari material usage.",
        },
      ],
      filterOptions: {
        sourceType: CASH_SOURCE_OPTIONS,
      },
    };
  }
}
