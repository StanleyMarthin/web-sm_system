import { randomUUID } from "node:crypto";
import type {
  QcFinalChecklist,
  QcFinalChecklistItem,
  QcGridQuery,
  QcInspectionRecord,
  QcPassRequest,
  QcQueueRecord,
  QcRejectRequest,
  QcSummary,
} from "@smsystem/contracts/qc";
import type { AuthScope } from "@smsystem/contracts/auth";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";
import { isIssueStorageReady } from "@/repositories/issues/issues.repo";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface QcListParams extends ScopeParams {
  query: QcGridQuery;
  qcLevel?: "QC_KD" | "QC_QA";
}

interface QcListPayload {
  rows: QcQueueRecord[];
  total: number;
  summary: QcSummary;
}

interface QcRow extends RowDataPacket {
  coreId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  panelName: string | null;
  taskCategory: string;
  jobName: string;
  countdownStatus: string;
  qcLastStatus: "LOLOS" | "TIDAK_LOLOS" | null;
  qcLevel: "QC_KD" | "QC_QA" | "QC_ADVISOR" | "QC_KP" | "QC_MP" | "QC_MO" | null;
  latestQcId: string | null;
  refWoId: string | null;
  waitingHours: number | null;
  remainingHours: number | null;
  targetHours: number | null;
  deadlineDate: string | null;
  latestInspectionDate: string | null;
  latestInspectionNotes: string | null;
  photoBeforeUrl: string | null;
  evidencePhotoUrl: string | null;
  reworkPlanId: string | null;
  reworkTaskDate: string | null;
  reworkAssignedUserId: string | null;
  reworkAssignedUserName: string | null;
  reworkPlanStatus: string | null;
  linkedIssueId: string | null;
  openIssueCount: number | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface OptionRow extends RowDataPacket {
  value: string | number;
  label: string;
}

interface ChecklistRow extends RowDataPacket {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  totalTasks: number;
  completedTasks: number;
  passedTasks: number;
  rejectedTasks: number;
  openIssueCount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  notes: string | null;
}

interface ApprovalRow extends RowDataPacket {
  approvedAt: string;
}

interface MutationResult {
  applied?: boolean;
  qcId: string;
  coreId: string;
  resultStatus: "LOLOS" | "TIDAK_LOLOS";
  issueId: string | null;
  reworkPlanId: string | null;
}

interface ApproverRow {
  advisorId: string | null;
  kpId: string | null;
  kdId: string | null;
}

export interface QcRepository {
  listQueue(params: QcListParams): Promise<QcListPayload>;
  listRework(params: QcListParams): Promise<QcListPayload>;
  listRecheck(params: QcListParams): Promise<QcListPayload>;
  listReferences(params: ScopeParams): Promise<{
    divisions: Array<{ label: string; value: string }>;
    units: Array<{ label: string; value: string }>;
    statuses: Array<{ label: string; value: string }>;
    qcLevels: Array<{ label: string; value: string }>;
  }>;
  findByCoreId(params: ScopeParams & { coreId: string }): Promise<QcQueueRecord | null>;
  listInspectionHistory(params: ScopeParams & { coreId: string }): Promise<QcInspectionRecord[]>;
  findAssignedEmployeeIds?(coreId: string): Promise<string[]>;
  findUnitApprovers?(carId: string): Promise<ApproverRow | null>;
  passInspection(
    context: { actorId: string; qcLevel: string },
    input: { coreId: string; payload: QcPassRequest },
  ): Promise<MutationResult>;
  rejectInspection(
    context: { actorId: string; qcLevel: string },
    input: { coreId: string; payload: QcRejectRequest },
  ): Promise<MutationResult>;
  findFinalChecklist(
    params: ScopeParams & { carId: string },
  ): Promise<{ checklist: QcFinalChecklist; items: QcFinalChecklistItem[] } | null>;
  approveFinalChecklist(
    context: { actorId: string; actorName: string | null },
    input: { carId: string; notes: string | null },
  ): Promise<{ carId: string; approved: true; approvedAt: string }>;
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

function toOptions(rows: OptionRow[]): Array<{ label: string; value: string }> {
  return rows.map((row) => ({
    label: row.label,
    value: String(row.value),
  }));
}

function toHours(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number.parseInt(hoursRaw ?? "0", 10);
  const minutes = Number.parseInt(minutesRaw ?? "0", 10);
  return Number((hours + minutes / 60).toFixed(2));
}

const TECHNICAL_COUNTDOWN_WHERE = "COALESCE(jt.is_teknis, 1) = 1";

function isFinalQcLevel(qcLevel: string): boolean {
  return qcLevel === "QC_QA" || qcLevel === "QC_ADVISOR";
}

const completedActualJoin = `
  LEFT JOIN sm_jobdesc_actual qc_work ON qc_work.id = (
    SELECT a.id FROM sm_jobdesc_actual a
    JOIN sm_jobdesc_plan p ON p.id = a.plandaily_id
    WHERE p.core_id = cd.id AND p.status NOT IN ('REJECTED', 'CANCEL')
    ORDER BY a.created_at DESC, a.id DESC LIMIT 1
  )
`;
const completedWorkWhere = "LOWER(qc_work.status) IN ('done', 'ready_qc') AND COALESCE(qc_work.progres, 0) >= 100";

function mapQcRow(row: QcRow): QcQueueRecord {
  return {
    coreId: row.coreId,
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    panelId: row.panelId,
    panelName: row.panelName,
    taskCategory: row.taskCategory,
    jobName: row.jobName,
    countdownStatus: row.countdownStatus,
    qcLastStatus: row.qcLastStatus,
    qcLevel: row.qcLevel,
    latestQcId: row.latestQcId,
    refWoId: row.refWoId,
    waitingHours: Number(row.waitingHours ?? 0),
    remainingHours: row.remainingHours === null ? null : Number(row.remainingHours),
    targetHours: row.targetHours === null ? null : Number(row.targetHours),
    deadlineDate: row.deadlineDate,
    latestInspectionDate: row.latestInspectionDate,
    latestInspectionNotes: row.latestInspectionNotes,
    photoBeforeUrl: row.photoBeforeUrl,
    evidencePhotoUrl: row.evidencePhotoUrl,
    reworkPlanId: row.reworkPlanId,
    reworkTaskDate: row.reworkTaskDate,
    reworkAssignedUserId: row.reworkAssignedUserId,
    reworkAssignedUserName: row.reworkAssignedUserName,
    reworkPlanStatus: row.reworkPlanStatus,
    linkedIssueId: row.linkedIssueId,
    openIssueCount: Number(row.openIssueCount ?? 0),
  };
}

function buildOrderBy(sortBy: string, direction: "asc" | "desc"): string {
  const columnMap: Record<string, string> = {
    waitingHours: "waitingHours",
    unitName: "c.unit_name",
    divisionName: "d.name",
    panelName: "COALESCE(cd.section_name, mp.panel_name, mp.name_part)",
    countdownStatus: "cd.status",
    qcLevel: "cd.last_qc_level",
    deadlineDate: "cd.deadline_date",
    latestInspectionDate: "latest_qc.inspection_date",
  };

  return `${columnMap[sortBy] ?? "waitingHours"} ${direction.toUpperCase()}, cd.updated_at DESC`;
}

function buildSearchClause(query: QcGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];
  if (!query.search) {
    return clauses;
  }

  const value = `%${query.search}%`;
  clauses.push(
    `(
      c.unit_name LIKE ?
      OR COALESCE(c.customer_name, '') LIKE ?
      OR COALESCE(d.name, '') LIKE ?
      OR COALESCE(cd.section_name, mp.panel_name, mp.name_part, '') LIKE ?
      OR COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) LIKE ?
    )`,
  );
  params.push(value, value, value, value, value);
  return clauses;
}

function buildFilterClauses(query: QcGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  for (const filter of query.filters) {
    if (filter.field === "divisionId") {
      clauses.push("cd.division_id = ?");
      params.push(Number.parseInt(filter.value, 10));
      continue;
    }

    if (filter.field === "carId") {
      clauses.push("cd.car_id = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "status") {
      clauses.push("COALESCE(cd.qc_last_status, cd.status) = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "qcLevel") {
      clauses.push("cd.last_qc_level = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "jobName" || filter.field === "jobdesc") {
      clauses.push("COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) LIKE ?");
      params.push(`%${filter.value}%`);
    }
  }

  return clauses;
}

function buildIssueLinkJoinSql(issueStorageReady: boolean): string {
  if (!issueStorageReady) {
    return `
    LEFT JOIN (
      SELECT
        NULL AS qcJoinId,
        NULL AS issueId,
        0 AS openIssueCount
    ) issue_link ON 1 = 0
  `;
  }

  return `
    LEFT JOIN (
      SELECT
        COALESCE(qc_id, source_ref_id) AS qcJoinId,
        MIN(id) AS issueId,
        SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') THEN 1 ELSE 0 END) AS openIssueCount
      FROM sm_issue_log
      WHERE source_type = 'QC_REJECT'
      GROUP BY COALESCE(qc_id, source_ref_id)
    ) issue_link ON issue_link.qcJoinId = COALESCE(cd.ref_rework_qc_id, cd.latest_qc_id)
  `;
}

function buildOpenIssuesByCarJoinSql(
  issueStorageReady: boolean,
  carColumn = "cd.car_id",
): string {
  if (!issueStorageReady) {
    return `
      LEFT JOIN (
        SELECT
          NULL AS car_id,
          0 AS openIssueCount
      ) issues ON 1 = 0
    `;
  }

  return `
      LEFT JOIN (
        SELECT
          car_id,
          SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') THEN 1 ELSE 0 END) AS openIssueCount
        FROM sm_issue_log
        GROUP BY car_id
      ) issues ON issues.car_id = ${carColumn}
    `;
}

function buildOpenIssuesByCountdownJoinSql(issueStorageReady: boolean): string {
  if (!issueStorageReady) {
    return `
        LEFT JOIN (
          SELECT
            NULL AS countdown_id,
            NULL AS issueId,
            NULL AS issueStatus
        ) issue_link ON 1 = 0
      `;
  }

  return `
        LEFT JOIN (
          SELECT
            countdown_id,
            MIN(id) AS issueId,
            MIN(status) AS issueStatus
          FROM sm_issue_log
          WHERE status NOT IN ('RESOLVED', 'WAIVED')
          GROUP BY countdown_id
        ) issue_link ON issue_link.countdown_id = cd.id
      `;
}

function baseQcSelectSql(issueStorageReady: boolean): string {
  return `
    SELECT
      cd.id AS coreId,
      c.id AS carId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      cd.division_id AS divisionId,
      d.name AS divisionName,
      cd.panel_id AS panelId,
      COALESCE(cd.section_name, mp.panel_name, mp.name_part) AS panelName,
      cd.task_category AS taskCategory,
      COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) AS jobName,
      COALESCE(cd.status, 'PLAN') AS countdownStatus,
      CASE WHEN UPPER(latest_qc.result_status) = 'PASS' THEN 'LOLOS'
        ELSE latest_qc.result_status END AS qcLastStatus,
      latest_qc.qc_level AS qcLevel,
      latest_qc.id AS latestQcId,
      cd.ref_taks_id AS refWoId,
      ROUND(
        TIMESTAMPDIFF(
          MINUTE,
          COALESCE(rework_plan.created_at, latest_qc.inspection_date, cd.updated_at, cd.created_at),
          NOW()
        ) / 60,
        2
      ) AS waitingHours,
      cd.remaining_hours AS remainingHours,
      COALESCE(cd.target_hours, cd.target_hours_initial) AS targetHours,
      DATE_FORMAT(cd.deadline_date, '%Y-%m-%d') AS deadlineDate,
      DATE_FORMAT(latest_qc.inspection_date, '%Y-%m-%d %H:%i:%s') AS latestInspectionDate,
      latest_qc.qc_notes AS latestInspectionNotes,
      latest_qc.photo_before_url AS photoBeforeUrl,
      latest_qc.evidence_photo_url AS evidencePhotoUrl,
      rework_plan.id AS reworkPlanId,
      DATE_FORMAT(rework_plan.task_date, '%Y-%m-%d') AS reworkTaskDate,
      rework_plan.assigned_user_id AS reworkAssignedUserId,
      rework_emp.full_name AS reworkAssignedUserName,
      rework_plan.status AS reworkPlanStatus,
      issue_link.issueId AS linkedIssueId,
      COALESCE(issue_link.openIssueCount, 0) AS openIssueCount
    FROM sm_jobdesc_countdown cd
    JOIN cars c ON c.id = cd.car_id
    LEFT JOIN sm_divisi d ON d.id = cd.division_id
    LEFT JOIN master_panels mp ON mp.id = cd.panel_id
    LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
    LEFT JOIN sm_jobdesc_wo wo ON wo.id = cd.ref_taks_id
    ${completedActualJoin}
    LEFT JOIN sm_qc_inspections latest_qc ON latest_qc.id = (
      SELECT q.id FROM sm_qc_inspections q
      WHERE q.core_id = cd.id AND q.inspection_date >= qc_work.created_at
      ORDER BY (q.qc_level IN ('QC_QA', 'QC_ADVISOR')) DESC, q.inspection_date DESC, q.id DESC LIMIT 1
    )
    LEFT JOIN sm_qc_inspections reject_qc ON reject_qc.id = cd.ref_rework_qc_id
    LEFT JOIN sm_jobdesc_plan rework_plan ON rework_plan.id = reject_qc.rework_plan_id
    LEFT JOIN sm_employee rework_emp ON rework_emp.employee_id = rework_plan.assigned_user_id
    ${buildIssueLinkJoinSql(issueStorageReady)}
  `;
}

export class MySqlQcRepository implements QcRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async findAssignedEmployeeIds(coreId: string): Promise<string[]> {
    const [rows] = await this.poolFactory().query<RowDataPacket[]>(
      `SELECT DISTINCT assigned_user_id AS employeeId
       FROM sm_jobdesc_plan
       WHERE core_id = ? AND assigned_user_id IS NOT NULL`,
      [coreId],
    );
    return rows.map((row) => String(row.employeeId)).filter(Boolean);
  }

  async findUnitApprovers(carId: string): Promise<ApproverRow | null> {
    const [rows] = await this.poolFactory().query<RowDataPacket[]>(
      `SELECT
         advisor_id AS advisorId,
         kp_id AS kpId,
         kd_id AS kdId
       FROM car_project_assignment
       WHERE car_id = ?
         AND ended_at IS NULL
       LIMIT 1`,
      [carId],
    );

    const row = rows[0];
    return row
      ? {
          advisorId: row.advisorId ? String(row.advisorId) : null,
          kpId: row.kpId ? String(row.kpId) : null,
          kdId: row.kdId ? String(row.kdId) : null,
        }
      : null;
  }

  async listQueue(params: QcListParams): Promise<QcListPayload> {
    return this.listByMode(params, {
      extraWhere: [
        completedWorkWhere,
        params.qcLevel ? `NOT EXISTS (
          SELECT 1 FROM sm_qc_inspections checked
          WHERE checked.core_id = cd.id AND checked.inspection_date >= qc_work.created_at
            AND checked.qc_level IN (${params.qcLevel === "QC_KD" ? "'QC_KD'" : "'QC_QA', 'QC_ADVISOR'"})
        )` : "1=1",
      ],
    });
  }

  async listRework(params: QcListParams): Promise<QcListPayload> {
    return this.listByMode(params, {
      extraWhere: [
        "UPPER(COALESCE(cd.qc_last_status, '')) = 'TIDAK_LOLOS'",
        "rework_plan.id IS NOT NULL",
        "UPPER(COALESCE(rework_plan.status, 'PLAN')) NOT IN ('READY_QC', 'DONE', 'CANCEL', 'REJECTED')",
      ],
    });
  }

  async listRecheck(params: QcListParams): Promise<QcListPayload> {
    return this.listByMode(params, {
      extraWhere: [
        "UPPER(COALESCE(cd.status, '')) = 'READY_QC'",
        "UPPER(COALESCE(cd.qc_last_status, '')) = 'TIDAK_LOLOS'",
        "rework_plan.id IS NOT NULL",
        "UPPER(COALESCE(rework_plan.status, 'PLAN')) IN ('READY_QC', 'DONE')",
      ],
    });
  }

  async listReferences(params: ScopeParams) {
    const pool = this.poolFactory();
    const scopeParams: unknown[] = [];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      scopeParams,
      {
        carId: "cd.car_id",
        divisionId: "cd.division_id",
      },
    );
    const whereSql = scopeWhere ? `WHERE ${scopeWhere}` : "";

    const [divisionRows, unitRows] = await Promise.all([
      pool.query(
        `
          SELECT DISTINCT
            d.id AS value,
            d.name AS label
          FROM sm_jobdesc_countdown cd
          JOIN sm_divisi d ON d.id = cd.division_id
          LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
          ${whereSql}
          ${whereSql ? `AND ${TECHNICAL_COUNTDOWN_WHERE}` : `WHERE ${TECHNICAL_COUNTDOWN_WHERE}`}
          ORDER BY d.name
        `,
        scopeParams,
      ),
      pool.query(
        `
          SELECT DISTINCT
            c.id AS value,
            c.unit_name AS label
          FROM sm_jobdesc_countdown cd
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
          ${whereSql}
          ${whereSql ? `AND ${TECHNICAL_COUNTDOWN_WHERE}` : `WHERE ${TECHNICAL_COUNTDOWN_WHERE}`}
          ORDER BY c.unit_name
        `,
        scopeParams,
      ),
    ]);

    return {
      divisions: toOptions(divisionRows[0] as OptionRow[]),
      units: toOptions(unitRows[0] as OptionRow[]),
      statuses: [
        { label: "READY_QC", value: "READY_QC" },
        { label: "LOLOS", value: "LOLOS" },
        { label: "TIDAK_LOLOS", value: "TIDAK_LOLOS" },
      ],
      qcLevels: [
        { label: "QC_KD", value: "QC_KD" },
        { label: "QC QA", value: "QC_QA" },
      ],
    };
  }

  async findByCoreId(params: ScopeParams & { coreId: string }): Promise<QcQueueRecord | null> {
    const pool = this.poolFactory();
    const issueStorageReady = await isIssueStorageReady(pool);
    const queryParams: unknown[] = [];
    const clauses = ["cd.id = ?"];
    queryParams.push(params.coreId);

    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
      {
        carId: "cd.car_id",
        divisionId: "cd.division_id",
      },
    );
    if (scopeWhere) {
      clauses.push(scopeWhere);
    }
    clauses.push(TECHNICAL_COUNTDOWN_WHERE);

    const [rows] = (await pool.query(
      `
        ${baseQcSelectSql(issueStorageReady)}
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    )) as [QcRow[], unknown];

    return rows[0] ? mapQcRow(rows[0]) : null;
  }

  async listInspectionHistory(params: ScopeParams & { coreId: string }): Promise<QcInspectionRecord[]> {
    const values: unknown[] = [params.coreId];
    const scope = buildScopeWhereClause(params.scope, params.employeeId, values, {
      carId: "cd.car_id", divisionId: "cd.division_id",
    });
    const [rows] = await this.poolFactory().query<RowDataPacket[]>(`
      SELECT q.id AS qcId, q.qc_level AS qcLevel,
        CASE WHEN UPPER(q.result_status) IN ('PASS', 'LOLOS') THEN 'LOLOS' ELSE 'TIDAK_LOLOS' END AS resultStatus,
        DATE_FORMAT(q.inspection_date, '%Y-%m-%d %H:%i:%s') AS inspectionDate,
        q.inspector_id AS inspectorId, e.full_name AS inspectorName,
        q.inspection_duration_minutes AS inspectionDurationMinutes, q.qc_notes AS notes,
        q.photo_before_url AS photoBeforeUrl, q.evidence_photo_url AS evidencePhotoUrl
      FROM sm_qc_inspections q
      JOIN sm_jobdesc_countdown cd ON cd.id = q.core_id
      LEFT JOIN sm_employee e ON e.employee_id = q.inspector_id
      WHERE cd.id = ? ${scope ? `AND ${scope}` : ""}
      ORDER BY q.inspection_date DESC, q.id DESC
    `, values);
    return rows.map((row) => ({
      qcId: row.qcId, qcLevel: row.qcLevel, resultStatus: row.resultStatus,
      inspectionDate: row.inspectionDate, inspectorId: row.inspectorId,
      inspectorName: row.inspectorName, notes: row.notes,
      inspectionDurationMinutes: row.inspectionDurationMinutes == null ? null : Number(row.inspectionDurationMinutes),
      photoBeforeUrl: row.photoBeforeUrl, evidencePhotoUrl: row.evidencePhotoUrl,
    }));
  }

  async passInspection(
    context: { actorId: string; qcLevel: string },
    input: { coreId: string; payload: QcPassRequest },
  ): Promise<MutationResult> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const current = await this.lockCountdown(connection, input.coreId);
      if (!current) {
        throw new Error("QC_NOT_FOUND");
      }
      if (current.isUnitOnHold) throw new Error("UNIT_ON_HOLD");
      if (!current.isTechnicalJob) {
        throw new Error("QC_NON_TECHNICAL_FORBIDDEN");
      }
      if (!current.workCompleted) throw new Error("QC_WORK_NOT_COMPLETED");

      const nextStatus = isFinalQcLevel(context.qcLevel) ? "DONE" : "READY_QC";
      const remainingHoursAfter = isFinalQcLevel(context.qcLevel) ? 0 : current.remainingHours;

      const qcId = randomUUID();
      await connection.execute(
        `
          INSERT INTO sm_qc_inspections (
            id,
            core_id,
            result_status,
            qc_notes,
            inspection_duration_minutes,
            remaining_hours_after,
            inspector_id,
            qc_level,
            inspector_role,
            photo_before_url,
            evidence_photo_url
          ) VALUES (?, ?, 'LOLOS', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          qcId,
          input.coreId,
          input.payload.notes ?? null,
          input.payload.inspectionDurationMinutes ?? null,
          remainingHoursAfter,
          context.actorId,
          context.qcLevel,
          context.qcLevel.replace("QC_", ""),
          input.payload.photoBeforeUrl ?? null,
          input.payload.evidencePhotoUrl ?? null,
        ],
      );

      if (!current.qaQcId || isFinalQcLevel(context.qcLevel)) await connection.execute(
        `
          UPDATE sm_jobdesc_countdown
          SET status = ?,
              qc_last_status = 'LOLOS',
              latest_qc_id = ?,
              last_qc_level = ?,
              remaining_hours = ?,
              user_update = ?
          WHERE id = ?
        `,
        [nextStatus, qcId, context.qcLevel, remainingHoursAfter, context.actorId, input.coreId],
      );

      await connection.commit();
      return {
        qcId,
        coreId: input.coreId,
        resultStatus: "LOLOS",
        applied: !current.qaQcId || isFinalQcLevel(context.qcLevel),
        issueId: null,
        reworkPlanId: current.reworkPlanId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async rejectInspection(
    context: { actorId: string; qcLevel: string },
    input: { coreId: string; payload: QcRejectRequest },
  ): Promise<MutationResult> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const current = await this.lockCountdown(connection, input.coreId);
      if (!current) {
        throw new Error("QC_NOT_FOUND");
      }
      if (current.isUnitOnHold) throw new Error("UNIT_ON_HOLD");

      if (!current.isTechnicalJob) throw new Error("QC_NON_TECHNICAL_FORBIDDEN");
      if (!current.workCompleted) throw new Error("QC_WORK_NOT_COMPLETED");
      if (!isFinalQcLevel(context.qcLevel)) {
        const qcId = randomUUID();
        await connection.execute(
          `INSERT INTO sm_qc_inspections (id, core_id, result_status, qc_notes,
            inspector_id, qc_level, inspector_role, inspection_duration_minutes,
            photo_before_url, evidence_photo_url)
           VALUES (?, ?, 'TIDAK_LOLOS', ?, ?, ?, ?, ?, ?, ?)`,
          [qcId, input.coreId, input.payload.notes, context.actorId, context.qcLevel,
            context.qcLevel.replace("QC_", ""), input.payload.inspectionDurationMinutes,
            input.payload.photoBeforeUrl, input.payload.evidencePhotoUrl],
        );
        if (!current.qaQcId) await connection.execute(
          `UPDATE sm_jobdesc_countdown SET status = 'READY_QC',
             qc_last_status = 'TIDAK_LOLOS', last_qc_level = 'QC_KD',
             latest_qc_id = ?, user_update = ? WHERE id = ?`,
          [qcId, context.actorId, input.coreId],
        );
        await connection.commit();
        return { qcId, coreId: input.coreId, resultStatus: "TIDAK_LOLOS", issueId: null, reworkPlanId: null, applied: false };
      }

      if (!input.payload.reworkAssignedUser.trim()) throw new Error("QC_REWORK_REQUIRED");
      const qcId = randomUUID();
      const reworkPlanId = randomUUID();
      const reworkHours = toHours(input.payload.reworkDailyHours);
      const extensionHours = Math.max(0, Number((reworkHours - current.remainingHours).toFixed(2)));
      const nextRemainingHours = Number((current.remainingHours + extensionHours).toFixed(2));
      const nextTargetHours = Number((current.targetHours + extensionHours).toFixed(2));
      const jobDescription =
        input.payload.reworkDescription?.trim() ||
        `QC Rework - ${current.jobName ?? current.panelName ?? "Task"}`;

      if (extensionHours > 0) {
        await connection.execute(
          `
            INSERT INTO sm_jobdesc_countdown_revisions (
              countdown_id,
              revision_type,
              reason_code,
              old_target_hours,
              new_target_hours,
              delta_hours,
              old_deadline_date,
              new_deadline_date,
              reference_type,
              reference_id,
              reason_detail,
              changed_by,
              approval_status
            ) VALUES (?, 'EXTENSION', 'QC_REWORK', ?, ?, ?, ?, ?, 'QC_REJECT', ?, ?, ?, 'APPROVED')
          `,
          [
            input.coreId,
            current.targetHours,
            nextTargetHours,
            extensionHours,
            current.deadlineDate,
            input.payload.reworkDate,
            qcId,
            input.payload.notes?.trim() || input.payload.reworkDescription?.trim() || "Extend otomatis karena reject QC.",
            context.actorId,
          ],
        );
      }

      await connection.execute(
        `
          INSERT INTO sm_jobdesc_plan (
            id,
            core_id,
            task_date,
            jobdescription,
            assigned_user_id,
            target_start_hours,
            target_finish_hours,
            dailyTargetHours,
            is_overtime,
            is_rework,
            isPriority,
            status,
            acc_tracking,
            note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'PLAN', 0, ?)
        `,
        [
          reworkPlanId,
          input.coreId,
          input.payload.reworkDate,
          jobDescription,
          input.payload.reworkAssignedUser,
          input.payload.reworkStartTime ?? null,
          input.payload.reworkFinishTime ?? null,
          input.payload.reworkDailyHours,
          input.payload.reworkIsOvertime ? 1 : 0,
          input.payload.reworkIsPriority ? 1 : 0,
          input.payload.notes?.trim() || input.payload.reworkDescription?.trim() || null,
        ],
      );

      await connection.execute(
        `
          INSERT INTO sm_qc_inspections (
            id,
            core_id,
            result_status,
            qc_notes,
            inspection_duration_minutes,
            remaining_hours_after,
            rework_plan_id,
            inspector_id,
            qc_level,
            inspector_role,
            photo_before_url,
            evidence_photo_url
          ) VALUES (?, ?, 'TIDAK_LOLOS', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          qcId,
          input.coreId,
          input.payload.notes ?? input.payload.reworkDescription ?? null,
          input.payload.inspectionDurationMinutes ?? null,
          nextRemainingHours,
          reworkPlanId,
          context.actorId,
          context.qcLevel,
          context.qcLevel.replace("QC_", ""),
          input.payload.photoBeforeUrl ?? null,
          input.payload.evidencePhotoUrl ?? null,
        ],
      );

      await connection.execute(
        `
          UPDATE sm_jobdesc_countdown
          SET status = 'PROSES',
              qc_last_status = 'TIDAK_LOLOS',
              latest_qc_id = ?,
              ref_rework_qc_id = ?,
              last_qc_level = ?,
              target_hours = ?,
              remaining_hours = ?,
              user_update = ?
          WHERE id = ?
        `,
        [qcId, qcId, context.qcLevel, nextTargetHours, nextRemainingHours, context.actorId, input.coreId],
      );

      await connection.commit();
      return {
        qcId,
        coreId: input.coreId,
        resultStatus: "TIDAK_LOLOS",
        issueId: null,
        reworkPlanId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findFinalChecklist(
    params: ScopeParams & { carId: string },
  ): Promise<{ checklist: QcFinalChecklist; items: QcFinalChecklistItem[] } | null> {
    const pool = this.poolFactory();
    const issueStorageReady = await isIssueStorageReady(pool);
    const scopeParams: unknown[] = [params.carId];
    const clauses = ["cd.car_id = ?"];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      scopeParams,
      {
        carId: "cd.car_id",
        divisionId: "cd.division_id",
      },
    );
    if (scopeWhere) {
      clauses.push(scopeWhere);
    }
    clauses.push(TECHNICAL_COUNTDOWN_WHERE);

    const [checklistRows] = (await pool.query(
      `
        SELECT
          c.id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
          COUNT(cd.id) AS totalTasks,
          SUM(CASE WHEN UPPER(COALESCE(cd.status, '')) = 'DONE' THEN 1 ELSE 0 END) AS completedTasks,
          SUM(CASE WHEN UPPER(COALESCE(cd.qc_last_status, '')) = 'LOLOS'
            AND cd.last_qc_level IN ('QC_QA', 'QC_ADVISOR') THEN 1 ELSE 0 END) AS passedTasks,
          SUM(CASE WHEN UPPER(COALESCE(cd.qc_last_status, '')) = 'TIDAK_LOLOS' THEN 1 ELSE 0 END) AS rejectedTasks,
          COALESCE(issues.openIssueCount, 0) AS openIssueCount,
          DATE_FORMAT(final.approved_at, '%Y-%m-%d %H:%i:%s') AS approvedAt,
          final.approved_by_name AS approvedBy,
          final.notes AS notes
        FROM sm_jobdesc_countdown cd
        JOIN cars c ON c.id = cd.car_id
        LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
        ${buildOpenIssuesByCarJoinSql(issueStorageReady, "c.id")}
        LEFT JOIN sm_qc_final_approvals final ON final.car_id = c.id
        WHERE ${clauses.join(" AND ")}
        GROUP BY
          c.id,
          c.unit_name,
          c.customer_name,
          targetDeliveryDate,
          issues.openIssueCount,
          final.approved_at,
          final.approved_by_name,
          final.notes
        LIMIT 1
      `,
      scopeParams,
    )) as [ChecklistRow[], unknown];

    const checklistRow = checklistRows[0];
    if (!checklistRow) {
      return null;
    }

    const [itemRows] = (await pool.query(
      `
        SELECT
          cd.id AS coreId,
          COALESCE(cd.section_name, mp.panel_name, mp.name_part) AS panelName,
          d.name AS divisionName,
          COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) AS jobName,
          COALESCE(cd.status, 'PLAN') AS countdownStatus,
          CASE WHEN cd.last_qc_level IN ('QC_QA', 'QC_ADVISOR') THEN cd.qc_last_status ELSE NULL END AS qcLastStatus,
          cd.latest_qc_id AS latestQcId,
          issue_link.issueId AS issueId,
          issue_link.issueStatus AS issueStatus
        FROM sm_jobdesc_countdown cd
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        LEFT JOIN master_panels mp ON mp.id = cd.panel_id
        LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
        LEFT JOIN sm_jobdesc_wo wo ON wo.id = cd.ref_taks_id
        ${buildOpenIssuesByCountdownJoinSql(issueStorageReady)}
        WHERE ${clauses.join(" AND ")}
        ORDER BY d.name, panelName, jobName
      `,
      scopeParams,
    )) as [Array<RowDataPacket & QcFinalChecklistItem>, unknown];

    const checklist: QcFinalChecklist = {
      carId: checklistRow.carId,
      unitName: checklistRow.unitName,
      customerName: checklistRow.customerName,
      targetDeliveryDate: checklistRow.targetDeliveryDate,
      totalTasks: Number(checklistRow.totalTasks ?? 0),
      completedTasks: Number(checklistRow.completedTasks ?? 0),
      passedTasks: Number(checklistRow.passedTasks ?? 0),
      rejectedTasks: Number(checklistRow.rejectedTasks ?? 0),
      openIssueCount: Number(checklistRow.openIssueCount ?? 0),
      isReadyForDelivery:
        Number(checklistRow.totalTasks ?? 0) > 0 &&
        Number(checklistRow.completedTasks ?? 0) === Number(checklistRow.totalTasks ?? 0) &&
        Number(checklistRow.passedTasks ?? 0) === Number(checklistRow.totalTasks ?? 0) &&
        Number(checklistRow.openIssueCount ?? 0) === 0,
      approvedAt: checklistRow.approvedAt,
      approvedBy: checklistRow.approvedBy,
      notes: checklistRow.notes,
    };

    return {
      checklist,
      items: itemRows.map((row) => ({
        coreId: row.coreId,
        panelName: row.panelName,
        divisionName: row.divisionName,
        jobName: row.jobName,
        countdownStatus: row.countdownStatus,
        qcLastStatus: row.qcLastStatus,
        latestQcId: row.latestQcId,
        issueId: row.issueId,
        issueStatus: row.issueStatus,
      })),
    };
  }

  async approveFinalChecklist(
    context: { actorId: string; actorName: string | null },
    input: { carId: string; notes: string | null },
  ): Promise<{ carId: string; approved: true; approvedAt: string }> {
    const pool = this.poolFactory();
    const approvalId = randomUUID();

    await pool.query(
      `
        INSERT INTO sm_qc_final_approvals (
          id,
          car_id,
          approved_by,
          approved_by_name,
          notes
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          approved_by = VALUES(approved_by),
          approved_by_name = VALUES(approved_by_name),
          notes = VALUES(notes),
          approved_at = CURRENT_TIMESTAMP
      `,
      [
        approvalId,
        input.carId,
        context.actorId,
        context.actorName,
        input.notes,
      ],
    );

    const [rows] = (await pool.query(
      `
        SELECT DATE_FORMAT(approved_at, '%Y-%m-%d %H:%i:%s') AS approvedAt
        FROM sm_qc_final_approvals
        WHERE car_id = ?
        LIMIT 1
      `,
      [input.carId],
    )) as [ApprovalRow[], unknown];

    return {
      carId: input.carId,
      approved: true,
      approvedAt: rows[0]?.approvedAt ?? new Date().toISOString().slice(0, 19).replace("T", " "),
    };
  }

  private async listByMode(
    params: QcListParams,
    input: {
      extraWhere: string[];
    },
  ): Promise<QcListPayload> {
    const pool = this.poolFactory();
    const issueStorageReady = await isIssueStorageReady(pool);
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [...input.extraWhere];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
      {
        carId: "cd.car_id",
        divisionId: "cd.division_id",
      },
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }
    whereClauses.push(TECHNICAL_COUNTDOWN_WHERE);

    whereClauses.push(...buildSearchClause(params.query, whereParams));
    whereClauses.push(...buildFilterClauses(params.query, whereParams));

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderBy = buildOrderBy(params.query.sortBy, params.query.sortDirection);
    const offset = (params.query.page - 1) * params.query.limit;

    const [countRows, rows, summary] = await Promise.all([
      pool.query(
        `
          SELECT COUNT(*) AS total
          FROM (
            ${baseQcSelectSql(issueStorageReady)}
            ${whereSql}
          ) qc_grid
        `,
        whereParams,
      ),
      pool.query(
        `
          ${baseQcSelectSql(issueStorageReady)}
          ${whereSql}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `,
        [...whereParams, params.query.limit, offset],
      ),
      this.readSummary(pool, params),
    ]);

    return {
      rows: (rows[0] as QcRow[]).map(mapQcRow),
      total: Number((countRows[0] as CountRow[])[0]?.total ?? 0),
      summary,
    };
  }

  private async readSummary(pool: Pool, params: ScopeParams): Promise<QcSummary> {
    const issueStorageReady = await isIssueStorageReady(pool);
    const scopeParams: unknown[] = [];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      scopeParams,
      {
        carId: "cd.car_id",
        divisionId: "cd.division_id",
      },
    );
    const whereClauses = [TECHNICAL_COUNTDOWN_WHERE];
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }
    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
    const [rows] = (await pool.query(
      `
        SELECT
          SUM(
            CASE
              WHEN ${completedWorkWhere}
                AND COALESCE(UPPER(cd.qc_last_status), '') <> 'TIDAK_LOLOS'
                AND COALESCE(cd.last_qc_level, '') NOT IN ('QC_QA', 'QC_ADVISOR')
              THEN 1 ELSE 0
            END
          ) AS readyCount,
          SUM(
            CASE
              WHEN UPPER(COALESCE(cd.status, '')) = 'READY_QC'
                AND UPPER(COALESCE(cd.qc_last_status, '')) = 'TIDAK_LOLOS'
                AND UPPER(COALESCE(rework_plan.status, 'PLAN')) IN ('READY_QC', 'DONE')
              THEN 1 ELSE 0
            END
          ) AS recheckCount,
          SUM(
            CASE
              WHEN UPPER(COALESCE(cd.qc_last_status, '')) = 'TIDAK_LOLOS'
                AND rework_plan.id IS NOT NULL
                AND UPPER(COALESCE(rework_plan.status, 'PLAN')) NOT IN ('READY_QC', 'DONE', 'CANCEL', 'REJECTED')
              THEN 1 ELSE 0
            END
          ) AS activeReworkCount
        FROM sm_jobdesc_countdown cd
        LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
        ${completedActualJoin}
        LEFT JOIN sm_qc_inspections reject_qc ON reject_qc.id = cd.ref_rework_qc_id
        LEFT JOIN sm_jobdesc_plan rework_plan ON rework_plan.id = reject_qc.rework_plan_id
        ${whereSql}
      `,
      scopeParams,
    )) as [Array<RowDataPacket & { readyCount: number | null; recheckCount: number | null; activeReworkCount: number | null }>, unknown];

    const [finalRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM (
          SELECT
            cd.car_id
          FROM sm_jobdesc_countdown cd
          LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
          ${buildOpenIssuesByCarJoinSql(issueStorageReady)}
          ${whereSql}
          GROUP BY cd.car_id
          HAVING COUNT(cd.id) > 0
            AND SUM(CASE WHEN UPPER(COALESCE(cd.status, '')) = 'DONE' THEN 1 ELSE 0 END) = COUNT(cd.id)
            AND SUM(CASE WHEN UPPER(COALESCE(cd.qc_last_status, '')) = 'LOLOS' THEN 1 ELSE 0 END) = COUNT(cd.id)
            AND COALESCE(MAX(issues.openIssueCount), 0) = 0
        ) ready_units
      `,
      scopeParams,
    )) as [CountRow[], unknown];

    return {
      readyCount: Number(rows[0]?.readyCount ?? 0),
      recheckCount: Number(rows[0]?.recheckCount ?? 0),
      activeReworkCount: Number(rows[0]?.activeReworkCount ?? 0),
      finalReadyUnits: Number(finalRows[0]?.total ?? 0),
    };
  }

  private async lockCountdown(
    connection: PoolConnection,
    coreId: string,
  ): Promise<{
    jobName: string | null;
    panelName: string | null;
    reworkPlanId: string | null;
    remainingHours: number;
    targetHours: number;
    deadlineDate: string | null;
    isTechnicalJob: boolean;
    workCompleted: boolean;
    qaQcId: string | null;
    isUnitOnHold: boolean;
  } | null> {
    const [rows] = (await connection.query(
      `
        SELECT
          cd.id AS coreId,
          COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) AS jobName,
          COALESCE(cd.section_name, mp.panel_name, mp.name_part) AS panelName,
          reject_qc.rework_plan_id AS reworkPlanId,
          COALESCE(cd.remaining_hours, 0) AS remainingHours,
          COALESCE(cd.target_hours, cd.target_hours_initial, 0) AS targetHours,
          DATE_FORMAT(cd.deadline_date, '%Y-%m-%d') AS deadlineDate,
          COALESCE(jt.is_teknis, 1) AS isTechnicalJob,
          CASE WHEN UPPER(COALESCE(c.status, '')) = 'HOLD' THEN 1 ELSE 0 END AS isUnitOnHold,
          (${completedWorkWhere}) AS workCompleted,
          (SELECT q.id FROM sm_qc_inspections q
           WHERE q.core_id = cd.id AND q.qc_level IN ('QC_QA', 'QC_ADVISOR')
             AND q.inspection_date >= qc_work.created_at
           ORDER BY q.inspection_date DESC, q.id DESC LIMIT 1) AS qaQcId
        FROM sm_jobdesc_countdown cd
        LEFT JOIN master_panels mp ON mp.id = cd.panel_id
        LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
        LEFT JOIN cars c ON c.id = cd.car_id
        LEFT JOIN sm_jobdesc_wo wo ON wo.id = cd.ref_taks_id
        ${completedActualJoin}
        LEFT JOIN sm_qc_inspections reject_qc ON reject_qc.id = cd.ref_rework_qc_id
        WHERE cd.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [coreId],
    )) as [Array<RowDataPacket & {
      coreId: string;
      jobName: string | null;
      panelName: string | null;
      reworkPlanId: string | null;
      remainingHours: number | null;
      targetHours: number | null;
      deadlineDate: string | null;
      isTechnicalJob: number | null;
      isUnitOnHold: number | null;
      workCompleted: number | null;
      qaQcId: string | null;
    }>, unknown];

    return rows[0]
      ? {
          jobName: rows[0].jobName,
          panelName: rows[0].panelName,
          reworkPlanId: rows[0].reworkPlanId,
          remainingHours: Number(rows[0].remainingHours ?? 0),
          targetHours: Number(rows[0].targetHours ?? rows[0].remainingHours ?? 0),
          deadlineDate: rows[0].deadlineDate ?? null,
          isTechnicalJob: Number(rows[0].isTechnicalJob ?? 1) === 1,
          isUnitOnHold: Number(rows[0].isUnitOnHold ?? 0) === 1,
          workCompleted: Number(rows[0].workCompleted ?? 0) === 1,
          qaQcId: rows[0].qaQcId ?? null,
        }
      : null;
  }
}
