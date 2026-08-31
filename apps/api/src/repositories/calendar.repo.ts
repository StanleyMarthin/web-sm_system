import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  DivisionCapacitySummary,
  PlanningMaterialStatus,
  PlanDivisionInput,
  PlanOvertimeInput,
  PlanUnitInput,
  WeeklyPlanRecord,
  WeeklyPlanRequest,
  WeeklyWorkConfigRecord,
  WeeklyWorkConfigRequest,
} from "@smsystem/contracts/calendar";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RedisClientType } from "redis";
import { randomUUID } from "node:crypto";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";
import { getRedisClient } from "@/redis/client";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface WeeklyConfigRow extends RowDataPacket {
  configId: string;
  weekStartDate: string;
  weekdayHours: number;
  saturdayHours: number;
  sundayHours: number;
  weekdayOvertimeHours: number;
  saturdayOvertimeHours: number;
  sundayOvertimeHours: number;
  efficiencyFactor: number;
  qcBufferDays: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CapacitySnapshotRow extends RowDataPacket {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number | null;
  activePicCount: number | null;
  openWoCount: number | null;
  openIssueCount: number | null;
  highSeverityIssueCount: number | null;
  latestCountdownUpdateAt: string | null;
  isMargin: number | null;
}

interface DivisionNameRow extends RowDataPacket {
  divisionName: string | null;
}

interface ActivePicRow extends RowDataPacket {
  total: number | null;
}

interface WeeklyPlanRow extends RowDataPacket {
  planId: string;
  weekStartDate: string;
  targetHours: number;
  targetIncome: number | null;
  labourRate: number | null;
  createdBy: string;
  notes: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
}

interface PlanOvertimeRowPacket extends RowDataPacket {
  divisionId: number;
  divisionName: string | null;
  overtimeDate: string;
  dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY";
  overtimeHours: number;
  memberCount: number;
  includeHead: number;
  notes: string | null;
}

interface PlanUnitRowPacket extends RowDataPacket {
  carId: string;
  divisionId: number;
  divisionName: string | null;
  allocatedHours: number;
  priorityRank: number | null;
  notes: string | null;
  unitName: string;
  customerName: string | null;
  isMargin: number | null;
  materialStatus: string | null;
  materialNote: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number | null;
}

interface PlanDivisionInputRowPacket extends RowDataPacket {
  divisionId: number;
  divisionName: string | null;
  memberCount: number;
}

interface LeaveSnapshotSeedRow extends RowDataPacket {
  leaveId: string;
  employeeId: string;
  divisionId: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
}

interface AttendanceSnapshotSeedRow extends RowDataPacket {
  attendanceId: string;
  employeeId: string;
  divisionId: number;
  attendanceStatus: string;
  absenceDate: string;
}

interface DivisionCountRow extends RowDataPacket {
  divisionId: number;
  count: number;
}

interface TechnicalDivisionRow extends RowDataPacket {
  divisionId: number;
  divisionName: string;
}

interface CachedAbsenceLoss {
  count: number;
  rows: Array<{ divisionId: number; lostHours: number }>;
}

interface NonMarginUnitRow extends RowDataPacket {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number | null;
  isMargin: number | null;
  materialStatus: string | null;
  materialNote: string | null;
  lockedDivisionName: string | null;
}

interface PlanningDivisionDemandRowPacket extends RowDataPacket {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  isMargin: number | null;
  divisionId: number;
  divisionName: string | null;
  remainingHours: number | null;
  progressPercent: number | null;
  panelCount: number | null;
  lockedPanelCount: number | null;
  materialStatus: string | null;
  materialNote: string | null;
}

export interface UnitCapacitySnapshot {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number;
  activePicCount: number;
  openWoCount: number;
  openIssueCount: number;
  highSeverityIssueCount: number;
  latestCountdownUpdateAt: string | null;
  isMargin: boolean;
}

export interface PlanOvertimeRow {
  divisionId: number;
  divisionName: string;
  overtimeDate: string;
  dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY";
  overtimeHours: number;
  memberCount: number;
  includeHead: boolean;
  notes: string | null;
}

export interface PlanUnitRow {
  carId: string;
  divisionId: number;
  divisionName: string;
  allocatedHours: number;
  priorityRank: number | null;
  notes: string | null;
  unitName: string;
  customerName: string | null;
  isMargin: boolean;
  materialStatus: PlanningMaterialStatus;
  materialReady: boolean;
  materialNote: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number;
}

export interface PlanningUnitRiskRow {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  remainingHours: number;
  isMargin: boolean;
  materialStatus: PlanningMaterialStatus;
  materialReady: boolean;
  materialNote: string | null;
  lockedDivisionName: string | null;
}

export interface PlanDivisionInputRow {
  divisionId: number;
  divisionName: string;
  memberCount: number;
}

export interface PlanningDivisionDemandRow {
  carId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  isMargin: boolean;
  materialStatus: PlanningMaterialStatus;
  materialReady: boolean;
  materialNote: string | null;
  divisionId: number;
  divisionName: string;
  remainingHours: number;
  progressPercent: number;
  panelCount: number;
  lockedPanelCount: number;
}

export interface CalendarRepository {
  listWeeklyConfigs(startDate?: string, endDate?: string): Promise<WeeklyWorkConfigRecord[]>;
  upsertWeeklyConfig(input: WeeklyWorkConfigRequest & { createdBy: string | null }): Promise<WeeklyWorkConfigRecord>;
  getUnitCapacitySnapshot(params: ScopeParams & { carId: string }): Promise<UnitCapacitySnapshot | null>;
  listDeliveryRiskRows(params: ScopeParams): Promise<UnitCapacitySnapshot[]>;
  countActivePicByDivision?(divisionId: number, date: string): Promise<number>;
  findDivisionName?(divisionId: number): Promise<string>;
  createOrUpdateWeeklyPlan(input: WeeklyPlanRequest & { createdBy: string }): Promise<WeeklyPlanRecord>;
  getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlanRecord | null>;
  getWeeklyPlanById(planId: string): Promise<WeeklyPlanRecord | null>;
  publishWeeklyPlan(planId: string): Promise<void>;
  upsertPlanOvertime(planId: string, rows: PlanOvertimeInput[]): Promise<void>;
  listPlanOvertime(planId: string): Promise<PlanOvertimeRow[]>;
  upsertPlanDivisionInputs(planId: string, rows: PlanDivisionInput[]): Promise<void>;
  listPlanDivisionInputs(planId: string): Promise<PlanDivisionInputRow[]>;
  upsertPlanUnits(planId: string, rows: PlanUnitInput[]): Promise<void>;
  listPlanUnits(planId: string): Promise<PlanUnitRow[]>;
  snapshotAbsenceForWeek(planId: string, weekStartDate: string, weekEndDate: string): Promise<number>;
  countActiveMembersByDivision(weekStartDate: string): Promise<Array<{ divisionId: number; count: number }>>;
  listTechnicalDivisions(): Promise<Array<{ divisionId: number; divisionName: string }>>;
  listAbsenceLossByDivision(planId: string): Promise<Array<{ divisionId: number; lostHours: number }>>;
  upsertCapacityCache(planId: string, rows: DivisionCapacitySummary[]): Promise<void>;
  getCapacityCache(planId: string): Promise<DivisionCapacitySummary[]>;
  listPlanningUnitsForRisk(params: ScopeParams & { weekStartDate: string; weekEndDate: string }): Promise<PlanningUnitRiskRow[]>;
  listPlanningDivisionDemand(params: ScopeParams & { weekStartDate: string; weekEndDate: string }): Promise<PlanningDivisionDemandRow[]>;
}

export interface WeeklyPlanningTempStore {
  getAbsenceLoss(planId: string): Promise<CachedAbsenceLoss | null>;
  setAbsenceLoss(planId: string, value: CachedAbsenceLoss): Promise<void>;
  getCapacity(planId: string): Promise<DivisionCapacitySummary[] | null>;
  setCapacity(planId: string, rows: DivisionCapacitySummary[]): Promise<void>;
}

const DEFAULT_WEEKDAY_HOURS = 8;
const DEFAULT_SATURDAY_HOURS = 5;
const DEFAULT_SUNDAY_HOURS = 0;
const WEEKLY_PLANNING_TEMP_TTL_SECONDS = 60 * 60 * 24 * 30;

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartDate(date: Date): string {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return formatIsoDate(addDays(date, diff));
}

function listIsoDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let cursor = parseIsoDate(startDate); cursor <= parseIsoDate(endDate); cursor = addDays(cursor, 1)) {
    dates.push(formatIsoDate(cursor));
  }
  return dates;
}

function toSqlDateTime(value: string): string {
  return value;
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
      `EXISTS (
        SELECT 1
        FROM sm_jobdesc_countdown cd_scope
        WHERE cd_scope.car_id = c.id
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

function mapWeeklyConfigRow(row: WeeklyConfigRow): WeeklyWorkConfigRecord {
  return {
    configId: row.configId,
    weekStartDate: row.weekStartDate,
    weekdayHours: Number(row.weekdayHours ?? 0),
    saturdayHours: Number(row.saturdayHours ?? 0),
    sundayHours: Number(row.sundayHours ?? 0),
    weekdayOvertimeHours: Number(row.weekdayOvertimeHours ?? 0),
    saturdayOvertimeHours: Number(row.saturdayOvertimeHours ?? 0),
    sundayOvertimeHours: Number(row.sundayOvertimeHours ?? 0),
    efficiencyFactor: Number(row.efficiencyFactor ?? 1),
    qcBufferDays: Number(row.qcBufferDays ?? 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSnapshotRow(row: CapacitySnapshotRow): UnitCapacitySnapshot {
  return {
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    targetDeliveryDate: row.targetDeliveryDate,
    remainingHours: Number(row.remainingHours ?? 0),
    activePicCount: Number(row.activePicCount ?? 0),
    openWoCount: Number(row.openWoCount ?? 0),
    openIssueCount: Number(row.openIssueCount ?? 0),
    highSeverityIssueCount: Number(row.highSeverityIssueCount ?? 0),
    latestCountdownUpdateAt: row.latestCountdownUpdateAt,
    isMargin: Number(row.isMargin ?? 1) === 1,
  };
}

function mapWeeklyPlanRow(row: WeeklyPlanRow): WeeklyPlanRecord {
  return {
    planId: row.planId,
    weekStartDate: row.weekStartDate,
    targetHours: Number(row.targetHours ?? 0),
    targetIncome: row.targetIncome === null ? null : Number(row.targetIncome),
    labourRate: row.labourRate === null ? null : Number(row.labourRate),
    createdBy: row.createdBy,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function mapPlanOvertimeRow(row: PlanOvertimeRowPacket): PlanOvertimeRow {
  return {
    divisionId: Number(row.divisionId),
    divisionName: row.divisionName ?? `Division ${row.divisionId}`,
    overtimeDate: row.overtimeDate,
    dayType: row.dayType,
    overtimeHours: Number(row.overtimeHours ?? 0),
    memberCount: Number(row.memberCount ?? 0),
    includeHead: Number(row.includeHead ?? 0) === 1,
    notes: row.notes,
  };
}

function normalizeMaterialStatus(value: string | null | undefined): PlanningMaterialStatus {
  if (value === "HUNTING" || value === "ORDERED" || value === "VENDOR") {
    return value;
  }

  return "READY";
}

function mapPlanUnitRow(row: PlanUnitRowPacket): PlanUnitRow {
  const materialStatus = normalizeMaterialStatus(row.materialStatus);
  return {
    carId: row.carId,
    divisionId: Number(row.divisionId),
    divisionName: row.divisionName ?? `Division ${row.divisionId}`,
    allocatedHours: Number(row.allocatedHours ?? 0),
    priorityRank: row.priorityRank === null ? null : Number(row.priorityRank),
    notes: row.notes,
    unitName: row.unitName,
    customerName: row.customerName,
    isMargin: Number(row.isMargin ?? 1) === 1,
    materialStatus,
    materialReady: materialStatus === "READY",
    materialNote: row.materialNote ?? null,
    targetDeliveryDate: row.targetDeliveryDate,
    remainingHours: Number(row.remainingHours ?? 0),
  };
}

function mapPlanningDivisionDemandRow(
  row: PlanningDivisionDemandRowPacket,
): PlanningDivisionDemandRow {
  const materialStatus = normalizeMaterialStatus(row.materialStatus);
  return {
    carId: row.carId,
    unitName: row.unitName,
    customerName: row.customerName,
    targetDeliveryDate: row.targetDeliveryDate,
    isMargin: Number(row.isMargin ?? 1) === 1,
    materialStatus,
    materialReady: materialStatus === "READY",
    materialNote: row.materialNote ?? null,
    divisionId: Number(row.divisionId),
    divisionName: row.divisionName ?? `Division ${row.divisionId}`,
    remainingHours: Number(row.remainingHours ?? 0),
    progressPercent: Number(row.progressPercent ?? 0),
    panelCount: Number(row.panelCount ?? 0),
    lockedPanelCount: Number(row.lockedPanelCount ?? 0),
  };
}

function capacitySnapshotBaseSql(): string {
  return `
    SELECT
      c.id AS carId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
      ROUND(COALESCE(cdAgg.remainingHours, 0), 2) AS remainingHours,
      COALESCE(planAgg.activePicCount, 0) AS activePicCount,
      COALESCE(woAgg.openWoCount, 0) AS openWoCount,
      COALESCE(issueAgg.openIssueCount, 0) AS openIssueCount,
      COALESCE(issueAgg.highSeverityIssueCount, 0) AS highSeverityIssueCount,
      DATE_FORMAT(cdAgg.latestCountdownUpdateAt, '%Y-%m-%d %H:%i:%s') AS latestCountdownUpdateAt,
      COALESCE(c.is_margin, 1) AS isMargin
    FROM cars c
    LEFT JOIN (
      SELECT
        car_id,
        SUM(CASE WHEN status <> 'DONE' THEN COALESCE(remaining_hours, 0) ELSE 0 END) AS remainingHours,
        MAX(updated_at) AS latestCountdownUpdateAt
      FROM sm_jobdesc_countdown
      GROUP BY car_id
    ) cdAgg ON cdAgg.car_id = c.id
    LEFT JOIN (
      SELECT
        cd.car_id,
        COUNT(DISTINCT p.assigned_user_id) AS activePicCount
      FROM sm_jobdesc_plan p
      JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
      WHERE p.assigned_user_id IS NOT NULL
      GROUP BY cd.car_id
    ) planAgg ON planAgg.car_id = c.id
    LEFT JOIN (
      SELECT
        car_id,
        SUM(CASE WHEN status IN ('SUBMITTED', 'APPROVED') THEN 1 ELSE 0 END) AS openWoCount
      FROM sm_jobdesc_wo
      GROUP BY car_id
    ) woAgg ON woAgg.car_id = c.id
    LEFT JOIN (
      SELECT
        car_id,
        SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') THEN 1 ELSE 0 END) AS openIssueCount,
        SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') AND severity = 'HIGH' THEN 1 ELSE 0 END) AS highSeverityIssueCount
      FROM sm_issue_log
      GROUP BY car_id
    ) issueAgg ON issueAgg.car_id = c.id
  `;
}

function buildPlanningMaterialJoinSql(env: ApiEnv): string {
  const prHeader = qualifyTable(env.PURCHASE_DB_NAME, "pur_pr_header");
  const prItems = qualifyTable(env.PURCHASE_DB_NAME, "pur_pr_items");
  const vendorWo = qualifyTable(env.PURCHASE_DB_NAME, "vnd_wo_vendor");

  return `
    LEFT JOIN (
      SELECT
        pr.car_id AS carId,
        MAX(CASE
          WHEN COALESCE(item.status, pr.status) IN ('OPEN', 'HUNTING') THEN 1
          ELSE 0
        END) AS hasHunting,
        MAX(CASE
          WHEN COALESCE(item.status, pr.status) = 'ORDERED' THEN 1
          ELSE 0
        END) AS hasOrdered
      FROM ${prHeader} pr
      LEFT JOIN ${prItems} item ON item.pr_id = pr.id
      WHERE pr.car_id IS NOT NULL
        AND COALESCE(pr.status, 'OPEN') NOT IN ('ARRIVED', 'REJECTED', 'CANCELLED', 'APPROVED', 'NOT_FOUND')
      GROUP BY pr.car_id
    ) prAgg ON prAgg.carId = c.id
    LEFT JOIN (
      SELECT
        car_id AS carId,
        MAX(CASE
          WHEN COALESCE(status, 'OPEN') IN ('OPEN', 'SENT', 'PROSES_VENDOR', 'DONE_VENDOR', 'REWORK_VENDOR')
          THEN 1
          ELSE 0
        END) AS hasVendorOpen
      FROM ${vendorWo}
      WHERE car_id IS NOT NULL
        AND COALESCE(status, 'OPEN') NOT IN ('RECEIVED', 'REJECTED', 'CANCELLED')
      GROUP BY car_id
    ) vendorAgg ON vendorAgg.carId = c.id
  `;
}

function buildPlanningMaterialStatusSql(): string {
  return `
    CASE
      WHEN COALESCE(prAgg.hasHunting, 0) = 1 THEN 'HUNTING'
      WHEN COALESCE(prAgg.hasOrdered, 0) = 1 THEN 'ORDERED'
      WHEN COALESCE(vendorAgg.hasVendorOpen, 0) = 1 THEN 'VENDOR'
      ELSE 'READY'
    END
  `;
}

function buildPlanningMaterialNoteSql(): string {
  return `
    CASE
      WHEN COALESCE(prAgg.hasHunting, 0) = 1 THEN 'Material masih hunting / belum siap.'
      WHEN COALESCE(prAgg.hasOrdered, 0) = 1 THEN 'Material masih dalam proses order.'
      WHEN COALESCE(vendorAgg.hasVendorOpen, 0) = 1 THEN 'Part masih berada di vendor.'
      ELSE NULL
    END
  `;
}

function buildWeeklyPlanningTempKey(kind: "absence-loss" | "capacity", planId: string): string {
  return `planning:weekly:${kind}:${planId}`;
}

export class RedisWeeklyPlanningTempStore implements WeeklyPlanningTempStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
    private readonly ttlSeconds: number = WEEKLY_PLANNING_TEMP_TTL_SECONDS,
  ) {}

  async getAbsenceLoss(planId: string): Promise<CachedAbsenceLoss | null> {
    return this.getJson<CachedAbsenceLoss>(buildWeeklyPlanningTempKey("absence-loss", planId));
  }

  async setAbsenceLoss(planId: string, value: CachedAbsenceLoss): Promise<void> {
    await this.setJson(buildWeeklyPlanningTempKey("absence-loss", planId), value);
  }

  async getCapacity(planId: string): Promise<DivisionCapacitySummary[] | null> {
    return this.getJson<DivisionCapacitySummary[]>(buildWeeklyPlanningTempKey("capacity", planId));
  }

  async setCapacity(planId: string, rows: DivisionCapacitySummary[]): Promise<void> {
    await this.setJson(buildWeeklyPlanningTempKey("capacity", planId), rows);
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const client = await this.clientFactory();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private async setJson(key: string, value: unknown): Promise<void> {
    const client = await this.clientFactory();
    await client.set(key, JSON.stringify(value), {
      expiration: {
        type: "EX",
        value: this.ttlSeconds,
      },
    });
  }
}

export class MySqlCalendarRepository implements CalendarRepository {
  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
    private readonly tempStore: WeeklyPlanningTempStore = new RedisWeeklyPlanningTempStore(),
  ) {}

  async listWeeklyConfigs(
    startDate?: string,
    endDate?: string,
  ): Promise<WeeklyWorkConfigRecord[]> {
    const pool = this.poolFactory();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (startDate) {
      clauses.push("week_start_date >= ?");
      params.push(startDate);
    }

    if (endDate) {
      clauses.push("week_start_date <= ?");
      params.push(endDate);
    }

    const [rows] = (await pool.query(
      `
        SELECT
          id AS configId,
          DATE_FORMAT(week_start_date, '%Y-%m-%d') AS weekStartDate,
          weekday_hours AS weekdayHours,
          saturday_hours AS saturdayHours,
          sunday_hours AS sundayHours,
          weekday_overtime_hours AS weekdayOvertimeHours,
          saturday_overtime_hours AS saturdayOvertimeHours,
          sunday_overtime_hours AS sundayOvertimeHours,
          efficiency_factor AS efficiencyFactor,
          qc_buffer_days AS qcBufferDays,
          created_by AS createdBy,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM sm_weekly_work_config
        ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY week_start_date DESC
      `,
      params,
    )) as [WeeklyConfigRow[], unknown];

    return rows.map(mapWeeklyConfigRow);
  }

  async upsertWeeklyConfig(
    input: WeeklyWorkConfigRequest & { createdBy: string | null },
  ): Promise<WeeklyWorkConfigRecord> {
    const pool = this.poolFactory();
    const configId = randomUUID();
    await pool.query<ResultSetHeader>(
      `
        INSERT INTO sm_weekly_work_config (
          id,
          week_start_date,
          weekday_hours,
          saturday_hours,
          sunday_hours,
          weekday_overtime_hours,
          saturday_overtime_hours,
          sunday_overtime_hours,
          efficiency_factor,
          qc_buffer_days,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          weekday_hours = VALUES(weekday_hours),
          saturday_hours = VALUES(saturday_hours),
          sunday_hours = VALUES(sunday_hours),
          weekday_overtime_hours = VALUES(weekday_overtime_hours),
          saturday_overtime_hours = VALUES(saturday_overtime_hours),
          sunday_overtime_hours = VALUES(sunday_overtime_hours),
          efficiency_factor = VALUES(efficiency_factor),
          qc_buffer_days = VALUES(qc_buffer_days),
          created_by = VALUES(created_by),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        configId,
        input.weekStartDate,
        input.weekdayHours,
        input.saturdayHours,
        input.sundayHours,
        input.weekdayOvertimeHours,
        input.saturdayOvertimeHours,
        input.sundayOvertimeHours,
        input.efficiencyFactor,
        input.qcBufferDays,
        input.createdBy,
      ],
    );

    const [rows] = (await pool.query(
      `
        SELECT
          id AS configId,
          DATE_FORMAT(week_start_date, '%Y-%m-%d') AS weekStartDate,
          weekday_hours AS weekdayHours,
          saturday_hours AS saturdayHours,
          sunday_hours AS sundayHours,
          weekday_overtime_hours AS weekdayOvertimeHours,
          saturday_overtime_hours AS saturdayOvertimeHours,
          sunday_overtime_hours AS sundayOvertimeHours,
          efficiency_factor AS efficiencyFactor,
          qc_buffer_days AS qcBufferDays,
          created_by AS createdBy,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM sm_weekly_work_config
        WHERE week_start_date = ?
        LIMIT 1
      `,
      [input.weekStartDate],
    )) as [WeeklyConfigRow[], unknown];

    const row = rows[0];
    if (!row) {
      throw new Error("WEEKLY_CONFIG_NOT_FOUND");
    }

    return mapWeeklyConfigRow(row);
  }

  async getUnitCapacitySnapshot(
    params: ScopeParams & { carId: string },
  ): Promise<UnitCapacitySnapshot | null> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.carId];
    const whereClauses = ["c.id = ?"];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        ${capacitySnapshotBaseSql()}
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    )) as [CapacitySnapshotRow[], unknown];

    const row = rows[0];
    return row ? mapSnapshotRow(row) : null;
  }

  async listDeliveryRiskRows(params: ScopeParams): Promise<UnitCapacitySnapshot[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const whereClauses: string[] = ["COALESCE(c.status, 'In_Progress') <> 'DONE'"];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        ${capacitySnapshotBaseSql()}
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
        ORDER BY c.unit_name ASC
      `,
      queryParams,
    )) as [CapacitySnapshotRow[], unknown];

    return rows.map(mapSnapshotRow);
  }

  async createOrUpdateWeeklyPlan(
    input: WeeklyPlanRequest & { createdBy: string },
  ): Promise<WeeklyPlanRecord> {
    const pool = this.poolFactory();
    const planId = randomUUID();
    const targetIncome =
      input.labourRate !== undefined
        ? Number((input.targetHours * input.labourRate).toFixed(2))
        : null;

    await pool.query<ResultSetHeader>(
      `
        INSERT INTO sm_weekly_plan (
          id,
          week_start_date,
          target_hours,
          target_income,
          labour_rate,
          created_by,
          notes,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT')
        ON DUPLICATE KEY UPDATE
          target_hours = VALUES(target_hours),
          target_income = VALUES(target_income),
          labour_rate = VALUES(labour_rate),
          notes = VALUES(notes),
          created_by = VALUES(created_by),
          status = CASE WHEN status = 'CLOSED' THEN status ELSE 'DRAFT' END,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        planId,
        input.weekStartDate,
        input.targetHours,
        targetIncome,
        input.labourRate ?? null,
        input.createdBy,
        input.notes?.trim() || null,
      ],
    );

    const plan = await this.getWeeklyPlan(input.weekStartDate);
    if (!plan) {
      throw new Error("WEEKLY_PLAN_NOT_FOUND");
    }

    return plan;
  }

  async getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlanRecord | null> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          id AS planId,
          DATE_FORMAT(week_start_date, '%Y-%m-%d') AS weekStartDate,
          target_hours AS targetHours,
          target_income AS targetIncome,
          labour_rate AS labourRate,
          created_by AS createdBy,
          notes,
          status,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM sm_weekly_plan
        WHERE week_start_date = ?
        LIMIT 1
      `,
      [weekStartDate],
    )) as [WeeklyPlanRow[], unknown];

    return rows[0] ? mapWeeklyPlanRow(rows[0]) : null;
  }

  async getWeeklyPlanById(planId: string): Promise<WeeklyPlanRecord | null> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          id AS planId,
          DATE_FORMAT(week_start_date, '%Y-%m-%d') AS weekStartDate,
          target_hours AS targetHours,
          target_income AS targetIncome,
          labour_rate AS labourRate,
          created_by AS createdBy,
          notes,
          status,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM sm_weekly_plan
        WHERE id = ?
        LIMIT 1
      `,
      [planId],
    )) as [WeeklyPlanRow[], unknown];

    return rows[0] ? mapWeeklyPlanRow(rows[0]) : null;
  }

  async publishWeeklyPlan(planId: string): Promise<void> {
    const pool = this.poolFactory();
    const [result] = await pool.query<ResultSetHeader>(
      `
        UPDATE sm_weekly_plan
        SET status = 'PUBLISHED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status <> 'CLOSED'
      `,
      [planId],
    );

    if (result.affectedRows === 0) {
      throw new Error("WEEKLY_PLAN_NOT_FOUND");
    }
  }

  async upsertPlanOvertime(planId: string, rows: PlanOvertimeInput[]): Promise<void> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        `DELETE FROM sm_weekly_plan_overtime WHERE plan_id = ?`,
        [planId],
      );

      for (const row of rows) {
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO sm_weekly_plan_overtime (
              id,
              plan_id,
              division_id,
              overtime_date,
              day_type,
              overtime_hours,
              member_count,
              include_head,
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            planId,
            row.divisionId,
            row.overtimeDate,
            row.dayType,
            row.overtimeHours,
            row.memberCount,
            row.includeHead ? 1 : 0,
            row.notes?.trim() || null,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listPlanOvertime(planId: string): Promise<PlanOvertimeRow[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          ot.division_id AS divisionId,
          d.name AS divisionName,
          DATE_FORMAT(ot.overtime_date, '%Y-%m-%d') AS overtimeDate,
          ot.day_type AS dayType,
          ot.overtime_hours AS overtimeHours,
          ot.member_count AS memberCount,
          ot.include_head AS includeHead,
          ot.notes AS notes
        FROM sm_weekly_plan_overtime ot
        JOIN sm_divisi d ON d.id = ot.division_id
        WHERE ot.plan_id = ?
        ORDER BY ot.overtime_date ASC, d.name ASC
      `,
      [planId],
    )) as [PlanOvertimeRowPacket[], unknown];

    return rows.map(mapPlanOvertimeRow);
  }

  async upsertPlanDivisionInputs(planId: string, rows: PlanDivisionInput[]): Promise<void> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        `DELETE FROM sm_weekly_plan_division_inputs WHERE plan_id = ?`,
        [planId],
      );

      for (const row of rows) {
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO sm_weekly_plan_division_inputs (
              id,
              plan_id,
              division_id,
              member_count
            )
            VALUES (?, ?, ?, ?)
          `,
          [randomUUID(), planId, row.divisionId, row.memberCount],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listPlanDivisionInputs(planId: string): Promise<PlanDivisionInputRow[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          division_input.division_id AS divisionId,
          division_ref.name AS divisionName,
          division_input.member_count AS memberCount
        FROM sm_weekly_plan_division_inputs division_input
        JOIN sm_divisi division_ref ON division_ref.id = division_input.division_id
        WHERE division_input.plan_id = ?
        ORDER BY division_ref.name ASC
      `,
      [planId],
    )) as [PlanDivisionInputRowPacket[], unknown];

    return rows.map((row) => ({
      divisionId: Number(row.divisionId),
      divisionName: row.divisionName ?? `Division ${row.divisionId}`,
      memberCount: Number(row.memberCount ?? 0),
    }));
  }

  async upsertPlanUnits(planId: string, rows: PlanUnitInput[]): Promise<void> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        `DELETE FROM sm_weekly_plan_units WHERE plan_id = ?`,
        [planId],
      );

      for (const row of rows) {
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO sm_weekly_plan_units (
              id,
              plan_id,
              car_id,
              division_id,
              allocated_hours,
              priority_rank,
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            planId,
            row.carId,
            row.divisionId,
            row.allocatedHours,
            row.priorityRank ?? null,
            row.notes?.trim() || null,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listPlanUnits(planId: string): Promise<PlanUnitRow[]> {
    const pool = this.poolFactory();
    const materialJoinSql = buildPlanningMaterialJoinSql(this.env);
    const materialStatusSql = buildPlanningMaterialStatusSql();
    const materialNoteSql = buildPlanningMaterialNoteSql();
    const [rows] = (await pool.query(
      `
        SELECT
          pu.car_id AS carId,
          pu.division_id AS divisionId,
          division_ref.name AS divisionName,
          pu.allocated_hours AS allocatedHours,
          pu.priority_rank AS priorityRank,
          pu.notes AS notes,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          c.is_margin AS isMargin,
          ${materialStatusSql} AS materialStatus,
          ${materialNoteSql} AS materialNote,
          DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
          ROUND(COALESCE(cdAgg.remainingHours, 0), 2) AS remainingHours
        FROM sm_weekly_plan_units pu
        JOIN cars c ON c.id = pu.car_id
        LEFT JOIN sm_divisi division_ref ON division_ref.id = pu.division_id
        ${materialJoinSql}
        LEFT JOIN (
          SELECT
            car_id,
            SUM(CASE WHEN status <> 'DONE' THEN COALESCE(remaining_hours, 0) ELSE 0 END) AS remainingHours
          FROM sm_jobdesc_countdown
          GROUP BY car_id
        ) cdAgg ON cdAgg.car_id = pu.car_id
        WHERE pu.plan_id = ?
        ORDER BY
          CASE WHEN pu.priority_rank IS NULL THEN 1 ELSE 0 END,
          pu.priority_rank ASC,
          c.unit_name ASC
      `,
      [planId],
    )) as [PlanUnitRowPacket[], unknown];

    return rows.map(mapPlanUnitRow);
  }

  async snapshotAbsenceForWeek(
    planId: string,
    weekStartDate: string,
    weekEndDate: string,
  ): Promise<number> {
    const pool = this.poolFactory();
    let snapshotCount = 0;
    const lossByDivision = new Map<number, number>();

    const configs = await this.listWeeklyConfigs(weekStartDate, weekEndDate);

    const hoursForDate = (date: string): number => {
      const configWeekStart = getWeekStartDate(parseIsoDate(date));
      const config =
        configs.find((entry) => entry.weekStartDate === configWeekStart) ??
        ({
          weekdayHours: DEFAULT_WEEKDAY_HOURS,
          saturdayHours: DEFAULT_SATURDAY_HOURS,
          sundayHours: DEFAULT_SUNDAY_HOURS,
        } as WeeklyWorkConfigRecord);
      const day = parseIsoDate(date).getUTCDay();
      if (day === 6) {
        return Number(config.saturdayHours ?? DEFAULT_SATURDAY_HOURS);
      }
      if (day === 0) {
        return Number(config.sundayHours ?? DEFAULT_SUNDAY_HOURS);
      }
      return Number(config.weekdayHours ?? DEFAULT_WEEKDAY_HOURS);
    };

    const addLoss = (divisionId: number, hours: number) => {
      lossByDivision.set(
        divisionId,
        Number(((lossByDivision.get(divisionId) ?? 0) + hours).toFixed(2)),
      );
    };

    const [leaveRows] = (await pool.query(
      `
        SELECT
          lr.id AS leaveId,
          lr.employee_id AS employeeId,
          e.division_id AS divisionId,
          lr.type AS leaveType,
          DATE_FORMAT(GREATEST(lr.start_date, ?), '%Y-%m-%d') AS fromDate,
          DATE_FORMAT(LEAST(lr.end_date, ?), '%Y-%m-%d') AS toDate
        FROM sm_leave_requests lr
        JOIN sm_employee e ON e.employee_id = lr.employee_id
        WHERE lr.status = 'APPROVED'
          AND lr.start_date <= ?
          AND lr.end_date >= ?
          AND e.division_id IS NOT NULL
      `,
      [weekStartDate, weekEndDate, weekEndDate, weekStartDate],
    )) as [LeaveSnapshotSeedRow[], unknown];

    for (const row of leaveRows) {
      for (const absenceDate of listIsoDateRange(row.fromDate, row.toDate)) {
        addLoss(Number(row.divisionId), hoursForDate(absenceDate));
        snapshotCount += 1;
      }
    }

    const [attendanceRows] = (await pool.query(
      `
        SELECT
          al.id AS attendanceId,
          al.employee_id AS employeeId,
          e.division_id AS divisionId,
          al.status AS attendanceStatus,
          DATE_FORMAT(al.work_date, '%Y-%m-%d') AS absenceDate
        FROM sm_attendance_logs al
        JOIN sm_employee e ON e.employee_id = al.employee_id
        WHERE al.work_date BETWEEN ? AND ?
          AND al.status IN ('TIDAK_HADIR', 'CUTI', 'IZIN', 'SAKIT')
          AND e.division_id IS NOT NULL
      `,
      [weekStartDate, weekEndDate],
    )) as [AttendanceSnapshotSeedRow[], unknown];

    for (const row of attendanceRows) {
      addLoss(Number(row.divisionId), hoursForDate(row.absenceDate));
      snapshotCount += 1;
    }

    await this.tempStore.setAbsenceLoss(planId, {
      count: snapshotCount,
      rows: [...lossByDivision.entries()].map(([divisionId, lostHours]) => ({
        divisionId,
        lostHours,
      })),
    });

    return snapshotCount;
  }

  async countActiveMembersByDivision(_weekStartDate: string): Promise<Array<{ divisionId: number; count: number }>> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          d.id AS divisionId,
          COUNT(e.employee_id) AS count
        FROM sm_divisi d
        LEFT JOIN sm_employee e
          ON e.division_id = d.id
         AND COALESCE(e.is_active, 1) = 1
        WHERE d.isteknis = 1
        GROUP BY d.id
      `,
    )) as [DivisionCountRow[], unknown];

    return rows.map((row) => ({
      divisionId: Number(row.divisionId),
      count: Number(row.count ?? 0),
    }));
  }

  async listTechnicalDivisions(): Promise<Array<{ divisionId: number; divisionName: string }>> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          id AS divisionId,
          name AS divisionName
        FROM sm_divisi
        WHERE isteknis = 1
        ORDER BY name ASC
      `,
    )) as [TechnicalDivisionRow[], unknown];

    return rows.map((row) => ({
      divisionId: Number(row.divisionId),
      divisionName: row.divisionName,
    }));
  }

  async listAbsenceLossByDivision(planId: string): Promise<Array<{ divisionId: number; lostHours: number }>> {
    return (await this.tempStore.getAbsenceLoss(planId))?.rows ?? [];
  }

  async upsertCapacityCache(planId: string, rows: DivisionCapacitySummary[]): Promise<void> {
    await this.tempStore.setCapacity(planId, rows);
  }

  async getCapacityCache(planId: string): Promise<DivisionCapacitySummary[]> {
    return (await this.tempStore.getCapacity(planId)) ?? [];
  }

  async listPlanningUnitsForRisk(
    params: ScopeParams & { weekStartDate: string; weekEndDate: string },
  ): Promise<PlanningUnitRiskRow[]> {
    const pool = this.poolFactory();
    const materialJoinSql = buildPlanningMaterialJoinSql(this.env);
    const materialStatusSql = buildPlanningMaterialStatusSql();
    const materialNoteSql = buildPlanningMaterialNoteSql();
    const queryParams: unknown[] = [params.weekStartDate, params.weekEndDate];
    const whereClauses = [
      "COALESCE(c.status, 'In_Progress') <> 'DONE'",
      `(
        COALESCE(c.revision_contract, c.contract_delivery_date) BETWEEN ? AND ?
        OR COALESCE(cdAgg.remainingHours, 0) > 0
      )`,
    ];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        SELECT
          c.id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
          ROUND(COALESCE(cdAgg.remainingHours, 0), 2) AS remainingHours,
          COALESCE(c.is_margin, 1) AS isMargin,
          ${materialStatusSql} AS materialStatus,
          ${materialNoteSql} AS materialNote,
          NULL AS lockedDivisionName
        FROM cars c
        ${materialJoinSql}
        LEFT JOIN (
          SELECT
            car_id,
            SUM(CASE WHEN status <> 'DONE' THEN COALESCE(remaining_hours, 0) ELSE 0 END) AS remainingHours
          FROM sm_jobdesc_countdown
          GROUP BY car_id
        ) cdAgg ON cdAgg.car_id = c.id
        WHERE ${whereClauses.join(" AND ")}
      `,
      queryParams,
    )) as [NonMarginUnitRow[], unknown];

    return rows.map((row) => ({
      carId: row.carId,
      unitName: row.unitName,
      customerName: row.customerName,
      targetDeliveryDate: row.targetDeliveryDate,
      remainingHours: Number(row.remainingHours ?? 0),
      isMargin: Number(row.isMargin ?? 1) === 1,
      materialStatus: normalizeMaterialStatus(row.materialStatus),
      materialReady: normalizeMaterialStatus(row.materialStatus) === "READY",
      materialNote: row.materialNote ?? null,
      lockedDivisionName: row.lockedDivisionName ?? null,
    }));
  }

  async listPlanningDivisionDemand(
    params: ScopeParams & { weekStartDate: string; weekEndDate: string },
  ): Promise<PlanningDivisionDemandRow[]> {
    const pool = this.poolFactory();
    const materialJoinSql = buildPlanningMaterialJoinSql(this.env);
    const materialStatusSql = buildPlanningMaterialStatusSql();
    const materialNoteSql = buildPlanningMaterialNoteSql();
    const queryParams: unknown[] = [params.weekStartDate, params.weekEndDate];
    const whereClauses = [
      "COALESCE(c.status, 'In_Progress') <> 'DONE'",
      "cd.status <> 'DONE'",
      "cd.division_id IS NOT NULL",
      `(
        COALESCE(c.revision_contract, c.contract_delivery_date) BETWEEN ? AND ?
        OR COALESCE(cd.remaining_hours, 0) > 0
      )`,
    ];
    const scopeWhere = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (scopeWhere) {
      whereClauses.push(scopeWhere);
    }

    const [rows] = (await pool.query(
      `
        SELECT
          c.id AS carId,
          c.unit_name AS unitName,
          c.customer_name AS customerName,
          DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
          COALESCE(c.is_margin, 1) AS isMargin,
          ${materialStatusSql} AS materialStatus,
          ${materialNoteSql} AS materialNote,
          cd.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS remainingHours,
          ROUND(AVG(COALESCE(cd.actual_progress_percent, 0)), 2) AS progressPercent,
          COUNT(DISTINCT cd.panel_id) AS panelCount,
          COUNT(DISTINCT CASE
            WHEN cps.is_locked = 1 AND cps.current_division_id = cd.division_id THEN cd.panel_id
            ELSE NULL
          END) AS lockedPanelCount
        FROM sm_jobdesc_countdown cd
        JOIN cars c ON c.id = cd.car_id
        ${materialJoinSql}
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        LEFT JOIN sm_car_panel_status cps
          ON cps.car_id = cd.car_id
         AND cps.panel_id = cd.panel_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY
          c.id,
          c.unit_name,
          c.customer_name,
          targetDeliveryDate,
          isMargin,
          prAgg.hasHunting,
          prAgg.hasOrdered,
          vendorAgg.hasVendorOpen,
          cd.division_id,
          d.name
        HAVING remainingHours > 0
        ORDER BY targetDeliveryDate ASC, c.unit_name ASC, d.name ASC
      `,
      queryParams,
    )) as [PlanningDivisionDemandRowPacket[], unknown];

    return rows.map(mapPlanningDivisionDemandRow);
  }

  async countActivePicByDivision(divisionId: number, date: string): Promise<number> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT COUNT(DISTINCT assigned_user_id) AS total
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
        WHERE cd.division_id = ?
          AND p.task_date = ?
          AND p.assigned_user_id IS NOT NULL
      `,
      [divisionId, date],
    )) as [ActivePicRow[], unknown];

    return Number(rows[0]?.total ?? 0);
  }

  async findDivisionName(divisionId: number): Promise<string> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT name AS divisionName
        FROM sm_divisi
        WHERE id = ?
        LIMIT 1
      `,
      [divisionId],
    )) as [DivisionNameRow[], unknown];

    return rows[0]?.divisionName ?? `Division ${divisionId}`;
  }
}
