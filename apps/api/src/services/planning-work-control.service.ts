import type {
  CreateTargetBody,
  OvertimeRecommendationBody,
} from "@smsystem/contracts/planning-work-control";
import type {
  PlanningWorkControlRepository,
} from "@/repositories/planning-work-control.repo";
import {
  MySqlPlanningWorkControlRepository,
} from "@/repositories/planning-work-control.repo";
import type { WebSession } from "@/services/auth/session.service";

export interface WorkControlCapacityParams {
  periodStart: string;
  periodEnd: string;
  divisionIds: number[];
  employeeId: string;
  scope: import("@smsystem/contracts/auth").AuthScope;
}

export interface PlanningWorkControlService {
  listUnits(session: WebSession): ReturnType<PlanningWorkControlRepository["listUnits"]>;
  getUnitProgress(
    session: WebSession,
    unitId: string,
  ): ReturnType<PlanningWorkControlRepository["getUnitProgress"]>;
  getCapacity(params: WorkControlCapacityParams): ReturnType<PlanningWorkControlRepository["snapshotCapacity"]>;
  listOvertimeRecommendations(
    session: WebSession,
    input: { periodStart: string; periodEnd: string },
  ): ReturnType<PlanningWorkControlRepository["listOvertimeRecommendations"]>;
  createTarget(
    session: WebSession,
    input: CreateTargetBody,
  ): ReturnType<PlanningWorkControlRepository["createTarget"]>;
  releaseSpk(
    session: WebSession,
    planningTargetId: string,
  ): ReturnType<PlanningWorkControlRepository["releaseTarget"]>;
  createOvertimeRecommendation(
    input: OvertimeRecommendationBody,
  ): ReturnType<PlanningWorkControlRepository["createOvertimeRecommendation"]>;
}

export class DefaultPlanningWorkControlService implements PlanningWorkControlService {
  constructor(
    private readonly repository: PlanningWorkControlRepository =
      new MySqlPlanningWorkControlRepository(),
  ) {}

  listUnits(session: WebSession) {
    return this.repository.listUnits({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  getUnitProgress(session: WebSession, unitId: string) {
    return this.repository.getUnitProgress({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  getCapacity(params: WorkControlCapacityParams) {
    return this.repository.snapshotCapacity(params);
  }

  listOvertimeRecommendations(
    session: WebSession,
    input: { periodStart: string; periodEnd: string },
  ) {
    return this.repository.listOvertimeRecommendations({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      ...input,
    });
  }

  createTarget(session: WebSession, input: CreateTargetBody) {
    return this.repository.createTarget({
      ...input,
      createdBy: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  releaseSpk(session: WebSession, planningTargetId: string) {
    return this.repository.releaseTarget({
      planningTargetId,
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });
  }

  createOvertimeRecommendation(input: OvertimeRecommendationBody) {
    return this.repository.createOvertimeRecommendation(input);
  }
}
