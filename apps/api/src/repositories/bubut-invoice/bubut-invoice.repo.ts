import type {
  BubutInvoiceSnapshot,
  BubutInvoiceType,
  BubutInvoiceWorkOrderQuery,
  BubutInvoiceWorkOrderRow,
} from "@smsystem/contracts/bubut-invoice";
import type { AuthScope } from "@smsystem/contracts/auth";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ScopedParams {
  employeeId: string;
  scope: AuthScope;
}

interface ListParams extends ScopedParams {
  query: BubutInvoiceWorkOrderQuery;
}

interface SourceParams extends ScopedParams {
  sourceWoId: string;
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

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function toDateString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function parseJsonArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface BubutInvoiceSource {
  sourceWoId: string;
  sourceWobNo: string;
  woDate: string | null;
  carId: string | null;
  carType: string | null;
  headProjectName: string | null;
  sparepartName: string | null;
  qty: number | null;
  qtyUnit: string | null;
  operatorName: string | null;
  divisionName: string | null;
  processDetailText: string | null;
}

export interface BubutInvoiceWorkHistoryWorkRowSource {
  id: string;
  actualId: string | null;
  countdownId: string | null;
  workDate: string | null;
  startTime: string | null;
  finishTime: string | null;
  breakHours: number;
  workingHourDecimal: number;
  resultStatus: string | null;
  operatorName: string | null;
  panelPartName: string | null;
  jobdesc: string | null;
  processDetail: string | null;
  documentationUrls: string[];
}

export interface BubutInvoiceRepository {
  findCompletedBubutWorkOrders(params: ListParams): Promise<{
    rows: BubutInvoiceWorkOrderRow[];
    total: number;
  }>;
  findWorkOrderSource(params: SourceParams): Promise<BubutInvoiceSource | null>;
  findActualWorkingHoursByWo(sourceWoId: string): Promise<Array<{
    actualId: string | null;
    workDate: string;
    start: string | null;
    finish: string | null;
    breakHours: number;
    workingHourDecimal: number;
    employeeName: string | null;
  }>>;
  findWarehouseMaterialsByWo(sourceWoId: string): Promise<Array<{
    materialName: string;
    qty: number;
    unit: string | null;
    price: number;
    total: number;
    warehouseTransactionId: string | null;
    stockCardId: string | null;
  }>>;
  findPicturesByWo(sourceWoId: string): Promise<Array<{
    url: string;
    caption: string | null;
    source: "GALLERY" | "LEDGER";
  }>>;
  findWorkHistoryRowsByWo(sourceWoId: string): Promise<BubutInvoiceWorkHistoryWorkRowSource[]>;
  findActiveInvoiceIdsBySourceWoId(sourceWoId: string): Promise<{
    direksiInvoiceId: number | null;
    customerInvoiceId: number | null;
  }>;
  findActiveInvoiceBySource(
    sourceWobNo: string,
    invoiceType: BubutInvoiceType,
  ): Promise<{ id: number } | null>;
  insertInvoice(snapshot: BubutInvoiceSnapshot): Promise<{
    invoiceId: number;
    invoiceNo: string;
  }>;
  findInvoiceById(params: ScopedParams & { invoiceId: number }): Promise<BubutInvoiceSnapshot | null>;
  cancelInvoice(params: {
    invoiceId: number;
    actorId: string;
    actorName: string;
    reason: string;
  }): Promise<boolean>;
  updateInvoice(
    invoiceId: number,
    snapshot: BubutInvoiceSnapshot,
    actorId: string,
    actorName: string,
  ): Promise<boolean>;
  getNextInvoiceSequence(month: string, year: string): Promise<number>;
  markPrinted(invoiceId: number): Promise<void>;
}

export class MySqlBubutInvoiceRepository implements BubutInvoiceRepository {
  private readonly pool: Pool;
  private readonly coreDb: string;
  private readonly warehouseDb: string;

  constructor() {
    const env = getApiEnv();
    this.pool = getMySqlPool(env);
    this.coreDb = env.CORE_DB_NAME;
    this.warehouseDb = env.WAREHOUSE_DB_NAME;
  }

  private get tables() {
    return {
      assignments: qualifyTable(this.coreDb, "car_project_assignment"),
      actual: qualifyTable(this.coreDb, "sm_jobdesc_actual"),
      cars: qualifyTable(this.coreDb, "cars"),
      countdown: qualifyTable(this.coreDb, "sm_jobdesc_countdown"),
      countdownDetail: qualifyTable(this.coreDb, "sm_jobdesc_countdown_detail"),
      divisions: qualifyTable(this.coreDb, "sm_divisi"),
      employees: qualifyTable(this.coreDb, "sm_employee"),
      invoice: qualifyTable(this.coreDb, "sm_bubut_invoice"),
      ledger: qualifyTable(this.coreDb, "sm_work_ledger"),
      ledgerPhotos: qualifyTable(this.coreDb, "sm_work_ledger_photos"),
      photosTemp: qualifyTable(this.coreDb, "sm_work_photos_temp"),
      plan: qualifyTable(this.coreDb, "sm_jobdesc_plan"),
      wo: qualifyTable(this.coreDb, "sm_jobdesc_wo"),
      materialPrices: qualifyTable(this.warehouseDb, "wh_material_prices"),
      materialUsage: qualifyTable(this.warehouseDb, "wh_material_usage"),
      transactions: qualifyTable(this.warehouseDb, "wh_transactions"),
    };
  }

  private buildScopeClause(scope: AuthScope, employeeId: string, params: unknown[]) {
    if (scope.canViewAllUnits) {
      return "";
    }

    const clauses: string[] = [];
    if (scope.divisionIds.length > 0) {
      clauses.push(`wo.to_div_id IN (${scope.divisionIds.map(() => "?").join(", ")})`);
      params.push(...scope.divisionIds);
    }

    if (scope.unitIds.length > 0) {
      clauses.push(`wo.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
      params.push(...scope.unitIds);
    }

    if (scope.canViewAssignedUnits) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM ${this.tables.assignments} assignment_scope
          WHERE assignment_scope.car_id = wo.car_id
            AND assignment_scope.ended_at IS NULL
            AND (
              assignment_scope.kp_id = ?
              OR assignment_scope.advisor_id = ?
              OR assignment_scope.kd_id = ?
            )
        )
      `);
      params.push(employeeId, employeeId, employeeId);
    }

    if (clauses.length === 0) {
      return "1 = 0";
    }

    return `(${clauses.join(" OR ")})`;
  }

  private buildBaseConditions(params: ListParams, queryParams: unknown[]) {
    const conditions = [
      "(UPPER(TRIM(to_div.code)) IN ('BBT', 'BUBUT') OR UPPER(TRIM(to_div.name)) LIKE '%BUBUT%')",
      "UPPER(done_core.status) IN ('DONE', 'QC_READY', 'READY_QC')",
      "done_core.ref_taks_id IS NOT NULL",
    ];

    const scopeClause = this.buildScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const { query } = params;
    if (query.search) {
      conditions.push(`(
        wo.wo_number LIKE ?
        OR car.unit_name LIKE ?
        OR wo.panel_name LIKE ?
        OR wo.job_detail LIKE ?
        OR operator.full_name LIKE ?
      )`);
      const search = `%${query.search}%`;
      queryParams.push(search, search, search, search, search);
    }

    if (query.woDateFrom) {
      conditions.push("wo.request_date >= ?");
      queryParams.push(query.woDateFrom);
    }
    if (query.woDateTo) {
      conditions.push("wo.request_date <= ?");
      queryParams.push(query.woDateTo);
    }
    if (query.workDateFrom) {
      conditions.push("work_summary.work_date >= ?");
      queryParams.push(query.workDateFrom);
    }
    if (query.workDateTo) {
      conditions.push("work_summary.work_date <= ?");
      queryParams.push(query.workDateTo);
    }
    if (query.team) {
      conditions.push("approver.full_name LIKE ?");
      queryParams.push(`%${query.team}%`);
    }
    if (query.carId) {
      conditions.push("wo.car_id = ?");
      queryParams.push(query.carId);
    }
    if (query.sparepartName) {
      conditions.push("wo.panel_name = ?");
      queryParams.push(query.sparepartName);
    }
    if (query.operatorId) {
      conditions.push("operator.employee_id = ?");
      queryParams.push(query.operatorId);
    }
    if (query.invoiceType === "DIREKSI") {
      conditions.push("direksi_invoice.id IS NOT NULL");
    }
    if (query.invoiceType === "CUSTOMER") {
      conditions.push("customer_invoice.id IS NOT NULL");
    }
    if (query.invoiceStatus) {
      const statusConditions: Record<string, string> = {
        BELUM_RILIS: "direksi_invoice.id IS NULL AND customer_invoice.id IS NULL AND cancelled_invoice.id IS NULL",
        RILIS_DIREKSI: "direksi_invoice.id IS NOT NULL AND customer_invoice.id IS NULL",
        RILIS_CUSTOMER: "direksi_invoice.id IS NULL AND customer_invoice.id IS NOT NULL",
        RILIS_KEDUANYA: "direksi_invoice.id IS NOT NULL AND customer_invoice.id IS NOT NULL",
        DIBATALKAN: "direksi_invoice.id IS NULL AND customer_invoice.id IS NULL AND cancelled_invoice.id IS NOT NULL",
      };
      conditions.push(statusConditions[query.invoiceStatus]);
    }
    for (const filter of query.filters) {
      if (filter.field === "invoiceStatus" || filter.field === "invoiceType") {
        continue;
      }

      const filterColumns: Record<string, string> = {
        sourceWobNo: "wo.wo_number",
        teamName: "approver.full_name",
        carType: "car.unit_name",
        operatorName: "COALESCE(operator.full_name, work_summary.operator_name)",
        divisionName: "to_div.name",
        sparepartName: "wo.panel_name",
      };
      const column = filterColumns[filter.field];
      if (!column) {
        continue;
      }

      conditions.push(`${column} LIKE ?`);
      queryParams.push(`%${filter.value}%`);
    }

    return conditions;
  }

  async findCompletedBubutWorkOrders(params: ListParams) {
    const tables = this.tables;
    const queryParams: unknown[] = [];
    const conditions = this.buildBaseConditions(params, queryParams);
    const whereClause = `WHERE ${conditions.join("\nAND ")}`;
    const sortColumns: Record<string, string> = {
      woDate: "wo.request_date",
      workDate: "work_summary.work_date",
      sourceWobNo: "wo.wo_number",
      teamName: "approver.full_name",
      carType: "car.unit_name",
      operatorName: "operator.full_name",
      divisionName: "to_div.name",
      totalWorkHourDecimal: "work_summary.total_hours",
      materialTotal: "material_summary.material_total",
      totalPriceBubut: "(COALESCE(work_summary.working_hour_total, 0) + COALESCE(material_summary.material_total, 0))",
    };
    const orderBy = `${sortColumns[params.query.sortBy] ?? sortColumns.woDate} ${params.query.sortDirection === "asc" ? "ASC" : "DESC"}`;
    const offset = (params.query.page - 1) * params.query.limit;
    const limitSql = Math.max(1, Math.min(100, params.query.limit));
    const offsetSql = Math.max(0, offset);

    const fromSql = `
      FROM ${tables.wo} wo
      INNER JOIN ${tables.divisions} to_div ON to_div.id = wo.to_div_id
      INNER JOIN ${tables.countdown} done_core
        ON done_core.ref_taks_id = wo.id
       AND done_core.task_category = 'WO'
      LEFT JOIN ${tables.cars} car ON car.id = wo.car_id
      LEFT JOIN ${tables.employees} approver ON approver.employee_id = wo.approver_id
      LEFT JOIN (
        SELECT
          core.ref_taks_id AS source_wo_id,
          MIN(detail.work_date) AS work_date,
          SUM(detail.billed_hours) AS total_hours,
          SUM(ROUND(((7500 * detail.billed_hours * 1444) / 1000) * 2)) AS working_hour_total,
          SUBSTRING_INDEX(GROUP_CONCAT(detail.employee_name ORDER BY detail.work_date DESC SEPARATOR '||'), '||', 1) AS operator_name,
          SUBSTRING_INDEX(GROUP_CONCAT(detail.employee_id ORDER BY detail.work_date DESC SEPARATOR '||'), '||', 1) AS operator_id
        FROM ${tables.countdown} core
        INNER JOIN ${tables.countdownDetail} detail ON detail.countdown_id = core.id
        WHERE core.ref_taks_id IS NOT NULL
        GROUP BY core.ref_taks_id
      ) work_summary ON work_summary.source_wo_id = wo.id
      LEFT JOIN ${tables.employees} operator ON operator.employee_id = work_summary.operator_id
      LEFT JOIN (
        SELECT
          core.ref_taks_id AS source_wo_id,
          SUM(COALESCE(usage_tbl.total_price, usage_tbl.qty * usage_tbl.price_per_unit, 0)) AS material_total
        FROM ${tables.countdown} core
        INNER JOIN ${tables.materialUsage} usage_tbl ON usage_tbl.countdown_id = core.id
        WHERE core.ref_taks_id IS NOT NULL
        GROUP BY core.ref_taks_id
      ) material_summary ON material_summary.source_wo_id = wo.id
      LEFT JOIN ${tables.invoice} direksi_invoice
        ON (direksi_invoice.source_wo_id = wo.id OR JSON_CONTAINS(direksi_invoice.source_snapshot_json, JSON_QUOTE(CAST(wo.id AS CHAR)), '$.mergedWoIds'))
       AND direksi_invoice.invoice_type = 'DIREKSI'
       AND direksi_invoice.status = 'RELEASED'
      LEFT JOIN ${tables.invoice} customer_invoice
        ON (customer_invoice.source_wo_id = wo.id OR JSON_CONTAINS(customer_invoice.source_snapshot_json, JSON_QUOTE(CAST(wo.id AS CHAR)), '$.mergedWoIds'))
       AND customer_invoice.invoice_type = 'CUSTOMER'
       AND customer_invoice.status = 'RELEASED'
      LEFT JOIN ${tables.invoice} cancelled_invoice
        ON cancelled_invoice.source_wo_id = wo.id
       AND cancelled_invoice.status = 'CANCELLED'
    `;

    const [countRows] = await this.pool.execute<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(DISTINCT wo.id) AS total ${fromSql} ${whereClause}`,
      queryParams as never[],
    );
    const total = toNumber(countRows[0]?.total);

    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT DISTINCT
          wo.id AS sourceWoId,
          wo.wo_number AS sourceWobNo,
          wo.request_date AS woDate,
          work_summary.work_date AS workDate,
          approver.full_name AS teamName,
          wo.car_id AS carId,
          car.unit_name AS carType,
          wo.panel_name AS sparepartName,
          1 AS qty,
          'pcs' AS qtyUnit,
          COALESCE(operator.full_name, work_summary.operator_name) AS operatorName,
          to_div.name AS divisionName,
          COALESCE(work_summary.total_hours, 0) AS totalWorkHourDecimal,
          COALESCE(work_summary.working_hour_total, 0) AS workingHourTotal,
          COALESCE(material_summary.material_total, 0) AS materialTotal,
          direksi_invoice.id AS direksiInvoiceId,
          customer_invoice.id AS customerInvoiceId,
          cancelled_invoice.id AS cancelledInvoiceId
        ${fromSql}
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limitSql} OFFSET ${offsetSql}
      `,
      queryParams as never[],
    );

    return {
      rows: rows.map((row) => this.mapWorkOrderRow(row)),
      total,
    };
  }

  private mapWorkOrderRow(row: GenericRow): BubutInvoiceWorkOrderRow {
    const totalWorkHourDecimal = toNumber(row.totalWorkHourDecimal);
    const workingHourTotal = toNumber(row.workingHourTotal);
    const materialTotal = toNumber(row.materialTotal);
    const direksiInvoiceId = toNullableNumber(row.direksiInvoiceId);
    const customerInvoiceId = toNullableNumber(row.customerInvoiceId);
    const cancelledInvoiceId = toNullableNumber(row.cancelledInvoiceId);
    const invoiceStatus =
      direksiInvoiceId && customerInvoiceId
        ? "RILIS_KEDUANYA"
        : direksiInvoiceId
          ? "RILIS_DIREKSI"
          : customerInvoiceId
            ? "RILIS_CUSTOMER"
            : cancelledInvoiceId
              ? "DIBATALKAN"
              : "BELUM_RILIS";

    return {
      sourceWoId: String(row.sourceWoId),
      sourceKey: String(row.sourceWoId),
      sourceWobNo: String(row.sourceWobNo),
      woDate: toDateString(row.woDate),
      workDate: toDateString(row.workDate),
      teamName: toNullableString(row.teamName),
      carId: toNullableString(row.carId),
      carType: toNullableString(row.carType),
      sparepartName: toNullableString(row.sparepartName),
      qty: toNullableNumber(row.qty),
      qtyUnit: toNullableString(row.qtyUnit),
      operatorName: toNullableString(row.operatorName),
      divisionName: toNullableString(row.divisionName),
      totalWorkHourText: this.hourDecimalToText(totalWorkHourDecimal),
      materialTotal,
      workingHourTotal,
      totalPriceBubut: workingHourTotal + materialTotal,
      invoiceStatus,
      direksiInvoiceStatus: direksiInvoiceId ? "RELEASED" : "NOT_RELEASED",
      customerInvoiceStatus: customerInvoiceId ? "RELEASED" : "NOT_RELEASED",
      direksiInvoiceId,
      customerInvoiceId,
    };
  }

  private hourDecimalToText(decimalHours: number): string {
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  async findWorkOrderSource(params: SourceParams): Promise<BubutInvoiceSource | null> {
    const queryParams: unknown[] = [params.sourceWoId];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams);
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          wo.id AS sourceWoId,
          wo.wo_number AS sourceWobNo,
          wo.request_date AS woDate,
          wo.car_id AS carId,
          car.unit_name AS carType,
          approver.full_name AS headProjectName,
          wo.panel_name AS sparepartName,
          1 AS qty,
          'pcs' AS qtyUnit,
          operator_summary.operatorName AS operatorName,
          to_div.name AS divisionName,
          wo.job_detail AS processDetailText
        FROM ${this.tables.wo} wo
        INNER JOIN ${this.tables.divisions} to_div ON to_div.id = wo.to_div_id
        INNER JOIN ${this.tables.countdown} done_core
          ON done_core.ref_taks_id = wo.id
         AND done_core.task_category = 'WO'
         AND UPPER(done_core.status) IN ('DONE', 'QC_READY', 'READY_QC')
        LEFT JOIN ${this.tables.cars} car ON car.id = wo.car_id
        LEFT JOIN ${this.tables.employees} approver ON approver.employee_id = wo.approver_id
        LEFT JOIN (
          SELECT
            core.ref_taks_id AS source_wo_id,
            SUBSTRING_INDEX(GROUP_CONCAT(detail.employee_name ORDER BY detail.work_date DESC SEPARATOR '||'), '||', 1) AS operatorName
          FROM ${this.tables.countdown} core
          INNER JOIN ${this.tables.countdownDetail} detail ON detail.countdown_id = core.id
          WHERE core.ref_taks_id IS NOT NULL
          GROUP BY core.ref_taks_id
        ) operator_summary ON operator_summary.source_wo_id = wo.id
        WHERE wo.id = ?
          AND (UPPER(TRIM(to_div.code)) IN ('BBT', 'BUBUT') OR UPPER(TRIM(to_div.name)) LIKE '%BUBUT%')
          ${scopeClause ? `AND ${scopeClause}` : ""}
        LIMIT 1
      `,
      queryParams as never[],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      sourceWoId: String(row.sourceWoId),
      sourceWobNo: String(row.sourceWobNo),
      woDate: toDateString(row.woDate),
      carId: toNullableString(row.carId),
      carType: toNullableString(row.carType),
      headProjectName: toNullableString(row.headProjectName),
      sparepartName: toNullableString(row.sparepartName),
      qty: toNullableNumber(row.qty),
      qtyUnit: toNullableString(row.qtyUnit),
      operatorName: toNullableString(row.operatorName),
      divisionName: toNullableString(row.divisionName),
      processDetailText: toNullableString(row.processDetailText),
    };
  }

  async findActualWorkingHoursByWo(sourceWoId: string) {
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          detail.ref_actual_id AS actualId,
          detail.work_date AS workDate,
          detail.start_time AS startTime,
          detail.finish_time AS finishTime,
          detail.break_hours AS breakHours,
          detail.billed_hours AS workingHourDecimal,
          detail.employee_name AS employeeName
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.countdownDetail} detail ON detail.countdown_id = core.id
        WHERE core.ref_taks_id = ?
        ORDER BY detail.work_date ASC, detail.start_time ASC
      `,
      [sourceWoId],
    );

    return rows.map((row) => ({
      actualId: toNullableString(row.actualId),
      workDate: toDateString(row.workDate) ?? "",
      start: toNullableString(row.startTime)?.slice(0, 5) ?? null,
      finish: toNullableString(row.finishTime)?.slice(0, 5) ?? null,
      breakHours: toNumber(row.breakHours),
      workingHourDecimal: toNumber(row.workingHourDecimal),
      employeeName: toNullableString(row.employeeName),
    }));
  }

  async findWarehouseMaterialsByWo(sourceWoId: string) {
    const [usageRows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          usage_tbl.item_name AS materialName,
          usage_tbl.qty,
          usage_tbl.uom,
          COALESCE(usage_tbl.price_per_unit, price_tbl.price_per_unit, 0) AS price,
          COALESCE(usage_tbl.total_price, usage_tbl.qty * COALESCE(usage_tbl.price_per_unit, price_tbl.price_per_unit, 0), 0) AS total,
          usage_tbl.warehouse_trx_id AS warehouseTransactionId,
          trx.stock_card_id AS stockCardId
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.materialUsage} usage_tbl ON usage_tbl.countdown_id = core.id
        LEFT JOIN ${this.tables.transactions} trx ON trx.id = usage_tbl.warehouse_trx_id
        LEFT JOIN ${this.tables.materialPrices} price_tbl
          ON price_tbl.item_name = usage_tbl.item_name
         AND price_tbl.effective_date <= usage_tbl.usage_date
         AND (price_tbl.expired_date IS NULL OR price_tbl.expired_date >= usage_tbl.usage_date)
        WHERE core.ref_taks_id = ?
        ORDER BY usage_tbl.usage_date ASC, usage_tbl.item_name ASC
      `,
      [sourceWoId],
    );

    if (usageRows.length > 0) {
      return usageRows.map((row) => ({
        materialName: String(row.materialName),
        qty: toNumber(row.qty),
        unit: toNullableString(row.uom),
        price: toNumber(row.price),
        total: toNumber(row.total),
        warehouseTransactionId: toNullableString(row.warehouseTransactionId),
        stockCardId: toNullableString(row.stockCardId),
      }));
    }

    const [transactionRows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          trx.item_name AS materialName,
          trx.qty,
          trx.uom,
          COALESCE(price_tbl.price_per_unit, 0) AS price,
          trx.qty * COALESCE(price_tbl.price_per_unit, 0) AS total,
          trx.id AS warehouseTransactionId,
          trx.stock_card_id AS stockCardId
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.transactions} trx ON trx.core_id = core.id
        LEFT JOIN ${this.tables.materialPrices} price_tbl
          ON price_tbl.item_name = trx.item_name
         AND price_tbl.effective_date <= DATE(trx.request_date)
         AND (price_tbl.expired_date IS NULL OR price_tbl.expired_date >= DATE(trx.request_date))
        WHERE core.ref_taks_id = ?
          AND trx.item_category = 'BAHAN'
          AND trx.approval_status = 'APPROVED'
          AND trx.item_status IN ('RELEASED', 'INSTALLED', 'RETURNED', 'STORED')
        ORDER BY trx.request_date ASC, trx.item_name ASC
      `,
      [sourceWoId],
    );

    return transactionRows.map((row) => ({
      materialName: String(row.materialName),
      qty: toNumber(row.qty),
      unit: toNullableString(row.uom),
      price: toNumber(row.price),
      total: toNumber(row.total),
      warehouseTransactionId: toNullableString(row.warehouseTransactionId),
      stockCardId: toNullableString(row.stockCardId),
    }));
  }

  async findPicturesByWo(sourceWoId: string) {
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT photo.photo_url AS url, photo.caption, 'GALLERY' AS source
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.plan} plan_tbl ON plan_tbl.core_id = core.id
        INNER JOIN ${this.tables.actual} actual ON actual.plandaily_id = plan_tbl.id
        INNER JOIN ${this.tables.photosTemp} photo ON photo.actual_id = actual.id
        WHERE core.ref_taks_id = ?
        UNION ALL
        SELECT ledger_photo.photo_url AS url, ledger_photo.caption, 'LEDGER' AS source
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.ledger} ledger ON ledger.countdown_id = core.id
        INNER JOIN ${this.tables.ledgerPhotos} ledger_photo ON ledger_photo.ledger_id = ledger.id
        WHERE core.ref_taks_id = ?
      `,
      [sourceWoId, sourceWoId],
    );

    return rows.map((row) => ({
      url: String(row.url),
      caption: toNullableString(row.caption),
      source: row.source === "LEDGER" ? "LEDGER" as const : "GALLERY" as const,
    }));
  }

  async findWorkHistoryRowsByWo(sourceWoId: string) {
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          detail.id,
          detail.ref_actual_id AS actualId,
          core.id AS countdownId,
          detail.work_date AS workDate,
          detail.start_time AS startTime,
          detail.finish_time AS finishTime,
          detail.break_hours AS breakHours,
          detail.billed_hours AS workingHourDecimal,
          detail.task_status AS resultStatus,
          detail.employee_name AS operatorName,
          COALESCE(core.section_name, wo.panel_name) AS panelPartName,
          COALESCE(plan_tbl.jobdescription, wo.job_detail) AS jobdesc,
          COALESCE(actual.daily_notes, plan_tbl.note, wo.job_detail) AS processDetail,
          COALESCE(temp_photos.urls, JSON_ARRAY()) AS tempPhotoUrls,
          COALESCE(ledger_photos.urls, JSON_ARRAY()) AS ledgerPhotoUrls
        FROM ${this.tables.countdown} core
        INNER JOIN ${this.tables.wo} wo ON wo.id = core.ref_taks_id
        INNER JOIN ${this.tables.countdownDetail} detail ON detail.countdown_id = core.id
        LEFT JOIN ${this.tables.actual} actual ON actual.id = detail.ref_actual_id
        LEFT JOIN ${this.tables.plan} plan_tbl ON plan_tbl.id = actual.plandaily_id
        LEFT JOIN (
          SELECT actual_id, JSON_ARRAYAGG(photo_url) AS urls
          FROM ${this.tables.photosTemp}
          GROUP BY actual_id
        ) temp_photos ON temp_photos.actual_id = detail.ref_actual_id
        LEFT JOIN (
          SELECT ledger.countdown_id, ledger.actual_id, JSON_ARRAYAGG(ledger_photo.photo_url) AS urls
          FROM ${this.tables.ledger} ledger
          INNER JOIN ${this.tables.ledgerPhotos} ledger_photo ON ledger_photo.ledger_id = ledger.id
          GROUP BY ledger.countdown_id, ledger.actual_id
        ) ledger_photos
          ON ledger_photos.countdown_id = core.id
         AND (ledger_photos.actual_id = detail.ref_actual_id OR detail.ref_actual_id IS NULL)
        WHERE core.ref_taks_id = ?
        ORDER BY detail.work_date ASC, detail.start_time ASC, detail.id ASC
      `,
      [sourceWoId],
    );

    return rows.map((row) => {
      const tempUrls = parseJsonArray(row.tempPhotoUrls).map(String);
      const ledgerUrls = parseJsonArray(row.ledgerPhotoUrls).map(String);
      return {
        id: String(row.id),
        actualId: toNullableString(row.actualId),
        countdownId: toNullableString(row.countdownId),
        workDate: toDateString(row.workDate),
        startTime: toNullableString(row.startTime)?.slice(0, 5) ?? null,
        finishTime: toNullableString(row.finishTime)?.slice(0, 5) ?? null,
        breakHours: toNumber(row.breakHours),
        workingHourDecimal: toNumber(row.workingHourDecimal),
        resultStatus: toNullableString(row.resultStatus),
        operatorName: toNullableString(row.operatorName),
        panelPartName: toNullableString(row.panelPartName),
        jobdesc: toNullableString(row.jobdesc),
        processDetail: toNullableString(row.processDetail),
        documentationUrls: [...new Set([...tempUrls, ...ledgerUrls])],
      };
    });
  }

  async findActiveInvoiceIdsBySourceWoId(sourceWoId: string) {
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT
          MAX(CASE WHEN invoice_type = 'DIREKSI' THEN id END) AS direksiInvoiceId,
          MAX(CASE WHEN invoice_type = 'CUSTOMER' THEN id END) AS customerInvoiceId
        FROM ${this.tables.invoice}
        WHERE source_wo_id = ?
          AND status = 'RELEASED'
      `,
      [sourceWoId],
    );

    return {
      direksiInvoiceId: toNullableNumber(rows[0]?.direksiInvoiceId),
      customerInvoiceId: toNullableNumber(rows[0]?.customerInvoiceId),
    };
  }

  async findActiveInvoiceBySource(sourceWobNo: string, invoiceType: BubutInvoiceType) {
    const [rows] = await this.pool.execute<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM ${this.tables.invoice}
        WHERE source_wob_no = ?
          AND invoice_type = ?
          AND status = 'RELEASED'
        LIMIT 1
      `,
      [sourceWobNo, invoiceType],
    );

    return rows[0] ? { id: Number(rows[0].id) } : null;
  }

  async insertInvoice(snapshot: BubutInvoiceSnapshot) {
    const invoiceNo = snapshot.invoiceNo ?? "";
    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        INSERT INTO ${this.tables.invoice} (
          invoice_no, invoice_type, status, active_invoice_key, sales_invoice_date, wo_date,
          source_wo_id, source_wob_no, head_project_name, po_no, po_date, car_id, car_type,
          sparepart_name, qty, qty_unit, operator_name, division_name, total_work_minutes,
          total_work_hour_text, total_work_hour_decimal, power_watt, power_cost_kwh,
          working_hour_total, material_total, total_price_bubut, markup_percent,
          markup_multiplier, price_after_markup, rounding_step, price_rounding,
          material_use_json, working_hours_json, picture_urls_json, process_detail_text,
          source_snapshot_json, released_by, released_by_name
        ) VALUES (?, ?, 'RELEASED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invoiceNo,
        snapshot.invoiceType,
        `${snapshot.sourceWobNo}:${snapshot.invoiceType}`,
        snapshot.salesInvoiceDate,
        snapshot.woDate,
        snapshot.sourceWoId,
        snapshot.sourceWobNo,
        snapshot.headProjectName,
        snapshot.poNo,
        snapshot.poDate,
        snapshot.carId,
        snapshot.carType,
        snapshot.sparepartName,
        snapshot.qty,
        snapshot.qtyUnit,
        snapshot.operatorName,
        snapshot.divisionName,
        snapshot.totals.totalWorkMinutes,
        snapshot.totals.totalWorkHourText,
        snapshot.totals.totalWorkHourDecimal,
        7500,
        1444,
        snapshot.totals.workingHourTotal,
        snapshot.totals.materialTotal,
        snapshot.totals.totalPriceBubut,
        snapshot.totals.markupPercent,
        snapshot.totals.markupMultiplier,
        snapshot.totals.priceAfterMarkup,
        snapshot.totals.roundingStep,
        snapshot.totals.priceRounding,
        JSON.stringify(snapshot.materials),
        JSON.stringify(snapshot.workingHours),
        JSON.stringify(snapshot.pictures),
        snapshot.processDetailText,
        JSON.stringify(snapshot.sourceSnapshot),
        snapshot.releasedBy ?? "",
        snapshot.releasedByName ?? null,
      ],
    );

    return {
      invoiceId: result.insertId,
      invoiceNo,
    };
  }

  async findInvoiceById(params: ScopedParams & { invoiceId: number }) {
    const queryParams: unknown[] = [params.invoiceId];
    const scopeClause = this.buildScopeClause(params.scope, params.employeeId, queryParams);
    const [rows] = await this.pool.execute<GenericRow[]>(
      `
        SELECT invoice.*
        FROM ${this.tables.invoice} invoice
        LEFT JOIN ${this.tables.wo} wo ON wo.id = invoice.source_wo_id
        WHERE invoice.id = ?
          ${scopeClause ? `AND ${scopeClause}` : ""}
        LIMIT 1
      `,
      queryParams as never[],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.mapInvoiceRow(row);
  }

  private mapInvoiceRow(row: GenericRow): BubutInvoiceSnapshot {
    return {
      invoiceId: toNumber(row.id),
      invoiceNo: String(row.invoice_no),
      invoiceType: row.invoice_type === "CUSTOMER" ? "CUSTOMER" : "DIREKSI",
      status: row.status === "CANCELLED" ? "CANCELLED" : "RELEASED",
      salesInvoiceDate: toDateString(row.sales_invoice_date) ?? "",
      woDate: toDateString(row.wo_date),
      sourceWoId: String(row.source_wo_id),
      sourceWobNo: String(row.source_wob_no),
      headProjectName: toNullableString(row.head_project_name),
      poNo: toNullableString(row.po_no),
      poDate: toDateString(row.po_date),
      carId: toNullableString(row.car_id),
      carType: toNullableString(row.car_type),
      sparepartName: toNullableString(row.sparepart_name),
      qty: toNullableNumber(row.qty),
      qtyUnit: toNullableString(row.qty_unit),
      operatorName: toNullableString(row.operator_name),
      divisionName: toNullableString(row.division_name),
      processDetailText: toNullableString(row.process_detail_text),
      materials: parseJsonArray(row.material_use_json) as BubutInvoiceSnapshot["materials"],
      workingHours: parseJsonArray(row.working_hours_json) as BubutInvoiceSnapshot["workingHours"],
      pictures: parseJsonArray(row.picture_urls_json) as BubutInvoiceSnapshot["pictures"],
      totals: {
        totalWorkMinutes: toNumber(row.total_work_minutes),
        totalWorkHourText: toNullableString(row.total_work_hour_text) ?? "00:00",
        totalWorkHourDecimal: toNumber(row.total_work_hour_decimal),
        workingHourTotal: toNumber(row.working_hour_total),
        materialTotal: toNumber(row.material_total),
        totalPriceBubut: toNumber(row.total_price_bubut),
        markupPercent: toNumber(row.markup_percent, 235),
        markupMultiplier: toNumber(row.markup_multiplier, 3.35),
        priceAfterMarkup: toNullableNumber(row.price_after_markup),
        roundingStep: toNumber(row.rounding_step, 1000),
        priceRounding: toNullableNumber(row.price_rounding),
      },
      sourceSnapshot: (typeof row.source_snapshot_json === "string"
        ? JSON.parse(row.source_snapshot_json || "{}")
        : row.source_snapshot_json ?? {}) as Record<string, unknown>,
      releasedBy: toNullableString(row.released_by),
      releasedByName: toNullableString(row.released_by_name),
      releasedAt: toNullableString(row.released_at),
      printedCount: toNumber(row.printed_count),
      lastPrintedAt: toNullableString(row.last_printed_at),
      cancelledBy: toNullableString(row.cancelled_by),
      cancelledByName: toNullableString(row.cancelled_by_name),
      cancelledAt: toNullableString(row.cancelled_at),
      cancelReason: toNullableString(row.cancel_reason),
    };
  }

  async cancelInvoice(params: {
    invoiceId: number;
    actorId: string;
    actorName: string;
    reason: string;
  }) {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        UPDATE ${this.tables.invoice}
        SET status = 'CANCELLED',
            active_invoice_key = NULL,
            cancelled_by = ?,
            cancelled_by_name = ?,
            cancelled_at = CURRENT_TIMESTAMP,
            cancel_reason = ?
        WHERE id = ?
          AND status = 'RELEASED'
      `,
      [params.actorId, params.actorName, params.reason, params.invoiceId],
    );

    return result.affectedRows > 0;
  }

  async updateInvoice(
    invoiceId: number,
    snapshot: BubutInvoiceSnapshot,
    actorId: string,
    actorName: string,
  ): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        UPDATE ${this.tables.invoice}
        SET sales_invoice_date = ?,
            po_no = ?,
            po_date = ?,
            picture_urls_json = ?,
            source_snapshot_json = ?
        WHERE id = ?
          AND status = 'RELEASED'
      `,
      [
        snapshot.salesInvoiceDate,
        snapshot.poNo,
        snapshot.poDate,
        JSON.stringify(snapshot.pictures),
        JSON.stringify(snapshot.sourceSnapshot),
        invoiceId,
      ],
    );

    return result.affectedRows > 0;
  }

  async getNextInvoiceSequence(month: string, year: string): Promise<number> {
    const like = `SIB/%/${month}/${year}`;
    const [rows] = await this.pool.execute<Array<RowDataPacket & { lastSeq: number | null }>>(
      `
        SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(invoice_no, '/', 2), '/', -1) AS UNSIGNED)) AS lastSeq
        FROM ${this.tables.invoice}
        WHERE invoice_no LIKE ?
      `,
      [like],
    );

    return toNumber(rows[0]?.lastSeq) + 1;
  }

  async markPrinted(invoiceId: number): Promise<void> {
    await this.pool.execute(
      `
        UPDATE ${this.tables.invoice}
        SET printed_count = printed_count + 1,
            last_printed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [invoiceId],
    );
  }
}
