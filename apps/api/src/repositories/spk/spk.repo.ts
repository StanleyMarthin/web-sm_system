import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  SpkApprovalState,
  SpkDraftDetailUpdateRow,
  SpkDetailRecord,
  SpkGridQuery,
  SpkHeaderRecord,
  SpkPlannerMeta,
  SpkPreviewRecord,
  SpkStatus,
  SpkSummary,
} from "@smsystem/contracts/spk";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface SpkListParams extends ScopeParams {
  query: SpkGridQuery;
}

interface SpkPreviewParams extends ScopeParams {
  date: string;
}

interface HeaderRow extends RowDataPacket {
  spkId: string;
  spkNumber: string;
  spkDate: string;
  status: string;
  totalUnits: number;
  totalHours: number;
  createdBy: string;
  approvedBy: string | null;
  rejectReason: string | null;
  notes: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  plannerMeta: string | null;
}

interface DetailRow extends RowDataPacket {
  detailId: string;
  spkId: string;
  planId: string;
  unitNameSnapshot: string;
  divisionNameSnapshot: string;
  jobNameSnapshot: string;
  picNameSnapshot: string;
  targetHoursSnapshot: number;
  targetDateSnapshot: string;
  approvalState: string;
  approvalNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

interface PreviewRow extends RowDataPacket {
  planId: string;
  unitName: string;
  divisionName: string;
  jobName: string;
  picName: string;
  targetHours: number;
  targetDate: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  pendingApproval: number | null;
}

interface StorageReadyCache {
  checkedAt: number;
  ready: boolean;
}

const SPK_STORAGE_CACHE_TTL_MS = 60_000;
const PLANNER_META_PREFIX = "[PLANNER_AUTO_DRAFT]";

let spkStorageReadyCache: StorageReadyCache | null = null;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCacheFresh(cache: StorageReadyCache | null): cache is StorageReadyCache {
  return Boolean(cache && Date.now() - cache.checkedAt < SPK_STORAGE_CACHE_TTL_MS);
}

async function isSpkStorageReady(connection: Pick<Pool | PoolConnection, "query">): Promise<boolean> {
  if (isCacheFresh(spkStorageReadyCache)) {
    return spkStorageReadyCache.ready;
  }

  const [headerRows] = (await connection.query(
    `SHOW TABLES LIKE 'sm_spk_header'`,
  )) as [RowDataPacket[], unknown];
  const [detailRows] = (await connection.query(
    `SHOW TABLES LIKE 'sm_spk_detail'`,
  )) as [RowDataPacket[], unknown];

  const ready = headerRows.length > 0 && detailRows.length > 0;
  spkStorageReadyCache = {
    checkedAt: Date.now(),
    ready,
  };

  return ready;
}

async function requireSpkStorageReady(connection: Pick<Pool | PoolConnection, "query">): Promise<void> {
  if (!(await isSpkStorageReady(connection))) {
    throw new Error("SPK_STORAGE_NOT_READY");
  }
}

function mapHeaderRow(row: HeaderRow): SpkHeaderRecord {
  const plannerMeta = parsePlannerMeta(row.notes);
  return {
    spkId: row.spkId,
    spkNumber: row.spkNumber,
    spkDate: row.spkDate,
    status: row.status as SpkStatus,
    totalUnits: Number(row.totalUnits),
    totalHours: Number(row.totalHours),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    rejectReason: row.rejectReason,
    notes: plannerMeta ? plannerMeta.note : row.notes,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    activatedAt: row.activatedAt,
    plannerMeta,
  };
}

function mapDetailRow(row: DetailRow): SpkDetailRecord {
  return {
    detailId: row.detailId,
    spkId: row.spkId,
    planId: row.planId ?? null,
    unitNameSnapshot: row.unitNameSnapshot,
    divisionNameSnapshot: row.divisionNameSnapshot,
    jobNameSnapshot: row.jobNameSnapshot,
    picNameSnapshot: row.picNameSnapshot,
    targetHoursSnapshot: Number(row.targetHoursSnapshot),
    targetDateSnapshot: row.targetDateSnapshot,
    approvalState: row.approvalState as SpkApprovalState,
    approvalNote: row.approvalNote,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
  };
}

function buildPlannerMetaNote(meta: SpkPlannerMeta): string {
  return `${PLANNER_META_PREFIX}${JSON.stringify(meta)}`;
}

function parsePlannerMeta(notes: string | null | undefined): SpkPlannerMeta | null {
  if (!notes || !notes.startsWith(PLANNER_META_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(notes.slice(PLANNER_META_PREFIX.length)) as SpkPlannerMeta;
  } catch {
    return null;
  }
}

function mapPreviewRow(row: PreviewRow): SpkPreviewRecord {
  return {
    planId: row.planId,
    unitName: row.unitName,
    divisionName: row.divisionName,
    jobName: row.jobName,
    picName: row.picName,
    targetHours: Number(row.targetHours),
    targetDate: row.targetDate,
  };
}

function buildPlanScopeClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  aliases: {
    planAlias: string;
    countdownAlias: string;
  },
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [`${aliases.planAlias}.assigned_user_id = ?`];
  params.push(employeeId);

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ${aliases.countdownAlias}.car_id
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
      `${aliases.countdownAlias}.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(
      `${aliases.countdownAlias}.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.unitIds);
  }

  return `(${clauses.join(" OR ")})`;
}

function buildPlannerSnapshotScopeClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  aliases: {
    carAlias: string;
    divisionAlias: string;
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
        WHERE cpa_scope.car_id = ${aliases.carAlias}.id
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
      `${aliases.divisionAlias}.id IN (${scope.divisionIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(
      `${aliases.carAlias}.id IN (${scope.unitIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.unitIds);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildHeaderScopeExistsClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  headerAlias = "sh",
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const planScopeClause = buildPlanScopeClause(scope, employeeId, params, {
    planAlias: "p_scope",
    countdownAlias: "jc_scope",
  });
  const plannerSnapshotScopeClause = buildPlannerSnapshotScopeClause(
    scope,
    employeeId,
    params,
    {
      carAlias: "c_scope",
      divisionAlias: "d_scope",
    },
  );

  return `EXISTS (
    SELECT 1
    FROM sm_spk_detail sd_scope
    LEFT JOIN sm_jobdesc_plan p_scope ON p_scope.id = sd_scope.plan_id
    LEFT JOIN sm_jobdesc_countdown jc_scope ON jc_scope.id = p_scope.core_id
    LEFT JOIN cars c_scope ON c_scope.unit_name = sd_scope.unit_name_snapshot
    LEFT JOIN sm_divisi d_scope ON d_scope.name = sd_scope.division_name_snapshot
    WHERE sd_scope.spk_id = ${headerAlias}.id
      AND (
        (sd_scope.plan_id IS NOT NULL AND ${planScopeClause})
        OR
        (sd_scope.plan_id IS NULL AND ${plannerSnapshotScopeClause})
      )
  )`;
}

function buildPreviewQueryBaseSql(): string {
  return `
    SELECT
      p.id AS planId,
      COALESCE(c.unit_name, jc.car_id) AS unitName,
      COALESCE(d.name, '-') AS divisionName,
      COALESCE(p.jobdescription, '') AS jobName,
      COALESCE(e.full_name, p.assigned_user_id) AS picName,
      ROUND(TIME_TO_SEC(p.dailyTargetHours) / 3600, 2) AS targetHours,
      DATE_FORMAT(p.task_date, '%Y-%m-%d') AS targetDate
    FROM sm_jobdesc_plan p
    JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
    LEFT JOIN cars c ON c.id = jc.car_id
    LEFT JOIN sm_divisi d ON d.id = jc.division_id
    LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
  `;
}

function buildPreviewWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
  date: string,
): string {
  const clauses = [
    "p.task_date = ?",
    "COALESCE(p.status, 'PLAN') NOT IN ('REJECTED', 'CANCEL', 'CANCELLED')",
    "COALESCE(p.acc_tracking, 0) = 0",
  ];
  params.push(date);

  const scopeClause = buildPlanScopeClause(scope, employeeId, params, {
    planAlias: "p",
    countdownAlias: "jc",
  });
  if (scopeClause) {
    clauses.push(scopeClause);
  }

  return clauses.join(" AND ");
}

function buildListOrderBy(query: SpkGridQuery): string {
  const direction = query.sortDirection.toUpperCase();
  const columnMap: Record<string, string> = {
    spkDate: "sh.spk_date",
    status: "sh.status",
    totalUnits: "sh.total_units",
    totalHours: "sh.total_hours",
    createdAt: "sh.created_at",
    submittedAt: "sh.submitted_at",
    approvedAt: "sh.approved_at",
    activatedAt: "sh.activated_at",
  };

  const column = columnMap[query.sortBy] ?? columnMap.spkDate;
  return `${column} ${direction}, sh.created_at DESC, sh.id DESC`;
}

function buildHeaderSelectSql(): string {
  return `
    SELECT
      sh.id AS spkId,
      sh.spk_number AS spkNumber,
      DATE_FORMAT(sh.spk_date, '%Y-%m-%d') AS spkDate,
      sh.status AS status,
      sh.total_units AS totalUnits,
      ROUND(sh.total_hours, 2) AS totalHours,
      sh.created_by_name AS createdBy,
      sh.approved_by_name AS approvedBy,
      sh.reject_reason AS rejectReason,
      sh.notes AS notes,
      DATE_FORMAT(sh.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(sh.submitted_at, '%Y-%m-%d %H:%i:%s') AS submittedAt,
      DATE_FORMAT(sh.approved_at, '%Y-%m-%d %H:%i:%s') AS approvedAt,
      DATE_FORMAT(sh.activated_at, '%Y-%m-%d %H:%i:%s') AS activatedAt
    FROM sm_spk_header sh
  `;
}

function buildDetailSelectSql(): string {
  return `
    SELECT
      sd.id AS detailId,
      sd.spk_id AS spkId,
      sd.plan_id AS planId,
      sd.unit_name_snapshot AS unitNameSnapshot,
      sd.division_name_snapshot AS divisionNameSnapshot,
      sd.job_name_snapshot AS jobNameSnapshot,
      sd.pic_name_snapshot AS picNameSnapshot,
      ROUND(sd.target_hours_snapshot, 2) AS targetHoursSnapshot,
      DATE_FORMAT(sd.target_date_snapshot, '%Y-%m-%d') AS targetDateSnapshot,
      sd.approval_state AS approvalState,
      sd.approval_note AS approvalNote,
      sd.approved_by_name AS approvedBy,
      DATE_FORMAT(sd.approved_at, '%Y-%m-%d %H:%i:%s') AS approvedAt
    FROM sm_spk_detail sd
  `;
}

async function readPreviewRows(
  connection: Pick<Pool | PoolConnection, "query">,
  params: SpkPreviewParams,
): Promise<SpkPreviewRecord[]> {
  const queryParams: unknown[] = [];
  const whereClause = buildPreviewWhereClause(
    params.scope,
    params.employeeId,
    queryParams,
    params.date,
  );

  const [rows] = (await connection.query(
    `
      ${buildPreviewQueryBaseSql()}
      WHERE ${whereClause}
      ORDER BY divisionName ASC, unitName ASC, picName ASC, p.id ASC
    `,
    queryParams,
  )) as [PreviewRow[], unknown];

  return rows.map(mapPreviewRow);
}

function countUnits(rows: SpkPreviewRecord[]): number {
  return new Set(rows.map((row) => row.unitName)).size;
}

export interface SpkRepository {
  list(params: SpkListParams): Promise<{ rows: SpkHeaderRecord[]; total: number; storageReady: boolean }>;
  summary(params: ScopeParams): Promise<SpkSummary>;
  preview(
    params: SpkPreviewParams,
  ): Promise<{ rows: SpkPreviewRecord[]; totalUnits: number; totalHours: number }>;
  findExistingByDate(spkDate: string): Promise<SpkHeaderRecord | null>;
  generate(
    params: { actorId: string; actorName: string },
    input: { spkDate: string; notes: string | null },
  ): Promise<{ spkId: string }>;
  findPlannerDraftByWeeklyPlan(weeklyPlanId: string): Promise<SpkHeaderRecord | null>;
  generateFromWeeklyPlan(
    params: {
      actorId: string;
      actorName: string;
      weeklyPlanId: string;
      weekStartDate: string;
      generatedOvertimeRows: number;
      note: string | null;
      allocations: Array<{
        carId: string;
        unitName: string;
        divisionId: number;
        divisionName: string;
        targetHours: number;
      }>;
    },
  ): Promise<{ spkId: string }>;
  findDetail(
    params: ScopeParams & { spkId: string },
  ): Promise<{ header: SpkHeaderRecord; details: SpkDetailRecord[] } | null>;
  replaceDraftDetails(
    spkId: string,
    rows: SpkDraftDetailUpdateRow[],
  ): Promise<void>;
  updateHeaderStatus(
    spkId: string,
    status: SpkStatus,
    input?: { actorId?: string; actorName?: string; reason?: string | null },
  ): Promise<void>;
  updateItemApproval(
    spkId: string,
    detailId: string,
    input: { isApproved: boolean; note: string | null; actorId: string; actorName: string },
  ): Promise<void>;
  lockPlansForActivation(spkId: string): Promise<string[]>;
  today(params: ScopeParams): Promise<SpkHeaderRecord[]>;
}

export class MySqlSpkRepository implements SpkRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async list(params: SpkListParams): Promise<{ rows: SpkHeaderRecord[]; total: number; storageReady: boolean }> {
    const pool = this.poolFactory();
    if (!(await isSpkStorageReady(pool))) {
      return {
        rows: [],
        total: 0,
        storageReady: false,
      };
    }

    const whereClauses = ["sh.spk_date = ?", "sh.notes LIKE ?"];
    const queryParams: unknown[] = [params.query.date, `${PLANNER_META_PREFIX}%`];

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      whereClauses.push(
        `(
          sh.spk_number LIKE ?
          OR sh.created_by_name LIKE ?
          OR COALESCE(sh.approved_by_name, '') LIKE ?
          OR COALESCE(sh.notes, '') LIKE ?
        )`,
      );
      queryParams.push(value, value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "status") {
        whereClauses.push("sh.status = ?");
        queryParams.push(filter.value);
      }
    }

    const scopeClause = buildHeaderScopeExistsClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const whereSql = whereClauses.join(" AND ");
    const [rows] = (await pool.query(
      `
        ${buildHeaderSelectSql()}
        WHERE ${whereSql}
        ORDER BY ${buildListOrderBy(params.query)}
        LIMIT ? OFFSET ?
      `,
      [
        ...queryParams,
        params.query.limit,
        (params.query.page - 1) * params.query.limit,
      ],
    )) as [HeaderRow[], unknown];

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM sm_spk_header sh
        WHERE ${whereSql}
      `,
      queryParams,
    )) as [CountRow[], unknown];

    return {
      rows: rows.map(mapHeaderRow),
      total: toNumber(countRows[0]?.total, 0),
      storageReady: true,
    };
  }

  async summary(params: ScopeParams): Promise<SpkSummary> {
    const pool = this.poolFactory();
    if (!(await isSpkStorageReady(pool))) {
      return {
        pendingApproval: 0,
      };
    }

    const queryParams: unknown[] = [`${PLANNER_META_PREFIX}%`];
    const whereClauses = ["sh.status = 'SUBMITTED'", "sh.notes LIKE ?"];
    const scopeClause = buildHeaderScopeExistsClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = (await pool.query(
      `
        SELECT COUNT(*) AS pendingApproval
        FROM sm_spk_header sh
        WHERE ${whereClauses.join(" AND ")}
      `,
      queryParams,
    )) as [SummaryRow[], unknown];

    return {
      pendingApproval: toNumber(rows[0]?.pendingApproval, 0),
    };
  }

  async preview(
    params: SpkPreviewParams,
  ): Promise<{ rows: SpkPreviewRecord[]; totalUnits: number; totalHours: number }> {
    const pool = this.poolFactory();
    const rows = await readPreviewRows(pool, params);
    return {
      rows,
      totalUnits: countUnits(rows),
      totalHours: Number(rows.reduce((total, row) => total + row.targetHours, 0).toFixed(2)),
    };
  }

  async findExistingByDate(spkDate: string): Promise<SpkHeaderRecord | null> {
    const pool = this.poolFactory();
    await requireSpkStorageReady(pool);
    const [rows] = (await pool.query(
      `
        ${buildHeaderSelectSql()}
        WHERE sh.spk_date = ?
          AND sh.status <> 'REJECTED'
        ORDER BY sh.created_at DESC, sh.id DESC
        LIMIT 1
      `,
      [spkDate],
    )) as [HeaderRow[], unknown];

    return rows[0] ? mapHeaderRow(rows[0]) : null;
  }

  async findPlannerDraftByWeeklyPlan(weeklyPlanId: string): Promise<SpkHeaderRecord | null> {
    const pool = this.poolFactory();
    await requireSpkStorageReady(pool);
    const [rows] = (await pool.query(
      `
        ${buildHeaderSelectSql()}
        WHERE sh.notes LIKE ?
        ORDER BY sh.created_at DESC, sh.id DESC
      `,
      [`${PLANNER_META_PREFIX}%`],
    )) as [HeaderRow[], unknown];

    const matched = rows
      .map(mapHeaderRow)
      .find((row) => row.plannerMeta?.weeklyPlanId === weeklyPlanId);

    return matched ?? null;
  }

  async generate(
    params: { actorId: string; actorName: string },
    input: { spkDate: string; notes: string | null },
  ): Promise<{ spkId: string }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await requireSpkStorageReady(connection);

      const [existingRows] = (await connection.query(
        `
          SELECT 1 AS ok
          FROM sm_spk_header
          WHERE spk_date = ?
            AND status <> 'REJECTED'
          LIMIT 1
        `,
        [input.spkDate],
      )) as [Array<RowDataPacket & { ok: number }>, unknown];
      if (existingRows.length > 0) {
        throw new Error("SPK_ALREADY_EXISTS");
      }

      const rows = await readPreviewRows(connection, {
        employeeId: params.actorId,
        scope: {
          canViewAllUnits: true,
          canViewAssignedUnits: false,
          divisionIds: [],
          managedDivisionIds: [],
          unitIds: [],
        },
        date: input.spkDate,
      });
      if (rows.length === 0) {
        throw new Error("SPK_SOURCE_EMPTY");
      }

      const spkId = `SPK-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
      const [sequenceRows] = (await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM sm_spk_header
          WHERE spk_date = ?
        `,
        [input.spkDate],
      )) as [CountRow[], unknown];
      const sequence = String(toNumber(sequenceRows[0]?.total, 0) + 1).padStart(3, "0");
      const spkNumber = `SPK-${input.spkDate.replace(/-/gu, "")}-${sequence}`;
      const totalHours = Number(
        rows.reduce((total, row) => total + row.targetHours, 0).toFixed(2),
      );
      const totalUnits = countUnits(rows);

      await connection.execute(
        `
          INSERT INTO sm_spk_header (
            id,
            spk_number,
            spk_date,
            status,
            total_units,
            total_hours,
            created_by_employee_id,
            created_by_name,
            notes
          ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
        `,
        [
          spkId,
          spkNumber,
          input.spkDate,
          totalUnits,
          totalHours,
          params.actorId,
          params.actorName,
          input.notes,
        ],
      );

      for (const row of rows) {
        const detailId = `SPKD-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
        await connection.execute(
          `
            INSERT INTO sm_spk_detail (
              id,
              spk_id,
              plan_id,
              unit_name_snapshot,
              division_name_snapshot,
              job_name_snapshot,
              pic_name_snapshot,
              target_hours_snapshot,
              target_date_snapshot,
              approval_state,
              approval_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
          `,
          [
            detailId,
            spkId,
            row.planId,
            row.unitName,
            row.divisionName,
            row.jobName,
            row.picName,
            row.targetHours,
            row.targetDate,
          ],
        );
      }

      await connection.commit();
      return { spkId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async generateFromWeeklyPlan(
    params: {
      actorId: string;
      actorName: string;
      weeklyPlanId: string;
      weekStartDate: string;
      generatedOvertimeRows: number;
      note: string | null;
      allocations: Array<{
        carId: string;
        unitName: string;
        divisionId: number;
        divisionName: string;
        targetHours: number;
      }>;
    },
  ): Promise<{ spkId: string }> {
    const existing = await this.findPlannerDraftByWeeklyPlan(params.weeklyPlanId);
    if (existing) {
      return { spkId: existing.spkId };
    }

    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await requireSpkStorageReady(connection);

      if (params.allocations.length === 0) {
        throw new Error("SPK_SOURCE_EMPTY");
      }

      const spkId = `SPK-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
      const [sequenceRows] = (await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM sm_spk_header
          WHERE spk_date = ?
        `,
        [params.weekStartDate],
      )) as [CountRow[], unknown];
      const sequence = String(toNumber(sequenceRows[0]?.total, 0) + 1).padStart(3, "0");
      const spkNumber = `SPK-${params.weekStartDate.replace(/-/gu, "")}-${sequence}`;
      const totalHours = Number(
        params.allocations.reduce((total, row) => total + row.targetHours, 0).toFixed(2),
      );
      const totalUnits = new Set(params.allocations.map((row) => row.carId)).size;
      const plannerMeta: SpkPlannerMeta = {
        source: "WEEKLY_PLANNER",
        weeklyPlanId: params.weeklyPlanId,
        weekStartDate: params.weekStartDate,
        generatedOvertimeRows: params.generatedOvertimeRows,
        note: params.note,
        allocations: params.allocations.map((row) => ({
          allocationKey: `${row.unitName}::${row.divisionName}`,
          carId: row.carId,
          unitName: row.unitName,
          divisionId: row.divisionId,
          divisionName: row.divisionName,
          targetHours: Number(row.targetHours.toFixed(2)),
        })),
      };

      await connection.execute(
        `
          INSERT INTO sm_spk_header (
            id,
            spk_number,
            spk_date,
            status,
            total_units,
            total_hours,
            created_by_employee_id,
            created_by_name,
            notes
          ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
        `,
        [
          spkId,
          spkNumber,
          params.weekStartDate,
          totalUnits,
          totalHours,
          params.actorId,
          params.actorName,
          buildPlannerMetaNote(plannerMeta),
        ],
      );

      for (const row of params.allocations) {
        const detailId = `SPKD-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
        await connection.execute(
          `
            INSERT INTO sm_spk_detail (
              id,
              spk_id,
              plan_id,
              unit_name_snapshot,
              division_name_snapshot,
              job_name_snapshot,
              pic_name_snapshot,
              target_hours_snapshot,
              target_date_snapshot,
              approval_state,
              approval_note
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
          `,
          [
            detailId,
            spkId,
            row.unitName,
            row.divisionName,
            `Target mingguan ${row.divisionName}`,
            "Belum dibagi",
            row.targetHours,
            params.weekStartDate,
          ],
        );
      }

      await connection.commit();
      return { spkId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findDetail(
    params: ScopeParams & { spkId: string },
  ): Promise<{ header: SpkHeaderRecord; details: SpkDetailRecord[] } | null> {
    const pool = this.poolFactory();
    await requireSpkStorageReady(pool);
    const [headerRows] = (await pool.query(
      `
        ${buildHeaderSelectSql()}
        WHERE sh.id = ?
        LIMIT 1
      `,
      [params.spkId],
    )) as [HeaderRow[], unknown];
    const header = headerRows[0] ? mapHeaderRow(headerRows[0]) : null;
    if (!header) {
      return null;
    }

    const detailParams: unknown[] = [params.spkId];
    const whereClauses = ["sd.spk_id = ?"];
    if (!params.scope.canViewAllUnits) {
      const planScopeClause = buildPlanScopeClause(
        params.scope,
        params.employeeId,
        detailParams,
        {
          planAlias: "p",
          countdownAlias: "jc",
        },
      );
      const plannerSnapshotScopeClause = buildPlannerSnapshotScopeClause(
        params.scope,
        params.employeeId,
        detailParams,
        {
          carAlias: "c_snapshot",
          divisionAlias: "d_snapshot",
        },
      );
      whereClauses.push(
        `(
          (sd.plan_id IS NOT NULL AND ${planScopeClause})
          OR
          (sd.plan_id IS NULL AND ${plannerSnapshotScopeClause})
        )`,
      );
    }

    const [detailRows] = (await pool.query(
      `
        ${buildDetailSelectSql()}
        LEFT JOIN sm_jobdesc_plan p ON p.id = sd.plan_id
        LEFT JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
        LEFT JOIN cars c_snapshot ON c_snapshot.unit_name = sd.unit_name_snapshot
        LEFT JOIN sm_divisi d_snapshot ON d_snapshot.name = sd.division_name_snapshot
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY sd.created_at ASC, sd.id ASC
      `,
      detailParams,
    )) as [DetailRow[], unknown];

    if (!params.scope.canViewAllUnits && detailRows.length === 0) {
      return null;
    }

    return {
      header,
      details: detailRows.map(mapDetailRow),
    };
  }

  async replaceDraftDetails(
    spkId: string,
    rows: SpkDraftDetailUpdateRow[],
  ): Promise<void> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await requireSpkStorageReady(connection);

      await connection.execute(
        `DELETE FROM sm_spk_detail WHERE spk_id = ?`,
        [spkId],
      );

      for (const row of rows) {
        const detailId = row.detailId ?? `SPKD-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
        await connection.execute(
          `
            INSERT INTO sm_spk_detail (
              id,
              spk_id,
              plan_id,
              unit_name_snapshot,
              division_name_snapshot,
              job_name_snapshot,
              pic_name_snapshot,
              target_hours_snapshot,
              target_date_snapshot,
              approval_state,
              approval_note
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
          `,
          [
            detailId,
            spkId,
            row.unitNameSnapshot,
            row.divisionNameSnapshot,
            row.jobNameSnapshot,
            row.picNameSnapshot,
            row.targetHoursSnapshot,
            row.targetDateSnapshot,
          ],
        );
      }

      const totalHours = Number(
        rows.reduce((total, row) => total + row.targetHoursSnapshot, 0).toFixed(2),
      );
      const totalUnits = new Set(rows.map((row) => row.unitNameSnapshot)).size;

      await connection.execute(
        `
          UPDATE sm_spk_header
          SET total_units = ?, total_hours = ?
          WHERE id = ?
        `,
        [totalUnits, totalHours, spkId],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateHeaderStatus(
    spkId: string,
    status: SpkStatus,
    input?: { actorId?: string; actorName?: string; reason?: string | null },
  ): Promise<void> {
    const pool = this.poolFactory();
    await requireSpkStorageReady(pool);
    await pool.execute(
      `
        UPDATE sm_spk_header
        SET
          status = ?,
          submitted_at = CASE WHEN ? = 'SUBMITTED' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
          approved_at = CASE WHEN ? = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          approved_by_employee_id = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by_employee_id END,
          approved_by_name = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by_name END,
          reject_reason = CASE WHEN ? = 'REJECTED' THEN ? ELSE reject_reason END,
          activated_at = CASE WHEN ? = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE activated_at END
        WHERE id = ?
      `,
      [
        status,
        status,
        status,
        status,
        input?.actorId ?? null,
        status,
        input?.actorName ?? null,
        status,
        input?.reason ?? null,
        status,
        spkId,
      ],
    );
  }

  async updateItemApproval(
    spkId: string,
    detailId: string,
    input: { isApproved: boolean; note: string | null; actorId: string; actorName: string },
  ): Promise<void> {
    const pool = this.poolFactory();
    await requireSpkStorageReady(pool);
    await pool.execute(
      `
        UPDATE sm_spk_detail
        SET
          approval_state = ?,
          approval_note = ?,
          approved_by_employee_id = ?,
          approved_by_name = ?,
          approved_at = CURRENT_TIMESTAMP
        WHERE spk_id = ?
          AND id = ?
      `,
      [
        input.isApproved ? "APPROVED" : "REJECTED",
        input.note,
        input.actorId,
        input.actorName,
        spkId,
        detailId,
      ],
    );
  }

  async lockPlansForActivation(spkId: string): Promise<string[]> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await requireSpkStorageReady(connection);
      const [approvedRows] = (await connection.query(
        `
          SELECT plan_id AS planId
          FROM sm_spk_detail
          WHERE spk_id = ?
            AND approval_state = 'APPROVED'
        `,
        [spkId],
      )) as [Array<RowDataPacket & { planId: string }>, unknown];
      const planIds = approvedRows
        .map((row) => row.planId)
        .filter((planId): planId is string => Boolean(planId));

      if (planIds.length > 0) {
        await connection.execute(
          `
            UPDATE sm_jobdesc_plan
            SET acc_tracking = 1
            WHERE id IN (${planIds.map(() => "?").join(", ")})
          `,
          planIds,
        );
      }

      await connection.commit();
      return planIds;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async today(params: ScopeParams): Promise<SpkHeaderRecord[]> {
    const pool = this.poolFactory();
    if (!(await isSpkStorageReady(pool))) {
      return [];
    }

    const queryParams: unknown[] = [];
    const whereClauses = ["sh.status = 'ACTIVE'", "sh.spk_date = CURRENT_DATE()"];
    const scopeClause = buildHeaderScopeExistsClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = (await pool.query(
      `
        ${buildHeaderSelectSql()}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY sh.created_at DESC, sh.id DESC
      `,
      queryParams,
    )) as [HeaderRow[], unknown];

    return rows.map(mapHeaderRow);
  }
}
