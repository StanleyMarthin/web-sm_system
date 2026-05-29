import type {
  QaDashboardSummary,
  QaGridQuery,
  QaInspectionRecord,
  QaUpdateInspectionRequest,
} from "@smsystem/contracts/qa";
import type { AuthScope } from "@smsystem/contracts/auth";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface QaListParams extends ScopeParams {
  query: QaGridQuery;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface OptionRow extends RowDataPacket {
  value: string | number;
  label: string;
}

interface QaInspectionRow extends RowDataPacket {
  qcId: string;
  coreId: string;
  carId: string;
  inspectionDate: string;
  unitName: string;
  divisionId: number | null;
  divisionName: string | null;
  panelName: string | null;
  jobName: string;
  inspectorId: string | null;
  inspectorName: string | null;
  resultStatus: "LOLOS" | "TIDAK_LOLOS";
  qcNotes: string | null;
  photoBeforeUrl: string | null;
  evidencePhotoUrl: string | null;
  issueType: QaInspectionRecord["issueType"];
  issueArea: QaInspectionRecord["issueArea"];
  issueCause: string | null;
  priorityLevel: QaInspectionRecord["priorityLevel"];
  recommendation: string | null;
  followupStatus: QaInspectionRecord["followupStatus"];
}

interface ColumnRow extends RowDataPacket {
  Field: string;
}

interface DashboardCountRow extends RowDataPacket {
  totalInspectionsThisMonth: number;
  passedCount: number;
  openFindingsCount: number;
}

interface DivisionRejectRow extends RowDataPacket {
  divisionName: string | null;
  rejectCount: number;
}

interface IssueAreaRow extends RowDataPacket {
  issueArea: NonNullable<QaInspectionRecord["issueArea"]>;
  total: number;
}

export interface QaRepository {
  listInspections(params: QaListParams): Promise<{
    rows: QaInspectionRecord[];
    total: number;
    references: {
      divisions: Array<{ value: string; label: string }>;
      resultStatuses: Array<{ value: string; label: string }>;
      priorityLevels: Array<{ value: string; label: string }>;
      followupStatuses: Array<{ value: string; label: string }>;
      issueTypes: Array<{ value: string; label: string }>;
      issueAreas: Array<{ value: string; label: string }>;
    };
    dashboard: QaDashboardSummary;
  }>;
  updateInspectionAnalysis(
    params: ScopeParams & { qcId: string; payload: QaUpdateInspectionRequest },
  ): Promise<QaInspectionRecord | null>;
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
    clauses.push(`${aliases.divisionId} IN (${scope.divisionIds.map(() => "?").join(", ")})`);
    params.push(...scope.divisionIds);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function toOptions(rows: OptionRow[]): Array<{ label: string; value: string }> {
  return rows.map((row) => ({ label: row.label, value: String(row.value) }));
}

function normalizeNullableEnum<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
): T | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase() as T;
  return allowedValues.includes(normalized) ? normalized : null;
}

function mapRow(row: QaInspectionRow): QaInspectionRecord {
  return {
    qcId: row.qcId,
    coreId: row.coreId,
    carId: row.carId,
    inspectionDate: row.inspectionDate,
    unitName: row.unitName,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    panelName: row.panelName,
    jobName: row.jobName,
    inspectorId: row.inspectorId,
    inspectorName: row.inspectorName,
    resultStatus: row.resultStatus,
    qcNotes: row.qcNotes,
    photoBeforeUrl: row.photoBeforeUrl,
    evidencePhotoUrl: row.evidencePhotoUrl,
    issueType: normalizeNullableEnum(row.issueType, [
      "PENGERJAAN",
      "FUNGSI",
      "MATERIAL",
      "KOMPONEN",
      "FINISHING",
      "LAINNYA",
    ]),
    issueArea: normalizeNullableEnum(row.issueArea, [
      "MEKANIK",
      "BODI",
      "INTERIOR",
      "ELECTRICAL",
      "PAINTING",
      "AKSESORIS",
      "LAINNYA",
    ]),
    issueCause: row.issueCause,
    priorityLevel: normalizeNullableEnum(row.priorityLevel, ["LOW", "MEDIUM", "HIGH"]),
    recommendation: row.recommendation,
    followupStatus: normalizeNullableEnum(row.followupStatus, ["OPEN", "CLOSED"]),
  };
}

function hasColumn(columns: Set<string>, columnName: string) {
  return columns.has(columnName.toLowerCase());
}

function qcColumn(columns: Set<string>, columnName: string, fallback = "NULL") {
  return hasColumn(columns, columnName) ? `qc.${columnName}` : fallback;
}

function inspectionDateExpression(columns: Set<string>) {
  if (hasColumn(columns, "inspection_date")) return "qc.inspection_date";
  if (hasColumn(columns, "created_at")) return "qc.created_at";
  if (hasColumn(columns, "updated_at")) return "qc.updated_at";
  return "CURRENT_TIMESTAMP()";
}

function followupStatusExpression(columns: Set<string>) {
  return qcColumn(columns, "followup_status", "NULL");
}

function issueAreaExpression(columns: Set<string>) {
  return qcColumn(columns, "issue_area", "NULL");
}

function priorityLevelExpression(columns: Set<string>) {
  return qcColumn(columns, "priority_level", "NULL");
}

function buildOrderBy(columns: Set<string>, sortBy: string, direction: "asc" | "desc") {
  const columnMap: Record<string, string> = {
    inspectionDate: inspectionDateExpression(columns),
    unitName: "c.unit_name",
    divisionName: "d.name",
    jobName: "COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category)",
    resultStatus: "qc.result_status",
    priorityLevel: priorityLevelExpression(columns),
    followupStatus: followupStatusExpression(columns),
  };

  return `${columnMap[sortBy] ?? inspectionDateExpression(columns)} ${direction.toUpperCase()}, qc.id DESC`;
}

function buildSearchClause(query: QaGridQuery, params: unknown[]): string[] {
  if (!query.search) {
    return [];
  }

  const value = `%${query.search}%`;
  params.push(value, value, value, value, value);
  return [
    `(
      c.unit_name LIKE ?
      OR COALESCE(d.name, '') LIKE ?
      OR COALESCE(cd.section_name, mp.name, '') LIKE ?
      OR COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) LIKE ?
      OR COALESCE(emp.full_name, '') LIKE ?
    )`,
  ];
}

function buildFilterClauses(columns: Set<string>, query: QaGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  for (const filter of query.filters) {
    if (filter.field === "divisionId") {
      clauses.push("cd.division_id = ?");
      params.push(Number.parseInt(filter.value, 10));
      continue;
    }
    if (filter.field === "resultStatus") {
      clauses.push("qc.result_status = ?");
      params.push(filter.value);
      continue;
    }
    if (filter.field === "priorityLevel") {
      if (!hasColumn(columns, "priority_level")) continue;
      clauses.push(`${priorityLevelExpression(columns)} = ?`);
      params.push(filter.value);
      continue;
    }
    if (filter.field === "followupStatus") {
      if (!hasColumn(columns, "followup_status")) continue;
      clauses.push(`${followupStatusExpression(columns)} = ?`);
      params.push(filter.value);
      continue;
    }
    if (filter.field === "unitId") {
      clauses.push("cd.car_id = ?");
      params.push(Number.parseInt(filter.value, 10) || filter.value);
      continue;
    }
    if (filter.field === "issueArea") {
      if (!hasColumn(columns, "issue_area")) continue;
      clauses.push(`${issueAreaExpression(columns)} = ?`);
      params.push(filter.value);
      continue;
    }
    if (filter.field === "dateFrom") {
      clauses.push(`DATE(${inspectionDateExpression(columns)}) >= ?`);
      params.push(filter.value);
      continue;
    }
    if (filter.field === "dateTo") {
      clauses.push(`DATE(${inspectionDateExpression(columns)}) <= ?`);
      params.push(filter.value);
    }
  }

  return clauses;
}

function baseFromSql(columns: Set<string>) {
  return `
    FROM sm_qc_inspections qc
    JOIN sm_jobdesc_countdown cd ON cd.id = qc.core_id
    JOIN cars c ON c.id = cd.car_id
    LEFT JOIN sm_divisi d ON d.id = cd.division_id
    LEFT JOIN master_panels mp ON mp.id = cd.panel_id
    LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
    LEFT JOIN sm_jobdesc_wo wo ON wo.id = cd.ref_taks_id
    LEFT JOIN sm_employee emp ON ${hasColumn(columns, "inspector_id") ? "emp.employee_id = qc.inspector_id" : "1 = 0"}
  `;
}

function baseSelectSql(columns: Set<string>) {
  return `
    SELECT
      qc.id AS qcId,
      qc.core_id AS coreId,
      c.id AS carId,
      DATE_FORMAT(${inspectionDateExpression(columns)}, '%Y-%m-%d %H:%i:%s') AS inspectionDate,
      c.unit_name AS unitName,
      cd.division_id AS divisionId,
      d.name AS divisionName,
      COALESCE(cd.section_name, mp.name) AS panelName,
      COALESCE(wo.job_detail, jt.job_name, cd.section_name, cd.task_category) AS jobName,
      ${qcColumn(columns, "inspector_id")} AS inspectorId,
      emp.full_name AS inspectorName,
      qc.result_status AS resultStatus,
      qc.qc_notes AS qcNotes,
      ${qcColumn(columns, "photo_before_url")} AS photoBeforeUrl,
      ${qcColumn(columns, "evidence_photo_url")} AS evidencePhotoUrl,
      ${qcColumn(columns, "issue_type")} AS issueType,
      ${issueAreaExpression(columns)} AS issueArea,
      ${qcColumn(columns, "issue_cause")} AS issueCause,
      ${priorityLevelExpression(columns)} AS priorityLevel,
      ${qcColumn(columns, "recommendation")} AS recommendation,
      ${followupStatusExpression(columns)} AS followupStatus
    ${baseFromSql(columns)}
  `;
}

export class MySqlQaRepository implements QaRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  private async getInspectionColumns(pool: Pool) {
    const [rows] = await pool.query<ColumnRow[]>("SHOW COLUMNS FROM sm_qc_inspections");
    return new Set(rows.map((row) => row.Field.toLowerCase()));
  }

  async listInspections(params: QaListParams) {
    const pool = this.poolFactory();
    const columns = await this.getInspectionColumns(pool);
    const queryParams: unknown[] = [];
    const whereClauses = ["qc.result_status IN ('LOLOS', 'TIDAK_LOLOS')"];

    const scopeWhere = buildScopeWhereClause(params.scope, params.employeeId, queryParams, {
      carId: "cd.car_id",
      divisionId: "cd.division_id",
    });
    if (scopeWhere) whereClauses.push(scopeWhere);
    whereClauses.push(...buildSearchClause(params.query, queryParams));
    whereClauses.push(...buildFilterClauses(columns, params.query, queryParams));
    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const limit = Math.min(Math.max(params.query.limit, 1), 100);
    const offset = (params.query.page - 1) * limit;

    const [rowResult, countResult, referencesResult, dashboardCountResult, topRejectResult, areaResult, criticalResult] =
      await Promise.all([
        pool.query(
          `
            ${baseSelectSql(columns)}
            ${whereSql}
            ORDER BY ${buildOrderBy(columns, params.query.sortBy, params.query.sortDirection)}
            LIMIT ?
            OFFSET ?
          `,
          [...queryParams, limit, offset],
        ),
        pool.query<CountRow[]>(
          `
            SELECT COUNT(*) AS total
            ${baseFromSql(columns)}
            ${whereSql}
          `,
          queryParams,
        ),
        pool.query<OptionRow[]>(
          `
            SELECT DISTINCT d.id AS value, d.name AS label
            ${baseFromSql(columns)}
            ${whereSql}
            AND d.id IS NOT NULL
            ORDER BY d.name
          `,
          queryParams,
        ),
        pool.query<DashboardCountRow[]>(
          `
            SELECT
              COUNT(*) AS totalInspectionsThisMonth,
              SUM(
                CASE
                  WHEN qc.result_status = 'LOLOS'
                  THEN 1 ELSE 0
                END
              ) AS passedCount,
              SUM(
                CASE
                  WHEN qc.result_status = 'TIDAK_LOLOS'
                    AND COALESCE(${followupStatusExpression(columns)}, 'OPEN') = 'OPEN'
                  THEN 1 ELSE 0
                END
              ) AS openFindingsCount
            ${baseFromSql(columns)}
            ${whereSql}
          `,
          queryParams,
        ),
        pool.query<DivisionRejectRow[]>(
          `
            SELECT COALESCE(d.name, 'Tanpa Divisi') AS divisionName, COUNT(*) AS rejectCount
            ${baseFromSql(columns)}
            ${whereSql}
            AND qc.result_status = 'TIDAK_LOLOS'
            GROUP BY COALESCE(d.name, 'Tanpa Divisi')
            ORDER BY rejectCount DESC, divisionName ASC
            LIMIT 5
          `,
          queryParams,
        ),
        pool.query<IssueAreaRow[]>(
          `
            SELECT ${issueAreaExpression(columns)} AS issueArea, COUNT(*) AS total
            ${baseFromSql(columns)}
            ${whereSql}
            AND ${issueAreaExpression(columns)} IS NOT NULL
            GROUP BY ${issueAreaExpression(columns)}
            ORDER BY total DESC, ${issueAreaExpression(columns)} ASC
          `,
          queryParams,
        ),
        pool.query<QaInspectionRow[]>(
          `
            ${baseSelectSql(columns)}
            ${whereSql}
            AND qc.result_status = 'TIDAK_LOLOS'
            AND ${priorityLevelExpression(columns)} = 'HIGH'
            AND COALESCE(${followupStatusExpression(columns)}, 'OPEN') = 'OPEN'
            ORDER BY ${inspectionDateExpression(columns)} DESC, qc.id DESC
            LIMIT 8
          `,
          queryParams,
        ),
      ]);

    const unitResult = await pool.query<OptionRow[]>(
      `
        SELECT DISTINCT c.id AS value, c.unit_name AS label
        ${baseFromSql(columns)}
        ${whereSql}
        AND c.id IS NOT NULL
        ORDER BY c.unit_name
      `,
      queryParams,
    );

    const rows = (rowResult[0] as QaInspectionRow[]).map(mapRow);
    const total = Number((countResult[0][0] as CountRow | undefined)?.total ?? 0);
    const dashboardCount = (dashboardCountResult[0][0] as DashboardCountRow | undefined) ?? {
      totalInspectionsThisMonth: 0,
      passedCount: 0,
      openFindingsCount: 0,
    };

    return {
      rows,
      total,
      references: {
        units: toOptions(unitResult[0] as OptionRow[]),
        divisions: toOptions(referencesResult[0] as OptionRow[]),
        resultStatuses: [
          { label: "Lolos", value: "LOLOS" },
          { label: "Tolak", value: "TIDAK_LOLOS" },
        ],
        priorityLevels: [
          { label: "Low", value: "LOW" },
          { label: "Medium", value: "MEDIUM" },
          { label: "High", value: "HIGH" },
        ],
        followupStatuses: [
          { label: "Open", value: "OPEN" },
          { label: "Closed", value: "CLOSED" },
        ],
        issueTypes: [
          { label: "Pengerjaan", value: "PENGERJAAN" },
          { label: "Fungsi", value: "FUNGSI" },
          { label: "Material", value: "MATERIAL" },
          { label: "Komponen", value: "KOMPONEN" },
          { label: "Finishing", value: "FINISHING" },
          { label: "Lainnya", value: "LAINNYA" },
        ],
        issueAreas: [
          { label: "Mekanik", value: "MEKANIK" },
          { label: "Bodi", value: "BODI" },
          { label: "Interior", value: "INTERIOR" },
          { label: "Electrical", value: "ELECTRICAL" },
          { label: "Painting", value: "PAINTING" },
          { label: "Aksesoris", value: "AKSESORIS" },
          { label: "Lainnya", value: "LAINNYA" },
        ],
      },
      dashboard: {
        totalInspectionsThisMonth: Number(dashboardCount.totalInspectionsThisMonth ?? 0),
        firstTimeYieldPercent:
          Number(dashboardCount.totalInspectionsThisMonth ?? 0) > 0
            ? (Number(dashboardCount.passedCount ?? 0) / Number(dashboardCount.totalInspectionsThisMonth ?? 0)) * 100
            : 0,
        openFindingsCount: Number(dashboardCount.openFindingsCount ?? 0),
        topRejectDivisions: (topRejectResult[0] as DivisionRejectRow[]).map((row) => ({
          divisionName: row.divisionName ?? "Tanpa Divisi",
          rejectCount: Number(row.rejectCount ?? 0),
        })),
        issueAreaDistribution: (areaResult[0] as IssueAreaRow[]).map((row) => ({
          issueArea: row.issueArea,
          total: Number(row.total ?? 0),
        })),
        criticalAlerts: (criticalResult[0] as QaInspectionRow[]).map(mapRow),
      },
    };
  }

  async updateInspectionAnalysis(params: ScopeParams & { qcId: string; payload: QaUpdateInspectionRequest }) {
    const pool = this.poolFactory();
    const columns = await this.getInspectionColumns(pool);
    const scopeParams: unknown[] = [params.qcId];
    const clauses = ["qc.id = ?"];
    const scopeWhere = buildScopeWhereClause(params.scope, params.employeeId, scopeParams, {
      carId: "cd.car_id",
      divisionId: "cd.division_id",
    });
    if (scopeWhere) clauses.push(scopeWhere);

    const [existingRows] = await pool.query<QaInspectionRow[]>(
      `
        ${baseSelectSql(columns)}
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      scopeParams,
    );

    if (!existingRows[0]) {
      return null;
    }

    const requiredColumns = [
      "issue_type",
      "issue_area",
      "issue_cause",
      "priority_level",
      "recommendation",
      "followup_status",
    ];
    if (requiredColumns.some((column) => !hasColumn(columns, column))) {
      throw new Error("QA_ANALYTICS_COLUMNS_NOT_READY");
    }

    await pool.execute<ResultSetHeader>(
      `
        UPDATE sm_qc_inspections
        SET issue_type = ?,
            issue_area = ?,
            issue_cause = ?,
            priority_level = ?,
            recommendation = ?,
            followup_status = ?
        WHERE id = ?
      `,
      [
        params.payload.issueType ?? null,
        params.payload.issueArea ?? null,
        params.payload.issueCause ?? null,
        params.payload.priorityLevel ?? null,
        params.payload.recommendation ?? null,
        params.payload.followupStatus ?? null,
        params.qcId,
      ],
    );

    const [updatedRows] = await pool.query<QaInspectionRow[]>(
      `
        ${baseSelectSql(columns)}
        WHERE qc.id = ?
        LIMIT 1
      `,
      [params.qcId],
    );

    return updatedRows[0] ? mapRow(updatedRows[0]) : null;
  }
}
