import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  IssueCreateRequest,
  IssueQuery,
  IssueRecord,
  IssueSeverity,
  IssueSourceType,
  IssueStatus,
  IssueSummary,
} from "@smsystem/contracts/issue";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface IssueListParams extends ScopeParams {
  query: IssueQuery;
}

interface IssueRow extends RowDataPacket {
  issueId: string;
  issueNumber: string;
  sourceType: IssueSourceType;
  sourceRefId: string | null;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  countdownId: string | null;
  planId: string | null;
  qcId: string | null;
  ledgerId: string | null;
  issueType: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  status: IssueStatus;
  isUrgent: number | boolean;
  assignedTo: string | null;
  assignedToName: string | null;
  reportedBy: string | null;
  reportedByName: string | null;
  createdAt: string;
  updatedAt: string;
  resolutionNotes: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  openCount: number | null;
  urgentCount: number | null;
  escalatedCount: number | null;
}

interface OptionRow extends RowDataPacket {
  value: string | number;
  label: string;
}

interface JobdescOptionRow extends RowDataPacket {
  value: string;
  label: string;
  carId: string;
  divisionId: number | null;
  countdownId: string;
  panelValue: string;
  panelLabel: string;
  title: string;
  description: string;
}

interface StorageReadyCache {
  checkedAt: number;
  ready: boolean;
}

const ISSUE_STORAGE_CACHE_TTL_MS = 60_000;

let issueStorageReadyCache: StorageReadyCache | null = null;

export interface IssueAutoSourceRecord {
  sourceRefId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  countdownId: string | null;
  planId: string | null;
  qcId?: string | null;
  ledgerId?: string | null;
  issueType: string;
  severity: IssueSeverity;
  title: string;
  description: string;
}

interface IssueAutoSourceRow extends RowDataPacket, IssueAutoSourceRecord {
}

interface IssueListPayload {
  rows: IssueRecord[];
  total: number;
  summary: IssueSummary;
  storageReady: boolean;
}

export interface IssuesRepository {
  list(params: IssueListParams): Promise<IssueListPayload>;
  listUrgent(params: ScopeParams): Promise<IssueRecord[]>;
  listReferences(params: ScopeParams): Promise<{
    units: Array<{ label: string; value: string }>;
    divisions: Array<{ label: string; value: string }>;
    statuses: Array<{ label: string; value: string }>;
    severities: Array<{ label: string; value: string }>;
    employees: Array<{ label: string; value: string }>;
    jobdescs: Array<{ value: string; label: string; carId: string; divisionId: number | null; countdownId: string; panelValue: string; panelLabel: string; title: string; description: string }>;
  }>;
  findById(params: ScopeParams & { issueId: string }): Promise<IssueRecord | null>;
  findJobdescContext(params: ScopeParams & { planId: string }): Promise<{ planId: string; countdownId: string; carId: string; divisionId: number | null } | null>;
  create(params: { actorId: string; actorName: string | null }, input: IssueCreateRequest): Promise<{ issueId: string }>;
  updateStatus(issueId: string, status: Exclude<IssueStatus, "OPEN">, input?: {
    actorId?: string;
    actorName?: string | null;
    resolutionNotes?: string | null;
    note?: string | null;
  }): Promise<void>;
  assign(issueId: string, input: { assignedTo: string; assignedToName: string | null }): Promise<void>;
  listByUnit(params: ScopeParams & { carId: string }): Promise<IssueRecord[]>;
  listAutoQcRejectSources(): Promise<IssueAutoSourceRecord[]>;
  listAutoLedgerIssueSources(): Promise<IssueAutoSourceRecord[]>;
  upsertAutoIssue(input: IssueAutoSourceRecord & { sourceType: Exclude<IssueSourceType, "MANUAL"> }): Promise<string>;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  aliases: { carId: string; divisionId: string },
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

function issueBaseSelectSql(): string {
  return `
    SELECT
      il.id AS issueId,
      il.issue_number AS issueNumber,
      il.source_type AS sourceType,
      il.source_ref_id AS sourceRefId,
      il.car_id AS carId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      il.division_id AS divisionId,
      d.name AS divisionName,
      il.countdown_id AS countdownId,
      il.plan_id AS planId,
      il.qc_id AS qcId,
      il.ledger_id AS ledgerId,
      il.issue_type AS issueType,
      il.severity AS severity,
      il.title AS title,
      il.description AS description,
      il.status AS status,
      il.is_urgent AS isUrgent,
      il.assigned_to AS assignedTo,
      il.assigned_to_name AS assignedToName,
      il.reported_by AS reportedBy,
      il.reported_by_name AS reportedByName,
      DATE_FORMAT(il.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(il.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
      il.resolution_notes AS resolutionNotes
    FROM sm_issue_log il
    JOIN cars c ON c.id = il.car_id
    LEFT JOIN sm_divisi d ON d.id = il.division_id
  `;
}

function buildFilterClauses(query: IssueQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        il.issue_number LIKE ?
        OR c.unit_name LIKE ?
        OR COALESCE(c.customer_name, '') LIKE ?
        OR il.title LIKE ?
        OR il.description LIKE ?
      )`,
    );
    params.push(value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "status") {
      clauses.push("il.status = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "severity") {
      clauses.push("il.severity = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "divisionId") {
      clauses.push("il.division_id = ?");
      params.push(Number.parseInt(filter.value, 10));
      continue;
    }

    if (filter.field === "carId") {
      clauses.push("il.car_id = ?");
      params.push(filter.value);
    }
  }

  return clauses;
}

function buildOrderBy(sortBy: string, direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    createdAt: "il.created_at",
    updatedAt: "il.updated_at",
    unitName: "c.unit_name",
    status: "il.status",
    severity:
      "CASE il.severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END",
  };

  return `${columnMap[sortBy] ?? "il.created_at"} ${direction.toUpperCase()}, il.id DESC`;
}

function mapIssueRow(row: IssueRow): IssueRecord {
  return {
    issueId: row.issueId,
    issueNumber: row.issueNumber,
    sourceType: row.sourceType,
    sourceRefId: row.sourceRefId,
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    countdownId: row.countdownId,
    planId: row.planId,
    qcId: row.qcId,
    ledgerId: row.ledgerId,
    issueType: row.issueType,
    severity: row.severity,
    title: row.title,
    description: row.description,
    status: row.status,
    isUrgent: Boolean(row.isUrgent),
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    reportedBy: row.reportedBy,
    reportedByName: row.reportedByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolutionNotes: row.resolutionNotes,
  };
}

function toOptions(rows: OptionRow[]): Array<{ label: string; value: string }> {
  return rows.map((row) => ({
    label: row.label,
    value: String(row.value),
  }));
}

function buildStaticIssueReferences() {
  return {
    units: [] as Array<{ label: string; value: string }>,
    divisions: [] as Array<{ label: string; value: string }>,
    statuses: [
      "OPEN",
      "ACKNOWLEDGED",
      "IN_PROGRESS",
      "QC_RECHECK",
      "RESOLVED",
      "ESCALATED",
      "WAIVED",
    ].map((status) => ({ label: status, value: status })),
    severities: ["LOW", "MEDIUM", "HIGH"].map((severity) => ({
      label: severity,
      value: severity,
    })),
    employees: [] as Array<{ label: string; value: string }>,
    jobdescs: [] as Array<{ value: string; label: string; carId: string; divisionId: number | null; countdownId: string; panelValue: string; panelLabel: string; title: string; description: string }>,
  };
}

function isCacheFresh(cache: StorageReadyCache | null): cache is StorageReadyCache {
  return Boolean(cache && Date.now() - cache.checkedAt < ISSUE_STORAGE_CACHE_TTL_MS);
}

export async function isIssueStorageReady(
  connection: Pick<Pool | PoolConnection, "query">,
): Promise<boolean> {
  if (isCacheFresh(issueStorageReadyCache)) {
    return issueStorageReadyCache.ready;
  }

  const [rows] = (await connection.query(
    `SHOW TABLES LIKE 'sm_issue_log'`,
  )) as [RowDataPacket[], unknown];

  const ready = rows.length > 0;
  issueStorageReadyCache = {
    checkedAt: Date.now(),
    ready,
  };

  return ready;
}

async function requireIssueStorageReady(
  connection: Pick<Pool | PoolConnection, "query">,
): Promise<void> {
  if (!(await isIssueStorageReady(connection))) {
    throw new Error("ISSUES_STORAGE_NOT_READY");
  }
}

function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/gu, "");
}

export class MySqlIssuesRepository implements IssuesRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {}

  async list(params: IssueListParams): Promise<IssueListPayload> {
    const pool = this.poolFactory();
    if (!(await isIssueStorageReady(pool))) {
      return {
        rows: [],
        total: 0,
        summary: {
          openCount: 0,
          urgentCount: 0,
          escalatedCount: 0,
        },
        storageReady: false,
      };
    }

    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
      {
        carId: "il.car_id",
        divisionId: "il.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }
    whereClauses.push(...buildFilterClauses(params.query, whereParams));
    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const offset = (params.query.page - 1) * params.query.limit;

    const [rows] = (await pool.query(
      `
        ${issueBaseSelectSql()}
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      [...whereParams, params.query.limit, offset],
    )) as [IssueRow[], unknown];

    const countParams: unknown[] = [];
    const countClauses: string[] = [];
    const countScopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      countParams,
      {
        carId: "il.car_id",
        divisionId: "il.division_id",
      },
    );
    if (countScopeWhere) {
      countClauses.push(countScopeWhere);
    }
    countClauses.push(...buildFilterClauses(params.query, countParams));
    const countSql =
      countClauses.length > 0 ? `WHERE ${countClauses.join(" AND ")}` : "";

    const [countResult, summaryResult] = await Promise.all([
      pool.query(
        `
          SELECT COUNT(*) AS total
          FROM sm_issue_log il
          JOIN cars c ON c.id = il.car_id
          ${countSql}
        `,
        countParams,
      ) as Promise<[CountRow[], unknown]>,
      pool.query(
        `
          SELECT
            SUM(CASE WHEN il.status NOT IN ('RESOLVED', 'WAIVED') THEN 1 ELSE 0 END) AS openCount,
            SUM(CASE WHEN il.status NOT IN ('RESOLVED', 'WAIVED') AND il.is_urgent = 1 THEN 1 ELSE 0 END) AS urgentCount,
            SUM(CASE WHEN il.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalatedCount
          FROM sm_issue_log il
          JOIN cars c ON c.id = il.car_id
          ${countSql}
        `,
        countParams,
      ) as Promise<[SummaryRow[], unknown]>,
    ]);
    const countRow = countResult[0][0];
    const summaryRow = summaryResult[0][0];

    return {
      rows: rows.map(mapIssueRow),
      total: Number(countRow?.total ?? 0),
      summary: {
        openCount: Number(summaryRow?.openCount ?? 0),
        urgentCount: Number(summaryRow?.urgentCount ?? 0),
        escalatedCount: Number(summaryRow?.escalatedCount ?? 0),
      },
      storageReady: true,
    };
  }

  async listUrgent(params: ScopeParams): Promise<IssueRecord[]> {
    const pool = this.poolFactory();
    if (!(await isIssueStorageReady(pool))) {
      return [];
    }

    const queryParams: unknown[] = [];
    const whereClauses = [
      "il.status NOT IN ('RESOLVED', 'WAIVED')",
      "il.is_urgent = 1",
    ];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "il.car_id",
        divisionId: "il.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        ${issueBaseSelectSql()}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY il.created_at DESC
        LIMIT 20
      `,
      queryParams,
    )) as [IssueRow[], unknown];

    return rows.map(mapIssueRow);
  }

  async listReferences(params: ScopeParams) {
    const pool = this.poolFactory();
    if (!(await isIssueStorageReady(pool))) {
      return buildStaticIssueReferences();
    }

    const jobdescParams: unknown[] = [];
    const jobdescScope = buildScopeWhereClause(params.scope, params.employeeId, jobdescParams, {
      carId: "cd.car_id",
      divisionId: "cd.division_id",
    });
    const jobdescWhere = ["p.task_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)"];
    if (jobdescScope) jobdescWhere.push(jobdescScope);

    const [unitRows, jobdescRows, divisionRows, employeeRows] = await Promise.all([
      pool.query(
        `
          SELECT DISTINCT
            c.id AS value,
            c.unit_name AS label
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          WHERE ${jobdescWhere.join(" AND ")}
          ORDER BY c.unit_name ASC
        `,
        jobdescParams,
      ) as Promise<[OptionRow[], unknown]>,
      pool.query(
        `
          SELECT
            p.id AS value,
            CONCAT(c.unit_name, ' · ', COALESCE(d.name, '-'), ' · ', COALESCE(NULLIF(p.jobdescription, ''), NULLIF(cd.section_name, ''), 'Jobdesc')) AS label,
            cd.car_id AS carId,
            cd.division_id AS divisionId,
            cd.id AS countdownId,
            COALESCE(CAST(cd.panel_id AS CHAR), CONCAT('part:', COALESCE(cd.section_name, '-'))) AS panelValue,
            CONCAT(COALESCE(mp.name, 'Tanpa Panel'), CASE WHEN NULLIF(cd.section_name, '') IS NULL THEN '' ELSE CONCAT(' · ', cd.section_name) END) AS panelLabel,
            COALESCE(NULLIF(cd.section_name, ''), NULLIF(p.jobdescription, ''), 'Pembahasan Jobdesc') AS title,
            COALESCE(NULLIF(p.jobdescription, ''), NULLIF(cd.section_name, ''), 'Tidak ada instruksi kerja.') AS description
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
          LEFT JOIN master_panels mp ON mp.id = cd.panel_id
          WHERE ${jobdescWhere.join(" AND ")}
          ORDER BY p.task_date DESC, c.unit_name ASC
          LIMIT 300
        `,
        jobdescParams,
      ) as Promise<[JobdescOptionRow[], unknown]>,
      pool.query(
        `
          SELECT DISTINCT
            cd.division_id AS value,
            d.name AS label
          FROM sm_jobdesc_plan p
          JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
          WHERE ${jobdescWhere.join(" AND ")}
          ORDER BY d.name ASC
        `,
        jobdescParams,
      ) as Promise<[OptionRow[], unknown]>,
      pool.query(
        `
          SELECT employee_id AS value, full_name AS label
          FROM sm_employee
          ORDER BY full_name ASC
        `,
      ) as Promise<[OptionRow[], unknown]>,
    ]);

    return {
      units: toOptions(unitRows[0]),
      divisions: toOptions(divisionRows[0]),
      statuses: buildStaticIssueReferences().statuses,
      severities: buildStaticIssueReferences().severities,
      employees: toOptions(employeeRows[0]),
      jobdescs: jobdescRows[0].map((row) => ({
        value: row.value,
        label: row.label,
        carId: row.carId,
        divisionId: row.divisionId,
        countdownId: row.countdownId,
        panelValue: row.panelValue,
        panelLabel: row.panelLabel,
        title: row.title,
        description: row.description,
      })),
    };
  }

  async findById(params: ScopeParams & { issueId: string }): Promise<IssueRecord | null> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const queryParams: unknown[] = [params.issueId];
    const whereClauses = ["il.id = ?"];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "il.car_id",
        divisionId: "il.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        ${issueBaseSelectSql()}
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    )) as [IssueRow[], unknown];

    const row = rows[0];
    return row ? mapIssueRow(row) : null;
  }

  async findJobdescContext(params: ScopeParams & { planId: string }) {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.planId];
    const clauses = ["p.id = ?"];
    const scope = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      carId: "cd.car_id",
      divisionId: "cd.division_id",
    });
    if (scope) clauses.push(scope);
    const [rows] = await pool.query<Array<RowDataPacket & { planId: string; countdownId: string; carId: string; divisionId: number | null }>>(
      `SELECT p.id AS planId, cd.id AS countdownId, cd.car_id AS carId, cd.division_id AS divisionId
       FROM sm_jobdesc_plan p JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
       WHERE ${clauses.join(" AND ")} LIMIT 1`,
      queryParams,
    );
    return rows[0] ?? null;
  }

  async create(
    params: { actorId: string; actorName: string | null },
    input: IssueCreateRequest,
  ): Promise<{ issueId: string }> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const issueId = randomUUID();
    const issueNumber = await this.generateIssueNumber();
    await pool.query<ResultSetHeader>(
      `
        INSERT INTO sm_issue_log (
          id,
          issue_number,
          source_type,
          source_ref_id,
          car_id,
          division_id,
          countdown_id,
          plan_id,
          issue_type,
          severity,
          title,
          description,
          status,
          is_urgent,
          reported_by,
          reported_by_name
        )
        VALUES (?, ?, 'MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
      `,
      [
        issueId,
        issueNumber,
        input.carId,
        input.divisionId ?? null,
        input.countdownId ?? null,
        input.planId ?? null,
        input.issueType,
        input.severity,
        input.title,
        input.description,
        input.severity === "HIGH" ? 1 : 0,
        params.actorId,
        params.actorName,
      ],
    );

    return {
      issueId,
    };
  }

  async updateStatus(
    issueId: string,
    status: Exclude<IssueStatus, "OPEN">,
    input?: {
      actorId?: string;
      actorName?: string | null;
      resolutionNotes?: string | null;
      note?: string | null;
    },
  ): Promise<void> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const sets = ["status = ?"];
    const values: unknown[] = [status];

    if (status === "ACKNOWLEDGED") {
      sets.push("acknowledged_by = ?", "acknowledged_at = NOW()");
      values.push(input?.actorId ?? null);
    }

    if (status === "ESCALATED") {
      sets.push("escalated_by = ?", "escalated_at = NOW()");
      values.push(input?.actorId ?? null);
    }

    if (status === "RESOLVED") {
      sets.push("resolved_by = ?", "resolved_at = NOW()", "resolution_notes = ?");
      values.push(input?.actorId ?? null, input?.resolutionNotes ?? null);
    }

    if (status === "WAIVED") {
      sets.push("waived_by = ?", "waived_at = NOW()", "waive_notes = ?");
      values.push(input?.actorId ?? null, input?.note ?? null);
    }

    values.push(issueId);
    await pool.query(
      `
        UPDATE sm_issue_log
        SET ${sets.join(", ")}
        WHERE id = ?
      `,
      values,
    );
  }

  async assign(
    issueId: string,
    input: { assignedTo: string; assignedToName: string | null },
  ): Promise<void> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    await pool.query(
      `
        UPDATE sm_issue_log
        SET assigned_to = ?, assigned_to_name = ?
        WHERE id = ?
      `,
      [input.assignedTo, input.assignedToName, issueId],
    );
  }

  async listByUnit(params: ScopeParams & { carId: string }): Promise<IssueRecord[]> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const queryParams: unknown[] = [params.carId];
    const whereClauses = ["il.car_id = ?"];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "il.car_id",
        divisionId: "il.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        ${issueBaseSelectSql()}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY il.created_at DESC
      `,
      queryParams,
    )) as [IssueRow[], unknown];

    return rows.map(mapIssueRow);
  }

  async listAutoQcRejectSources(): Promise<IssueAutoSourceRow[]> {
    const pool = this.poolFactory();
    if (!(await isIssueStorageReady(pool))) {
      return [];
    }

    const [rows] = (await pool.query(
      `
        SELECT
          qc.id AS sourceRefId,
          c.id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          cd.division_id AS divisionId,
          d.name AS divisionName,
          cd.id AS countdownId,
          qc.rework_plan_id AS planId,
          qc.id AS qcId,
          'QC_REJECT' AS issueType,
          'HIGH' AS severity,
          CONCAT('QC Reject - ', COALESCE(cd.section_name, 'Task')) AS title,
          COALESCE(NULLIF(TRIM(qc.qc_notes), ''), 'QC tidak lolos dan perlu tindak lanjut.') AS description
        FROM sm_qc_inspections qc
        JOIN sm_jobdesc_countdown cd ON cd.id = qc.core_id
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        WHERE qc.result_status = 'TIDAK_LOLOS'
      `,
    )) as [IssueAutoSourceRow[], unknown];

    return rows;
  }

  async listAutoLedgerIssueSources(): Promise<IssueAutoSourceRow[]> {
    const pool = this.poolFactory();
    if (!(await isIssueStorageReady(pool))) {
      return [];
    }

    const [rows] = (await pool.query(
      `
        SELECT
          li.id AS sourceRefId,
          wl.car_id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          wl.division_id AS divisionId,
          d.name AS divisionName,
          wl.countdown_id AS countdownId,
          wl.plan_id AS planId,
          wl.id AS ledgerId,
          li.issue_type AS issueType,
          li.severity AS severity,
          CONCAT('Ledger Issue - ', li.issue_type) AS title,
          li.description AS description
        FROM sm_work_ledger_issues li
        JOIN sm_work_ledger wl ON wl.id = li.ledger_id
        JOIN cars c ON c.id = wl.car_id
        LEFT JOIN sm_divisi d ON d.id = wl.division_id
        WHERE li.is_resolved = 0
      `,
    )) as [IssueAutoSourceRow[], unknown];

    return rows;
  }

  async upsertAutoIssue(
    input: IssueAutoSourceRecord & { sourceType: Exclude<IssueSourceType, "MANUAL"> },
  ): Promise<string> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const issueId = randomUUID();
    const issueNumber = await this.generateIssueNumber();
    await pool.query(
      `
        INSERT INTO sm_issue_log (
          id,
          issue_number,
          source_type,
          source_ref_id,
          car_id,
          division_id,
          countdown_id,
          plan_id,
          qc_id,
          ledger_id,
          issue_type,
          severity,
          title,
          description,
          status,
          is_urgent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          severity = VALUES(severity),
          is_urgent = VALUES(is_urgent),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        issueId,
        issueNumber,
        input.sourceType,
        input.sourceRefId,
        input.carId,
        input.divisionId,
        input.countdownId ?? null,
        input.planId ?? null,
        input.qcId ?? null,
        input.ledgerId ?? null,
        input.issueType,
        input.severity,
        input.title,
        input.description,
        input.severity === "HIGH" ? 1 : 0,
      ],
    );

    const [rows] = (await pool.query(
      `
        SELECT id AS issueId
        FROM sm_issue_log
        WHERE source_type = ? AND source_ref_id = ?
        LIMIT 1
      `,
      [input.sourceType, input.sourceRefId],
    )) as [Array<RowDataPacket & { issueId: string }>, unknown];

    return rows[0]?.issueId ?? "";
  }

  private async generateIssueNumber(): Promise<string> {
    const pool = this.poolFactory();
    await requireIssueStorageReady(pool);
    const [rows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM sm_issue_log
        WHERE DATE(created_at) = CURDATE()
      `,
    )) as [CountRow[], unknown];

    const sequence = String(Number(rows[0]?.total ?? 0) + 1).padStart(3, "0");
    return `ISS-${todayKey()}-${sequence}`;
  }
}
