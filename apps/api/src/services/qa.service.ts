import { buildGridMeta } from "@/services/grid/paginate";
import type { WebSession } from "@/services/auth/session.service";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import type { QaGridQuery, QaInspectionRecord, QaUpdateInspectionRequest } from "@smsystem/contracts/qa";
import { MySqlQaRepository, type QaRepository } from "@/repositories/qa.repo";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";

export interface QaService {
  listPortal(session: WebSession, query: QaGridQuery): Promise<{
    data: QaInspectionRecord[];
    meta: ReturnType<typeof buildGridMeta>;
    query: QaGridQuery;
    references: Awaited<ReturnType<QaRepository["listInspections"]>>["references"];
    dashboard: Awaited<ReturnType<QaRepository["listInspections"]>>["dashboard"];
  }>;
  updateInspectionAnalysis(
    session: WebSession,
    qcId: string,
    input: QaUpdateInspectionRequest,
  ): Promise<QaInspectionRecord | null>;
}

function normalizeQuery(query: QaGridQuery): QaGridQuery {
  const allowedSorts = new Set([
    "inspectionDate",
    "unitName",
    "divisionName",
    "jobName",
    "resultStatus",
    "priorityLevel",
    "followupStatus",
  ]);
  const allowedFilters = new Set([
    "divisionId",
    "resultStatus",
    "priorityLevel",
    "followupStatus",
    "issueArea",
    "dateFrom",
    "dateTo",
  ]);

  return {
    ...query,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "inspectionDate",
    sortDirection: query.sortDirection ?? "desc",
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
  };
}

export class DefaultQaService implements QaService {
  constructor(
    private readonly repository: QaRepository = new MySqlQaRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(new MySqlAuditRepository()),
  ) {}

  async listPortal(session: WebSession, query: QaGridQuery) {
    const normalizedQuery = applyDefaultDivisionIdFilter(session, normalizeQuery(query));
    const result = await this.repository.listInspections({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalizedQuery,
    });

    return {
      data: result.rows,
      meta: buildGridMeta(result.total, normalizedQuery.page, normalizedQuery.limit),
      query: normalizedQuery,
      references: result.references,
      dashboard: result.dashboard,
    };
  }

  async updateInspectionAnalysis(session: WebSession, qcId: string, input: QaUpdateInspectionRequest) {
    const updated = await this.repository.updateInspectionAnalysis({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      qcId,
      payload: input,
    });

    if (updated) {
      await this.auditService.log({
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        action: "qa.analysis.update",
        module: "qa",
        recordId: qcId,
        newValue: updated,
      });
    }

    return updated;
  }
}
