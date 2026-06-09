import type {
  CreateServiceIntakeBody,
  CreateTargetBody,
  CriticalPathSnapshotBody,
  LabourOverrideBody,
  OvertimeRecommendationBody,
} from "@smsystem/contracts/planning-work-control";
import type {
  PlanningWorkControlRepository,
} from "@/repositories/planning-work-control.repo";
import {
  MySqlPlanningWorkControlRepository,
} from "@/repositories/planning-work-control.repo";
import {
  RedisPlanningWorkControlTempStore,
  type PlanningWorkControlTempStore,
} from "@/services/planning-work-control-temp.service";
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
  listServiceTemplates(): ReturnType<PlanningWorkControlTempStore["listServiceTemplates"]>;
  createServiceIntake(
    session: WebSession,
    input: CreateServiceIntakeBody,
  ): ReturnType<PlanningWorkControlTempStore["createServiceIntakeDraft"]>;
  saveCriticalPathSnapshot(
    session: WebSession,
    input: CriticalPathSnapshotBody,
  ): ReturnType<PlanningWorkControlTempStore["saveCriticalPathSnapshot"]>;
  getLabourOverride(unitId: string): ReturnType<PlanningWorkControlTempStore["getLabourOverride"]>;
  saveLabourOverride(
    session: WebSession,
    input: LabourOverrideBody,
  ): ReturnType<PlanningWorkControlTempStore["saveLabourOverride"]>;
}

export class DefaultPlanningWorkControlService implements PlanningWorkControlService {
  constructor(
    private readonly repository: PlanningWorkControlRepository =
      new MySqlPlanningWorkControlRepository(),
    private readonly tempStore: PlanningWorkControlTempStore =
      new RedisPlanningWorkControlTempStore(),
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

  listServiceTemplates() {
    return this.tempStore.listServiceTemplates();
  }

  createServiceIntake(session: WebSession, input: CreateServiceIntakeBody) {
    return this.tempStore.createServiceIntakeDraft({
      ...input,
      createdBy: session.user.employeeId,
    });
  }

  saveCriticalPathSnapshot(session: WebSession, input: CriticalPathSnapshotBody) {
    return this.tempStore.saveCriticalPathSnapshot({
      ...input,
      savedBy: session.user.employeeId,
    });
  }

  getLabourOverride(unitId: string) {
    return this.tempStore.getLabourOverride(unitId);
  }

  saveLabourOverride(session: WebSession, input: LabourOverrideBody) {
    return this.tempStore.saveLabourOverride({
      ...input,
      savedBy: session.user.employeeId,
    });
  }
}
