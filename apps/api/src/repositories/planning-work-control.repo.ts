import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateTargetBody,
  DivisionCapacity,
  OvertimeRecommendationBody,
  UnitProgress,
  WorkControlRiskLevel,
  WorkControlUnit,
} from "@smsystem/contracts/planning-work-control";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface UnitSummaryRow extends RowDataPacket {
  unitId: string;
  unitName: string;
  customerName: string | null;
  carId: string;
  progressPercent: number | null;
  remainingJobCount: number | null;
  remainingHours: number | null;
  targetDeliveryDate: string | null;
  status: string | null;
}

interface UnitProgressRow extends RowDataPacket {
  unitId: string;
  unitName: string;
  customerName: string | null;
  targetDeliveryDate: string | null;
  progressPercent: number | null;
  remainingHours: number | null;
  totalEstimatedHours: number | null;
  actualHours: number | null;
  openIssueCount: number | null;
  highIssueCount: number | null;
}

interface DivisionProgressRow extends RowDataPacket {
  divisionId: number;
  divisionName: string | null;
  pendingHours: number | null;
}

interface JobProgressRow extends RowDataPacket {
  jobId: string;
  jobName: string | null;
  status: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
}

interface DivisionMemberRow extends RowDataPacket {
  divisionId: number;
  divisionName: string | null;
  employeeId: string | null;
  employeeName: string | null;
}

interface AbsenceRow extends RowDataPacket {
  divisionId: number;
  employeeId: string;
  employeeName: string | null;
  absenceType: string | null;
  startDate: string;
  endDate: string;
  absenceDays: number | null;
}

interface ScheduledRow extends RowDataPacket {
  divisionId: number;
  scheduledHours: number | null;
}

interface TargetRow extends RowDataPacket {
  planningTargetId: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "REVIEW" | "RELEASED" | "CANCELLED";
}

interface TargetDivisionRow extends RowDataPacket {
  rowId: string;
  carId: string;
  unitName: string | null;
  divisionId: number;
  divisionName: string | null;
  targetOutput: string;
  targetHours: number;
  targetFinishDate: string;
  shortageHours: number;
  recommendation: "SPK" | "SPK_WITH_SPL" | "HOLD" | "REVISE_TARGET";
  notes: string | null;
}

interface ExistingSpkRow extends RowDataPacket {
  spkId: string;
}

interface CountRow extends RowDataPacket {
  total: number | null;
}

interface DraftTargetLookupRow extends RowDataPacket {
  planningTargetId: string;
}

interface PlanningSplRecommendationRow extends RowDataPacket {
  planningTargetId: string;
  periodStart: string;
  periodEnd: string;
  divisionId: number;
  divisionName: string | null;
  shortageHours: number | null;
  recommendedOvertimeHours: number | null;
  unitCount: number | null;
  targetCount: number | null;
  firstNeedDate: string | null;
  lastNeedDate: string | null;
  reason: string | null;
  status: "RECOMMENDED" | "APPROVED" | "REJECTED" | null;
}

export interface CapacitySnapshotInput {
  periodStart: string;
  periodEnd: string;
  divisionIds: number[];
  employeeId: string;
  scope: import("@smsystem/contracts/auth").AuthScope;
}

export interface CreatePlanningTargetInput extends CreateTargetBody {
  createdBy: string;
  scope: import("@smsystem/contracts/auth").AuthScope;
}

export interface ReleasePlanningTargetInput {
  planningTargetId: string;
  actorId: string;
  actorName: string;
}

export interface CreateOvertimeRecommendationInput extends OvertimeRecommendationBody {
  unitId?: string | null;
}

export interface PlanningWorkControlRepository {
  listUnits(params: ScopeParams): Promise<WorkControlUnit[]>;
  getUnitProgress(params: ScopeParams & { unitId: string }): Promise<UnitProgress | null>;
  snapshotCapacity(input: CapacitySnapshotInput): Promise<DivisionCapacity[]>;
  listOvertimeRecommendations(
    params: ScopeParams & { periodStart: string; periodEnd: string },
  ): Promise<
    Array<{
      planningTargetId: string;
      periodStart: string;
      periodEnd: string;
      divisionId: string;
      divisionName: string;
      shortageHours: number;
      recommendedOvertimeHours: number;
      unitCount: number;
      targetCount: number;
      firstNeedDate: string | null;
      lastNeedDate: string | null;
      reason: string | null;
      status: "RECOMMENDED" | "APPROVED" | "REJECTED" | null;
    }>
  >;
  createTarget(input: CreatePlanningTargetInput): Promise<{ planningTargetId: string; status: "DRAFT" }>;
  releaseTarget(input: ReleasePlanningTargetInput): Promise<{ spkIds: string[]; message: string }>;
  createOvertimeRecommendation(
    input: CreateOvertimeRecommendationInput,
  ): Promise<{ recommendationId: string; status: "RECOMMENDED" }>;
}

const DEFAULT_WEEKDAY_HOURS = 8;
const DEFAULT_SATURDAY_HOURS = 5;
const MILLISECONDS_PER_DAY = 86_400_000;

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, amount: number): string {
  const parsed = parseIsoDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return formatIsoDate(parsed);
}

function differenceInDaysInclusive(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate).getTime();
  const end = parseIsoDate(endDate).getTime();
  return Math.max(1, Math.floor((end - start) / MILLISECONDS_PER_DAY) + 1);
}

function countNormalHours(periodStart: string, periodEnd: string): number {
  let total = 0;
  for (
    let cursor = parseIsoDate(periodStart);
    cursor <= parseIsoDate(periodEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) {
      total += DEFAULT_WEEKDAY_HOURS;
    } else if (day === 6) {
      total += DEFAULT_SATURDAY_HOURS;
    }
  }
  return total;
}

function mapPriority(priority: number): "NORMAL" | "IMPORTANT" | "URGENT" {
  if (priority <= 1) {
    return "URGENT";
  }
  if (priority === 2) {
    return "IMPORTANT";
  }
  return "NORMAL";
}

function resolveRecommendation(
  targetHours: number,
  availableCapacityHours: number,
): "SPK" | "SPK_WITH_SPL" {
  return targetHours > availableCapacityHours ? "SPK_WITH_SPL" : "SPK";
}

function resolveRiskLevel(
  remainingHours: number,
  targetDeliveryDate: string | null,
): WorkControlRiskLevel {
  if (!targetDeliveryDate) {
    return remainingHours > 120 ? "HIGH" : remainingHours > 60 ? "MEDIUM" : "LOW";
  }

  const daysLeft = Math.ceil(
    (parseIsoDate(targetDeliveryDate).getTime() - Date.now()) / MILLISECONDS_PER_DAY,
  );
  if (daysLeft <= 2 || remainingHours > 160) {
    return "CRITICAL";
  }
  if (daysLeft <= 5 || remainingHours > 100) {
    return "HIGH";
  }
  if (daysLeft <= 10 || remainingHours > 50) {
    return "MEDIUM";
  }
  return "LOW";
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

function buildUnitProgressBaseSql(scopeClause: string): string {
  return `
    SELECT
      c.id AS unitId,
      c.unit_name AS unitName,
      c.customer_name AS customerName,
      COALESCE(c.status, 'In_Progress') AS status,
      DATE_FORMAT(COALESCE(c.revision_contract, c.contract_delivery_date), '%Y-%m-%d') AS targetDeliveryDate,
      ROUND(COALESCE(cdAgg.progressPercent, 0), 2) AS progressPercent,
      ROUND(COALESCE(cdAgg.remainingHours, 0), 2) AS remainingHours,
      ROUND(COALESCE(cdAgg.totalEstimatedHours, 0), 2) AS totalEstimatedHours,
      ROUND(COALESCE(cdAgg.actualHours, 0), 2) AS actualHours,
      COALESCE(issueAgg.openIssueCount, 0) AS openIssueCount,
      COALESCE(issueAgg.highIssueCount, 0) AS highIssueCount
    FROM cars c
    LEFT JOIN (
      SELECT
        car_id,
        AVG(COALESCE(actual_progress_percent, 0)) AS progressPercent,
        SUM(CASE WHEN COALESCE(status, 'PLAN') <> 'DONE' THEN COALESCE(remaining_hours, 0) ELSE 0 END) AS remainingHours,
        SUM(COALESCE(target_hours_revised, target_hours_initial + time_extension_hours, target_hours_initial, 0)) AS totalEstimatedHours,
        SUM(COALESCE(total_actual_hours, 0)) AS actualHours
      FROM sm_jobdesc_countdown
      GROUP BY car_id
    ) cdAgg ON cdAgg.car_id = c.id
    LEFT JOIN (
      SELECT
        car_id,
        SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') THEN 1 ELSE 0 END) AS openIssueCount,
        SUM(CASE WHEN status NOT IN ('RESOLVED', 'WAIVED') AND severity = 'HIGH' THEN 1 ELSE 0 END) AS highIssueCount
      FROM sm_issue_log
      GROUP BY car_id
    ) issueAgg ON issueAgg.car_id = c.id
    WHERE COALESCE(c.status, 'In_Progress') <> 'DONE'
      AND COALESCE(cdAgg.remainingHours, 0) > 0
      ${scopeClause ? `AND ${scopeClause}` : ""}
  `;
}

async function findTargetRows(
  connection: PoolConnection,
  planningTargetId: string,
): Promise<{ target: TargetRow; rows: TargetDivisionRow[] } | null> {
  const [targetRows] = (await connection.query(
    `
      SELECT
        id AS planningTargetId,
        DATE_FORMAT(period_start, '%Y-%m-%d') AS periodStart,
        DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd,
        status
      FROM planning_targets
      WHERE id = ?
      LIMIT 1
    `,
    [planningTargetId],
  )) as [TargetRow[], unknown];

  const target = targetRows[0];
  if (!target) {
    return null;
  }

  const [rows] = (await connection.query(
    `
      SELECT
        ptd.id AS rowId,
        ptd.car_id AS carId,
        c.unit_name AS unitName,
        ptd.division_id AS divisionId,
        d.name AS divisionName,
        ptd.target_output AS targetOutput,
        ptd.target_hours AS targetHours,
        DATE_FORMAT(ptd.target_finish_date, '%Y-%m-%d') AS targetFinishDate,
        ptd.shortage_hours AS shortageHours,
        ptd.recommendation AS recommendation,
        ptd.notes AS notes
      FROM planning_target_divisions ptd
      JOIN cars c ON c.id = ptd.car_id
      LEFT JOIN sm_divisi d ON d.id = ptd.division_id
      WHERE ptd.planning_target_id = ?
      ORDER BY ptd.priority ASC, c.unit_name ASC, d.name ASC
    `,
    [planningTargetId],
  )) as [TargetDivisionRow[], unknown];

  return { target, rows };
}

async function findEditableDraftTarget(
  connection: PoolConnection,
  planningTargetId: string,
  createdBy: string,
): Promise<DraftTargetLookupRow | null> {
  const [rows] = (await connection.query(
    `
      SELECT id AS planningTargetId
      FROM planning_targets
      WHERE id = ?
        AND status = 'DRAFT'
        AND created_by = ?
      LIMIT 1
    `,
    [planningTargetId, createdBy],
  )) as [DraftTargetLookupRow[], unknown];

  return rows[0] ?? null;
}

export class MySqlPlanningWorkControlRepository implements PlanningWorkControlRepository {
  constructor(private readonly poolFactory: () => Pool = getMySqlPool) {}

  async listUnits(params: ScopeParams): Promise<WorkControlUnit[]> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams);
    const [rows] = (await pool.query(
      `
        SELECT
          unit.unitId,
          unit.unitName,
          unit.customerName,
          unit.unitId AS carId,
          unit.progressPercent,
          COALESCE(jobAgg.remainingJobCount, 0) AS remainingJobCount,
          unit.remainingHours,
          unit.targetDeliveryDate,
          unit.status
        FROM (${buildUnitProgressBaseSql(scopeClause)}) unit
        LEFT JOIN (
          SELECT car_id, COUNT(*) AS remainingJobCount
          FROM sm_jobdesc_countdown
          WHERE COALESCE(status, 'PLAN') <> 'DONE'
            AND COALESCE(remaining_hours, 0) > 0
          GROUP BY car_id
        ) jobAgg ON jobAgg.car_id = unit.unitId
        ORDER BY
          CASE WHEN unit.targetDeliveryDate IS NULL THEN 1 ELSE 0 END,
          unit.targetDeliveryDate ASC,
          unit.remainingHours DESC,
          unit.unitName ASC
        LIMIT 100
      `,
      queryParams,
    )) as [UnitSummaryRow[], unknown];

    return rows.map((row) => {
      const remainingHours = toNumber(row.remainingHours);
      return {
        unitId: row.unitId,
        unitName: row.unitName,
        customerName: row.customerName,
        carId: row.carId,
        progressPercent: Math.max(0, Math.min(100, toNumber(row.progressPercent))),
        riskLevel: resolveRiskLevel(remainingHours, row.targetDeliveryDate),
        remainingJobCount: Math.max(0, Math.trunc(toNumber(row.remainingJobCount))),
        remainingHours,
        targetDeliveryDate: row.targetDeliveryDate,
        status: row.status ?? "ACTIVE",
      };
    });
  }

  async getUnitProgress(params: ScopeParams & { unitId: string }): Promise<UnitProgress | null> {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [];
    const scopeClause = buildScopeWhereClause(params.scope, params.employeeId, queryParams);
    const [unitRows] = (await pool.query(
      `${buildUnitProgressBaseSql(scopeClause)} AND c.id = ? LIMIT 1`,
      [...queryParams, params.unitId],
    )) as [UnitProgressRow[], unknown];

    const unit = unitRows[0];
    if (!unit) {
      return null;
    }

    const [divisionRows] = (await pool.query(
      `
        SELECT
          cd.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS pendingHours
        FROM sm_jobdesc_countdown cd
        LEFT JOIN sm_divisi d ON d.id = cd.division_id
        WHERE cd.car_id = ?
          AND cd.division_id IS NOT NULL
          AND COALESCE(cd.status, 'PLAN') <> 'DONE'
          AND COALESCE(cd.remaining_hours, 0) > 0
        GROUP BY cd.division_id, d.name
        ORDER BY pendingHours DESC, d.name ASC
      `,
      [params.unitId],
    )) as [DivisionProgressRow[], unknown];

    const [jobRows] = (await pool.query(
      `
        SELECT
          cd.id AS jobId,
          COALESCE(mjt.job_name, cd.section_name, 'Pekerjaan') AS jobName,
          COALESCE(cd.status, 'PLAN') AS status,
          ROUND(COALESCE(cd.target_hours_revised, cd.target_hours_initial + cd.time_extension_hours, cd.target_hours_initial, 0), 2) AS estimatedHours,
          CASE
            WHEN cd.total_actual_hours IS NULL THEN NULL
            ELSE ROUND(cd.total_actual_hours, 2)
          END AS actualHours
        FROM sm_jobdesc_countdown cd
        LEFT JOIN master_job_types mjt ON mjt.id = cd.job_type_id
        WHERE cd.car_id = ?
          AND COALESCE(cd.status, 'PLAN') <> 'DONE'
        ORDER BY cd.deadline_date ASC, cd.created_at ASC
      `,
      [params.unitId],
    )) as [JobProgressRow[], unknown];

    const remainingHours = toNumber(unit.remainingHours);
    const roughEstimateDays = Math.max(0, Math.ceil(remainingHours / DEFAULT_WEEKDAY_HOURS));
    const highIssueCount = toNumber(unit.highIssueCount);
    const openIssueCount = toNumber(unit.openIssueCount);
    const mainConstraint =
      highIssueCount > 0
        ? "Ada issue prioritas tinggi yang perlu diselesaikan."
        : openIssueCount > 0
          ? "Ada issue terbuka yang perlu dipantau."
          : null;

    return {
      unitId: unit.unitId,
      progressPercent: Math.max(0, Math.min(100, toNumber(unit.progressPercent))),
      remainingHours,
      totalEstimatedHours: toNumber(unit.totalEstimatedHours),
      actualHours: toNumber(unit.actualHours),
      roughEstimateDays,
      mainConstraint,
      involvedDivisions: divisionRows.map((row) => ({
        divisionId: String(row.divisionId),
        divisionName: row.divisionName ?? `Division ${row.divisionId}`,
        pendingHours: toNumber(row.pendingHours),
      })),
      jobs: jobRows.map((row) => ({
        jobId: row.jobId,
        jobName: row.jobName ?? "Pekerjaan",
        status: row.status ?? "PLAN",
        estimatedHours: toNumber(row.estimatedHours),
        actualHours: row.actualHours === null ? null : toNumber(row.actualHours),
      })),
    };
  }

  async snapshotCapacity(input: CapacitySnapshotInput): Promise<DivisionCapacity[]> {
    const pool = this.poolFactory();
    const normalHoursPerMember = countNormalHours(input.periodStart, input.periodEnd);
    
    const queryParams: unknown[] = [];
    const divisionClauses: string[] = ["d.isteknis = 1"];

    if (input.divisionIds.length > 0) {
      divisionClauses.push(`d.id IN (${input.divisionIds.map(() => "?").join(", ")})`);
      queryParams.push(...input.divisionIds);
    }

    if (!input.scope.canViewAllUnits && input.scope.divisionIds.length > 0) {
      divisionClauses.push(`(d.id IN (${input.scope.divisionIds.map(() => "?").join(", ")}) OR d.parent_id IN (${input.scope.divisionIds.map(() => "?").join(", ")}))`);
      queryParams.push(...input.scope.divisionIds, ...input.scope.divisionIds);
    }

    const divisionFilter = `AND ${divisionClauses.join(" AND ")}`;

    const [memberRows] = (await pool.query(
      `
        SELECT
          d.id AS divisionId,
          d.name AS divisionName,
          e.employee_id AS employeeId,
          e.full_name AS employeeName
        FROM sm_divisi d
        LEFT JOIN sm_employee e
          ON e.division_id = d.id
         AND COALESCE(e.is_active, 1) = 1
        WHERE 1=1
          ${divisionFilter}
        ORDER BY d.name ASC, e.full_name ASC
      `,
      queryParams,
    )) as [DivisionMemberRow[], unknown];

    const [absenceRows] = (await pool.query(
      `
        SELECT
          e.division_id AS divisionId,
          lr.employee_id AS employeeId,
          e.full_name AS employeeName,
          CASE WHEN lr.type IN ('CUTI', 'IZIN', 'SAKIT') THEN lr.type ELSE 'IZIN' END AS absenceType,
          DATE_FORMAT(GREATEST(lr.start_date, ?), '%Y-%m-%d') AS startDate,
          DATE_FORMAT(LEAST(lr.end_date, ?), '%Y-%m-%d') AS endDate,
          DATEDIFF(LEAST(lr.end_date, ?), GREATEST(lr.start_date, ?)) + 1 AS absenceDays
        FROM sm_leave_requests lr
        JOIN sm_employee e ON e.employee_id = lr.employee_id
        WHERE lr.status = 'APPROVED'
          AND lr.start_date <= ?
          AND lr.end_date >= ?
          AND e.division_id IS NOT NULL
          ${input.divisionIds.length > 0 ? `AND e.division_id IN (${input.divisionIds.map(() => "?").join(", ")})` : ""}
          ${!input.scope.canViewAllUnits && input.scope.divisionIds.length > 0 ? `AND (e.division_id IN (${input.scope.divisionIds.map(() => "?").join(", ")}) OR e.division_id IN (SELECT id FROM sm_divisi WHERE parent_id IN (${input.scope.divisionIds.map(() => "?").join(", ")})))` : ""}
      `,
      [
        input.periodStart,
        input.periodEnd,
        input.periodEnd,
        input.periodStart,
        input.periodEnd,
        input.periodStart,
        ...input.divisionIds,
        ...( !input.scope.canViewAllUnits && input.scope.divisionIds.length > 0 ? [...input.scope.divisionIds, ...input.scope.divisionIds] : []),
      ],
    )) as [AbsenceRow[], unknown];

    const [scheduledRows] = (await pool.query(
      `
        SELECT
          ptd.division_id AS divisionId,
          ROUND(SUM(COALESCE(ptd.target_hours, 0)), 2) AS scheduledHours
        FROM planning_target_divisions ptd
        JOIN planning_targets pt ON pt.id = ptd.planning_target_id
        WHERE pt.status IN ('DRAFT', 'REVIEW', 'RELEASED')
          AND pt.period_start <= ?
          AND pt.period_end >= ?
          ${input.divisionIds.length > 0 ? `AND ptd.division_id IN (${input.divisionIds.map(() => "?").join(", ")})` : ""}
        GROUP BY ptd.division_id
      `,
      [input.periodEnd, input.periodStart, ...input.divisionIds],
    )) as [ScheduledRow[], unknown];

    const scheduledByDivision = new Map(
      scheduledRows.map((row) => [Number(row.divisionId), toNumber(row.scheduledHours)]),
    );
    const membersByDivision = new Map<number, DivisionMemberRow[]>();
    for (const row of memberRows) {
      if (!membersByDivision.has(row.divisionId)) {
        membersByDivision.set(row.divisionId, []);
      }
      if (row.employeeId) {
        membersByDivision.get(row.divisionId)?.push(row);
      }
    }

    const absenceByDivision = new Map<number, AbsenceRow[]>();
    for (const row of absenceRows) {
      if (!absenceByDivision.has(row.divisionId)) {
        absenceByDivision.set(row.divisionId, []);
      }
      absenceByDivision.get(row.divisionId)?.push(row);
    }

    const divisions = [...new Map(memberRows.map((row) => [
      row.divisionId,
      row.divisionName ?? `Division ${row.divisionId}`,
    ])).entries()];

    const capacities: DivisionCapacity[] = [];
    for (const [divisionId, divisionName] of divisions) {
      const members = membersByDivision.get(divisionId) ?? [];
      const absences = absenceByDivision.get(divisionId) ?? [];
      const absentMemberIds = new Set(absences.map((row) => row.employeeId));
      const absenceHours = absences.reduce(
        (total, row) => total + toNumber(row.absenceDays) * DEFAULT_WEEKDAY_HOURS,
        0,
      );
      const scheduledHours = scheduledByDivision.get(divisionId) ?? 0;
      const normalCapacityHours = members.length * normalHoursPerMember;
      const availableCapacityHours = Math.max(
        0,
        Number((normalCapacityHours - absenceHours - scheduledHours).toFixed(2)),
      );

      capacities.push({
        divisionId: String(divisionId),
        divisionName,
        totalMembers: members.length,
        activeMembers: Math.max(0, members.length - absentMemberIds.size),
        absentMembers: absentMemberIds.size,
        normalCapacityHours,
        absenceHours,
        availableCapacityHours,
        absentMemberDetails: absences.map((row) => ({
          memberId: row.employeeId,
          memberName: row.employeeName ?? row.employeeId,
          absenceType: row.absenceType ?? "IZIN",
          startDate: row.startDate,
          endDate: row.endDate,
        })),
      });
    }

    return capacities;
  }

  async listOvertimeRecommendations(
    params: ScopeParams & { periodStart: string; periodEnd: string },
  ): Promise<
    Array<{
      planningTargetId: string;
      periodStart: string;
      periodEnd: string;
      divisionId: string;
      divisionName: string;
      shortageHours: number;
      recommendedOvertimeHours: number;
      unitCount: number;
      targetCount: number;
      firstNeedDate: string | null;
      lastNeedDate: string | null;
      reason: string | null;
      status: "RECOMMENDED" | "APPROVED" | "REJECTED" | null;
    }>
  > {
    const pool = this.poolFactory();
    const queryParams: unknown[] = [params.periodEnd, params.periodStart];
    const whereClauses = [
      "pt.status = 'RELEASED'",
      "pt.period_start <= ?",
      "pt.period_end >= ?",
      "COALESCE(ptd.shortage_hours, 0) > 0",
    ];

    if (!params.scope.canViewAllUnits) {
      const scopedClauses: string[] = [];

      if (params.scope.canViewAssignedUnits) {
        scopedClauses.push(
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
        queryParams.push(params.employeeId, params.employeeId, params.employeeId);
      }

      if (params.scope.divisionIds.length > 0) {
        scopedClauses.push(`ptd.division_id IN (${params.scope.divisionIds.map(() => "?").join(", ")})`);
        queryParams.push(...params.scope.divisionIds);
      }

      if (params.scope.unitIds.length > 0) {
        scopedClauses.push(`ptd.car_id IN (${params.scope.unitIds.map(() => "?").join(", ")})`);
        queryParams.push(...params.scope.unitIds);
      }

      whereClauses.push(scopedClauses.length > 0 ? `(${scopedClauses.join(" OR ")})` : "1 = 0");
    }

    const [rows] = (await pool.query(
      `
        SELECT
          pt.id AS planningTargetId,
          DATE_FORMAT(pt.period_start, '%Y-%m-%d') AS periodStart,
          DATE_FORMAT(pt.period_end, '%Y-%m-%d') AS periodEnd,
          ptd.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(SUM(COALESCE(ptd.shortage_hours, 0)), 2) AS shortageHours,
          ROUND(MAX(COALESCE(otr.recommended_overtime_hours, 0)), 2) AS recommendedOvertimeHours,
          COUNT(DISTINCT ptd.car_id) AS unitCount,
          COUNT(*) AS targetCount,
          DATE_FORMAT(MIN(ptd.target_finish_date), '%Y-%m-%d') AS firstNeedDate,
          DATE_FORMAT(MAX(ptd.target_finish_date), '%Y-%m-%d') AS lastNeedDate,
          MAX(otr.reason) AS reason,
          MAX(otr.status) AS status
        FROM planning_target_divisions ptd
        JOIN planning_targets pt ON pt.id = ptd.planning_target_id
        LEFT JOIN sm_divisi d ON d.id = ptd.division_id
        LEFT JOIN cars c ON c.id = ptd.car_id
        LEFT JOIN overtime_recommendations otr
          ON otr.planning_target_id = pt.id
         AND otr.division_id = ptd.division_id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY pt.id, pt.period_start, pt.period_end, ptd.division_id, d.name
        ORDER BY pt.period_start ASC, d.name ASC
      `,
      queryParams,
    )) as [PlanningSplRecommendationRow[], unknown];

    return rows.map((row) => ({
      planningTargetId: row.planningTargetId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      divisionId: String(row.divisionId),
      divisionName: row.divisionName ?? `Division ${row.divisionId}`,
      shortageHours: toNumber(row.shortageHours),
      recommendedOvertimeHours: toNumber(row.recommendedOvertimeHours),
      unitCount: Math.max(0, Math.trunc(toNumber(row.unitCount))),
      targetCount: Math.max(0, Math.trunc(toNumber(row.targetCount))),
      firstNeedDate: row.firstNeedDate,
      lastNeedDate: row.lastNeedDate,
      reason: row.reason,
      status: row.status ?? null,
    }));
  }

  async createTarget(input: CreatePlanningTargetInput): Promise<{ planningTargetId: string; status: "DRAFT" }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();
    const periodEnd = addDays(input.weekStartDate, 6);

    try {
      await connection.beginTransaction();
      const editableDraft = input.planningTargetId
        ? await findEditableDraftTarget(connection, input.planningTargetId, input.createdBy)
        : null;
      const planningTargetId = editableDraft?.planningTargetId ?? randomUUID();
      const totalTargetHours = input.units.reduce((total, row) => total + row.targetHours, 0);
      const first = input.units[0];
      if (editableDraft) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE planning_targets
            SET period_start = ?,
                period_end = ?,
                unit_id = ?,
                target_output = ?,
                target_hours = ?,
                target_finish_date = ?,
                priority = ?,
                risk_level = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            input.weekStartDate,
            periodEnd,
            first?.carId ?? null,
            first?.targetOutput ?? null,
            totalTargetHours,
            first?.targetFinishDate ?? null,
            first ? mapPriority(first.priority) : "NORMAL",
            first?.riskLevel ?? "LOW",
            first?.notes?.trim() || null,
            planningTargetId,
          ],
        );

        await connection.execute<ResultSetHeader>(
          `
            DELETE FROM planning_target_divisions
            WHERE planning_target_id = ?
          `,
          [planningTargetId],
        );
      } else {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO planning_targets (
              id,
              period_start,
              period_end,
              unit_id,
              target_output,
              target_hours,
              target_finish_date,
              priority,
              risk_level,
              status,
              created_by,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
          `,
          [
            planningTargetId,
            input.weekStartDate,
            periodEnd,
            first?.carId ?? null,
            first?.targetOutput ?? null,
            totalTargetHours,
            first?.targetFinishDate ?? null,
            first ? mapPriority(first.priority) : "NORMAL",
            first?.riskLevel ?? "LOW",
            input.createdBy,
            first?.notes?.trim() || null,
          ],
        );
      }

      const divisionIds = input.units.map((row) => Number.parseInt(row.divisionId, 10));
      const capacities = await this.snapshotCapacity({
        periodStart: input.weekStartDate,
        periodEnd,
        divisionIds,
        employeeId: input.createdBy,
        scope: input.scope,
      });
      const capacityByDivision = new Map(
        capacities.map((row) => [Number(row.divisionId), row.availableCapacityHours]),
      );

      for (const row of input.units) {
        const divisionId = Number.parseInt(row.divisionId, 10);
        const availableCapacityHours = capacityByDivision.get(divisionId) ?? 0;
        const shortageHours = Math.max(0, Number((row.targetHours - availableCapacityHours).toFixed(2)));
        const recommendation = resolveRecommendation(row.targetHours, availableCapacityHours);
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO planning_target_divisions (
              id,
              planning_target_id,
              car_id,
              division_id,
              target_output,
              target_hours,
              target_finish_date,
              priority,
              risk_level,
              available_capacity_hours,
              shortage_hours,
              recommendation,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            planningTargetId,
            row.carId,
            divisionId,
            row.targetOutput,
            row.targetHours,
            row.targetFinishDate,
            mapPriority(row.priority),
            row.riskLevel,
            availableCapacityHours,
            shortageHours,
            recommendation,
            row.notes?.trim() || null,
          ],
        );
      }

      await connection.commit();
      return { planningTargetId, status: "DRAFT" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async releaseTarget(input: ReleasePlanningTargetInput): Promise<{ spkIds: string[]; message: string }> {
    const pool = this.poolFactory();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const targetBundle = await findTargetRows(connection, input.planningTargetId);
      if (!targetBundle) {
        throw new Error("PLANNING_TARGET_NOT_FOUND");
      }
      if (targetBundle.rows.length === 0) {
        throw new Error("PLANNING_TARGET_EMPTY");
      }

      const [existingRows] = (await connection.query(
        `
          SELECT id AS spkId
          FROM sm_spk_header
          WHERE notes LIKE ? OR notes LIKE ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [`WORK_CONTROL:${input.planningTargetId}:%`, `[PLANNER_AUTO_DRAFT]%${input.planningTargetId}%`],
      )) as [ExistingSpkRow[], unknown];

      if (existingRows[0]) {
        await connection.commit();
        return {
          spkIds: [existingRows[0].spkId],
          message: "SPK untuk target ini sudah pernah dibuat.",
        };
      }

      const [sequenceRows] = (await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM sm_spk_header
          WHERE spk_date = ?
        `,
        [targetBundle.target.periodStart],
      )) as [CountRow[], unknown];
      const sequence = String(toNumber(sequenceRows[0]?.total) + 1).padStart(3, "0");
      const spkId = `SPK-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`;
      const spkNumber = `SPK-${targetBundle.target.periodStart.replace(/-/gu, "")}-${sequence}`;
      const totalHours = Number(
        targetBundle.rows.reduce((total, row) => total + toNumber(row.targetHours), 0).toFixed(2),
      );
      const totalUnits = new Set(targetBundle.rows.map((row) => row.carId)).size;
      const generatedOvertimeRows = targetBundle.rows.filter(
        (row) => toNumber(row.shortageHours) > 0,
      ).length;
      const metaNote = `[PLANNER_AUTO_DRAFT]${JSON.stringify({
        source: "WEEKLY_PLANNER",
        weeklyPlanId: input.planningTargetId,
        planningTargetId: input.planningTargetId,
        weekStartDate: targetBundle.target.periodStart,
        generatedOvertimeRows,
        allocations: targetBundle.rows.map(r => ({
          allocationKey: r.rowId,
          carId: r.carId,
          unitName: r.unitName ?? r.carId,
          divisionId: r.divisionId,
          divisionName: r.divisionName ?? "Unknown",
          targetHours: r.targetHours,
        })),
        note: "Generated via Work Control Planner",
      })}`;

      await connection.execute<ResultSetHeader>(
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
          targetBundle.target.periodStart,
          totalUnits,
          totalHours,
          input.actorId,
          input.actorName,
          metaNote,
        ],
      );

      for (const row of targetBundle.rows) {
        await connection.execute<ResultSetHeader>(
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
            `SPKD-${randomUUID().replace(/-/gu, "").slice(0, 20).toUpperCase()}`,
            spkId,
            row.rowId,
            row.unitName ?? row.carId,
            row.divisionName ?? `Division ${row.divisionId}`,
            row.targetOutput,
            "Belum dibagi",
            row.targetHours,
            row.targetFinishDate,
          ],
        );

      }

      await connection.execute<ResultSetHeader>(
        `
          UPDATE planning_targets
          SET status = 'RELEASED',
              released_by = ?,
              released_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.actorId, input.planningTargetId],
      );

      await connection.commit();
      return {
        spkIds: [spkId],
        message: "SPK berhasil dibuat dari Work Control.",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createOvertimeRecommendation(
    input: CreateOvertimeRecommendationInput,
  ): Promise<{ recommendationId: string; status: "RECOMMENDED" }> {
    const pool = this.poolFactory();
    const recommendationId = randomUUID();
    await pool.execute<ResultSetHeader>(
      `
        DELETE FROM overtime_recommendations
        WHERE planning_target_id = ?
          AND division_id = ?
          AND status = 'RECOMMENDED'
      `,
      [input.planningTargetId, Number.parseInt(input.divisionId, 10)],
    );
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO overtime_recommendations (
          id,
          planning_target_id,
          unit_id,
          division_id,
          shortage_hours,
          recommended_overtime_hours,
          reason,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'RECOMMENDED')
      `,
      [
        recommendationId,
        input.planningTargetId,
        input.unitId ?? null,
        Number.parseInt(input.divisionId, 10),
        input.shortageHours,
        input.shortageHours,
        input.reason,
      ],
    );

    return {
      recommendationId,
      status: "RECOMMENDED",
    };
  }
}
