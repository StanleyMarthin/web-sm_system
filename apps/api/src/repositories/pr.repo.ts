import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreatePrRequest,
  OrderPrRequest,
  PrGridQuery,
  PrGridReference,
  PrItemRecord,
  PrMutationResult,
  PrRecord,
  PrSummary,
  ReceivePrRequest,
} from "@smsystem/contracts/pr";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface PrListParams extends ScopeParams {
  query: PrGridQuery;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  pendingApproval: number | null;
  huntingCount: number | null;
  orderedCount: number | null;
  criticalCount: number | null;
}

interface OptionRow extends RowDataPacket {
  value: string | number | null;
  label: string | null;
}

interface PrHeaderRow extends RowDataPacket {
  prId: string;
  prNumber: string;
  carId: string | null;
  unitName: string | null;
  customerName: string | null;
  divisionName: string | null;
  requestedBy: string;
  requestedByName: string | null;
  accTracking: string;
  status: string | null;
  targetDate: string | null;
  priority: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  totalItems: number | null;
  totalQty: number | null;
  totalEstimatedPrice: number | null;
  totalActualPrice: number | null;
  vendorSummary: string | null;
  latestArrivalDate: string | null;
  agingDays: number | null;
}

interface PrItemRow extends RowDataPacket {
  itemId: string;
  prId: string;
  itemName: string;
  description: string | null;
  originType: "LOKAL" | "LN";
  qty: number | null;
  uom: string | null;
  estimatedPrice: number | null;
  actualPrice: number | null;
  vendorId: string | null;
  vendorName: string | null;
  photoUrl: string | null;
  status: PrItemRecord["status"];
  huntingNotes: string | null;
  arrivalDate: string | null;
}

interface CreatePrContext {
  actorId: string;
  actorName: string;
  divisionName: string;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function derivePrPrefix(divisionName: string): string {
  const cleaned = divisionName.replace(/[^A-Za-z0-9 ]+/gu, " ").trim().toUpperCase();
  if (!cleaned) {
    return "PR";
  }

  const words = cleaned.split(/\s+/u).filter(Boolean);
  const initial =
    words.length <= 1 ? words[0]?.slice(0, 2) ?? "PR" : `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`;
  return `PR${initial}`.slice(0, 6);
}

function normalizePrApprovalStage(value: unknown): PrRecord["accTracking"] {
  const stage = String(value ?? "").trim().toUpperCase();
  if (
    stage === "PENDING_ADV" ||
    stage === "PENDING_KP" ||
    stage === "PENDING_MP" ||
    stage === "PENDING_PUR" ||
    stage === "APPROVED"
  ) {
    return stage;
  }

  if (stage === "1" || stage === "TRUE") {
    return "APPROVED";
  }

  return "PENDING_ADV";
}

function computePrRisk(params: {
  accTracking: string;
  status: string;
  agingDays: number;
  totalItems: number;
  latestArrivalDate: string | null;
}): { riskScore: number; isCritical: boolean } {
  let score = Math.min(40, Math.max(0, params.agingDays * 8));

  if (params.accTracking !== "APPROVED") {
    score += 20;
  }

  if (params.status === "HUNTING") {
    score += 25;
  } else if (params.status === "ORDERED") {
    score += 15;
  } else if (params.status === "OPEN") {
    score += 10;
  }

  if (!params.latestArrivalDate && ["HUNTING", "ORDERED"].includes(params.status)) {
    score += 10;
  }

  if (params.totalItems >= 5) {
    score += 5;
  }

  const riskScore = Math.min(100, score);
  const isCritical =
    ["OPEN", "HUNTING", "ORDERED"].includes(params.status) &&
    (params.agingDays >= 3 || riskScore >= 70);

  return {
    riskScore,
    isCritical,
  };
}

function mapPrHeaderRow(row: PrHeaderRow): PrRecord {
  const agingDays = Math.max(0, Number(row.agingDays ?? 0));
  const accTracking = normalizePrApprovalStage(row.accTracking);
  const risk = computePrRisk({
    accTracking,
    status: row.status ?? "OPEN",
    agingDays,
    totalItems: Number(row.totalItems ?? 0),
    latestArrivalDate: row.latestArrivalDate,
  });

  return {
    prId: row.prId,
    prNumber: row.prNumber,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    customerName: row.customerName ?? "-",
    divisionName: row.divisionName ?? "-",
    requestedBy: row.requestedBy,
    requestedByName: row.requestedByName ?? row.requestedBy,
    accTracking,
    status: (row.status ?? "OPEN") as PrRecord["status"],
    targetDate: row.targetDate,
    priority: row.priority,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    totalItems: Number(row.totalItems ?? 0),
    totalQty: toNumber(row.totalQty),
    totalEstimatedPrice: toNumber(row.totalEstimatedPrice),
    totalActualPrice: toNumber(row.totalActualPrice),
    vendorSummary: row.vendorSummary?.trim() || "-",
    latestArrivalDate: row.latestArrivalDate,
    agingDays,
    riskScore: risk.riskScore,
    isCritical: risk.isCritical,
  };
}

function mapPrItemRow(row: PrItemRow): PrItemRecord {
  return {
    itemId: row.itemId,
    prId: row.prId,
    itemName: row.itemName,
    description: row.description,
    originType: row.originType,
    qty: toNumber(row.qty),
    uom: row.uom ?? "-",
    estimatedPrice: row.estimatedPrice === null ? null : Number(row.estimatedPrice),
    actualPrice: row.actualPrice === null ? null : Number(row.actualPrice),
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    photoUrl: row.photoUrl,
    status: row.status,
    huntingNotes: row.huntingNotes,
    arrivalDate: row.arrivalDate,
  };
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  coreCarsTable: string,
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = ["h.requested_by = ?"];
  params.push(employeeId);

  if (scope.divisionIds.length > 0) {
    clauses.push(`req.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`);
    params.push(...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(`h.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
    params.push(...scope.unitIds);
  }

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = h.car_id
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
        WHERE cd_scope.car_id = h.car_id
          AND cd_scope.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
      )`,
    );
    params.push(...scope.divisionIds);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildPrHeaderSelectSql(purchaseDb: string, coreDb: string): string {
  const headerTable = qualifyTable(purchaseDb, "pur_pr_header");
  const itemsTable = qualifyTable(purchaseDb, "pur_pr_items");
  const carsTable = qualifyTable(coreDb, "cars");
  const employeeTable = qualifyTable(coreDb, "sm_employee");
  const divisionTable = qualifyTable(coreDb, "sm_divisi");

  return `
    SELECT
      h.id AS prId,
      h.pr_number AS prNumber,
      h.car_id AS carId,
      COALESCE(c.unit_name, h.car_name, h.car_id) AS unitName,
      COALESCE(c.customer_name, '-') AS customerName,
      COALESCE(h.division_name, d.name, '-') AS divisionName,
      h.requested_by AS requestedBy,
      COALESCE(h.requested_by_name, req.full_name, h.requested_by) AS requestedByName,
      h.acc_tracking AS accTracking,
      COALESCE(h.status, 'OPEN') AS status,
      DATE_FORMAT(h.target_date, '%Y-%m-%d') AS targetDate,
      h.priority AS priority,
      h.notes AS notes,
      DATE_FORMAT(h.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(h.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
      COALESCE(items.totalItems, 0) AS totalItems,
      COALESCE(items.totalQty, 0) AS totalQty,
      COALESCE(items.totalEstimatedPrice, 0) AS totalEstimatedPrice,
      COALESCE(items.totalActualPrice, 0) AS totalActualPrice,
      COALESCE(items.vendorSummary, '-') AS vendorSummary,
      DATE_FORMAT(items.latestArrivalDate, '%Y-%m-%d') AS latestArrivalDate,
      TIMESTAMPDIFF(DAY, h.created_at, CURRENT_TIMESTAMP) AS agingDays
    FROM ${headerTable} h
    LEFT JOIN ${carsTable} c ON c.id = h.car_id
    LEFT JOIN ${employeeTable} req ON req.employee_id = h.requested_by
    LEFT JOIN ${divisionTable} d ON d.id = req.division_id
    LEFT JOIN (
      SELECT
        i.pr_id,
        COUNT(*) AS totalItems,
        SUM(COALESCE(i.qty, 0)) AS totalQty,
        SUM(COALESCE(i.estimated_price, 0)) AS totalEstimatedPrice,
        SUM(COALESCE(i.actual_price, 0)) AS totalActualPrice,
        GROUP_CONCAT(DISTINCT NULLIF(TRIM(i.vendor_name), '') ORDER BY i.vendor_name SEPARATOR ', ') AS vendorSummary,
        MAX(i.arrival_date) AS latestArrivalDate
      FROM ${itemsTable} i
      GROUP BY i.pr_id
    ) items ON items.pr_id = h.id
  `;
}

function buildSearchClauses(query: PrGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];
  if (!query.search) {
    return clauses;
  }

  const value = `%${query.search}%`;
  clauses.push(
    `(
      h.pr_number LIKE ?
      OR COALESCE(c.unit_name, h.car_name, h.car_id, '') LIKE ?
      OR COALESCE(c.customer_name, '') LIKE ?
      OR COALESCE(h.division_name, d.name, '') LIKE ?
      OR COALESCE(h.requested_by_name, h.requested_by, '') LIKE ?
      OR EXISTS (
        SELECT 1
        FROM ${qualifyTable(getApiEnv().PURCHASE_DB_NAME, "pur_pr_items")} i_search
        WHERE i_search.pr_id = h.id
          AND (
            i_search.item_name LIKE ?
            OR COALESCE(i_search.vendor_name, '') LIKE ?
          )
      )
    )`,
  );
  params.push(value, value, value, value, value, value, value);
  return clauses;
}

function buildFilterClauses(query: PrGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];
  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("COALESCE(h.status, 'OPEN') = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "accTracking") {
      clauses.push("h.acc_tracking = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "divisionName") {
      clauses.push("COALESCE(h.division_name, d.name, '') = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "vendorSummary") {
      clauses.push("COALESCE(items.vendorSummary, '') LIKE ?");
      params.push(`%${filter.value}%`);
    }
  }
  return clauses;
}

function buildViewModeClause(viewMode: PrGridQuery["viewMode"]): string {
  if (viewMode === "active") {
    return `COALESCE(h.status, 'OPEN') NOT IN ('ARRIVED', 'REJECTED', 'CANCELLED')`;
  }

  if (viewMode === "closed") {
    return `COALESCE(h.status, 'OPEN') IN ('ARRIVED', 'REJECTED', 'CANCELLED')`;
  }

  return "";
}

function buildOrderBy(sortBy: PrGridQuery["sortBy"], direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    createdAt: "h.created_at",
    updatedAt: "h.updated_at",
    prNumber: "h.pr_number",
    unitName: "COALESCE(c.unit_name, h.car_name, h.car_id)",
    divisionName: "COALESCE(h.division_name, d.name, '')",
    accTracking: "h.acc_tracking",
    status: "COALESCE(h.status, 'OPEN')",
    totalItems: "COALESCE(items.totalItems, 0)",
    totalQty: "COALESCE(items.totalQty, 0)",
    totalEstimatedPrice: "COALESCE(items.totalEstimatedPrice, 0)",
    totalActualPrice: "COALESCE(items.totalActualPrice, 0)",
    latestArrivalDate: "items.latestArrivalDate",
    agingDays: "TIMESTAMPDIFF(DAY, h.created_at, CURRENT_TIMESTAMP)",
  };

  return `${columnMap[sortBy] ?? "h.created_at"} ${direction.toUpperCase()}, h.created_at DESC`;
}

async function nextPrNumber(
  connection: PoolConnection,
  purchaseDb: string,
  prefix: string,
): Promise<string> {
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const year = String(new Date().getFullYear());
  const likePattern = `${prefix}/%/${month}/${year}`;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT pr_number AS code FROM ${qualifyTable(purchaseDb, "pur_pr_header")} WHERE pr_number LIKE ?`,
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

  return `${prefix}/${String(maxSequence + 1).padStart(3, "0")}/${month}/${year}`;
}

async function assertPanelHasCountdown(
  connection: PoolConnection,
  coreDb: string,
  carId: string,
  panelId: number,
): Promise<number> {
  const [panelRows] = await connection.query<RowDataPacket[]>(
    `
      SELECT id
      FROM ${qualifyTable(coreDb, "master_panels")}
      WHERE id = ? AND car_id = ?
      LIMIT 1
    `,
    [panelId, carId],
  );
  if (panelRows.length === 0) {
    throw new Error("UNIT_PANEL_NOT_FOUND");
  }

  const [countdownRows] = await connection.query<RowDataPacket[]>(
    `
      SELECT id
      FROM ${qualifyTable(coreDb, "sm_jobdesc_countdown")}
      WHERE panel_id = ?
      LIMIT 1
    `,
    [panelId],
  );
  if (countdownRows.length === 0) {
    throw new Error("PR_REQUIRES_COUNTDOWN");
  }

  return Number(panelRows[0]?.id);
}

export interface PrRepository {
  list(params: PrListParams): Promise<{ rows: PrRecord[]; total: number; summary: PrSummary }>;
  listCritical(params: ScopeParams): Promise<PrRecord[]>;
  listReferences(params: ScopeParams): Promise<PrGridReference>;
  create(context: CreatePrContext, input: CreatePrRequest): Promise<PrMutationResult>;
  update(prId: string, input: CreatePrRequest): Promise<PrMutationResult>;
  findById(
    params: ScopeParams & { prId: string },
  ): Promise<{ header: PrRecord; items: PrItemRecord[] } | null>;
  advanceApproval(prId: string, notes: string | null): Promise<PrMutationResult>;
  markOrdered(prId: string, input: OrderPrRequest): Promise<PrMutationResult>;
  markReceived(prId: string, input: ReceivePrRequest): Promise<PrMutationResult>;
  cancel(prId: string, reason: string): Promise<PrMutationResult>;
}

export class MySqlPrRepository implements PrRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pick<Pool, "query" | "execute" | "getConnection"> = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async list(params: PrListParams): Promise<{ rows: PrRecord[]; total: number; summary: PrSummary }> {
    const pool = this.poolFactory(this.env);
    const baseSql = buildPrHeaderSelectSql(this.env.PURCHASE_DB_NAME, this.env.CORE_DB_NAME);
    const coreCarsTable = qualifyTable(this.env.CORE_DB_NAME, "cars");
    const queryParams: unknown[] = [];
    const whereClauses = [
      ...buildSearchClauses(params.query, queryParams),
      ...buildFilterClauses(params.query, queryParams),
    ];
    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      coreCarsTable,
    );
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
      pool.query<PrHeaderRow[]>(
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
            SUM(CASE WHEN status = 'HUNTING' THEN 1 ELSE 0 END) AS huntingCount,
            SUM(CASE WHEN status = 'ORDERED' THEN 1 ELSE 0 END) AS orderedCount,
            SUM(
              CASE
                WHEN status IN ('OPEN', 'HUNTING', 'ORDERED')
                  AND (agingDays >= 3 OR (accTracking <> 'APPROVED' AND agingDays >= 2))
                THEN 1 ELSE 0
              END
            ) AS criticalCount
          FROM (${baseSql} ${whereSql}) summary_source
        `,
        queryParams,
      ),
    ]);

    const rows = rowsResult[0].map(mapPrHeaderRow);
    const summaryRow = summaryResult[0][0];
    return {
      rows,
      total: Number(countResult[0][0]?.total ?? 0),
      summary: {
        pendingApproval: Number(summaryRow?.pendingApproval ?? 0),
        huntingCount: Number(summaryRow?.huntingCount ?? 0),
        orderedCount: Number(summaryRow?.orderedCount ?? 0),
        criticalCount: Number(summaryRow?.criticalCount ?? 0),
      },
    };
  }

  async listCritical(params: ScopeParams): Promise<PrRecord[]> {
    const result = await this.list({
      ...params,
      query: {
        page: 1,
        limit: 50,
        search: "",
        sortBy: "agingDays",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      },
    });
    return result.rows.filter((row) => row.isCritical);
  }

  async listReferences(params: ScopeParams): Promise<PrGridReference> {
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
        "HUNTING",
        "ORDERED",
        "ARRIVED",
        "NOT_FOUND",
        "REJECTED",
        "CANCELLED",
      ].map((status) => ({ value: status, label: status })),
      approvalStages: [
        "PENDING_ADV",
        "PENDING_KP",
        "PENDING_MP",
        "PENDING_PUR",
        "APPROVED",
      ].map((status) => ({ value: status, label: status })),
      vendors: vendorRows[0]
        .filter((row) => row.value !== null && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
    };
  }

  async create(context: CreatePrContext, input: CreatePrRequest): Promise<PrMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      let masterPanelId: number | null = null;
      if (input.panelId) {
        masterPanelId = await assertPanelHasCountdown(
          connection,
          this.env.DB_NAME,
          input.carId,
          input.panelId,
        );
      }
      const prefix = derivePrPrefix(input.divisionName ?? context.divisionName);
      const prNumber = await nextPrNumber(connection, this.env.PURCHASE_DB_NAME, prefix);
      const prId = randomUUID();

      await connection.execute(
        `
          INSERT INTO ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")} (
            id,
            pr_number,
            car_id,
            master_panel_id,
            requested_by,
            requested_by_name,
            division_name,
            target_date,
            priority,
            acc_tracking,
            status,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ADV', 'OPEN', ?)
        `,
        [
          prId,
          prNumber,
          input.carId,
          masterPanelId,
          context.actorId,
          context.actorName,
          input.divisionName ?? context.divisionName,
          input.targetDate ?? null,
          input.priority ?? "NORMAL",
          input.notes,
        ],
      );

      for (const item of input.items) {
        await connection.execute(
          `
            INSERT INTO ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")} (
              id,
              pr_id,
              item_name,
              description,
              origin_type,
              qty,
              uom,
              estimated_price,
              photo_url,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'HUNTING')
          `,
          [
            randomUUID(),
            prId,
            item.itemName,
            item.description,
            item.originType,
            item.qty,
            item.uom,
            item.estimatedPrice,
            item.photoUrl ?? null,
          ],
        );
      }

      await connection.commit();
      return {
        prId,
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

  async update(prId: string, input: CreatePrRequest): Promise<PrMutationResult> {
    const item = input.items[0];
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [headerResult] = await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")}
          SET car_id = ?,
              division_name = ?,
              target_date = ?,
              priority = ?,
              notes = ?
          WHERE id = ?
        `,
        [input.carId, input.divisionName ?? null, input.targetDate ?? null, input.priority ?? "NORMAL", input.notes ?? null, prId],
      );
      if ("affectedRows" in headerResult && Number(headerResult.affectedRows) === 0) {
        throw new Error("PR_NOT_FOUND");
      }

      if (item) {
        await connection.execute(
          `
            UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
            SET item_name = ?,
                description = ?,
                origin_type = ?,
                qty = ?,
                uom = ?,
                estimated_price = ?,
                photo_url = ?
            WHERE pr_id = ?
            ORDER BY item_name ASC, id ASC
            LIMIT 1
          `,
          [item.itemName, item.description ?? null, item.originType, item.qty, item.uom, item.estimatedPrice ?? null, item.photoUrl ?? null, prId],
        );
      }

      await connection.commit();
      return { prId, accTracking: "PENDING_ADV", status: "OPEN" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(
    params: ScopeParams & { prId: string },
  ): Promise<{ header: PrRecord; items: PrItemRecord[] } | null> {
    const pool = this.poolFactory(this.env);
    const baseSql = buildPrHeaderSelectSql(this.env.PURCHASE_DB_NAME, this.env.CORE_DB_NAME);
    const coreCarsTable = qualifyTable(this.env.CORE_DB_NAME, "cars");
    const queryParams: unknown[] = [params.prId];
    const whereClauses = ["h.id = ?"];
    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      coreCarsTable,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [headerRows, itemRows] = await Promise.all([
      pool.query<PrHeaderRow[]>(
        `
          ${baseSql}
          WHERE ${whereClauses.join(" AND ")}
          LIMIT 1
        `,
        queryParams,
      ),
      pool.query<PrItemRow[]>(
        `
          SELECT
            i.id AS itemId,
            i.pr_id AS prId,
            i.item_name AS itemName,
            i.description AS description,
            i.origin_type AS originType,
            i.qty AS qty,
            i.uom AS uom,
            i.estimated_price AS estimatedPrice,
            i.actual_price AS actualPrice,
            i.vendor_id AS vendorId,
            i.vendor_name AS vendorName,
            i.photo_url AS photoUrl,
            i.status AS status,
            i.hunting_notes AS huntingNotes,
            DATE_FORMAT(i.arrival_date, '%Y-%m-%d') AS arrivalDate
          FROM ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")} i
          WHERE i.pr_id = ?
          ORDER BY i.item_name ASC, i.id ASC
        `,
        [params.prId],
      ),
    ]);

    const headerRow = headerRows[0][0];
    if (!headerRow) {
      return null;
    }

    return {
      header: mapPrHeaderRow(headerRow),
      items: itemRows[0].map(mapPrItemRow),
    };
  }

  async advanceApproval(prId: string, notes: string | null): Promise<PrMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT acc_tracking AS accTracking, COALESCE(status, 'OPEN') AS status FROM ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")} WHERE id = ? FOR UPDATE`,
        [prId],
      );
      const row = rows[0];
      if (!row) {
        throw new Error("PR_NOT_FOUND");
      }

      const currentStage = normalizePrApprovalStage(row.accTracking);
      let nextStage: PrMutationResult["accTracking"];
      let nextStatus = String(row.status) as PrMutationResult["status"];

      if (currentStage === "PENDING_ADV") {
        nextStage = "PENDING_KP";
      } else if (currentStage === "PENDING_KP") {
        nextStage = "PENDING_MP";
      } else if (currentStage === "PENDING_MP") {
        nextStage = "PENDING_PUR";
      } else if (currentStage === "PENDING_PUR") {
        nextStage = "APPROVED";
        nextStatus = "HUNTING";
      } else {
        throw new Error("INVALID_APPROVAL_STATE");
      }

      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")}
          SET acc_tracking = ?,
              status = ?,
              notes = CASE
                WHEN ? IS NULL OR ? = '' THEN notes
                WHEN notes IS NULL OR notes = '' THEN ?
                ELSE CONCAT(notes, '\n', ?)
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextStage, nextStatus, notes, notes, notes, notes, prId],
      );

      if (nextStage === "APPROVED") {
        await connection.execute(
          `
            UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
            SET status = COALESCE(status, 'HUNTING')
            WHERE pr_id = ?
          `,
          [prId],
        );
      }

      await connection.commit();
      return {
        prId,
        accTracking: nextStage,
        status: nextStatus,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async markOrdered(prId: string, input: OrderPrRequest): Promise<PrMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      for (const item of input.items) {
        await connection.execute(
          `
            UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
            SET vendor_id = ?,
                vendor_name = ?,
                actual_price = ?,
                hunting_notes = CASE
                  WHEN ? IS NULL OR ? = '' THEN hunting_notes
                  WHEN hunting_notes IS NULL OR hunting_notes = '' THEN ?
                  ELSE CONCAT(hunting_notes, '\n', ?)
                END,
                status = 'ORDERED'
            WHERE id = ? AND pr_id = ?
          `,
          [
            item.vendorId,
            item.vendorName,
            item.actualPrice,
            item.notes,
            item.notes,
            item.notes,
            item.notes,
            item.itemId,
            prId,
          ],
        );
      }

      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")}
          SET status = 'ORDERED',
              notes = CASE
                WHEN ? IS NULL OR ? = '' THEN notes
                WHEN notes IS NULL OR notes = '' THEN ?
                ELSE CONCAT(notes, '\n', ?)
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.notes, input.notes, input.notes, input.notes, prId],
      );

      await connection.commit();
      return {
        prId,
        accTracking: "APPROVED",
        status: "ORDERED",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async markReceived(prId: string, input: ReceivePrRequest): Promise<PrMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      for (const item of input.items) {
        await connection.execute(
          `
            UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
            SET arrival_date = ?,
                actual_price = COALESCE(?, actual_price),
                hunting_notes = CASE
                  WHEN ? IS NULL OR ? = '' THEN hunting_notes
                  WHEN hunting_notes IS NULL OR hunting_notes = '' THEN ?
                  ELSE CONCAT(hunting_notes, '\n', ?)
                END,
                status = 'ARRIVED'
            WHERE id = ? AND pr_id = ?
          `,
          [
            item.arrivalDate,
            item.actualPrice,
            item.notes,
            item.notes,
            item.notes,
            item.notes,
            item.itemId,
            prId,
          ],
        );
      }

      const [pendingRows] = await connection.query<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
          WHERE pr_id = ?
            AND COALESCE(status, 'HUNTING') <> 'ARRIVED'
        `,
        [prId],
      );

      const nextStatus: PrMutationResult["status"] =
        Number(pendingRows[0]?.total ?? 0) === 0 ? "ARRIVED" : "ORDERED";

      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")}
          SET status = ?,
              notes = CASE
                WHEN ? IS NULL OR ? = '' THEN notes
                WHEN notes IS NULL OR notes = '' THEN ?
                ELSE CONCAT(notes, '\n', ?)
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextStatus, input.notes, input.notes, input.notes, input.notes, prId],
      );

      await connection.commit();
      return {
        prId,
        accTracking: "APPROVED",
        status: nextStatus,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async cancel(prId: string, reason: string): Promise<PrMutationResult> {
    const pool = this.poolFactory(this.env);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_header")}
          SET status = 'CANCELLED',
              notes = CASE
                WHEN notes IS NULL OR notes = '' THEN ?
                ELSE CONCAT(notes, '\n', ?)
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [reason, reason, prId],
      );
      await connection.execute(
        `
          UPDATE ${qualifyTable(this.env.PURCHASE_DB_NAME, "pur_pr_items")}
          SET status = CASE
            WHEN status = 'ARRIVED' THEN status
            ELSE 'CANCELLED'
          END
          WHERE pr_id = ?
        `,
        [prId],
      );
      await connection.commit();
      return {
        prId,
        accTracking: "APPROVED",
        status: "CANCELLED",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
