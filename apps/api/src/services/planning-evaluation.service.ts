import type {
  PlanningEvaluationDivisionRecord,
  PlanningEvaluationMode,
  PlanningEvaluationSpan,
  PlanningEvaluationSummary,
} from "@smsystem/contracts/planning-evaluation";
import { TtlCache } from "@/lib/ttl-cache";
import {
  MySqlPlanningEvaluationRepository,
  type PlanningEvaluationRepository,
} from "@/repositories/planning-evaluation.repo";
import type { WebSession } from "@/services/auth/session.service";

export interface PlanningEvaluationResult {
  date: string;
  dateTo: string;
  span: PlanningEvaluationSpan;
  mode: PlanningEvaluationMode;
  summary: PlanningEvaluationSummary;
  divisions: PlanningEvaluationDivisionRecord[];
}

export interface PlanningEvaluationService {
  getEvaluation(
    session: WebSession,
    input: {
      date: string;
      dateTo: string;
      span: PlanningEvaluationSpan;
      mode: PlanningEvaluationMode;
    },
  ): Promise<PlanningEvaluationResult>;
}

const PLANNING_EVALUATION_CACHE_TTL_MS = 5_000;
const planningEvaluationCache = new TtlCache<PlanningEvaluationResult>(
  PLANNING_EVALUATION_CACHE_TTL_MS,
);

function buildPlanningEvaluationCacheKey(
  session: WebSession,
  input: {
    date: string;
    dateTo: string;
    span: PlanningEvaluationSpan;
    mode: PlanningEvaluationMode;
  },
): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
    input,
  });
}

export class DefaultPlanningEvaluationService implements PlanningEvaluationService {
  constructor(
    private readonly repository: PlanningEvaluationRepository = new MySqlPlanningEvaluationRepository(),
  ) {}

  async getEvaluation(
    session: WebSession,
    input: {
      date: string;
      dateTo: string;
      span: PlanningEvaluationSpan;
      mode: PlanningEvaluationMode;
    },
  ): Promise<PlanningEvaluationResult> {
    return planningEvaluationCache.getOrCreate(
      buildPlanningEvaluationCacheKey(session, input),
      async () => {
        const rows = await this.repository.listDivisionAggregate({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
          date: input.date,
          dateTo: input.dateTo,
          mode: input.mode,
        });

        const divisions: PlanningEvaluationDivisionRecord[] = rows.map((row) => ({
          divisionId: row.divisionId,
          divisionName: row.divisionName,
          baselineHours: row.baselineHours,
          revisionHours: row.revisionHours,
          actualHours: row.actualHours,
          revisionDeltaHours: Number((row.revisionHours - row.baselineHours).toFixed(2)),
          actualDeltaHours: Number((row.actualHours - row.revisionHours).toFixed(2)),
          baselineUnitCount: row.baselineUnitCount,
          revisionJobCount: row.revisionJobCount,
          actualUnitCount: row.actualUnitCount,
        }));

        const summary: PlanningEvaluationSummary = {
          baselineHours: Number(divisions.reduce((sum, row) => sum + row.baselineHours, 0).toFixed(2)),
          revisionHours: Number(divisions.reduce((sum, row) => sum + row.revisionHours, 0).toFixed(2)),
          actualHours: Number(divisions.reduce((sum, row) => sum + row.actualHours, 0).toFixed(2)),
          revisionDeltaHours: Number(
            divisions.reduce((sum, row) => sum + row.revisionDeltaHours, 0).toFixed(2),
          ),
          actualDeltaHours: Number(
            divisions.reduce((sum, row) => sum + row.actualDeltaHours, 0).toFixed(2),
          ),
        };

        return {
          date: input.date,
          dateTo: input.dateTo,
          span: input.span,
          mode: input.mode,
          summary,
          divisions,
        };
      },
    );
  }
}
