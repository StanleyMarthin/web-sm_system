import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  GalleryActualStatus,
  GalleryPhotoRecord,
  GalleryPhotoSource,
  GalleryPhotoType,
  GalleryQuery,
  GalleryRecord,
} from "@smsystem/contracts/gallery";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface GalleryListParams extends ScopeParams {
  query: GalleryQuery;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface OptionRow extends RowDataPacket {
  value: string | number | null;
  label: string | null;
}

interface GalleryRowPacket extends RowDataPacket {
  actualId: string;
  planId: string;
  countdownId: string;
  workDate: string;
  latestPhotoAt: string | null;
  carId: string;
  unitName: string | null;
  customerName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  panelName: string | null;
  partName: string | null;
  jobTypeId: string | null;
  jobName: string | null;
  jobDescription: string | null;
  employeeId: string | null;
  employeeName: string | null;
  actualStatus: GalleryActualStatus;
  countdownStatus: string | null;
  progressPercent: number | null;
  photoCount: number | null;
  beforeCount: number | null;
  processCount: number | null;
  afterCount: number | null;
  defectCount: number | null;
  submittedToLedger: number | boolean | null;
}

interface GalleryPhotoRowPacket extends RowDataPacket {
  photoId: string;
  actualId: string;
  photoType: GalleryPhotoType;
  photoUrl: string;
  caption: string | null;
  source: GalleryPhotoSource;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  canEdit: number | boolean | null;
  canDelete: number | boolean | null;
}

interface GalleryActualContextRow extends RowDataPacket {
  actualId: string;
  planId: string;
  countdownId: string;
  carId: string;
  unitName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelName: string | null;
  partName: string | null;
  jobName: string | null;
  jobDescription: string | null;
  employeeId: string | null;
  employeeName: string | null;
  workDate: string;
  actualStatus: GalleryActualStatus;
  countdownStatus: string | null;
  submittedToLedger: number | boolean | null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapGalleryRow(row: GalleryRowPacket): GalleryRecord {
  return {
    actualId: row.actualId,
    planId: row.planId,
    countdownId: row.countdownId,
    workDate: row.workDate,
    latestPhotoAt: row.latestPhotoAt,
    carId: row.carId,
    unitName: row.unitName ?? row.carId,
    customerName: row.customerName,
    divisionId: row.divisionId,
    divisionName: row.divisionName ?? "-",
    panelId: row.panelId,
    panelName: row.panelName ?? "-",
    partName: row.partName ?? "-",
    jobTypeId: row.jobTypeId,
    jobName: row.jobName ?? "-",
    jobDescription: row.jobDescription ?? "-",
    employeeId: row.employeeId,
    employeeName: row.employeeName ?? "-",
    actualStatus: row.actualStatus,
    countdownStatus: row.countdownStatus ?? "PLAN",
    progressPercent: toNumber(row.progressPercent),
    photoCount: Math.trunc(toNumber(row.photoCount)),
    beforeCount: Math.trunc(toNumber(row.beforeCount)),
    processCount: Math.trunc(toNumber(row.processCount)),
    afterCount: Math.trunc(toNumber(row.afterCount)),
    defectCount: Math.trunc(toNumber(row.defectCount)),
    submittedToLedger: toBoolean(row.submittedToLedger),
  };
}

function mapGalleryPhotoRow(row: GalleryPhotoRowPacket): GalleryPhotoRecord {
  return {
    photoId: row.photoId,
    actualId: row.actualId,
    photoType: row.photoType,
    photoUrl: row.photoUrl,
    caption: row.caption,
    source: row.source,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName,
    uploadedAt: row.uploadedAt,
    canEdit: toBoolean(row.canEdit),
    canDelete: toBoolean(row.canDelete),
  };
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

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = c.id
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
      `cd.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`,
    );
    params.push(...scope.divisionIds);
  }

  if (scope.unitIds.length > 0) {
    clauses.push(`cd.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
    params.push(...scope.unitIds);
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildGalleryFilterClauses(query: GalleryQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        c.id LIKE ?
        OR c.unit_name LIKE ?
        OR COALESCE(mp.panel_name, '') LIKE ?
        OR COALESCE(mp.name_part, '') LIKE ?
        OR COALESCE(cd.section_name, '') LIKE ?
        OR COALESCE(mjt.job_name, '') LIKE ?
        OR COALESCE(p.jobdescription, '') LIKE ?
        OR COALESCE(e.full_name, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value, value, value, value);
  }

  if (query.unitId) {
    clauses.push("c.id = ?");
    params.push(query.unitId);
  }

  if (query.divisionId) {
    clauses.push("cd.division_id = ?");
    params.push(Number.parseInt(query.divisionId, 10));
  }

  if (query.panelId) {
    clauses.push("cd.panel_id = ?");
    params.push(Number.parseInt(query.panelId, 10));
  }

  if (query.status) {
    clauses.push("a.status = ?");
    params.push(query.status);
  }

  if (query.part) {
    clauses.push("COALESCE(cd.section_name, '') LIKE ?");
    params.push(`%${query.part}%`);
  }

  if (query.jobSearch) {
    const value = `%${query.jobSearch}%`;
    clauses.push(
      "(COALESCE(mjt.job_name, '') LIKE ? OR COALESCE(p.jobdescription, '') LIKE ?)",
    );
    params.push(value, value);
  }

  return clauses;
}

function buildOrderBy(sortBy: GalleryQuery["sortBy"], direction: GalleryQuery["sortDirection"]) {
  const columnMap: Record<GalleryQuery["sortBy"], string> = {
    latestPhotoAt: "COALESCE(photo_agg.latestPhotoAt, a.start_time, a.created_at)",
    workDate: "COALESCE(DATE(a.start_time), p.task_date, DATE(a.created_at))",
    unitName: "c.unit_name",
    panelName: "COALESCE(mp.panel_name, mp.name_part, '-')",
    partName: "COALESCE(cd.section_name, '-')",
    jobName: "COALESCE(mjt.job_name, '-')",
    jobDescription: "COALESCE(p.jobdescription, '-')",
    employeeName: "COALESCE(e.full_name, '-')",
    actualStatus: "a.status",
    photoCount: "COALESCE(photo_agg.photoCount, 0)",
  };

  return `${columnMap[sortBy]} ${direction.toUpperCase()}, c.unit_name ASC, a.created_at DESC`;
}

export interface GalleryPhotoContext {
  actualId: string;
  planId: string;
  countdownId: string;
  carId: string;
  unitName: string;
  divisionId: number | null;
  divisionName: string;
  panelName: string;
  partName: string;
  jobName: string;
  jobDescription: string;
  employeeId: string | null;
  employeeName: string;
  workDate: string;
  actualStatus: GalleryActualStatus;
  countdownStatus: string;
  submittedToLedger: boolean;
}

export interface GalleryReferences {
  units: Array<{ value: string; label: string }>;
  divisions: Array<{ value: string; label: string }>;
  panels: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
}

export interface GalleryRepository {
  listRows(params: GalleryListParams): Promise<{ rows: GalleryRecord[]; total: number }>;
  listReferences(params: ScopeParams & { date: string }): Promise<GalleryReferences>;
  getActualContext(params: ScopeParams & { actualId: string }): Promise<GalleryPhotoContext | null>;
  listPhotosByActualId(params: ScopeParams & { actualId: string }): Promise<GalleryPhotoRecord[]>;
  findPhotoById(params: ScopeParams & { photoId: string }): Promise<GalleryPhotoRecord | null>;
  createPhoto(input: {
    actualId: string;
    photoType: GalleryPhotoType;
    photoUrl: string;
    caption?: string | null;
    uploadedBy: string;
    uploadedByName: string;
  }): Promise<GalleryPhotoRecord>;
  updatePhoto(
    photoId: string,
    input: {
      photoType?: GalleryPhotoType;
      photoUrl?: string;
      caption?: string | null;
    },
  ): Promise<GalleryPhotoRecord>;
  deletePhoto(photoId: string): Promise<void>;
}

export class MySqlGalleryRepository implements GalleryRepository {
  private readonly coreDb = getApiEnv().CORE_DB_NAME;
  private readonly tables = {
    actual: qualifyTable(this.coreDb, "sm_jobdesc_actual"),
    plan: qualifyTable(this.coreDb, "sm_jobdesc_plan"),
    countdown: qualifyTable(this.coreDb, "sm_jobdesc_countdown"),
    cars: qualifyTable(this.coreDb, "cars"),
    divisions: qualifyTable(this.coreDb, "sm_divisi"),
    panels: qualifyTable(this.coreDb, "master_panels"),
    jobTypes: qualifyTable(this.coreDb, "master_job_types"),
    employees: qualifyTable(this.coreDb, "sm_employee"),
    tempPhotos: qualifyTable(this.coreDb, "sm_work_photos_temp"),
    ledger: qualifyTable(this.coreDb, "sm_work_ledger"),
    ledgerPhotos: qualifyTable(this.coreDb, "sm_work_ledger_photos"),
  };

  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async listRows(params: GalleryListParams) {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [params.query.date];
    const whereClauses = [
      "COALESCE(DATE(a.start_time), p.task_date, DATE(a.created_at)) = ?",
    ];

    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    whereClauses.push(...buildGalleryFilterClauses(params.query, whereParams));
    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.panels} mp ON mp.id = cd.panel_id
        LEFT JOIN ${this.tables.jobTypes} mjt ON mjt.id = cd.job_type_id
        LEFT JOIN ${this.tables.employees} e ON e.employee_id = p.assigned_user_id
        ${whereSql}
      `,
      whereParams,
    )) as [CountRow[], unknown];

    const dataParams = [...whereParams, params.query.limit, (params.query.page - 1) * params.query.limit];

    const [rows] = (await pool.query(
      `
        SELECT
          a.id AS actualId,
          p.id AS planId,
          cd.id AS countdownId,
          DATE_FORMAT(COALESCE(DATE(a.start_time), p.task_date, DATE(a.created_at)), '%Y-%m-%d') AS workDate,
          DATE_FORMAT(photo_agg.latestPhotoAt, '%Y-%m-%d %H:%i:%s') AS latestPhotoAt,
          c.id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          cd.division_id AS divisionId,
          d.name AS divisionName,
          cd.panel_id AS panelId,
          COALESCE(mp.panel_name, mp.name_part, '-') AS panelName,
          COALESCE(cd.section_name, '-') AS partName,
          cd.job_type_id AS jobTypeId,
          COALESCE(mjt.job_name, '-') AS jobName,
          COALESCE(p.jobdescription, '-') AS jobDescription,
          p.assigned_user_id AS employeeId,
          COALESCE(e.full_name, '-') AS employeeName,
          a.status AS actualStatus,
          COALESCE(cd.status, 'PLAN') AS countdownStatus,
          ROUND(COALESCE(a.progres, 0), 2) AS progressPercent,
          COALESCE(photo_agg.photoCount, 0) AS photoCount,
          COALESCE(photo_agg.beforeCount, 0) AS beforeCount,
          COALESCE(photo_agg.processCount, 0) AS processCount,
          COALESCE(photo_agg.afterCount, 0) AS afterCount,
          COALESCE(photo_agg.defectCount, 0) AS defectCount,
          COALESCE(a.submitted_to_ledger, 0) AS submittedToLedger
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        LEFT JOIN ${this.tables.panels} mp ON mp.id = cd.panel_id
        LEFT JOIN ${this.tables.jobTypes} mjt ON mjt.id = cd.job_type_id
        LEFT JOIN ${this.tables.employees} e ON e.employee_id = p.assigned_user_id
        LEFT JOIN (
          SELECT
            photo_source.actualId,
            MAX(photo_source.photoAt) AS latestPhotoAt,
            COUNT(*) AS photoCount,
            SUM(CASE WHEN photo_source.photoType = 'BEFORE' THEN 1 ELSE 0 END) AS beforeCount,
            SUM(CASE WHEN photo_source.photoType = 'PROCESS' THEN 1 ELSE 0 END) AS processCount,
            SUM(CASE WHEN photo_source.photoType = 'AFTER' THEN 1 ELSE 0 END) AS afterCount,
            SUM(CASE WHEN photo_source.photoType = 'DEFECT' THEN 1 ELSE 0 END) AS defectCount
          FROM (
            SELECT
              tp.actual_id AS actualId,
              tp.photo_type AS photoType,
              COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP) AS photoAt
            FROM ${this.tables.tempPhotos} tp
            UNION ALL
            SELECT
              wl.actual_id AS actualId,
              lp.photo_type AS photoType,
              COALESCE(lp.taken_at, lp.created_at) AS photoAt
            FROM ${this.tables.ledgerPhotos} lp
            JOIN ${this.tables.ledger} wl ON wl.id = lp.ledger_id
          ) photo_source
          GROUP BY photo_source.actualId
        ) photo_agg ON photo_agg.actualId = a.id
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      dataParams,
    )) as [GalleryRowPacket[], unknown];

    return {
      rows: rows.map(mapGalleryRow),
      total: countRows[0]?.total ?? 0,
    };
  }

  async listReferences(params: ScopeParams & { date: string }) {
    const pool = this.poolFactory();
    const statusOptions = [
      { value: "pending", label: "Menunggu" },
      { value: "onprogress", label: "Sedang dikerjakan" },
      { value: "done", label: "Selesai" },
      { value: "cancel", label: "Dibatalkan" },
    ];

    const baseParams: unknown[] = [params.date];
    const baseClauses = [
      "COALESCE(DATE(a.start_time), p.task_date, DATE(a.created_at)) = ?",
    ];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, baseParams);
    if (scopeClause) {
      baseClauses.push(scopeClause);
    }
    const whereSql = `WHERE ${baseClauses.join(" AND ")}`;

    const [unitRows] = (await pool.query(
      `
        SELECT DISTINCT c.id AS value, c.unit_name AS label
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        ${whereSql}
        ORDER BY c.unit_name ASC
      `,
      baseParams,
    )) as [OptionRow[], unknown];

    const [panelRows] = (await pool.query(
      `
        SELECT DISTINCT cd.panel_id AS value, COALESCE(mp.panel_name, mp.name_part) AS label
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        LEFT JOIN ${this.tables.panels} mp ON mp.id = cd.panel_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        ${whereSql}
          AND cd.panel_id IS NOT NULL
        ORDER BY COALESCE(mp.panel_name, mp.name_part) ASC
      `,
      baseParams,
    )) as [OptionRow[], unknown];

    const [divisionRows] = (await pool.query(
      `
        SELECT DISTINCT cd.division_id AS value, d.name AS label
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        ${whereSql}
          AND cd.division_id IS NOT NULL
        ORDER BY d.name ASC
      `,
      baseParams,
    )) as [OptionRow[], unknown];

    return {
      units: unitRows
        .filter((row) => row.value && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
      divisions: divisionRows
        .filter((row) => row.value && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
      panels: panelRows
        .filter((row) => row.value && row.label)
        .map((row) => ({ value: String(row.value), label: String(row.label) })),
      statuses: statusOptions,
    };
  }

  async getActualContext(params: ScopeParams & { actualId: string }) {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.actualId];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams);
    const whereClauses = ["a.id = ?"];
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    const [rows] = (await pool.query(
      `
        SELECT
          a.id AS actualId,
          p.id AS planId,
          cd.id AS countdownId,
          c.id AS carId,
          c.unit_name AS unitName,
          cd.division_id AS divisionId,
          COALESCE(d.name, '-') AS divisionName,
          COALESCE(mp.panel_name, mp.name_part, '-') AS panelName,
          COALESCE(cd.section_name, '-') AS partName,
          COALESCE(mjt.job_name, '-') AS jobName,
          COALESCE(p.jobdescription, '-') AS jobDescription,
          p.assigned_user_id AS employeeId,
          COALESCE(e.full_name, '-') AS employeeName,
          DATE_FORMAT(COALESCE(DATE(a.start_time), p.task_date, DATE(a.created_at)), '%Y-%m-%d') AS workDate,
          a.status AS actualStatus,
          COALESCE(cd.status, 'PLAN') AS countdownStatus,
          COALESCE(a.submitted_to_ledger, 0) AS submittedToLedger
        FROM ${this.tables.actual} a
        JOIN ${this.tables.plan} p ON p.id = a.plandaily_id
        JOIN ${this.tables.countdown} cd ON cd.id = p.core_id
        JOIN ${this.tables.cars} c ON c.id = cd.car_id
        LEFT JOIN ${this.tables.divisions} d ON d.id = cd.division_id
        LEFT JOIN ${this.tables.panels} mp ON mp.id = cd.panel_id
        LEFT JOIN ${this.tables.jobTypes} mjt ON mjt.id = cd.job_type_id
        LEFT JOIN ${this.tables.employees} e ON e.employee_id = p.assigned_user_id
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    )) as [GalleryActualContextRow[], unknown];

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      actualId: row.actualId,
      planId: row.planId,
      countdownId: row.countdownId,
      carId: row.carId,
      unitName: row.unitName ?? row.carId,
      divisionId: row.divisionId,
      divisionName: row.divisionName ?? "-",
      panelName: row.panelName ?? "-",
      partName: row.partName ?? "-",
      jobName: row.jobName ?? "-",
      jobDescription: row.jobDescription ?? "-",
      employeeId: row.employeeId,
      employeeName: row.employeeName ?? "-",
      workDate: row.workDate,
      actualStatus: row.actualStatus,
      countdownStatus: row.countdownStatus ?? "PLAN",
      submittedToLedger: toBoolean(row.submittedToLedger),
    };
  }

  async listPhotosByActualId(params: ScopeParams & { actualId: string }) {
    const context = await this.getActualContext(params);
    if (!context) {
      return [];
    }

    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT *
        FROM (
          SELECT
            tp.id AS photoId,
            tp.actual_id AS actualId,
            tp.photo_type AS photoType,
            tp.photo_url AS photoUrl,
            tp.caption AS caption,
            'TEMP' AS source,
            tp.uploaded_by AS uploadedBy,
            uploader.full_name AS uploadedByName,
            DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
            1 AS canEdit,
            1 AS canDelete
          FROM ${this.tables.tempPhotos} tp
          LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = tp.uploaded_by
          WHERE tp.actual_id = ?
          UNION ALL
          SELECT
            lp.id AS photoId,
            wl.actual_id AS actualId,
            lp.photo_type AS photoType,
            lp.photo_url AS photoUrl,
            lp.caption AS caption,
            'LEDGER' AS source,
            lp.taken_by AS uploadedBy,
            COALESCE(lp.taken_by_name, uploader.full_name) AS uploadedByName,
            DATE_FORMAT(COALESCE(lp.taken_at, lp.created_at), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
            0 AS canEdit,
            0 AS canDelete
          FROM ${this.tables.ledgerPhotos} lp
          JOIN ${this.tables.ledger} wl ON wl.id = lp.ledger_id
          LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = lp.taken_by
          WHERE wl.actual_id = ?
        ) gallery_photo
        ORDER BY uploadedAt DESC, photoType ASC
      `,
      [params.actualId, params.actualId],
    )) as [GalleryPhotoRowPacket[], unknown];

    return rows.map(mapGalleryPhotoRow);
  }

  async findPhotoById(params: ScopeParams & { photoId: string }) {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT *
        FROM (
          SELECT
            tp.id AS photoId,
            tp.actual_id AS actualId,
            tp.photo_type AS photoType,
            tp.photo_url AS photoUrl,
            tp.caption AS caption,
            'TEMP' AS source,
            tp.uploaded_by AS uploadedBy,
            uploader.full_name AS uploadedByName,
            DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
            1 AS canEdit,
            1 AS canDelete
          FROM ${this.tables.tempPhotos} tp
          LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = tp.uploaded_by
          WHERE tp.id = ?
          UNION ALL
          SELECT
            lp.id AS photoId,
            wl.actual_id AS actualId,
            lp.photo_type AS photoType,
            lp.photo_url AS photoUrl,
            lp.caption AS caption,
            'LEDGER' AS source,
            lp.taken_by AS uploadedBy,
            COALESCE(lp.taken_by_name, uploader.full_name) AS uploadedByName,
            DATE_FORMAT(COALESCE(lp.taken_at, lp.created_at), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
            0 AS canEdit,
            0 AS canDelete
          FROM ${this.tables.ledgerPhotos} lp
          JOIN ${this.tables.ledger} wl ON wl.id = lp.ledger_id
          LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = lp.taken_by
          WHERE lp.id = ?
        ) gallery_photo
        LIMIT 1
      `,
      [params.photoId, params.photoId],
    )) as [GalleryPhotoRowPacket[], unknown];

    const row = rows[0];
    if (!row) {
      return null;
    }

    const context = await this.getActualContext({
      employeeId: params.employeeId,
      scope: params.scope,
      actualId: row.actualId,
    });

    if (!context) {
      return null;
    }

    return mapGalleryPhotoRow(row);
  }

  async createPhoto(input: {
    actualId: string;
    photoType: GalleryPhotoType;
    photoUrl: string;
    caption?: string | null;
    uploadedBy: string;
    uploadedByName: string;
  }) {
    const pool = this.poolFactory();
    const photoId = randomUUID();
    await pool.execute(
      `
        INSERT INTO ${this.tables.tempPhotos} (
          id,
          actual_id,
          photo_type,
          photo_url,
          caption,
          is_before_fulfilled,
          uploaded_by,
          uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        photoId,
        input.actualId,
        input.photoType,
        input.photoUrl,
        input.caption ?? null,
        input.photoType === "BEFORE" ? 1 : 0,
        input.uploadedBy,
      ],
    );

    const [rows] = (await pool.query(
      `
        SELECT
          tp.id AS photoId,
          tp.actual_id AS actualId,
          tp.photo_type AS photoType,
          tp.photo_url AS photoUrl,
          tp.caption AS caption,
          'TEMP' AS source,
          tp.uploaded_by AS uploadedBy,
          ? AS uploadedByName,
          DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
          1 AS canEdit,
          1 AS canDelete
        FROM ${this.tables.tempPhotos} tp
        WHERE tp.id = ?
        LIMIT 1
      `,
      [input.uploadedByName, photoId],
    )) as [GalleryPhotoRowPacket[], unknown];

    return mapGalleryPhotoRow(rows[0]!);
  }

  async updatePhoto(
    photoId: string,
    input: {
      photoType?: GalleryPhotoType;
      photoUrl?: string;
      caption?: string | null;
    },
  ) {
    const pool = this.poolFactory();
    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (input.photoType !== undefined) {
      updates.push("photo_type = ?");
      values.push(input.photoType);
      updates.push("is_before_fulfilled = ?");
      values.push(input.photoType === "BEFORE" ? 1 : 0);
    }

    if (input.photoUrl !== undefined) {
      updates.push("photo_url = ?");
      values.push(input.photoUrl);
    }

    if (input.caption !== undefined) {
      updates.push("caption = ?");
      values.push(input.caption);
    }

    if (updates.length === 0) {
      const [rows] = (await pool.query(
        `
          SELECT
            tp.id AS photoId,
            tp.actual_id AS actualId,
            tp.photo_type AS photoType,
            tp.photo_url AS photoUrl,
            tp.caption AS caption,
            'TEMP' AS source,
            tp.uploaded_by AS uploadedBy,
            uploader.full_name AS uploadedByName,
            DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
            1 AS canEdit,
            1 AS canDelete
          FROM ${this.tables.tempPhotos} tp
          LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = tp.uploaded_by
          WHERE tp.id = ?
          LIMIT 1
        `,
        [photoId],
      )) as [GalleryPhotoRowPacket[], unknown];
      return mapGalleryPhotoRow(rows[0]!);
    }

    values.push(photoId);
    await pool.execute(
      `
        UPDATE ${this.tables.tempPhotos}
        SET ${updates.join(", ")}
        WHERE id = ?
      `,
      values,
    );

    const [rows] = (await pool.query(
      `
        SELECT
          tp.id AS photoId,
          tp.actual_id AS actualId,
          tp.photo_type AS photoType,
          tp.photo_url AS photoUrl,
          tp.caption AS caption,
          'TEMP' AS source,
          tp.uploaded_by AS uploadedBy,
          uploader.full_name AS uploadedByName,
          DATE_FORMAT(COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP), '%Y-%m-%d %H:%i:%s') AS uploadedAt,
          1 AS canEdit,
          1 AS canDelete
        FROM ${this.tables.tempPhotos} tp
        LEFT JOIN ${this.tables.employees} uploader ON uploader.employee_id = tp.uploaded_by
        WHERE tp.id = ?
        LIMIT 1
      `,
      [photoId],
    )) as [GalleryPhotoRowPacket[], unknown];

    return mapGalleryPhotoRow(rows[0]!);
  }

  async deletePhoto(photoId: string) {
    const pool = this.poolFactory();
    await pool.execute(
      `
        DELETE FROM ${this.tables.tempPhotos}
        WHERE id = ?
      `,
      [photoId],
    );
  }
}
