import type {
  QcFinalApproveRequest,
  QcFinalChecklist,
  QcFinalChecklistItem,
  QcGridQuery,
  QcPassRequest,
  QcQueueRecord,
  QcRejectRequest,
  QcSummary,
} from "@smsystem/contracts/qc";
import { buildGridMeta } from "@/services/grid/paginate";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlQcRepository,
  type QcRepository,
} from "@/repositories/qc.repo";
import {
  MySqlIssuesRepository,
  type IssuesRepository,
} from "@/repositories/issues.repo";
import { permissionCodes } from "@smsystem/permissions";
import type { WebSession } from "@/services/auth/session.service";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";
import {
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
} from "@/services/mobile-notification.service";

interface QcListResult {
  data: QcQueueRecord[];
  meta: ReturnType<typeof buildGridMeta>;
  query: QcGridQuery;
  references: Awaited<ReturnType<QcRepository["listReferences"]>>;
  summary: QcSummary;
}

interface QcDetailResult {
  item: QcQueueRecord;
}

interface QcMutationResult {
  qcId: string;
  coreId: string;
  resultStatus: "LOLOS" | "TIDAK_LOLOS";
  issueId: string | null;
  reworkPlanId: string | null;
}

interface QcFinalChecklistResult {
  checklist: QcFinalChecklist;
  items: QcFinalChecklistItem[];
}

function isIssueStorageUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === "ISSUES_STORAGE_NOT_READY";
}

export interface QcService {
  listQueue(session: WebSession, query: QcGridQuery): Promise<QcListResult>;
  listRework(session: WebSession, query: QcGridQuery): Promise<QcListResult>;
  listRecheck(session: WebSession, query: QcGridQuery): Promise<QcListResult>;
  findDetail(session: WebSession, coreId: string): Promise<QcDetailResult | null>;
  pass(session: WebSession, coreId: string, input: QcPassRequest): Promise<QcMutationResult>;
  reject(session: WebSession, coreId: string, input: QcRejectRequest): Promise<QcMutationResult>;
  getFinalChecklist(session: WebSession, carId: string): Promise<QcFinalChecklistResult | null>;
  approveFinalChecklist(
    session: WebSession,
    carId: string,
    input: QcFinalApproveRequest,
  ): Promise<{ carId: string; approved: true; approvedAt: string }>;
}

const QC_REFERENCE_CACHE_TTL_MS = 60_000;
const qcReferenceCache = new TtlCache<
  Awaited<ReturnType<QcRepository["listReferences"]>>
>(QC_REFERENCE_CACHE_TTL_MS);

function qcScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

function normalizeQuery(query: QcGridQuery): QcGridQuery {
  const allowedSorts = new Set([
    "waitingHours",
    "unitName",
    "divisionName",
    "panelName",
    "countdownStatus",
    "qcLevel",
    "deadlineDate",
    "latestInspectionDate",
  ]);
  const allowedFilters = new Set(["divisionId", "carId", "status", "qcLevel", "jobName", "jobdesc"]);

  return {
    ...query,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "waitingHours",
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
  };
}

function deriveQcLevel(session: WebSession): "QC_KD" | "QC_ADVISOR" | "QC_KP" | "QC_MP" | "QC_MO" {
  const permissions = session.user.permissions;

  if (
    session.user.scope.canViewAllUnits &&
    permissions.includes(permissionCodes.qcValidate)
  ) {
    return "QC_MO";
  }

  if (
    session.user.scope.managedDivisionIds.length > 0 &&
    permissions.includes(permissionCodes.qcValidate)
  ) {
    return "QC_KP";
  }

  if (session.user.scope.canViewAssignedUnits && session.user.scope.managedDivisionIds.length > 0) {
    return "QC_ADVISOR";
  }

  if (permissions.includes(permissionCodes.qcSubmit)) {
    return "QC_KD";
  }

  return "QC_MP";
}

export class DefaultQcService implements QcService {
  constructor(
    private readonly repository: QcRepository = new MySqlQcRepository(),
    private readonly issueRepository: Pick<IssuesRepository, "upsertAutoIssue" | "updateStatus"> = new MySqlIssuesRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async listQueue(session: WebSession, query: QcGridQuery): Promise<QcListResult> {
    return this.listMode("queue", session, query);
  }

  async listRework(session: WebSession, query: QcGridQuery): Promise<QcListResult> {
    return this.listMode("rework", session, query);
  }

  async listRecheck(session: WebSession, query: QcGridQuery): Promise<QcListResult> {
    return this.listMode("recheck", session, query);
  }

  async findDetail(session: WebSession, coreId: string): Promise<QcDetailResult | null> {
    const item = await this.repository.findByCoreId({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      coreId,
    });
    return item ? { item } : null;
  }

  async pass(
    session: WebSession,
    coreId: string,
    input: QcPassRequest,
  ): Promise<QcMutationResult> {
    const detail = await this.findDetail(session, coreId);
    if (!detail) {
      throw new Error("QC_NOT_FOUND");
    }

    const qcLevel = deriveQcLevel(session);
    const result = await this.repository.passInspection(
      {
        actorId: session.user.employeeId,
        qcLevel,
      },
      {
        coreId,
        payload: input,
      },
    );

    if (detail.item.linkedIssueId && detail.item.qcLastStatus === "TIDAK_LOLOS") {
      try {
        await this.issueRepository.updateStatus(detail.item.linkedIssueId, "RESOLVED", {
          actorId: session.user.employeeId,
          actorName: session.user.fullName,
          resolutionNotes: input.notes ?? "QC recheck passed.",
        });
      } catch (error) {
        if (!isIssueStorageUnavailable(error)) {
          throw error;
        }
      }
    }

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "qc.pass",
      module: "qc",
      recordId: coreId,
      oldValue: {
        qcLastStatus: detail.item.qcLastStatus,
        linkedIssueId: detail.item.linkedIssueId,
      },
      newValue: result,
    });

    try {
      const employeeIds = await (this.repository.findAssignedEmployeeIds?.(coreId) ?? Promise.resolve([]));
      const recipients = [...employeeIds, detail.item.reworkAssignedUserId].filter(
        (employeeId): employeeId is string => Boolean(employeeId),
      );
      await notifyMobileEmployees(recipients, {
        title: "QC Lolos",
        body: `QC ${qcLevel.replace("QC_", "")} menyatakan ${detail.item.unitName} - ${detail.item.panelName ?? detail.item.jobName} lolos. Pekerjaan selesai.`,
        data: { coreId, qcId: result.qcId, resultStatus: "LOLOS", qcLevel, module: "qc" },
      }, "sm_job_qc");
    } catch (error) {
      console.error("[qc] notification error:", error);
    }

    return result;
  }

  async reject(
    session: WebSession,
    coreId: string,
    input: QcRejectRequest,
  ): Promise<QcMutationResult> {
    const detail = await this.findDetail(session, coreId);
    if (!detail) {
      throw new Error("QC_NOT_FOUND");
    }

    const qcLevel = deriveQcLevel(session);
    const result = await this.repository.rejectInspection(
      {
        actorId: session.user.employeeId,
        qcLevel,
      },
      {
        coreId,
        payload: input,
      },
    );

    let issueId: string | null = null;
    try {
      issueId = await this.issueRepository.upsertAutoIssue({
        sourceType: "QC_REJECT",
        sourceRefId: result.qcId,
        carId: detail.item.carId,
        unitName: detail.item.unitName,
        customerName: detail.item.customerName,
        divisionId: detail.item.divisionId,
        divisionName: detail.item.divisionName,
        countdownId: detail.item.coreId,
        planId: result.reworkPlanId,
        qcId: result.qcId,
        issueType: "QC_REJECT",
        severity: "HIGH",
        title: `QC Reject - ${detail.item.panelName ?? detail.item.jobName}`,
        description:
          input.notes?.trim() ||
          input.reworkDescription?.trim() ||
          "QC tidak lolos dan perlu tindak lanjut.",
      });
    } catch (error) {
      if (!isIssueStorageUnavailable(error)) {
        throw error;
      }
    }

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "qc.reject",
      module: "qc",
      recordId: coreId,
      oldValue: {
        qcLastStatus: detail.item.qcLastStatus,
      },
      newValue: {
        ...result,
        issueId,
      },
    });

    try {
      const originalWorkers = await (this.repository.findAssignedEmployeeIds?.(coreId) ?? []);
      const recipients = qcLevel === "QC_KD"
        ? [input.reworkAssignedUser, ...originalWorkers]
        : await resolveEmployeeIdsByPermission(
          permissionCodes.qcSubmit,
          detail.item.divisionId ?? undefined,
        );
      await notifyMobileEmployees(recipients, {
        title: "QC Tidak Lolos",
        body: `QC ${qcLevel.replace("QC_", "")} menyatakan ${detail.item.unitName} - ${detail.item.panelName ?? detail.item.jobName} tidak lolos dan perlu diperbaiki.`,
        data: { coreId, qcId: result.qcId, resultStatus: "TIDAK_LOLOS", qcLevel, module: "qc" },
      }, "sm_job_qc");
    } catch (error) {
      console.error("[qc] notification error:", error);
    }

    return {
      ...result,
      issueId,
    };
  }

  async getFinalChecklist(
    session: WebSession,
    carId: string,
  ): Promise<QcFinalChecklistResult | null> {
    return this.repository.findFinalChecklist({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      carId,
    });
  }

  async approveFinalChecklist(
    session: WebSession,
    carId: string,
    input: QcFinalApproveRequest,
  ): Promise<{ carId: string; approved: true; approvedAt: string }> {
    const checklist = await this.getFinalChecklist(session, carId);
    if (!checklist) {
      throw new Error("FINAL_CHECKLIST_NOT_FOUND");
    }

    if (!checklist.checklist.isReadyForDelivery) {
      throw new Error("FINAL_CHECKLIST_NOT_READY");
    }

    const result = await this.repository.approveFinalChecklist(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      {
        carId,
        notes: input.notes ?? null,
      },
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "qc.final-approve",
      module: "qc",
      recordId: carId,
      newValue: {
        ...result,
        notes: input.notes ?? null,
      },
    });

    return result;
  }

  private async listMode(
    mode: "queue" | "rework" | "recheck",
    session: WebSession,
    query: QcGridQuery,
  ): Promise<QcListResult> {
    const normalized = applyDefaultDivisionIdFilter(
      session,
      normalizeQuery(query),
    );
    const [payload, references] = await Promise.all([
      mode === "queue"
        ? this.repository.listQueue({
            employeeId: session.user.employeeId,
            scope: session.user.scope,
            query: normalized,
          })
        : mode === "rework"
          ? this.repository.listRework({
              employeeId: session.user.employeeId,
              scope: session.user.scope,
              query: normalized,
            })
          : this.repository.listRecheck({
              employeeId: session.user.employeeId,
              scope: session.user.scope,
              query: normalized,
            }),
      qcReferenceCache.getOrCreate(qcScopeCacheKey(session), () =>
        this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
      ),
    ]);

    return {
      data: payload.rows,
      meta: buildGridMeta(payload.total, normalized.page, normalized.limit),
      query: normalized,
      references,
      summary: payload.summary,
    };
  }
}
