import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  PlanningWorkspaceSummary,
  WeeklyGapResult,
} from "@smsystem/contracts/calendar";
import type { MonitoringReferences } from "@smsystem/contracts/monitoring";
import { permissionCodes } from "@smsystem/permissions";
import type { WebSession } from "@/services/auth/session.service";
import {
  DefaultCalendarService,
  type CalendarService,
} from "@/services/calendar.service";
import {
  DefaultMonitoringService,
  type MonitoringService,
} from "@/services/monitoring.service";
import {
  DefaultWeeklyPlanningService,
  type WeeklyPlanningService,
} from "@/services/planning.service";

export interface PlanningWorkspaceSummaryInput {
  asOfDate: string;
  startDate: string;
  endDate: string;
  includeOvertime: boolean;
  weekStartDate: string;
  riskQuery: GridQueryState;
}

export interface PlanningWorkspaceService {
  getSummary(
    session: WebSession,
    input: PlanningWorkspaceSummaryInput,
  ): Promise<PlanningWorkspaceSummary>;
}

function emptyGap(): WeeklyGapResult {
  return {
    targetHours: 0,
    totalNetCapacity: 0,
    deficit: 0,
    byDivision: [],
  };
}

function toDivisionOptions(references: MonitoringReferences) {
  return references.divisions;
}

export class DefaultPlanningWorkspaceService implements PlanningWorkspaceService {
  constructor(
    private readonly calendarService: CalendarService = new DefaultCalendarService(),
    private readonly planningService: WeeklyPlanningService = new DefaultWeeklyPlanningService(),
    private readonly monitoringService: MonitoringService = new DefaultMonitoringService(),
  ) {}

  async getSummary(
    session: WebSession,
    input: PlanningWorkspaceSummaryInput,
  ): Promise<PlanningWorkspaceSummary> {
    const [weeklyConfigs, workingDays, deliveryRisk, references, weeklyPlan] =
      await Promise.all([
        this.calendarService.listWeeklyConfigs(session),
        this.calendarService.getWorkingDays(session, {
          startDate: input.startDate,
          endDate: input.endDate,
          includeOvertime: input.includeOvertime,
        }),
        this.calendarService.listDeliveryRisk(
          session,
          input.riskQuery,
          input.asOfDate,
        ),
        this.monitoringService.listReferences(session),
        this.getWeeklyPlanSummary(session, input.weekStartDate),
      ]);

    return {
      asOfDate: input.asOfDate,
      weekStartDate: input.weekStartDate,
      canManage: session.user.permissions.includes(permissionCodes.updatePlan),
      weeklyConfigs,
      workingDays,
      deliveryRisk: {
        rows: deliveryRisk.data,
        meta: deliveryRisk.meta,
        query: deliveryRisk.query,
        summary: deliveryRisk.summary,
      },
      divisionOptions: toDivisionOptions(references),
      weeklyPlan,
    };
  }

  private async getWeeklyPlanSummary(
    session: WebSession,
    weekStartDate: string,
  ): Promise<PlanningWorkspaceSummary["weeklyPlan"]> {
    const plan = await this.planningService.getPlanByWeek(weekStartDate);
    if (!plan) {
      return {
        plan: null,
        capacity: [],
        gap: emptyGap(),
        alerts: [],
        recommendations: null,
        overtime: [],
        divisionInputs: [],
        units: [],
        planningUnits: await this.planningService.listPlanningUnitsForWeek(session, weekStartDate),
      };
    }

    let capacity = await this.planningService.getCapacityCache(plan.planId);
    if (capacity.length === 0) {
      capacity = await this.planningService.recomputeCapacity(plan.planId);
    }

    const [gap, alerts, recommendations, overtime, divisionInputs, units, planningUnits] = await Promise.all([
      this.planningService.computeGap(plan.planId),
      this.planningService.generateAlerts(session, plan.planId),
      this.planningService.getRecommendations(session, plan.planId),
      this.planningService.listPlanOvertime(plan.planId),
      this.planningService.listPlanDivisionInputs(plan.planId),
      this.planningService.listPlanUnits(plan.planId),
      this.planningService.listPlanningUnitsForWeek(session, plan.weekStartDate),
    ]);

    return {
      plan,
      capacity,
      gap,
      alerts,
      recommendations,
      overtime,
      divisionInputs,
      units,
      planningUnits,
    };
  }
}
