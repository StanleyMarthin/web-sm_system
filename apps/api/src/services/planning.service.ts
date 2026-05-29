import type {
  DivisionCapacitySummary,
  PlanDivisionInput,
  PlanAlert,
  PlanRecommendation,
  PlanRecommendationDivision,
  PlanningMaterialStatus,
  PlanRecommendationUnit,
  PlanOvertimeInput,
  PlanUnitInput,
  WeeklyGapResult,
  WeeklyPlanDivisionInputRecord,
  WeeklyPlanRecord,
  WeeklyPlanRequest,
} from "@smsystem/contracts/calendar";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlCalendarRepository,
  type CalendarRepository,
  type PlanningDivisionDemandRow,
  type PlanningUnitRiskRow,
  type PlanOvertimeRow,
  type PlanUnitRow,
} from "@/repositories/calendar.repo";
import {
  MySqlSpkRepository,
  type SpkRepository,
} from "@/repositories/spk.repo";
import type { WebSession } from "@/services/auth/session.service";

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

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function diffCalendarDays(fromDate: string, toDate: string): number {
  const from = parseIsoDate(fromDate).getTime();
  const to = parseIsoDate(toDate).getTime();
  return Math.round((to - from) / 86_400_000);
}

function isMonday(isoDate: string): boolean {
  return parseIsoDate(isoDate).getUTCDay() === 1;
}

function buildWeekWindow(weekStartDate: string): { weekStartDate: string; weekEndDate: string } {
  return {
    weekStartDate,
    weekEndDate: formatIsoDate(addDays(parseIsoDate(weekStartDate), 6)),
  };
}

function groupPlanUnitsByDivision(rows: PlanUnitRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of rows) {
    totals.set(row.divisionId, (totals.get(row.divisionId) ?? 0) + row.allocatedHours);
  }
  return totals;
}

function groupPlanUnitsByCar(rows: PlanUnitRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.carId, (totals.get(row.carId) ?? 0) + row.allocatedHours);
  }
  return totals;
}

function groupOvertimeByDivision(rows: PlanOvertimeRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of rows) {
    const headContribution = row.includeHead ? 1 : 0;
    const totalHours = (row.memberCount + headContribution) * row.overtimeHours;
    totals.set(row.divisionId, (totals.get(row.divisionId) ?? 0) + totalHours);
  }
  return totals;
}

function groupPlanUnitsByCarDivision(rows: PlanUnitRow[]): Map<string, PlanUnitRow> {
  return new Map(rows.map((row) => [`${row.carId}:${row.divisionId}`, row]));
}

function computeTotalWeekHours(
  configs: Awaited<ReturnType<CalendarRepository["listWeeklyConfigs"]>>,
  weekStartDate: string,
): number {
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(parseIsoDate(weekStartDate), offset);
    const dateIso = formatIsoDate(date);
    const weekKey = date.getUTCDay() === 0
      ? formatIsoDate(addDays(date, -6))
      : formatIsoDate(addDays(date, 1 - date.getUTCDay()));
    const config = configs.find((entry) => entry.weekStartDate === weekKey);

    if (date.getUTCDay() === 6) {
      total += Number(config?.saturdayHours ?? 5);
    } else if (date.getUTCDay() === 0) {
      total += Number(config?.sundayHours ?? 0);
    } else {
      total += Number(config?.weekdayHours ?? 8);
    }

    void dateIso;
  }

  return Number(total.toFixed(2));
}

function getDayName(isoDate: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parseIsoDate(isoDate));
}

function getDayType(isoDate: string): "WEEKDAY" | "SATURDAY" | "SUNDAY" {
  const day = parseIsoDate(isoDate).getUTCDay();
  if (day === 6) {
    return "SATURDAY";
  }
  if (day === 0) {
    return "SUNDAY";
  }
  return "WEEKDAY";
}

function getWeekKey(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const day = date.getUTCDay();
  if (day === 0) {
    return formatIsoDate(addDays(date, -6));
  }
  return formatIsoDate(addDays(date, 1 - day));
}

function listIsoDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let cursor = parseIsoDate(startDate); cursor <= parseIsoDate(endDate); cursor = addDays(cursor, 1)) {
    dates.push(formatIsoDate(cursor));
  }
  return dates;
}

function getConfigForDate(
  configs: Awaited<ReturnType<CalendarRepository["listWeeklyConfigs"]>>,
  isoDate: string,
) {
  const weekKey = getWeekKey(isoDate);
  return configs.find((entry) => entry.weekStartDate === weekKey);
}

function getDailyOvertimeLimit(
  configs: Awaited<ReturnType<CalendarRepository["listWeeklyConfigs"]>>,
  isoDate: string,
): number {
  const config = getConfigForDate(configs, isoDate);
  const dayType = getDayType(isoDate);
  if (dayType === "SATURDAY") {
    return Number(config?.saturdayOvertimeHours ?? 3);
  }
  if (dayType === "SUNDAY") {
    return Number(config?.sundayOvertimeHours ?? 0);
  }
  return Number(config?.weekdayOvertimeHours ?? 2);
}

function clampNonNegative(value: number): number {
  return Number(Math.max(0, value).toFixed(2));
}

function sumValues<T>(rows: T[], picker: (row: T) => number): number {
  return Number(rows.reduce((total, row) => total + picker(row), 0).toFixed(2));
}

interface RankedPlanningDemandRow extends PlanningDivisionDemandRow {
  priorityRank: number | null;
  unitPriorityScore: number;
  rowPriorityScore: number;
}

function buildGap(targetHours: number, byDivision: DivisionCapacitySummary[]): WeeklyGapResult {
  const totalNetCapacity = Number(
    byDivision.reduce((sum, row) => sum + row.netCapacityHours, 0).toFixed(2),
  );

  return {
    targetHours,
    totalNetCapacity,
    deficit: Number((targetHours - totalNetCapacity).toFixed(2)),
    byDivision,
  };
}

function findOvertimeStreakAlerts(rows: PlanOvertimeRow[]): PlanAlert[] {
  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    const dates = grouped.get(row.divisionId) ?? [];
    if (!dates.includes(row.overtimeDate)) {
      dates.push(row.overtimeDate);
    }
    grouped.set(row.divisionId, dates);
  }

  const alerts: PlanAlert[] = [];
  for (const [divisionId, dates] of grouped.entries()) {
    const sorted = [...dates].sort((left, right) =>
      parseIsoDate(left).getTime() - parseIsoDate(right).getTime(),
    );

    let streak = 1;
    let maxStreak = sorted.length > 0 ? 1 : 0;
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = parseIsoDate(sorted[index - 1]);
      const current = parseIsoDate(sorted[index]);
      const diff = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
      if (diff === 1) {
        streak += 1;
      } else {
        streak = 1;
      }

      if (streak > maxStreak) {
        maxStreak = streak;
      }
    }

    if (maxStreak >= 4) {
      alerts.push({
        type: "OVERTIME_EXCESSIVE",
        severity: "WARNING",
        message: `Divisi ${divisionId} dijadwalkan lembur ${maxStreak} hari berturut-turut.`,
        divisionId,
        meta: { maxStreakDays: maxStreak },
      });
    }
  }

  return alerts;
}

function isMaterialBlocked(status: PlanningMaterialStatus): boolean {
  return status !== "READY";
}

function buildAutoDraftOvertimeRows(
  recommendation: PlanRecommendation | null,
  memberCounts: Map<number, number>,
): PlanOvertimeInput[] {
  if (!recommendation) {
    return [];
  }

  const rows: PlanOvertimeInput[] = [];

  for (const division of recommendation.divisions) {
    const memberCountBase = Math.max(1, memberCounts.get(division.divisionId) ?? 1);
    for (const schedule of division.schedule) {
      if (schedule.extraHoursRecommended <= 0) {
        continue;
      }

      const overtimeHours = Number(
        (schedule.extraHoursRecommended / memberCountBase).toFixed(2),
      );
      if (overtimeHours <= 0) {
        continue;
      }

      rows.push({
        divisionId: division.divisionId,
        overtimeDate: schedule.date,
        dayType: getDayType(schedule.date),
        overtimeHours,
        memberCount: memberCountBase,
        includeHead: false,
        notes: `Auto-draft dari planner mingguan untuk ${division.divisionName}.`,
      });
    }
  }

  return rows;
}

export interface WeeklyPlanPublishResult {
  plan: WeeklyPlanRecord;
  spkDraftId: string;
  generatedOvertimeRows: number;
}

export interface WeeklyPlanningService {
  upsertPlan(session: WebSession, input: WeeklyPlanRequest): Promise<WeeklyPlanRecord>;
  getPlanByWeek(weekStartDate: string): Promise<WeeklyPlanRecord | null>;
  listPlanOvertime(planId: string): Promise<PlanOvertimeRow[]>;
  listPlanDivisionInputs(planId: string): Promise<WeeklyPlanDivisionInputRecord[]>;
  listPlanUnits(planId: string): Promise<PlanUnitRow[]>;
  listPlanningUnitsForWeek(session: WebSession, weekStartDate: string): Promise<PlanningUnitRiskRow[]>;
  setOvertime(session: WebSession, planId: string, rows: PlanOvertimeInput[]): Promise<void>;
  setDivisionInputs(session: WebSession, planId: string, rows: PlanDivisionInput[]): Promise<void>;
  setUnitAllocations(session: WebSession, planId: string, rows: PlanUnitInput[]): Promise<void>;
  snapshotAbsence(session: WebSession, planId: string): Promise<{ snapshotCount: number; capacity: DivisionCapacitySummary[] }>;
  recomputeCapacity(planId: string): Promise<DivisionCapacitySummary[]>;
  computeGap(planId: string): Promise<WeeklyGapResult>;
  generateAlerts(session: WebSession, planId: string): Promise<PlanAlert[]>;
  getRecommendations(session: WebSession, planId: string): Promise<PlanRecommendation>;
  getCapacityCache(planId: string): Promise<DivisionCapacitySummary[]>;
  publishPlan(session: WebSession, planId: string): Promise<WeeklyPlanPublishResult>;
}

export class DefaultWeeklyPlanningService implements WeeklyPlanningService {
  constructor(
    private readonly repository: CalendarRepository = new MySqlCalendarRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
    private readonly spkRepository: SpkRepository = new MySqlSpkRepository(),
  ) {}

  async upsertPlan(session: WebSession, input: WeeklyPlanRequest): Promise<WeeklyPlanRecord> {
    if (!isMonday(input.weekStartDate)) {
      throw new Error("WEEK_START_MUST_BE_MONDAY");
    }

    const plan = await this.repository.createOrUpdateWeeklyPlan({
      ...input,
      createdBy: session.user.employeeId,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.upsert",
      module: "planning",
      recordId: plan.planId,
      newValue: {
        weekStartDate: plan.weekStartDate,
        targetHours: plan.targetHours,
        labourRate: plan.labourRate,
      },
    });

    return plan;
  }

  async getPlanByWeek(weekStartDate: string): Promise<WeeklyPlanRecord | null> {
    return this.repository.getWeeklyPlan(weekStartDate);
  }

  async listPlanOvertime(planId: string): Promise<PlanOvertimeRow[]> {
    return this.repository.listPlanOvertime(planId);
  }

  async listPlanDivisionInputs(planId: string): Promise<WeeklyPlanDivisionInputRecord[]> {
    const plan = await this.requirePlan(planId);
    const [technicalDivisions, autoCounts, storedRows] = await Promise.all([
      this.repository.listTechnicalDivisions(),
      this.repository.countActiveMembersByDivision(plan.weekStartDate),
      this.repository.listPlanDivisionInputs(planId),
    ]);

    const autoCountMap = new Map(autoCounts.map((row) => [row.divisionId, row.count]));
    const storedMap = new Map(storedRows.map((row) => [row.divisionId, row]));

    return technicalDivisions.map((division) => {
      const autoMemberCount = autoCountMap.get(division.divisionId) ?? 0;
      const stored = storedMap.get(division.divisionId);

      return {
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        autoMemberCount,
        memberCount: stored?.memberCount ?? autoMemberCount,
      };
    });
  }

  async listPlanUnits(planId: string): Promise<PlanUnitRow[]> {
    return this.repository.listPlanUnits(planId);
  }

  async listPlanningUnitsForWeek(
    session: WebSession,
    weekStartDate: string,
  ): Promise<PlanningUnitRiskRow[]> {
    const weekWindow = buildWeekWindow(weekStartDate);
    return this.repository.listPlanningUnitsForRisk({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      weekStartDate: weekWindow.weekStartDate,
      weekEndDate: weekWindow.weekEndDate,
    });
  }

  async setOvertime(
    session: WebSession,
    planId: string,
    rows: PlanOvertimeInput[],
  ): Promise<void> {
    await this.requirePlan(planId);
    await this.repository.upsertPlanOvertime(planId, rows);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.set_overtime",
      module: "planning",
      recordId: planId,
      newValue: {
        rows: rows.length,
      },
    });
  }

  async setDivisionInputs(
    session: WebSession,
    planId: string,
    rows: PlanDivisionInput[],
  ): Promise<void> {
    await this.requirePlan(planId);
    await this.repository.upsertPlanDivisionInputs(planId, rows);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.set_divisions",
      module: "planning",
      recordId: planId,
      newValue: {
        rows: rows.length,
      },
    });
  }

  async setUnitAllocations(
    session: WebSession,
    planId: string,
    rows: PlanUnitInput[],
  ): Promise<void> {
    await this.requirePlan(planId);
    await this.repository.upsertPlanUnits(planId, rows);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.set_units",
      module: "planning",
      recordId: planId,
      newValue: {
        rows: rows.length,
      },
    });
  }

  async snapshotAbsence(
    session: WebSession,
    planId: string,
  ): Promise<{ snapshotCount: number; capacity: DivisionCapacitySummary[] }> {
    const plan = await this.requirePlan(planId);
    const weekWindow = buildWeekWindow(plan.weekStartDate);

    const snapshotCount = await this.repository.snapshotAbsenceForWeek(
      planId,
      weekWindow.weekStartDate,
      weekWindow.weekEndDate,
    );
    const capacity = await this.recomputeCapacity(planId);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.snapshot_absence",
      module: "planning",
      recordId: planId,
      newValue: {
        snapshotCount,
      },
    });

    return { snapshotCount, capacity };
  }

  async recomputeCapacity(planId: string): Promise<DivisionCapacitySummary[]> {
    const plan = await this.requirePlan(planId);
    const weekWindow = buildWeekWindow(plan.weekStartDate);

    const [
      technicalDivisions,
      activeMemberCounts,
      divisionInputRows,
      overtimeRows,
      unitRows,
      absenceLossRows,
      configs,
    ] = await Promise.all([
      this.repository.listTechnicalDivisions(),
      this.repository.countActiveMembersByDivision(weekWindow.weekStartDate),
      this.repository.listPlanDivisionInputs(planId),
      this.repository.listPlanOvertime(planId),
      this.repository.listPlanUnits(planId),
      this.repository.listAbsenceLossByDivision(planId),
      this.repository.listWeeklyConfigs(weekWindow.weekStartDate, weekWindow.weekEndDate),
    ]);

    const activeMap = new Map(activeMemberCounts.map((row) => [row.divisionId, row.count]));
    const overrideMap = new Map(divisionInputRows.map((row) => [row.divisionId, row.memberCount]));
    const overtimeMap = groupOvertimeByDivision(overtimeRows);
    const allocationMap = groupPlanUnitsByDivision(unitRows);
    const absenceMap = new Map(absenceLossRows.map((row) => [row.divisionId, row.lostHours]));
    const totalWeeklyHours = computeTotalWeekHours(configs, weekWindow.weekStartDate);

    const summaries: DivisionCapacitySummary[] = technicalDivisions.map((division) => {
      const memberCountBase = overrideMap.get(division.divisionId) ?? (activeMap.get(division.divisionId) ?? 0);
      const absenceLostHours = Number((absenceMap.get(division.divisionId) ?? 0).toFixed(2));
      const fullAbsenceMembers = totalWeeklyHours > 0
        ? Math.floor(absenceLostHours / totalWeeklyHours)
        : 0;
      const memberCountActive = Math.max(0, memberCountBase - fullAbsenceMembers);
      const normalCapacityHours = Number((memberCountBase * totalWeeklyHours).toFixed(2));
      const overtimeCapacityHours = Number((overtimeMap.get(division.divisionId) ?? 0).toFixed(2));
      const allocatedHours = Number((allocationMap.get(division.divisionId) ?? 0).toFixed(2));
      const netCapacityHours = Number(
        (normalCapacityHours + overtimeCapacityHours - absenceLostHours).toFixed(2),
      );
      const utilizationPct =
        netCapacityHours > 0
          ? Number(((allocatedHours / netCapacityHours) * 100).toFixed(2))
          : 0;

      return {
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        memberCountActive,
        normalCapacityHours,
        overtimeCapacityHours,
        absenceLostHours,
        netCapacityHours,
        allocatedHours,
        utilizationPct,
      };
    });

    await this.repository.upsertCapacityCache(planId, summaries);
    return summaries;
  }

  async computeGap(planId: string): Promise<WeeklyGapResult> {
    const plan = await this.requirePlan(planId);
    let capacity = await this.repository.getCapacityCache(planId);
    if (capacity.length === 0) {
      capacity = await this.recomputeCapacity(planId);
    }

    return buildGap(plan.targetHours, capacity);
  }

  async generateAlerts(session: WebSession, planId: string): Promise<PlanAlert[]> {
    const plan = await this.requirePlan(planId);
    const weekWindow = buildWeekWindow(plan.weekStartDate);

    let capacity = await this.repository.getCapacityCache(planId);
    if (capacity.length === 0) {
      capacity = await this.recomputeCapacity(planId);
    }

    const gap = buildGap(plan.targetHours, capacity);
    const alerts: PlanAlert[] = [];

    if (gap.deficit > 0) {
      alerts.push({
        type: "GAP_DEFICIT",
        severity: "CRITICAL",
        message: `Target mingguan kurang ${gap.deficit.toFixed(2)} jam dari kapasitas bersih.`,
        meta: {
          targetHours: gap.targetHours,
          totalNetCapacity: gap.totalNetCapacity,
        },
      });
    }

    if (gap.totalNetCapacity > gap.targetHours * 1.3) {
      alerts.push({
        type: "GAP_SURPLUS",
        severity: "INFO",
        message: "Kapasitas minggu ini jauh di atas target. Pertimbangkan optimasi alokasi.",
        meta: {
          targetHours: gap.targetHours,
          totalNetCapacity: gap.totalNetCapacity,
        },
      });
    }

    for (const row of capacity) {
      if (row.allocatedHours > row.netCapacityHours) {
        alerts.push({
          type: "ALLOCATION_OVERFLOW",
          severity: "CRITICAL",
          message: `Alokasi divisi ${row.divisionName} melebihi kapasitas bersih.`,
          divisionId: row.divisionId,
          meta: {
            allocatedHours: row.allocatedHours,
            netCapacityHours: row.netCapacityHours,
          },
        });
      }

      if (row.normalCapacityHours > 0 && row.absenceLostHours > row.normalCapacityHours * 0.2) {
        alerts.push({
          type: "ABSENCE_IMPACT",
          severity: "WARNING",
          message: `Absensi di divisi ${row.divisionName} menurunkan kapasitas lebih dari 20%.`,
          divisionId: row.divisionId,
          meta: {
            absenceLostHours: row.absenceLostHours,
            normalCapacityHours: row.normalCapacityHours,
          },
        });
      }
    }

    const [overtimeRows, planUnits, planningUnits] = await Promise.all([
      this.repository.listPlanOvertime(planId),
      this.repository.listPlanUnits(planId),
      this.repository.listPlanningUnitsForRisk({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        weekStartDate: weekWindow.weekStartDate,
        weekEndDate: weekWindow.weekEndDate,
      }),
    ]);

    alerts.push(...findOvertimeStreakAlerts(overtimeRows));

    const allocationByCar = groupPlanUnitsByCar(planUnits);

    for (const unit of planningUnits) {
      if (!unit.targetDeliveryDate || unit.remainingHours <= 0) {
        continue;
      }

      const daysToDeadline = diffCalendarDays(weekWindow.weekStartDate, unit.targetDeliveryDate);
      if (daysToDeadline < 0 || daysToDeadline > 7) {
        continue;
      }

      const allocatedHours = allocationByCar.get(unit.carId) ?? 0;
      if (allocatedHours < unit.remainingHours * 0.5) {
        alerts.push({
          type: "UNIT_RISK",
          severity: daysToDeadline <= 3 ? "CRITICAL" : "WARNING",
          message: `Unit ${unit.unitName} berisiko tidak selesai minggu ini karena alokasi masih rendah.`,
          carId: unit.carId,
          meta: {
            daysToDeadline,
            remainingHours: unit.remainingHours,
            allocatedHours,
          },
        });
      }
    }

    const nonMarginIdleUnits = planningUnits.filter(
      (unit) => !unit.isMargin && (allocationByCar.get(unit.carId) ?? 0) <= 0,
    );

    for (const unit of nonMarginIdleUnits) {
      alerts.push({
        type: "NON_MARGIN_IDLE",
        severity: "WARNING",
        message: `Unit non-margin ${unit.unitName} belum mendapatkan alokasi jam minggu ini.`,
        carId: unit.carId,
        meta: {
          remainingHours: unit.remainingHours,
        },
      });
    }

    return alerts;
  }

  async getRecommendations(
    session: WebSession,
    planId: string,
  ): Promise<PlanRecommendation> {
    const plan = await this.requirePlan(planId);
    const weekWindow = buildWeekWindow(plan.weekStartDate);

    let capacity = await this.repository.getCapacityCache(planId);
    if (capacity.length === 0) {
      capacity = await this.recomputeCapacity(planId);
    }

    const [overtimeRows, unitRows, configs, demandRows] = await Promise.all([
      this.repository.listPlanOvertime(planId),
      this.repository.listPlanUnits(planId),
      this.repository.listWeeklyConfigs(weekWindow.weekStartDate, weekWindow.weekEndDate),
      this.repository.listPlanningDivisionDemand({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        weekStartDate: weekWindow.weekStartDate,
        weekEndDate: weekWindow.weekEndDate,
      }),
    ]);

    const capacityMap = new Map(capacity.map((row) => [row.divisionId, row]));
    const manualAllocationMap = groupPlanUnitsByCarDivision(unitRows);
    const totalDemandHours = clampNonNegative(sumValues(demandRows, (row) => row.remainingHours));
    const remainingTargetState = {
      hours: clampNonNegative(Math.min(plan.targetHours, totalDemandHours)),
    };
    const recommendedByDivision = new Map<number, number>();
    const demandByUnit = new Map<string, RankedPlanningDemandRow[]>();

    for (const row of demandRows) {
      const manualAllocation = manualAllocationMap.get(`${row.carId}:${row.divisionId}`);
      const unitRowsForCar = demandByUnit.get(row.carId) ?? [];
      unitRowsForCar.push({
        ...row,
        priorityRank: manualAllocation?.priorityRank ?? null,
        unitPriorityScore: 0,
        rowPriorityScore: 0,
      });
      demandByUnit.set(row.carId, unitRowsForCar);
    }

    const sortedUnits = [...demandByUnit.entries()]
      .map(([carId, rows]) => {
        const totalRemainingHoursForUnit = clampNonNegative(
          sumValues(rows, (row) => row.remainingHours),
        );
        const lockedDivisionName =
          rows
            .filter((row) => row.lockedPanelCount > 0)
            .sort((left, right) => right.lockedPanelCount - left.lockedPanelCount)[0]
            ?.divisionName ?? null;
        const earliestDeadline =
          rows
            .map((row) => row.targetDeliveryDate)
            .filter((date): date is string => Boolean(date))
            .sort((left, right) => parseIsoDate(left).getTime() - parseIsoDate(right).getTime())[0] ??
          null;
        const daysToDeadline =
          earliestDeadline === null ? null : diffCalendarDays(weekWindow.weekStartDate, earliestDeadline);
        const hasLockedPanels = rows.some((row) => row.lockedPanelCount > 0);
        const isNonMargin = rows.some((row) => !row.isMargin);
        const isBlockedByMaterial = rows.some((row) => isMaterialBlocked(row.materialStatus));
        const deadlineScore =
          daysToDeadline === null
            ? 10
            : daysToDeadline < 0
              ? 70
              : Math.max(0, 40 - (daysToDeadline * 5));
        const unitPriorityScore =
          deadlineScore +
          (hasLockedPanels ? 24 : 0) +
          (isNonMargin ? 12 : 0) +
          (isBlockedByMaterial ? 18 : 0) +
          Math.min(20, totalRemainingHoursForUnit / 6);
        const rankedRows = rows
          .map((row) => {
            const lockedPenalty = hasLockedPanels && row.lockedPanelCount === 0 ? -18 : 0;
            const deadlineBoost =
              row.targetDeliveryDate === null
                ? 8
                : (() => {
                    const rowDaysToDeadline = diffCalendarDays(
                      weekWindow.weekStartDate,
                      row.targetDeliveryDate,
                    );
                    if (rowDaysToDeadline < 0) {
                      return 50;
                    }
                    return Math.max(0, 26 - (rowDaysToDeadline * 4));
                  })();

            return {
              ...row,
              unitPriorityScore,
              rowPriorityScore:
                deadlineBoost +
                (row.lockedPanelCount * 10) +
                (row.priorityRank !== null ? Math.max(0, 10 - row.priorityRank) : 0) +
                ((100 - row.progressPercent) / 5) +
                Math.min(14, row.remainingHours / 8) +
                lockedPenalty,
            };
          })
          .sort((left, right) => {
            if (right.lockedPanelCount !== left.lockedPanelCount) {
              return right.lockedPanelCount - left.lockedPanelCount;
            }
            if ((left.priorityRank ?? Number.MAX_SAFE_INTEGER) !== (right.priorityRank ?? Number.MAX_SAFE_INTEGER)) {
              return (left.priorityRank ?? Number.MAX_SAFE_INTEGER) - (right.priorityRank ?? Number.MAX_SAFE_INTEGER);
            }
            if (right.rowPriorityScore !== left.rowPriorityScore) {
              return right.rowPriorityScore - left.rowPriorityScore;
            }
            return right.remainingHours - left.remainingHours;
          });

        return {
          carId,
          rows: rankedRows,
          unitPriorityScore,
          totalRemainingHours: totalRemainingHoursForUnit,
          lockedDivisionName,
          daysToDeadline,
          isBlockedByMaterial,
        };
      })
      .sort((left, right) => {
        if (right.unitPriorityScore !== left.unitPriorityScore) {
          return right.unitPriorityScore - left.unitPriorityScore;
        }
        return right.totalRemainingHours - left.totalRemainingHours;
      });

    const unitRecommendations: PlanRecommendationUnit[] = sortedUnits.map((unit) => {
      const isMaterialReady = unit.rows.every((row) => row.materialReady);
      const materialStatus = unit.rows[0]?.materialStatus ?? "READY";
      const materialNote = unit.rows[0]?.materialNote ?? null;
      const isBudgetLocked = !unit.rows.every((row) => row.isMargin) || !isMaterialReady;
      const recommendedDivisions = unit.rows.map((row) => {
        const recommendedHours = isBudgetLocked
          ? 0
          : clampNonNegative(
              Math.min(row.remainingHours, remainingTargetState.hours),
            );
        remainingTargetState.hours = clampNonNegative(
          remainingTargetState.hours - recommendedHours,
        );
        if (recommendedHours > 0) {
          recommendedByDivision.set(
            row.divisionId,
            clampNonNegative((recommendedByDivision.get(row.divisionId) ?? 0) + recommendedHours),
          );
        }

        return {
          divisionId: row.divisionId,
          divisionName: row.divisionName,
          remainingHours: row.remainingHours,
          recommendedHours,
          progressPercent: row.progressPercent,
          panelCount: row.panelCount,
          lockedPanelCount: row.lockedPanelCount,
          isFocus: recommendedHours > 0 && row === unit.rows[0],
        };
      });

      const recommendedHours = clampNonNegative(
        sumValues(recommendedDivisions, (row) => row.recommendedHours),
      );
      const focusReason = !unit.rows.every((row) => row.isMargin)
        ? "Unit ini non-margin, jadi target jam kerja dikunci agar tidak memakan kapasitas utama."
        : !isMaterialReady
          ? materialNote ?? "Material belum siap, jadi target jam kerja belum bisa dibuka."
          : unit.lockedDivisionName
        ? `Lanjutkan ${unit.lockedDivisionName} lebih dulu agar unit ini tidak bentrok antar divisi.`
        : unit.daysToDeadline !== null && unit.daysToDeadline <= 3
          ? "Deadline sudah dekat, jadi unit ini perlu didorong lebih dulu."
          : recommendedDivisions.some((row) => row.recommendedHours > 0)
            ? "Unit ini layak didorong minggu ini karena sisa jamnya masih besar."
            : "Unit ini belum jadi fokus minggu ini karena target jam sudah habis di unit yang lebih mendesak.";

      return {
        carId: unit.carId,
        unitName: unit.rows[0]?.unitName ?? unit.carId,
        customerName: unit.rows[0]?.customerName ?? null,
        targetDeliveryDate: unit.rows[0]?.targetDeliveryDate ?? null,
        isMargin: unit.rows.every((row) => row.isMargin),
        materialStatus,
        materialReady: isMaterialReady,
        materialNote,
        totalRemainingHours: unit.totalRemainingHours,
        recommendedHours,
        uncoveredHours: clampNonNegative(unit.totalRemainingHours - recommendedHours),
        lockedDivisionName: unit.lockedDivisionName,
        focusReason,
        divisions: recommendedDivisions,
      };
    });

    const overtimeByDivisionDate = new Map<string, number>();
    for (const row of overtimeRows) {
      const totalHours = (row.memberCount + (row.includeHead ? 1 : 0)) * row.overtimeHours;
      const key = `${row.divisionId}:${row.overtimeDate}`;
      overtimeByDivisionDate.set(
        key,
        clampNonNegative((overtimeByDivisionDate.get(key) ?? 0) + totalHours),
      );
    }

    const lockedUnitCountByDivision = new Map<number, number>();
    for (const row of demandRows) {
      if (row.lockedPanelCount <= 0) {
        continue;
      }

      const key = row.divisionId;
      lockedUnitCountByDivision.set(key, (lockedUnitCountByDivision.get(key) ?? 0) + 1);
    }

    const divisionIds = new Set<number>([
      ...capacity.map((row) => row.divisionId),
      ...recommendedByDivision.keys(),
      ...demandRows.map((row) => row.divisionId),
    ]);
    const weekDates = listIsoDateRange(weekWindow.weekStartDate, weekWindow.weekEndDate);
    const divisionRecommendations: PlanRecommendationDivision[] = [...divisionIds]
      .map((divisionId) => {
        const capacityRow = capacityMap.get(divisionId);
        const targetHours = clampNonNegative(recommendedByDivision.get(divisionId) ?? 0);
        const effectiveNormalHours = clampNonNegative(
          (capacityRow?.normalCapacityHours ?? 0) - (capacityRow?.absenceLostHours ?? 0),
        );
        const scheduledOvertimeHours = clampNonNegative(capacityRow?.overtimeCapacityHours ?? 0);
        let extraNeeded = clampNonNegative(
          targetHours - effectiveNormalHours - scheduledOvertimeHours,
        );
        const schedule: PlanRecommendationDivision["schedule"] = weekDates.map((date: string) => {
          const memberCountActive = capacityRow?.memberCountActive ?? 0;
          const allowedTeamHours = clampNonNegative(
            memberCountActive * getDailyOvertimeLimit(configs, date),
          );
          const scheduledHours = overtimeByDivisionDate.get(`${divisionId}:${date}`) ?? 0;
          const remainingCapacityHours = clampNonNegative(allowedTeamHours - scheduledHours);
          const extraHoursRecommended = clampNonNegative(
            Math.min(extraNeeded, remainingCapacityHours),
          );
          extraNeeded = clampNonNegative(extraNeeded - extraHoursRecommended);

          return {
            date,
            dayName: getDayName(date),
            extraHoursRecommended,
            remainingCapacityHours,
          };
        });
        const additionalOvertimeHours = clampNonNegative(
          sumValues(schedule, (row) => row.extraHoursRecommended),
        );
        const uncoveredHours = extraNeeded;

        return {
          divisionId,
          divisionName:
            capacityRow?.divisionName ??
            demandRows.find((row) => row.divisionId === divisionId)?.divisionName ??
            `Division ${divisionId}`,
          targetHours,
          effectiveNormalHours,
          scheduledOvertimeHours,
          additionalOvertimeHours,
          uncoveredHours,
          overtimeDaysRecommended: schedule.filter((row) => row.extraHoursRecommended > 0).length,
          lockedUnitCount: lockedUnitCountByDivision.get(divisionId) ?? 0,
          schedule,
        };
      })
      .filter((row) =>
        row.targetHours > 0 ||
        row.additionalOvertimeHours > 0 ||
        row.scheduledOvertimeHours > 0 ||
        row.lockedUnitCount > 0,
      )
      .sort((left, right) => {
        if (right.uncoveredHours !== left.uncoveredHours) {
          return right.uncoveredHours - left.uncoveredHours;
        }
        return right.targetHours - left.targetHours;
      });

    const effectiveNormalHours = clampNonNegative(
      sumValues(capacity, (row) => row.normalCapacityHours - row.absenceLostHours),
    );
    const scheduledOvertimeHours = clampNonNegative(
      sumValues(capacity, (row) => row.overtimeCapacityHours),
    );
    const additionalOvertimeHours = clampNonNegative(
      sumValues(divisionRecommendations, (row) => row.additionalOvertimeHours),
    );
    const uncoveredHours = clampNonNegative(
      sumValues(divisionRecommendations, (row) => row.uncoveredHours),
    );
    const bottleneckDivisionName =
      divisionRecommendations.find((row) => row.uncoveredHours > 0)?.divisionName ??
      divisionRecommendations[0]?.divisionName ??
      null;
    const overtimeDates = new Set(
      divisionRecommendations.flatMap((division) =>
        division.schedule
          .filter((row) => row.extraHoursRecommended > 0)
          .map((row) => row.date),
      ),
    );

    return {
      summary: {
        targetHours: plan.targetHours,
        totalDemandHours,
        effectiveNormalHours,
        scheduledOvertimeHours,
        additionalOvertimeHours,
        uncoveredHours,
        overtimeDaysRecommended: overtimeDates.size,
        bottleneckDivisionName,
      },
      divisions: divisionRecommendations,
      units: unitRecommendations,
    };
  }

  async getCapacityCache(planId: string): Promise<DivisionCapacitySummary[]> {
    return this.repository.getCapacityCache(planId);
  }

  async publishPlan(session: WebSession, planId: string): Promise<WeeklyPlanPublishResult> {
    const plan = await this.requirePlan(planId);
    const [planUnits, recommendations, divisionInputs] = await Promise.all([
      this.repository.listPlanUnits(planId),
      this.getRecommendations(session, planId),
      this.listPlanDivisionInputs(planId),
    ]);

    if (planUnits.length === 0) {
      throw new Error("PLANNING_UNITS_EMPTY");
    }

    const memberCounts = new Map(
      divisionInputs.map((row) => [row.divisionId, Math.max(1, row.memberCount)]),
    );
    const autoDraftOvertimeRows = buildAutoDraftOvertimeRows(recommendations, memberCounts);
    await this.repository.upsertPlanOvertime(planId, autoDraftOvertimeRows);

    await this.recomputeCapacity(planId);
    await this.repository.publishWeeklyPlan(planId);

    const updated = await this.requirePlan(planId);
    const spkDraft = await this.spkRepository.generateFromWeeklyPlan({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      weeklyPlanId: planId,
      weekStartDate: updated.weekStartDate,
      generatedOvertimeRows: autoDraftOvertimeRows.length,
      note: updated.notes,
      allocations: planUnits.map((row) => ({
        carId: row.carId,
        unitName: row.unitName,
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        targetHours: row.allocatedHours,
      })),
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "planning.publish",
      module: "planning",
      recordId: planId,
      oldValue: {
        status: plan.status,
      },
      newValue: {
        status: updated.status,
        spkDraftId: spkDraft.spkId,
        generatedOvertimeRows: autoDraftOvertimeRows.length,
      },
    });

    return {
      plan: updated,
      spkDraftId: spkDraft.spkId,
      generatedOvertimeRows: autoDraftOvertimeRows.length,
    };
  }

  private async requirePlan(planId: string): Promise<WeeklyPlanRecord> {
    const plan = await this.repository.getWeeklyPlanById(planId);
    if (!plan) {
      throw new Error("WEEKLY_PLAN_NOT_FOUND");
    }

    return plan;
  }
}
