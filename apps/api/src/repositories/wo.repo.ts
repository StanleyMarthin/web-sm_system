import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  WoCreateRequest,
  WoGridQuery,
  WoGridReference,
  WoLinkedCountdown,
  WoRecord,
  WoStatus,
  WoSummary,
} from "@smsystem/contracts/wo";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface WoListParams extends ScopeParams {
  query: WoGridQuery;
}

interface WoMutationParams extends ScopeParams {
  woId: string;
}

interface WoRow extends RowDataPacket {
  woId: string;
  woNumber: string;
  carId: string | null;
  unitName: string | null;
  customerName: string | null;
  fromDivisionId: number | null;
  fromDivisionName: string | null;
  toDivisionId: number | null;
  toDivisionName: string | null;
  panelName: string | null;
  jobDetail: string | null;
  estimatedHours: number | null;
  isPriority: number | boolean;
  status: string | null;
  requestDate: string | null;
  approvalDate: string | null;
  createdAt: string | null;
  notes: string | null;
  picId: string | null;
  picName: string | null;
  approverId: string | null;
  linkedCountdownId: string | null;
  linkedCountdownStatus: string | null;
  agingHours: number | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  pendingApproval: number | null;
  approvedOpen: number | null;
  urgentCount: number | null;
}

interface ReferenceRow extends RowDataPacket {
  value: string;
  label: string;
}

interface LinkedCountdownRow extends RowDataPacket {
  coreId: string;
  divisionId: number | null;
  divisionName: string | null;
  status: string | null;
  createdAt: string | null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeWoRisk(params: {
  status: string;
  isPriority: boolean;
  agingHours: number;
  linkedCountdownId: string | null;
}): { agingScore: number; isUrgent: boolean } {
  let score = Math.min(40, Math.max(0, Math.round(params.agingHours * 2)));

  if (params.status === "OPEN" || params.status === "SUBMITTED") {
    score += 20;
  }

  if (params.status === "APPROVED") {
    score += 30;
  }

  if (params.isPriority) {
    score += 20;
  }

  if (params.status === "APPROVED" && !params.linkedCountdownId) {
    score += 15;
  }

  const agingScore = Math.min(100, score);
  const isUrgent =
    params.isPriority ||
    agingScore >= 70 ||
    ((params.status === "OPEN" || params.status === "SUBMITTED") &&
      params.agingHours >= 24);

  return {
    agingScore,
    isUrgent,
  };
}

function mapWoRow(row: WoRow): WoRecord {
  const agingHours = Math.max(0, toNumber(row.agingHours, 0));
  const isPriority = toBoolean(row.isPriority);
  const risk = computeWoRisk({
    status: row.status ?? "SUBMITTED",
    isPriority,
    agingHours,
    linkedCountdownId: row.linkedCountdownId,
  });

  return {
    woId: row.woId,
    woNumber: row.woNumber,
    carId: row.carId,
    unitName: row.unitName ?? "-",
    customerName: row.customerName ?? "-",
    fromDivisionId: row.fromDivisionId,
    fromDivisionName: row.fromDivisionName ?? "-",
    toDivisionId: row.toDivisionId,
    toDivisionName: row.toDivisionName ?? "-",
    panelName: row.panelName,
    jobDetail: row.jobDetail ?? "",
    estimatedHours: row.estimatedHours === null ? null : Number(row.estimatedHours),
    isPriority,
    status: (row.status ?? "SUBMITTED") as WoStatus,
    requestDate: row.requestDate ?? "",
    approvalDate: row.approvalDate,
    createdAt: row.createdAt ?? "",
    notes: row.notes,
    picId: row.picId,
    picName: row.picName,
    approverId: row.approverId,
    linkedCountdownId: row.linkedCountdownId,
    linkedCountdownStatus: row.linkedCountdownStatus,
    agingHours,
    agingScore: risk.agingScore,
    isUrgent: risk.isUrgent,
  };
}

function buildWoSelectSql(): string {
  return `
    SELECT
      w.id AS woId,
      w.wo_number AS woNumber,
      w.car_id AS carId,
      COALESCE(c.unit_name, w.car_id) AS unitName,
      COALESCE(c.customer_name, '-') AS customerName,
      w.from_div_id AS fromDivisionId,
      COALESCE(fd.name, '-') AS fromDivisionName,
      w.to_div_id AS toDivisionId,
      COALESCE(td.name, '-') AS toDivisionName,
      w.panel_name AS panelName,
      COALESCE(w.job_detail, '') AS jobDetail,
      w.estimated_hours AS estimatedHours,
      COALESCE(w.is_priority, 0) AS isPriority,
      COALESCE(w.status, 'SUBMITTED') AS status,
      DATE_FORMAT(w.request_date, '%Y-%m-%d') AS requestDate,
      DATE_FORMAT(w.approval_date, '%Y-%m-%d %H:%i:%s') AS approvalDate,
      DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      w.notes AS notes,
      w.pic_id AS picId,
      COALESCE(ep.full_name, NULL) AS picName,
      w.approver_id AS approverId,
      (
        SELECT ctd.id
        FROM sm_jobdesc_countdown ctd
        WHERE ctd.ref_taks_id = w.id
        ORDER BY ctd.created_at DESC
        LIMIT 1
      ) AS linkedCountdownId,
      (
        SELECT ctd.status
        FROM sm_jobdesc_countdown ctd
        WHERE ctd.ref_taks_id = w.id
        ORDER BY ctd.created_at DESC
        LIMIT 1
      ) AS linkedCountdownStatus,
      TIMESTAMPDIFF(
        HOUR,
        COALESCE(w.created_at, TIMESTAMP(w.request_date)),
        CURRENT_TIMESTAMP
      ) AS agingHours
    FROM sm_jobdesc_wo w
    LEFT JOIN cars c ON c.id = w.car_id
    LEFT JOIN sm_divisi fd ON fd.id = w.from_div_id
    LEFT JOIN sm_divisi td ON td.id = w.to_div_id
    LEFT JOIN sm_employee ep ON ep.employee_id = w.pic_id
  `;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [];

  if (scope.divisionIds.length > 0) {
    clauses.push(
      `(w.from_div_id IN (${scope.divisionIds.map(() => "?").join(", ")}) OR w.to_div_id IN (${scope.divisionIds.map(() => "?").join(", ")}))`,
    );
    params.push(...scope.divisionIds, ...scope.divisionIds);
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

  if (clauses.length === 0) {
    return "0 = 1";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildFilterClauses(query: WoGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.viewMode === "active") {
    clauses.push("COALESCE(w.status, 'SUBMITTED') NOT IN ('DONE', 'REJECTED', 'CLOSED')");
  } else if (query.viewMode === "done") {
    clauses.push("COALESCE(w.status, 'SUBMITTED') IN ('DONE', 'REJECTED', 'CLOSED')");
  }

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        w.wo_number LIKE ?
        OR COALESCE(c.unit_name, w.car_id) LIKE ?
        OR COALESCE(fd.name, '') LIKE ?
        OR COALESCE(td.name, '') LIKE ?
        OR COALESCE(w.job_detail, '') LIKE ?
        OR COALESCE(w.panel_name, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("COALESCE(w.status, 'SUBMITTED') = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "fromDivisionId") {
      clauses.push("w.from_div_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "toDivisionId") {
      clauses.push("w.to_div_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "isPriority") {
      clauses.push("COALESCE(w.is_priority, 0) = ?");
      params.push(filter.value === "1" ? 1 : 0);
    }
  }

  return clauses;
}

function buildOrderBy(query: WoGridQuery): string {
  const direction = query.sortDirection.toUpperCase();
  const columnMap: Record<string, string> = {
    requestDate: "w.request_date",
    status: "w.status",
    unitName: "COALESCE(c.unit_name, w.car_id)",
    fromDivisionName: "COALESCE(fd.name, '')",
    toDivisionName: "COALESCE(td.name, '')",
    estimatedHours: "COALESCE(w.estimated_hours, 0)",
    agingHours: "TIMESTAMPDIFF(HOUR, COALESCE(w.created_at, TIMESTAMP(w.request_date)), CURRENT_TIMESTAMP)",
    createdAt: "w.created_at",
  };

  const column = columnMap[query.sortBy] ?? columnMap.requestDate;
  return `${column} ${direction}, w.created_at DESC, w.id DESC`;
}

async function assertScopeAccess(
  connection: Pick<PoolConnection, "query">,
  params: ScopeParams & {
    carId: string | null;
    fromDivisionId: number | null;
    toDivisionId: number | null;
  },
): Promise<boolean> {
  if (params.scope.canViewAllUnits) {
    return true;
  }

  if (
    params.fromDivisionId !== null &&
    params.scope.divisionIds.includes(params.fromDivisionId)
  ) {
    return true;
  }

  if (
    params.toDivisionId !== null &&
    params.scope.divisionIds.includes(params.toDivisionId)
  ) {
    return true;
  }

  if (params.carId && params.scope.unitIds.includes(params.carId)) {
    return true;
  }

  if (!params.carId || !params.scope.canViewAssignedUnits) {
    return false;
  }

  const [rows] = (await connection.query(
    `
      SELECT 1 AS ok
      FROM car_project_assignment
      WHERE car_id = ?
        AND ended_at IS NULL
        AND (kp_id = ? OR advisor_id = ? OR kd_id = ?)
      LIMIT 1
    `,
    [params.carId, params.employeeId, params.employeeId, params.employeeId],
  )) as [Array<RowDataPacket & { ok: number }>, unknown];

  return rows.length > 0;
}

export interface WoRepository {
  list(
    params: WoListParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }>;
  listPendingApproval(
    params: ScopeParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }>;
  listMyDivision(
    params: ScopeParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }>;
  listUrgent(params: ScopeParams): Promise<WoRecord[]>;
  listReferences(params: ScopeParams): Promise<WoGridReference>;
  create(
    params: { actorId: string; fromDivisionId: number },
    input: WoCreateRequest,
  ): Promise<{ woId: string }>;
  findById(params: WoMutationParams): Promise<WoRecord | null>;
  updateStatus(
    woId: string,
    status: WoStatus,
    input?: { actorId?: string; reason?: string | null },
  ): Promise<void>;
  findLinkedCountdowns(woId: string): Promise<WoLinkedCountdown[]>;
}

export class MySqlWoRepository implements WoRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  private async runListQuery(
    params: ScopeParams,
    query: WoGridQuery,
    options: {
      extraClauses?: string[];
      extraParams?: unknown[];
      limit?: number;
    } = {},
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const whereClauses = buildFilterClauses(query, queryParams);
    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    if (options.extraClauses?.length) {
      whereClauses.push(...options.extraClauses);
    }
    if (options.extraParams?.length) {
      queryParams.push(...options.extraParams);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const limit = options.limit ?? query.limit;

    const [[rows], [countRows], [summaryRows]] = (await Promise.all([
      pool.query(
        `
          ${buildWoSelectSql()}
          ${whereSql}
          ORDER BY ${buildOrderBy(query)}
          LIMIT ? OFFSET ?
        `,
        [...queryParams, limit, (query.page - 1) * query.limit],
      ),
      pool.query(
        `
          SELECT COUNT(*) AS total
          FROM sm_jobdesc_wo w
          LEFT JOIN cars c ON c.id = w.car_id
          LEFT JOIN sm_divisi fd ON fd.id = w.from_div_id
          LEFT JOIN sm_divisi td ON td.id = w.to_div_id
          ${whereSql}
        `,
        queryParams,
      ),
      pool.query(
        `
          SELECT
            SUM(CASE WHEN COALESCE(w.status, 'SUBMITTED') IN ('OPEN', 'SUBMITTED') THEN 1 ELSE 0 END) AS pendingApproval,
            SUM(CASE WHEN COALESCE(w.status, 'SUBMITTED') = 'APPROVED' THEN 1 ELSE 0 END) AS approvedOpen,
            SUM(
              CASE
                WHEN COALESCE(w.is_priority, 0) = 1 THEN 1
                WHEN COALESCE(w.status, 'SUBMITTED') IN ('OPEN', 'SUBMITTED')
                  AND TIMESTAMPDIFF(HOUR, COALESCE(w.created_at, TIMESTAMP(w.request_date)), CURRENT_TIMESTAMP) >= 24
                  THEN 1
                ELSE 0
              END
            ) AS urgentCount
          FROM sm_jobdesc_wo w
          LEFT JOIN cars c ON c.id = w.car_id
          LEFT JOIN sm_divisi fd ON fd.id = w.from_div_id
          LEFT JOIN sm_divisi td ON td.id = w.to_div_id
          ${whereSql}
        `,
        queryParams,
      ),
    ])) as [
      [WoRow[], unknown],
      [CountRow[], unknown],
      [SummaryRow[], unknown],
    ];

    return {
      rows: rows.map(mapWoRow),
      total: toNumber(countRows[0]?.total, 0),
      summary: {
        pendingApproval: toNumber(summaryRows[0]?.pendingApproval, 0),
        approvedOpen: toNumber(summaryRows[0]?.approvedOpen, 0),
        urgentCount: toNumber(summaryRows[0]?.urgentCount, 0),
      },
    };
  }

  async list(
    params: WoListParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }> {
    return this.runListQuery(
      {
        employeeId: params.employeeId,
        scope: params.scope,
      },
      params.query,
    );
  }

  async listPendingApproval(
    params: ScopeParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }> {
    return this.runListQuery(
      params,
      {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "requestDate",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      },
      {
        extraClauses: ["COALESCE(w.status, 'SUBMITTED') IN ('OPEN', 'SUBMITTED')"],
      },
    );
  }

  async listMyDivision(
    params: ScopeParams,
  ): Promise<{ rows: WoRecord[]; total: number; summary: WoSummary }> {
    const divisionFocusId = params.scope.divisionIds[0] ?? null;
    if (divisionFocusId === null) {
      return {
        rows: [],
        total: 0,
        summary: {
          pendingApproval: 0,
          approvedOpen: 0,
          urgentCount: 0,
        },
      };
    }

    return this.runListQuery(
      params,
      {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "requestDate",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      },
      {
        extraClauses: ["(w.from_div_id = ? OR w.to_div_id = ?)"],
        extraParams: [divisionFocusId, divisionFocusId],
      },
    );
  }

  async listUrgent(params: ScopeParams): Promise<WoRecord[]> {
    const result = await this.runListQuery(
      params,
      {
        page: 1,
        limit: 10,
        search: "",
        sortBy: "requestDate",
        sortDirection: "desc",
        view: null,
        filters: [],
        viewMode: "active",
      },
      {
        limit: 20,
      },
    );

    return result.rows.filter((row) => row.isUrgent).slice(0, 10);
  }

  async listReferences(params: ScopeParams): Promise<WoGridReference> {
    const pool = this.poolFactory();
    const divisionQuery = pool.query(
      `
        SELECT CAST(id AS CHAR) AS value, name AS label
        FROM sm_divisi
        ORDER BY name ASC
      `,
    );

    let unitSql = `
      SELECT CAST(c.id AS CHAR) AS value, c.unit_name AS label
      FROM cars c
    `;
    const unitParams: unknown[] = [];
    if (!params.scope.canViewAllUnits) {
      const unitClauses: string[] = [];
      if (params.scope.unitIds.length > 0) {
        unitClauses.push(`c.id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        unitParams.push(...params.scope.unitIds);
      }
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
        unitParams.push(params.employeeId, params.employeeId, params.employeeId);
      }

      if (unitClauses.length > 0) {
        unitSql += ` WHERE ${unitClauses.join(" OR ")}`;
      } else {
        unitSql += " WHERE 0 = 1";
      }
    }
    unitSql += " ORDER BY c.unit_name ASC LIMIT 200";

    const unitQuery = pool.query(unitSql, unitParams);
    const statusRows: Array<{ value: string; label: string }> = [
      { value: "OPEN", label: "Open" },
      { value: "SUBMITTED", label: "Submitted" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
      { value: "DONE", label: "Done" },
      { value: "CLOSED", label: "Closed" },
    ];

    const [[divisionRows], [unitRows]] = (await Promise.all([
      divisionQuery,
      unitQuery,
    ])) as [[ReferenceRow[], unknown], [ReferenceRow[], unknown]];

    return {
      units: unitRows.map((row) => ({ value: row.value, label: row.label })),
      divisions: divisionRows.map((row) => ({ value: row.value, label: row.label })),
      statuses: statusRows.map((row) => ({ value: row.value, label: row.label })),
    };
  }

  async create(
    params: { actorId: string; fromDivisionId: number },
    input: WoCreateRequest,
  ): Promise<{ woId: string }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const createItems = input.items && input.items.length > 0
        ? input.items
        : [
            {
              jobDetail: input.jobDetail || "",
              panelName: input.panelName,
              sectionName: null,
              panelCategory: null,
              addPanelToMaster: false,
              notes: input.notes,
              estimatedHours: input.estimatedHours,
            },
          ];

      const createdIds: string[] = [];

      for (const item of createItems) {
        const woId = randomUUID();
        const [sequenceRows] = (await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM sm_jobdesc_wo
            WHERE MONTH(request_date) = MONTH(?)
              AND YEAR(request_date) = YEAR(?)
          `,
          [input.requestDate, input.requestDate],
        )) as [CountRow[], unknown];
        const sequence = String(toNumber(sequenceRows[0]?.total, 0) + 1).padStart(3, "0");
        const requestDate = new Date(`${input.requestDate}T00:00:00.000Z`);
        const month = String(requestDate.getUTCMonth() + 1).padStart(2, "0");
        const year = String(requestDate.getUTCFullYear());
        const woNumber = `WO/${sequence}/${month}/${year}`;

        const panelDisplay = item.sectionName || item.panelName || null;

        await connection.execute(
          `
            INSERT INTO sm_jobdesc_wo (
              id,
              wo_number,
              request_date,
              car_id,
              pic_id,
              from_div_id,
              to_div_id,
              panel_name,
              job_detail,
              estimated_hours,
              is_priority,
              status,
              acc_tracking,
              notes
            ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'SUBMITTED', 0, ?)
          `,
          [
            woId,
            woNumber,
            input.requestDate,
            input.carId,
            params.fromDivisionId,
            input.toDivisionId,
            panelDisplay,
            item.jobDetail,
            item.estimatedHours,
            input.isPriority ? 1 : 0,
            item.notes,
          ],
        );

        if (item.addPanelToMaster && panelDisplay) {
          const pName = panelDisplay.trim();
          if (pName) {
            const [existing] = await connection.query(
              "SELECT id FROM master_panels WHERE name = ? AND (car_id = ? OR car_id IS NULL) LIMIT 1",
              [pName, input.carId],
            ) as [unknown[], unknown];
            if (existing.length === 0) {
              await connection.execute(
                "INSERT INTO master_panels (car_id, section, name, category, is_active) VALUES (?, ?, ?, ?, 1)",
                [
                  input.carId,
                  item.panelCategory || null,
                  pName,
                  item.panelCategory || null,
                ],
              );
            }
          }
        }

        createdIds.push(woId);
      }

      await connection.commit();
      return { woId: createdIds[0] || randomUUID() };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(params: WoMutationParams): Promise<WoRecord | null> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      const [rows] = (await connection.query(
        `
          ${buildWoSelectSql()}
          WHERE w.id = ?
          LIMIT 1
        `,
        [params.woId],
      )) as [WoRow[], unknown];
      const row = rows[0];
      if (!row) {
        return null;
      }

      const canAccess = await assertScopeAccess(connection, {
        employeeId: params.employeeId,
        scope: params.scope,
        carId: row.carId,
        fromDivisionId: row.fromDivisionId,
        toDivisionId: row.toDivisionId,
      });
      if (!canAccess) {
        return null;
      }

      return mapWoRow(row);
    } finally {
      connection.release();
    }
  }

  async updateStatus(
    woId: string,
    status: WoStatus,
    input?: { actorId?: string; reason?: string | null },
  ): Promise<void> {
    const pool = this.poolFactory();

    if (status === "APPROVED") {
      await pool.execute(
        `
          UPDATE sm_jobdesc_wo
          SET
            status = 'APPROVED',
            approval_date = CURRENT_TIMESTAMP,
            approver_id = ?,
            notes = COALESCE(?, notes)
          WHERE id = ?
        `,
        [input?.actorId ?? null, input?.reason ?? null, woId],
      );
      return;
    }

    if (status === "REJECTED") {
      await pool.execute(
        `
          UPDATE sm_jobdesc_wo
          SET
            status = 'REJECTED',
            approver_id = ?,
            notes = CASE
              WHEN COALESCE(notes, '') = '' THEN ?
              ELSE CONCAT(notes, ' | REJECT: ', ?)
            END
          WHERE id = ?
        `,
        [input?.actorId ?? null, input?.reason ?? null, input?.reason ?? null, woId],
      );
      return;
    }

    await pool.execute(
      `
        UPDATE sm_jobdesc_wo
        SET status = ?
        WHERE id = ?
      `,
      [status, woId],
    );
  }

  async findLinkedCountdowns(woId: string): Promise<WoLinkedCountdown[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          ctd.id AS coreId,
          ctd.division_id AS divisionId,
          COALESCE(d.name, '-') AS divisionName,
          COALESCE(ctd.status, 'PLAN') AS status,
          DATE_FORMAT(ctd.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM sm_jobdesc_countdown ctd
        LEFT JOIN sm_divisi d ON d.id = ctd.division_id
        WHERE ctd.ref_taks_id = ?
        ORDER BY ctd.created_at DESC, ctd.id DESC
      `,
      [woId],
    )) as [LinkedCountdownRow[], unknown];

    return rows.map((row) => ({
      coreId: row.coreId,
      divisionId: row.divisionId,
      divisionName: row.divisionName ?? "-",
      status: row.status ?? "PLAN",
      createdAt: row.createdAt ?? "",
    }));
  }
}
