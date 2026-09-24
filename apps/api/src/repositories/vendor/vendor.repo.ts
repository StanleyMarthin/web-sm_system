import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateVendorRequest,
  VendorGridQuery,
  VendorGridReference,
  VendorMutationResult,
  VendorRecord,
  VendorStatusUpdateRequest,
  VendorSummary,
  ReceiveVendorRequest,
} from "@smsystem/contracts/vendor";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface VendorListParams extends ScopeParams {
  query: VendorGridQuery;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  pendingApproval: number | null;
  activeVendorCount: number | null;
  overdueCount: number | null;
  reworkCount: number | null;
}

interface OptionRow extends RowDataPacket {
  value: string | number | null;
  label: string | null;
}

interface VendorRow extends RowDataPacket {
  wovId: string;
  wovNumber: string;
  carId: string | null;
  unitName: string | null;
  customerName: string | null;
  coreId: string | null;
  prId: string | null;
  divisionName: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  accTracking: string;
  status: string | null;
  vendorId: string | null;
  vendorName: string;
  picVendor: string | null;
  itemName: string;
  quantity: number | null;
  uom: string | null;
  goodsConditionOut: string | null;
  goodsConditionIn: string | null;
  dateOut: string | null;
  targetDateReturn: string | null;
  dateIn: string | null;
  qcStatus: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string | null;
  agingDays: number | null;
}

interface CreateVendorContext {
  actorId: string;
  actorName: string;
  divisionName: string;
}

function normalizeVendorApprovalStage(value: unknown): VendorRecord["accTracking"] {
  const stage = String(value ?? "").trim().toUpperCase();
  if (
    stage === "PENDING_ADV" ||
    stage === "PENDING_KP" ||
    stage === "PENDING_PM" ||
    stage === "APPROVED"
  ) {
    return stage;
  }

  if (stage === "1" || stage === "TRUE") {
    return "APPROVED";
  }

  return "PENDING_ADV";
}

function computeVendorRisk(params: {
  status: string;
  agingDays: number;
  targetDateReturn: string | null;
}): { riskScore: number; isCritical: boolean } {
  let score = Math.min(40, Math.max(0, params.agingDays * 6));

  if (params.status === "PROSES_VENDOR") {
    score += 20;
  } else if (params.status === "DONE_VENDOR") {
    score += 10;
  } else if (params.status === "REWORK_VENDOR") {
    score += 30;
  } else if (params.status === "SENT") {
    score += 15;
  }

  if (params.targetDateReturn) {
    const target = new Date(params.targetDateReturn);
    const now = new Date();
    if (Number.isFinite(target.getTime()) && target.getTime() < now.getTime()) {
      score += 20;
    }
  }

  const riskScore = Math.min(100, score);
  return {
    riskScore,
    isCritical:
      ["SENT", "PROSES_VENDOR", "DONE_VENDOR", "REWORK_VENDOR"].includes(params.status) &&
      (params.agingDays >= 5 || riskScore >= 70),
  };
}

function mapVendorRow(row: VendorRow): VendorRecord {
  const agingDays = Math.max(0, Number(row.agingDays ?? 0));
  const accTracking = normalizeVendorApprovalStage(row.accTracking);
  const risk = computeVendorRisk({
    status: row.status ?? "OPEN",
    agingDays,
    targetDateReturn: row.targetDateReturn,
  });

  return {
    wovId: row.wovId,
    wovNumber: row.wovNumber,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    customerName: row.customerName ?? "-",
    coreId: row.coreId,
    prId: row.prId,
    divisionName: row.divisionName ?? "-",
    requestedBy: row.requestedBy,
    requestedByName: row.requestedByName ?? row.requestedBy ?? "-",
    accTracking,
    status: (row.status ?? "OPEN") as VendorRecord["status"],
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    picVendor: row.picVendor,
    itemName: row.itemName,
    quantity: row.quantity === null ? null : Number(row.quantity),
    uom: row.uom,
    goodsConditionOut: row.goodsConditionOut,
    goodsConditionIn: row.goodsConditionIn,
    dateOut: row.dateOut,
    targetDateReturn: row.targetDateReturn,
    dateIn: row.dateIn,
    qcStatus: row.qcStatus as VendorRecord["qcStatus"],
    estimatedCost: row.estimatedCost === null ? null : Number(row.estimatedCost),
    actualCost: row.actualCost === null ? null : Number(row.actualCost),
    remarks: row.remarks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    agingDays,
    riskScore: risk.riskScore,
    isCritical: risk.isCritical,
  };
}

function buildScopeWhereClause(scope: AuthScope, employeeId: string, params: unknown[]): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = ["w.requested_by = ?"];
  params.push(employeeId);

  if (scope.divisionIds.length > 0) {
    clauses.push(`req.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`);
    params.push(...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(`w.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
    params.push(...scope.unitIds);
  }

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = w.car_id
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
      `EXISTS (
        SELECT 1
        FROM sm_jobdesc_countdown cd_scope
        WHERE cd_scope.car_id = w.car_id
          AND cd_scope.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
      )`,
    );
    params.push(...scope.divisionIds);
  }

  return `(${clauses.join(" OR ")})`;
}

function buildVendorSelectSql(purchaseDb: string, coreDb: string): string {
  return `
    SELECT
      w.id AS wovId,
      w.wov_number AS wovNumber,
      w.car_id AS carId,
      COALESCE(c.unit_name, w.car_name, w.car_id) AS unitName,
      COALESCE(c.customer_name, '-') AS customerName,
      w.core_id AS coreId,
      w.pr_id AS prId,
      COALESCE(w.division_name, d.name, '-') AS divisionName,
      w.requested_by AS requestedBy,
      COALESCE(w.requested_by_name, req.full_name, w.requested_by) AS requestedByName,
      w.acc_tracking AS accTracking,
      COALESCE(w.status, 'OPEN') AS status,
      w.vendor_id AS vendorId,
      w.vendor_name AS vendorName,
      w.pic_vendor AS picVendor,
      w.item_name AS itemName,
      w.quantity AS quantity,
      w.uom AS uom,
      w.goods_condition_out AS goodsConditionOut,
      w.goods_condition_in AS goodsConditionIn,
      DATE_FORMAT(w.date_out, '%Y-%m-%d') AS dateOut,
      DATE_FORMAT(w.target_date_return, '%Y-%m-%d') AS targetDateReturn,
      DATE_FORMAT(w.date_in, '%Y-%m-%d') AS dateIn,
      w.qc_status AS qcStatus,
      w.estimated_cost AS estimatedCost,
      w.actual_cost AS actualCost,
      w.remarks AS remarks,
      DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(w.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
      TIMESTAMPDIFF(DAY, w.created_at, CURRENT_TIMESTAMP) AS agingDays
    FROM ${qualifyTable(purchaseDb, "vnd_wo_vendor")} w
    LEFT JOIN ${qualifyTable(coreDb, "cars")} c ON c.id = w.car_id
    LEFT JOIN ${qualifyTable(coreDb, "sm_employee")} req ON req.employee_id = w.requested_by
    LEFT JOIN ${qualifyTable(coreDb, "sm_divisi")} d ON d.id = req.division_id
  `;
}

function buildSearchClauses(query: VendorGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];
  if (!query.search) {
    return clauses;
  }

  const value = `%${query.search}%`;
  clauses.push(
    `(
      w.wov_number LIKE ?
      OR COALESCE(c.unit_name, w.car_name, w.car_id, '') LIKE ?
      OR COALESCE(c.customer_name, '') LIKE ?
      OR COALESCE(w.division_name, d.name, '') LIKE ?
      OR COALESCE(w.vendor_name, '') LIKE ?
      OR COALESCE(w.item_name, '') LIKE ?
    )`,
  );
  params.push(value, value, value, value, value, value);
  return clauses;
}

function buildFilterClauses(query: VendorGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];
  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("COALESCE(w.status, 'OPEN') = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "accTracking") {
      clauses.push("w.acc_tracking = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "divisionName") {
      clauses.push("COALESCE(w.division_name, d.name, '') = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "vendorName") {
      clauses.push("COALESCE(w.vendor_name, '') LIKE ?");
      params.push(`%${filter.value}%`);
    }
  }
  return clauses;
}

function buildViewModeClause(viewMode: VendorGridQuery["viewMode"]): string {
  if (viewMode === "active") {
    return `COALESCE(w.status, 'OPEN') NOT IN ('RECEIVED', 'REJECTED', 'CANCELLED')`;
  }

  if (viewMode === "received") {
    return `COALESCE(w.status, 'OPEN') = 'RECEIVED'`;
  }

  return "";
}

function buildOrderBy(sortBy: VendorGridQuery["sortBy"], direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    createdAt: "w.created_at",
    updatedAt: "w.updated_at",
    wovNumber: "w.wov_number",
    unitName: "COALESCE(c.unit_name, w.car_name, w.car_id)",
    divisionName: "COALESCE(w.division_name, d.name, '')",
    accTracking: "w.acc_tracking",
    status: "COALESCE(w.status, 'OPEN')",
    vendorName: "w.vendor_name",
    targetDateReturn: "w.target_date_return",
    dateIn: "w.date_in",
    agingDays: "TIMESTAMPDIFF(DAY, w.created_at, CURRENT_TIMESTAMP)",
  };

  return `${columnMap[sortBy] ?? "w.created_at"} ${direction.toUpperCase()}, w.created_at DESC`;
}

async function nextWovNumber(connection: PoolConnection, purchaseDb: string): Promise<string> {
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const year = String(new Date().getFullYear());
  const likePattern = `WOV/%/${month}/${year}`;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT wov_number AS code FROM ${qualifyTable(purchaseDb, "vnd_wo_vendor")} WHERE wov_number LIKE ?`,
    [likePattern],
  );

  let maxSequence = 0;
  for (const row of rows) {
    const code = String(row.code ?? "");
    const parts = code.split("/");
    const parsed = Number.parseInt(parts[1] ?? "0", 10);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  return `WOV/${String(maxSequence + 1).padStart(3, "0")}/${month}/${year}`;
}

export interface VendorRepository {
  list(params: VendorListParams): Promise<{ rows: VendorRecord[]; total: number; summary: VendorSummary }>;
  listReferences(params: ScopeParams): Promise<VendorGridReference>;
  create(context: CreateVendorContext, input: CreateVendorRequest): Promise<VendorMutationResult>;
  update(wovId: string, input: CreateVendorRequest): Promise<VendorMutationResult>;
  findById(params: ScopeParams & { wovId: string }): Promise<{ ticket: VendorRecord } | null>;
  advanceApproval(wovId: string, notes: string | null): Promise<VendorMutationResult>;
  updateStatus(wovId: string, input: VendorStatusUpdateRequest): Promise<VendorMutationResult>;
  receive(wovId: string, input: ReceiveVendorRequest): Promise<VendorMutationResult>;
  cancel(wovId: string, reason: string): Promise<VendorMutationResult>;
}

export class MySqlVendorRepository implements VendorRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pick<Pool, "query" | "execute" | "getConnection"> = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async list(params: VendorListParams): Promise<{ rows: VendorRecord[]; total: number; summary: VendorSummary }> {
    const pool = this.poolFactory(this.env);
    const baseSql = buildVendorSelectSql(this.env.PURCHASE_DB_NAME, this.env.CORE_DB_NAME);
    const queryParams: unknown[] = [];
    const whereClauses = [
      ...buildSearchClauses(params.query, queryParams),
      ...buildFilterClauses(params.query, queryParams),
    ];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams);
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const viewModeClause = buildViewModeClause(params.query.viewMode);
    if (viewModeClause) {
      whereClauses.push(viewModeClause);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const offset = (params.query.page - 1) * params.query.limit;
    const [rowsResult, countResult, summaryResult] = await Promise.all([
      pool.query<VendorRow[]>(
        `
          ${baseSql}
          ${whereSql}
          ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
          LIMIT ? OFFSET ?
        `,
        [...queryParams, params.query.limit, offset],
      ),
      pool.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM (${baseSql} ${whereSql}) counted
        `,
        queryParams,
      ),
      pool.query<SummaryRow[]>(
        `
          SELECT
            SUM(CASE WHEN accTracking <> 'APPROVED' THEN 1 ELSE 0 END) AS pendingApproval,
            SUM(CASE WHEN status IN ('OPEN', 'SENT', 'PROSES_VENDOR', 'DONE_VENDOR', 'REWORK_VENDOR') THEN 1 ELSE 0 END) AS activeVendorCount,
            SUM(
              CASE
                WHEN targetDateReturn IS NOT NULL
                  AND targetDateReturn < CURDATE()
                  AND status NOT IN ('RECEIVED', 'REJECTED', 'CANCELLED')
                THEN 1 ELSE 0
              END
            ) AS overdueCount,
            SUM(CASE WHEN status = 'REWORK_VENDOR' THEN 1 ELSE 0 END) AS reworkCount
          FROM (${baseSql} ${whereSql}) summary_source
        `,
        queryParams,
      ),
    ]);

    const rows = rowsResult[0].map(mapVendorRow);
    const summaryRow = summaryResult[0][0];

    return {
      rows,
      total: Number(countResult[0][0]?.total ?? 0),
      summary: {
        pendingApproval: Number(summaryRow?.pendingApproval ?? 0),
        activeVendorCount: Number(summaryRow?.activeVendorCount ?? 0),
        overdueCount: Number(summaryRow?.overdueCount ?? 0),
        reworkCount: Number(summaryRow?.reworkCount ?? 0),
      },
    };
  }

  async listReferences(params: ScopeParams): Promise<VendorGridReference> {
    const pool = this.poolFactory(this.env);
    const unitsParams: unknown[] = [];
    let unitsWhereSql = "";

    if (!params.scope.canViewAllUnits) {
      const unitClauses: string[] = [];

      if (params.scope.canViewAssignedUnits) {
        unitClauses.push(
          `EXISTS (
            SELECT 1
            FROM car_project_assignment cpa
            WHERE cpa.car_id = c.id
              AND cpa.ended_at IS NULL
              AND (cpa.kp_id = ? OR cpa.advisor_id = ? OR cpa.kd_id = ?)
          )`,
        );
        unitsParams.push(params.employeeId, params.employeeId, params.employeeId);
      }

      if (params.scope.unitIds.length > 0) {
        unitClauses.push(`c.id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        unitsParams.push(...params.scope.unitIds);
      }

      if (params.scope.divisionIds.length > 0) {
        unitClauses.push(
          `EXISTS (
            SELECT 1
            FROM sm_jobdesc_countdown cd
            WHERE cd.car_id = c.id
              AND cd.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
          )`,
        );
        unitsParams.push(...params.scope.divisionIds);
      }

      unitsWhereSql = unitClauses.length > 0 ? `WHERE ${unitClauses.join(" OR ")}` : "WHERE 1 = 0";
    }

    const [unitRows, divisionRows, vendorRows] = await Promise.all([
      pool.query<OptionRow[]>(
        `
          SELECT CAST(c.id AS CHAR) AS value, c.unit_name AS label
          FROM ${qualifyTable(this.env.CORE_DB_NAME, "cars")} c
          ${unitsWhereSql}
          ORDER BY c.unit_name ASC
          LIMIT 200
        `,
        unitsParams,
      ),
      pool.query<OptionRow[]>(
        `
          SELECT CAST(d.id AS CHAR) AS value, d.name AS label
          FROM ${qualifyTable(this.env.CORE_DB_NAME, "sm_divisi")} d
          ORDER BY d.name ASC
        `,
      ),
      pool.query<OptionRow[]>(
        `
          SELECT CAST(v.id AS CHAR) AS value, v.vendor_name AS label
          FROM ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_vendors")} v
          WHERE COALESCE(v.is_active, 1) = 1
          ORDER BY v.vendor_name ASC
        `,
      ),
    ]);

    return {
      units: unitRows[0]
        .filter((row) => row.value !== null && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
      divisions: divisionRows[0]
        .filter((row) => row.value !== null && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
      statuses: [
        "OPEN",
        "SENT",
        "PROSES_VENDOR",
        "DONE_VENDOR",
        "RECEIVED",
        "REWORK_VENDOR",
        "REJECTED",
        "CANCELLED",
      ].map((status) => ({ value: status, label: status })),
      approvalStages: [
        "PENDING_ADV",
        "PENDING_KP",
        "PENDING_PM",
        "APPROVED",
      ].map((status) => ({ value: status, label: status })),
      vendors: vendorRows[0]
        .filter((row) => row.value !== null && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
    };
  }

  async create(context: CreateVendorContext, input: CreateVendorRequest): Promise<VendorMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const createItems = input.items && input.items.length > 0
        ? input.items
        : [
            {
              itemName: input.itemName || "",
              quantity: input.quantity,
              uom: input.uom,
              goodsConditionOut: input.goodsConditionOut,
              estimatedCost: input.estimatedCost,
            },
          ];

      const createdIds: string[] = [];

      for (const item of createItems) {
        const wovId = randomUUID();
        const wovNumber = await nextWovNumber(connection, this.env.PURCHASE_DB_NAME);
        const today = new Date().toISOString().slice(0, 10);

        await connection.execute(
          `
            INSERT INTO ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")} (
              id,
              wov_number,
              car_id,
              core_id,
              pr_id,
              requested_by,
              requested_by_name,
              division_name,
              acc_tracking,
              status,
              vendor_id,
              vendor_name,
              pic_vendor,
              item_name,
              quantity,
              uom,
              goods_condition_out,
              date_out,
              target_date_return,
              estimated_cost,
              remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ADV', 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            wovId,
            wovNumber,
            input.carId,
            input.coreId,
            input.prId,
            context.actorId,
            context.actorName,
            context.divisionName,
            input.vendorId,
            input.vendorName,
            input.picVendor,
            item.itemName,
            item.quantity,
            item.uom,
            item.goodsConditionOut,
            today,
            input.targetDateReturn,
            item.estimatedCost,
            input.remarks,
          ],
        );

        createdIds.push(wovId);
      }

      await connection.commit();
      return {
        wovId: createdIds[0] || randomUUID(),
        accTracking: "PENDING_ADV",
        status: "OPEN",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(wovId: string, input: CreateVendorRequest): Promise<VendorMutationResult> {
    const item = input.items?.[0];
    const pool = this.poolFactory(this.env);
    const [result] = await pool.execute(
      `
        UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")}
        SET car_id = ?,
            core_id = ?,
            pr_id = ?,
            vendor_id = ?,
            vendor_name = ?,
            pic_vendor = ?,
            item_name = ?,
            quantity = ?,
            uom = ?,
            goods_condition_out = ?,
            target_date_return = ?,
            estimated_cost = ?,
            remarks = ?
        WHERE id = ?
      `,
      [
        input.carId,
        input.coreId ?? null,
        input.prId ?? null,
        input.vendorId ?? null,
        input.vendorName,
        input.picVendor ?? null,
        item?.itemName ?? input.itemName ?? "",
        item?.quantity ?? input.quantity ?? null,
        item?.uom ?? input.uom ?? null,
        item?.goodsConditionOut ?? input.goodsConditionOut ?? null,
        input.targetDateReturn ?? null,
        item?.estimatedCost ?? input.estimatedCost ?? null,
        input.remarks ?? null,
        wovId,
      ],
    );
    if ("affectedRows" in result && Number(result.affectedRows) === 0) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }
    return { wovId, accTracking: "PENDING_ADV", status: "OPEN" };
  }

  async findById(params: ScopeParams & { wovId: string }): Promise<{ ticket: VendorRecord } | null> {
    const pool = this.poolFactory(this.env);
    const queryParams: unknown[] = [params.wovId];
    const whereClauses = ["w.id = ?"];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams);
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = await pool.query<VendorRow[]>(
      `
        ${buildVendorSelectSql(this.env.PURCHASE_DB_NAME, this.env.CORE_DB_NAME)}
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ticket: mapVendorRow(row),
    };
  }

  async advanceApproval(wovId: string, notes: string | null): Promise<VendorMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT acc_tracking AS accTracking, COALESCE(status, 'OPEN') AS status FROM ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")} WHERE id = ? FOR UPDATE`,
        [wovId],
      );
      const row = rows[0];
      if (!row) {
        throw new Error("VENDOR_WO_NOT_FOUND");
      }

      const currentStage = normalizeVendorApprovalStage(row.accTracking);
      let nextStage: VendorMutationResult["accTracking"];
      if (currentStage === "PENDING_ADV") {
        nextStage = "PENDING_KP";
      } else if (currentStage === "PENDING_KP") {
        nextStage = "PENDING_PM";
      } else if (currentStage === "PENDING_PM") {
        nextStage = "APPROVED";
      } else {
        throw new Error("INVALID_APPROVAL_STATE");
      }

      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")}
          SET acc_tracking = ?,
              remarks = CASE
                WHEN ? IS NULL OR ? = '' THEN remarks
                WHEN remarks IS NULL OR remarks = '' THEN ?
                ELSE CONCAT(remarks, '\n', ?)
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextStage, notes, notes, notes, notes, wovId],
      );

      await connection.commit();
      return {
        wovId,
        accTracking: nextStage,
        status: String(row.status) as VendorMutationResult["status"],
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateStatus(wovId: string, input: VendorStatusUpdateRequest): Promise<VendorMutationResult> {
    const pool = this.poolFactory(this.env);
    await pool.execute(
      `
        UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")}
        SET status = ?,
            target_date_return = COALESCE(?, target_date_return),
            actual_cost = COALESCE(?, actual_cost),
            remarks = CASE
              WHEN ? IS NULL OR ? = '' THEN remarks
              WHEN remarks IS NULL OR remarks = '' THEN ?
              ELSE CONCAT(remarks, '\n', ?)
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.status,
        input.targetDateReturn,
        input.actualCost,
        input.remarks,
        input.remarks,
        input.remarks,
        input.remarks,
        wovId,
      ],
    );

    return {
      wovId,
      accTracking: "APPROVED",
      status: input.status,
    };
  }

  async receive(wovId: string, input: ReceiveVendorRequest): Promise<VendorMutationResult> {
    const pool = this.poolFactory(this.env);
    await pool.execute(
      `
        UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")}
        SET status = 'RECEIVED',
            date_in = ?,
            goods_condition_in = ?,
            qc_status = ?,
            actual_cost = COALESCE(?, actual_cost),
            remarks = CASE
              WHEN ? IS NULL OR ? = '' THEN remarks
              WHEN remarks IS NULL OR remarks = '' THEN ?
              ELSE CONCAT(remarks, '\n', ?)
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.dateIn,
        input.goodsConditionIn,
        input.qcStatus,
        input.actualCost,
        input.remarks,
        input.remarks,
        input.remarks,
        input.remarks,
        wovId,
      ],
    );

    return {
      wovId,
      accTracking: "APPROVED",
      status: "RECEIVED",
    };
  }

  async cancel(wovId: string, reason: string): Promise<VendorMutationResult> {
    const pool = this.poolFactory(this.env);
    await pool.execute(
      `
        UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "vnd_wo_vendor")}
        SET status = 'CANCELLED',
            remarks = CASE
              WHEN remarks IS NULL OR remarks = '' THEN ?
              ELSE CONCAT(remarks, '\n', ?)
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [reason, reason, wovId],
    );

    return {
      wovId,
      accTracking: "APPROVED",
      status: "CANCELLED",
    };
  }
}
